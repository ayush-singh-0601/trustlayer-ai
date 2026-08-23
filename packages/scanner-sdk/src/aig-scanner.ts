import { z } from "zod";
import type {
  ModelConfiguration,
  ScannerAdapter,
  ScannerHandle,
  ScannerRequest,
  ScannerResult,
  ScannerStatus,
} from "./types.js";

const envelopeSchema = z.object({
  status: z.number(),
  message: z.string().optional(),
  data: z.unknown(),
});

const submitDataSchema = z.object({ session_id: z.string().min(1) });
const statusDataSchema = z.object({
  session_id: z.string().min(1),
  status: z.enum(["pending", "running", "completed", "failed"]),
  title: z.string().optional(),
  created_at: z.number().optional(),
  updated_at: z.number().optional(),
  log: z.string().optional(),
});

export interface AigScannerOptions {
  baseUrl: string;
  version: string;
  headers?: Readonly<Record<string, string>>;
  fetch?: typeof globalThis.fetch;
}

export class ScannerProtocolError extends Error {
  constructor(message: string, readonly causeData?: unknown) {
    super(message);
    this.name = "ScannerProtocolError";
  }
}

export class ScannerCapabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScannerCapabilityError";
  }
}

export class AigScanner implements ScannerAdapter {
  readonly name = "aig";
  readonly #baseUrl: string;
  readonly #version: string;
  readonly #headers: Readonly<Record<string, string>>;
  readonly #fetch: typeof globalThis.fetch;

  constructor(options: AigScannerOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/$/, "");
    this.#version = options.version;
    this.#headers = options.headers ?? {};
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  supports(): boolean {
    return true;
  }

  async submit(request: ScannerRequest): Promise<ScannerHandle> {
    const response = await this.#request("/api/v1/app/taskapi/tasks", {
      method: "POST",
      body: JSON.stringify(toAigTask(request)),
    });
    const data = submitDataSchema.parse(response.data);
    return { scanner: this.name, externalId: data.session_id, scanType: request.scanType };
  }

  async status(handle: ScannerHandle): Promise<ScannerStatus> {
    this.#assertHandle(handle);
    const response = await this.#request(`/api/v1/app/taskapi/status/${encodeURIComponent(handle.externalId)}`);
    const data = statusDataSchema.parse(response.data);
    const status: ScannerStatus = { state: data.status, externalId: data.session_id };
    if (data.title !== undefined) status.title = data.title;
    if (data.created_at !== undefined) status.createdAt = new Date(data.created_at);
    if (data.updated_at !== undefined) status.updatedAt = new Date(data.updated_at);
    if (data.log !== undefined) status.redactedLog = redactSecrets(data.log);
    return status;
  }

  async result(handle: ScannerHandle): Promise<ScannerResult> {
    this.#assertHandle(handle);
    const response = await this.#request(`/api/v1/app/taskapi/result/${encodeURIComponent(handle.externalId)}`);
    return {
      scanner: this.name,
      scannerVersion: this.#version,
      externalId: handle.externalId,
      scanType: handle.scanType,
      raw: response.data,
    };
  }

  async cancel(): Promise<void> {
    throw new ScannerCapabilityError("The pinned AIG task API does not expose task cancellation");
  }

  async #request(path: string, init: RequestInit = {}): Promise<z.infer<typeof envelopeSchema>> {
    const response = await this.#fetch(`${this.#baseUrl}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...this.#headers,
        ...init.headers,
      },
    });
    if (!response.ok) throw new ScannerProtocolError(`AIG returned HTTP ${response.status}`);
    const parsed = envelopeSchema.safeParse(await response.json());
    if (!parsed.success) throw new ScannerProtocolError("AIG returned an invalid response envelope", parsed.error);
    if (parsed.data.status !== 0) {
      throw new ScannerProtocolError(parsed.data.message ?? "AIG reported an unsuccessful operation", parsed.data.data);
    }
    return parsed.data;
  }

  #assertHandle(handle: ScannerHandle): void {
    if (handle.scanner !== this.name) throw new ScannerProtocolError(`Handle belongs to scanner ${handle.scanner}`);
  }
}

function toAigTask(request: ScannerRequest): { type: string; content: Record<string, unknown> } {
  switch (request.scanType) {
    case "agent":
      return {
        type: "agent_scan",
        content: {
          agent_config: request.agentConfig,
          ...(request.evaluationModel ? { eval_model: toAigModel(request.evaluationModel) } : {}),
          ...(request.prompt ? { prompt: request.prompt } : {}),
          language: request.language ?? "en",
        },
      };
    case "infrastructure":
      return {
        type: "ai_infra_scan",
        content: {
          target: request.targets,
          ...(request.headers ? { headers: request.headers } : {}),
          timeout: request.timeoutSeconds ?? 30,
          ...(request.model ? { model: toAigModel(request.model) } : {}),
        },
      };
    case "mcp":
      return {
        type: "mcp_scan",
        content: {
          prompt: request.prompt ?? request.targetUrl,
          ...(request.headers ? { headers: request.headers } : {}),
          ...(request.model ? { model: toAigModel(request.model) } : {}),
          thread: request.concurrency ?? 4,
          language: "en",
        },
      };
    case "model":
      return {
        type: "model_redteam_report",
        content: {
          model: request.targets.map(toAigModel),
          eval_model: toAigModel(request.evaluationModel),
          dataset: {
            dataFile: request.datasets,
            numPrompts: request.promptCount,
            randomSeed: request.randomSeed,
          },
          ...(request.techniques ? { techniques: request.techniques } : {}),
        },
      };
  }
}

function toAigModel(model: ModelConfiguration): Record<string, string> {
  return {
    model: model.model,
    ...(model.token ? { token: model.token } : {}),
    ...(model.baseUrl ? { base_url: model.baseUrl } : {}),
  };
}

function redactSecrets(log: string): string {
  return log
    .replace(/(authorization\s*[:=]\s*(?:bearer\s+)?)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/((?:api[_-]?key|token|secret)\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED]");
}
