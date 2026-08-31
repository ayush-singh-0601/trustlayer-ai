import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { scanJobSchema, type ScannerAdapter, type ScannerHandle, type ScannerRequest } from "@trustlayer/scanner-sdk";
import { executeAndReport } from "./runner.js";

const job = scanJobSchema.parse({
  jobId: randomUUID(),
  organizationId: randomUUID(),
  assessmentId: randomUUID(),
  scanId: randomUUID(),
  assetName: "Support Agent",
  targetsToValidate: ["https://agent.example.com"],
  dataCategories: ["customer_data"],
  permissions: ["read"],
  blastRadius: "high",
  scanType: "agent",
  secretBrokerUrl: "http://api.internal/v1/internal/scans/secret",
  secretToken: "s".repeat(32),
  callbackUrl: "http://api.internal/v1/internal/scans/callback",
  callbackToken: "c".repeat(32),
  timeoutMs: 10_000,
  pollIntervalMs: 100,
});

class FixtureScanner implements ScannerAdapter {
  readonly name = "aig";
  #poll = 0;
  supports() {
    return true;
  }
  async submit(request: ScannerRequest): Promise<ScannerHandle> {
    return { scanner: this.name, externalId: "session-1", scanType: request.scanType };
  }
  async status() {
    this.#poll += 1;
    return { state: this.#poll > 1 ? "completed" : "running", externalId: "session-1" } as const;
  }
  async result(handle: ScannerHandle) {
    return {
      scanner: this.name,
      scannerVersion: "fixture",
      externalId: handle.externalId,
      scanType: handle.scanType,
      raw: {
        api_key: "must-not-leak",
        findings: [{ title: "Customer data leakage", severity: "high", description: "Cross-account result" }],
      },
    };
  }
  async cancel() {}
}

describe("isolated AIG worker", () => {
  it("revalidates targets, normalizes findings, redacts evidence, and reports once", async () => {
    const callback = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const outcome = await executeAndReport(job, {
      scanner: new FixtureScanner(),
      resolveHost: async () => [{ address: "93.184.216.34", family: 4 }],
      fetch: callback,
      loadRequest: async () => ({ scanType: "agent", agentConfig: "provider: custom" }),
      wait: async () => undefined,
    });

    expect(outcome.state).toBe("succeeded");
    expect(outcome.findings).toHaveLength(1);
    expect(outcome.redactedRawResult).toMatchObject({ api_key: "[REDACTED]" });
    expect(callback).toHaveBeenCalledOnce();
    expect(JSON.stringify(callback.mock.calls[0]?.[1]?.body)).not.toContain("must-not-leak");
  });

  it("reports target-validation failures without submitting the scan", async () => {
    const scanner = new FixtureScanner();
    const submit = vi.spyOn(scanner, "submit");
    const callback = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const outcome = await executeAndReport(job, {
      scanner,
      resolveHost: async () => [{ address: "169.254.169.254", family: 4 }],
      fetch: callback,
      loadRequest: async () => ({ scanType: "agent", agentConfig: "provider: custom" }),
    });

    expect(outcome).toMatchObject({ state: "failed", errorCode: "scanner_failure" });
    expect(submit).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledOnce();
  });

  it("rejects a brokered request that widens the assigned target set", async () => {
    const infrastructureJob = scanJobSchema.parse({ ...job, scanType: "infrastructure" });
    const scanner = new FixtureScanner();
    const submit = vi.spyOn(scanner, "submit");
    const callback = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status: 204 }));

    const outcome = await executeAndReport(infrastructureJob, {
      scanner,
      resolveHost: async () => [{ address: "93.184.216.34", family: 4 }],
      fetch: callback,
      loadRequest: async () => ({ scanType: "infrastructure", targets: ["https://attacker.example.com"] }),
    });

    expect(outcome).toMatchObject({ state: "failed", errorCode: "scanner_failure" });
    expect(outcome.redactedError).toContain("not assigned");
    expect(submit).not.toHaveBeenCalled();
  });
});
