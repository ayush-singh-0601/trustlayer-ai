import { createHash, randomBytes, randomUUID } from "node:crypto";
import type {
  Asset,
  Assessment,
  BusinessContext,
  RiskCategory,
  ScanType,
} from "@trustlayer/contracts";
import { analyzeExcessPermissions, calculateTrustScore } from "@trustlayer/risk-engine";
import {
  scanJobSchema,
  workerOutcomeSchema,
  type ScanJob,
  type ScannerRequest,
  type WorkerOutcomeContract,
} from "@trustlayer/scanner-sdk";
import { applicableRiskCategories } from "./compatibility.js";
import type { TrustLayerStore } from "./store.js";

export interface ScanDispatcher {
  /** Dispatch must be idempotent for a stable jobId. */
  dispatch(job: ScanJob): Promise<void>;
}

export interface AssessmentOrchestrator {
  start(assessment: Assessment, asset: Asset, authorizedTargets: readonly string[]): Promise<ScanJob[]>;
  consumeSecret(bearerToken: string, jobId: string, scanId: string): Promise<ScannerRequest | null>;
  receiveOutcome(
    bearerToken: string,
    untrustedOutcome: unknown,
  ): Promise<"accepted" | "duplicate" | "rejected">;
}

export interface ScanRequestProvider {
  requestFor(asset: Asset, scanType: ScanType): Promise<ScannerRequest>;
}

export class ScanConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScanConfigurationError";
  }
}

export class PublicEndpointRequestProvider implements ScanRequestProvider {
  async requestFor(asset: Asset, scanType: ScanType): Promise<ScannerRequest> {
    if (scanType === "infrastructure") {
      return { scanType, targets: [asset.targetUrl], timeoutSeconds: 30 };
    }
    if (scanType === "mcp") return { scanType, targetUrl: asset.targetUrl, concurrency: 4 };
    throw new ScanConfigurationError(`${scanType} scanning requires an encrypted asset credential configuration`);
  }
}

interface IssuedJob {
  job: ScanJob;
  request: ScannerRequest;
  secretConsumed: boolean;
  callbackTokenHash: string;
}

interface CoordinatedAssessment {
  assessment: Assessment;
  asset: Asset;
  context: BusinessContext;
  jobs: Map<string, IssuedJob>;
  outcomes: Map<string, WorkerOutcomeContract>;
  finalized: boolean;
}

export class AssessmentCoordinator implements AssessmentOrchestrator {
  readonly #assessments = new Map<string, CoordinatedAssessment>();
  readonly #secretTokens = new Map<string, { assessmentId: string; scanId: string }>();
  readonly #callbackTokens = new Map<string, { assessmentId: string; scanId: string }>();

  constructor(
    private readonly store: TrustLayerStore,
    private readonly dispatcher: ScanDispatcher,
    private readonly requests: ScanRequestProvider,
    private readonly internalApiBaseUrl: string,
  ) {}

  async start(assessment: Assessment, asset: Asset, authorizedTargets: readonly string[]): Promise<ScanJob[]> {
    const existing = this.#assessments.get(assessment.id);
    if (existing) return [...existing.jobs.values()].map(({ job }) => job);

    const context = businessContext(asset);
    const state: CoordinatedAssessment = {
      assessment,
      asset,
      context,
      jobs: new Map(),
      outcomes: new Map(),
      finalized: false,
    };
    this.#assessments.set(assessment.id, state);

    for (const scanType of assessment.requestedScans) {
      const request = await this.requests.requestFor(asset, scanType);
      const scanId = randomUUID();
      const jobId = randomUUID();
      const secretToken = token();
      const callbackToken = token();
      const job = scanJobSchema.parse({
        jobId,
        organizationId: assessment.organizationId,
        assessmentId: assessment.id,
        scanId,
        assetName: asset.name,
        targetsToValidate: [...authorizedTargets],
        dataCategories: context.dataCategories,
        permissions: context.currentPermissions,
        blastRadius: context.blastRadius,
        scanType,
        secretBrokerUrl: `${this.internalApiBaseUrl}/v1/internal/scans/secret`,
        secretToken,
        callbackUrl: `${this.internalApiBaseUrl}/v1/internal/scans/callback`,
        callbackToken,
      });
      state.jobs.set(scanId, {
        job,
        request,
        secretConsumed: false,
        callbackTokenHash: hash(callbackToken),
      });
      this.#secretTokens.set(hash(secretToken), { assessmentId: assessment.id, scanId });
      this.#callbackTokens.set(hash(callbackToken), { assessmentId: assessment.id, scanId });
    }

    const jobs = [...state.jobs.values()].map(({ job }) => job);
    await Promise.all(jobs.map((job) => this.dispatcher.dispatch(job)));
    return jobs;
  }

