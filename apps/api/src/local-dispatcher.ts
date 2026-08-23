import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import type { ScanJob } from "@trustlayer/scanner-sdk";
import type { ScanDispatcher } from "./coordinator.js";

export interface LocalScanDispatcherOptions {
  workerPath: string;
  aigBaseUrl: string;
  aigVersion: string;
  cwd: string;
}

export class LocalScanDispatcher implements ScanDispatcher {
  readonly #children = new Set<ChildProcess>();

  constructor(private readonly options: LocalScanDispatcherOptions) {
    if (!existsSync(options.workerPath)) {
      throw new Error(`Local scan worker is not built: ${options.workerPath}`);
    }
  }

  async dispatch(job: ScanJob): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, [this.options.workerPath], {
        cwd: this.options.cwd,
        windowsHide: true,
        stdio: ["ignore", "inherit", "inherit"],
        env: {
          ...process.env,
          SCAN_JOB_JSON: JSON.stringify(job),
          AIG_BASE_URL: this.options.aigBaseUrl,
          AIG_VERSION: this.options.aigVersion,
        },
      });
      this.#children.add(child);
      child.once("spawn", resolve);
      child.once("error", (error) => {
        this.#children.delete(child);
        reject(error);
      });
      child.once("exit", (code) => {
        this.#children.delete(child);
        if (code && code !== 0) console.error(`Local scan worker exited with code ${code}`);
      });
    });
  }

  close(): void {
    for (const child of this.#children) child.kill();
    this.#children.clear();
  }
}
