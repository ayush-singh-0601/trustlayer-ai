import type { NormalizedFinding } from "@trustlayer/contracts";
import {
  normalizeAigResult,
  redactDeep,
  scannerRequestSchema,
  type ScannerAdapter,
  type ScannerRequest,
  type ScannerResult,
  type ScannerStatus,
  type ScanJob,
  validateLocalScanTarget,
} from "@trustlayer/scanner-sdk";
import type { HostResolver } from "@trustlayer/scanner-sdk";

export interface WorkerOutcome {
  jobId: string;
  organizationId: string;
  assessmentId: string;
  scanId: string;
  state: "succeeded" | "failed";
  scannerHandle?: string;
  findings: NormalizedFinding[];
  redactedRawResult?: unknown;
  errorCode?: string;
  redactedError?: string;
}

export interface RunJobDependencies {
  scanner: ScannerAdapter;
  resolveHost?: HostResolver;
  fetch?: typeof globalThis.fetch;
  wait?: (milliseconds: number) => Promise<void>;
  now?: () => number;
  loadRequest?: (job: ScanJob) => Promise<ScannerRequest>;
}

export async function executeAndReport(job: ScanJob, dependencies: RunJobDependencies): Promise<WorkerOutcome> {
  let outcome: WorkerOutcome;
  try {
    outcome = await execute(job, dependencies);
  } catch (error) {
    outcome = {
      jobId: job.jobId,
      organizationId: job.organizationId,
      assessmentId: job.assessmentId,
      scanId: job.scanId,
      state: "failed",
      findings: [],
      errorCode: error instanceof WorkerTimeoutError ? "scanner_timeout" : "scanner_failure",
      redactedError: redactError(error),
    };
  }
  await report(job, outcome, dependencies.fetch ?? globalThis.fetch);
  return outcome;
}

async function execute(job: ScanJob, dependencies: RunJobDependencies): Promise<WorkerOutcome> {
  for (const target of job.targetsToValidate) await validateLocalScanTarget(target, dependencies.resolveHost);
  const request = dependencies.loadRequest
    ? await dependencies.loadRequest(job)
    : await loadBrokeredRequest(job, dependencies.fetch ?? globalThis.fetch);
  if (request.scanType !== job.scanType) throw new Error("Brokered request does not match the assigned scan type");
  const handle = await dependencies.scanner.submit(request);
  const start = (dependencies.now ?? Date.now)();
  const wait = dependencies.wait ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  let status: ScannerStatus;

  while (true) {
    status = await dependencies.scanner.status(handle);
    if (status.state === "completed") break;
    if (status.state === "failed") throw new Error("Scanner reported task failure");
    if ((dependencies.now ?? Date.now)() - start >= job.timeoutMs) throw new WorkerTimeoutError();
    await wait(job.pollIntervalMs);
  }

  const result: ScannerResult = await dependencies.scanner.result(handle);
  const findings = normalizeAigResult(result, {
    assetName: job.assetName,
    dataCategories: job.dataCategories,
    permissions: job.permissions,
    blastRadius: job.blastRadius,
  });
  return {
    jobId: job.jobId,
    organizationId: job.organizationId,
    assessmentId: job.assessmentId,
    scanId: job.scanId,
    state: "succeeded",
    scannerHandle: handle.externalId,
    findings,
    redactedRawResult: redactDeep(result.raw),
  };
}

async function report(job: ScanJob, outcome: WorkerOutcome, fetch: typeof globalThis.fetch): Promise<void> {
  const response = await fetch(job.callbackUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${job.callbackToken}`,
      "content-type": "application/json",
      "idempotency-key": job.jobId,
    },
    body: JSON.stringify(outcome),
  });
  if (!response.ok) throw new Error(`Coordinator callback failed with HTTP ${response.status}`);
}

async function loadBrokeredRequest(job: ScanJob, fetch: typeof globalThis.fetch): Promise<ScannerRequest> {
  const response = await fetch(job.secretBrokerUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${job.secretToken}`,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ jobId: job.jobId, scanId: job.scanId }),
  });
  if (!response.ok) throw new Error(`Secret broker returned HTTP ${response.status}`);
  return scannerRequestSchema.parse(await response.json()) as ScannerRequest;
}

function redactError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown worker failure";
  return String(redactDeep(message)).slice(0, 2_000);
}

class WorkerTimeoutError extends Error {
  constructor() {
    super("Scanner exceeded the configured execution timeout");
    this.name = "WorkerTimeoutError";
  }
}