  async consumeSecret(bearerToken: string, jobId: string, scanId: string): Promise<ScannerRequest | null> {
    const tokenHash = hash(bearerToken);
    const reference = this.#secretTokens.get(tokenHash);
    if (!reference || reference.scanId !== scanId) return null;
    const state = this.#assessments.get(reference.assessmentId);
    const issued = state?.jobs.get(scanId);
    if (!issued || issued.job.jobId !== jobId || issued.secretConsumed) return null;
    issued.secretConsumed = true;
    this.#secretTokens.delete(tokenHash);
    return issued.request;
  }

  async receiveOutcome(bearerToken: string, untrustedOutcome: unknown): Promise<"accepted" | "duplicate" | "rejected"> {
    const parsed = workerOutcomeSchema.safeParse(untrustedOutcome);
    if (!parsed.success) return "rejected";
    const outcome = parsed.data;
    const reference = this.#callbackTokens.get(hash(bearerToken));
    if (!reference || reference.scanId !== outcome.scanId || reference.assessmentId !== outcome.assessmentId) {
      const existing = this.#assessments.get(outcome.assessmentId)?.outcomes.get(outcome.scanId);
      return existing?.jobId === outcome.jobId ? "duplicate" : "rejected";
    }
    const state = this.#assessments.get(reference.assessmentId);
    const issued = state?.jobs.get(reference.scanId);
    if (!state || !issued || issued.job.jobId !== outcome.jobId || issued.callbackTokenHash !== hash(bearerToken)) {
      return "rejected";
    }
    if (state.outcomes.has(outcome.scanId)) return "duplicate";

    state.outcomes.set(outcome.scanId, outcome);
    this.#callbackTokens.delete(hash(bearerToken));
    if (state.outcomes.size === state.jobs.size) await this.#finalize(state);
    return "accepted";
  }

  async #finalize(state: CoordinatedAssessment): Promise<void> {
    if (state.finalized) return;
    state.finalized = true;
    const outcomes = [...state.outcomes.values()];
    const successful = outcomes.filter((outcome) => outcome.state === "succeeded");
    const permissionFindings = analyzeExcessPermissions(state.context);
    const findings = [...successful.flatMap((outcome) => outcome.findings), ...permissionFindings];
    const assessedCategories = new Set<RiskCategory>(["permissions"]);
    for (const outcome of successful) {
      const job = state.jobs.get(outcome.scanId)?.job;
      if (!job) continue;
      for (const category of categoriesForScan(job.scanType)) assessedCategories.add(category);
    }
    const result = calculateTrustScore({
      findings,
      context: state.context,
      applicableCategories: applicableRiskCategories(state.asset.type),
      assessedCategories: [...assessedCategories],
      assessmentComplete: successful.length === outcomes.length,
      monitoringActive: false,
    });
    const assessmentState =
      successful.length === outcomes.length ? "succeeded" : successful.length === 0 ? "failed" : "partial_failed";
    await this.store.finalizeAssessment(state.assessment.organizationId, state.assessment.id, {
      state: assessmentState,
      result,
      findings,
    });
  }
}

export class RecordingScanDispatcher implements ScanDispatcher {
  readonly jobs: ScanJob[] = [];
  async dispatch(job: ScanJob): Promise<void> {
    this.jobs.push(job);
  }
}

export function businessContext(asset: Asset): BusinessContext {
  const currentPermissions = [...new Set(asset.integrations.flatMap(({ permissions }) => permissions.current))];
  const requiredPermissions = [...new Set(asset.integrations.flatMap(({ permissions }) => permissions.required))];
  const dataCategories = [...new Set([...asset.dataCategories, ...asset.integrations.flatMap(({ dataCategories }) => dataCategories)])];
  const exposure = Math.max(0, ...asset.integrations.map(({ exposureEstimate }) => exposureEstimate ?? 0));
  const privileged = currentPermissions.some((permission) => ["write", "send", "delete", "execute", "bulk_export"].includes(permission));
  const sensitive = dataCategories.some((category) => category !== "public_information");
  const blastRadius =
    (asset.criticality === "critical" && privileged) || exposure >= 10_000
      ? "critical"
      : (sensitive && privileged) || exposure >= 1_000 || asset.criticality === "high"
        ? "high"
        : asset.integrations.length > 0
          ? "medium"
          : "low";
  return { criticality: asset.criticality, dataCategories, currentPermissions, requiredPermissions, blastRadius };
}

export function categoriesForScan(scanType: ScanType): RiskCategory[] {
  if (scanType === "infrastructure") return ["infrastructure"];
  if (scanType === "model") return ["model_security", "data_privacy"];
  if (scanType === "mcp") return ["agent_behavior", "permissions", "data_privacy"];
  return ["agent_behavior", "data_privacy"];
}

export function token(): string {
  return randomBytes(32).toString("base64url");
}

export function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
