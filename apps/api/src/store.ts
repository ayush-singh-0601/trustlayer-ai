import { randomUUID } from "node:crypto";
import type {
  Asset,
  Assessment,
  CreateAssetInput,
  CreateAssessmentInput,
  NormalizedFinding,
  ScanAuthorizationInput,
  TrustScoreResult,
} from "@trustlayer/contracts";
import { assetSchema, assessmentSchema, createAssetSchema } from "@trustlayer/contracts";

export interface StoredAuthorization extends ScanAuthorizationInput {
  id: string;
  organizationId: string;
  authorizedBy: string;
  authorizedAt: string;
  revokedAt: string | null;
}

export interface DashboardSummary {
  overallTrustScore: number | null;
  totalAssets: number;
  byStatus: Record<string, number>;
  urgentAssets: Asset[];
}

export interface FinalizeAssessmentInput {
  state: "succeeded" | "partial_failed" | "failed";
  result: TrustScoreResult;
  findings: NormalizedFinding[];
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super("The Idempotency-Key was already used for a different assessment request");
    this.name = "IdempotencyConflictError";
  }
}

export interface TrustLayerStore {
  listAssets(organizationId: string): Promise<Asset[]>;
  getAsset(organizationId: string, assetId: string): Promise<Asset | null>;
  createAsset(organizationId: string, input: CreateAssetInput): Promise<Asset>;
  createAuthorization(
    organizationId: string,
    userId: string,
    input: ScanAuthorizationInput,
  ): Promise<StoredAuthorization>;
  getAuthorization(organizationId: string, authorizationId: string): Promise<StoredAuthorization | null>;
  createAssessment(
    organizationId: string,
    userId: string,
    input: CreateAssessmentInput,
    idempotencyKey: string,
  ): Promise<Assessment>;
  getAssessment(organizationId: string, assessmentId: string): Promise<Assessment | null>;
  finalizeAssessment(
    organizationId: string,
    assessmentId: string,
    input: FinalizeAssessmentInput,
  ): Promise<Assessment>;
  dashboard(organizationId: string): Promise<DashboardSummary>;
}

export class InMemoryTrustLayerStore implements TrustLayerStore {
  readonly #assets = new Map<string, Asset>();
  readonly #authorizations = new Map<string, StoredAuthorization>();
  readonly #assessments = new Map<string, Assessment>();
  readonly #idempotency = new Map<string, string>();

  async listAssets(organizationId: string): Promise<Asset[]> {
    return [...this.#assets.values()].filter((asset) => asset.organizationId === organizationId);
  }

  async getAsset(organizationId: string, assetId: string): Promise<Asset | null> {
    const asset = this.#assets.get(assetId);
    return asset?.organizationId === organizationId ? asset : null;
  }

  async createAsset(organizationId: string, input: CreateAssetInput): Promise<Asset> {
    const parsed = createAssetSchema.parse(input);
    const now = new Date().toISOString();
    const asset = assetSchema.parse({
      ...parsed,
      id: randomUUID(),
      organizationId,
      status: "draft",
      trustScore: null,
      createdAt: now,
      updatedAt: now,
      lastAssessedAt: null,
    });
    this.#assets.set(asset.id, asset);
    return asset;
  }

  async createAuthorization(
    organizationId: string,
    userId: string,
    input: ScanAuthorizationInput,
  ): Promise<StoredAuthorization> {
    const authorization: StoredAuthorization = {
      ...input,
      id: randomUUID(),
      organizationId,
      authorizedBy: userId,
      authorizedAt: new Date().toISOString(),
      revokedAt: null,
    };
    this.#authorizations.set(authorization.id, authorization);
    return authorization;
  }

  async getAuthorization(organizationId: string, authorizationId: string): Promise<StoredAuthorization | null> {
    const authorization = this.#authorizations.get(authorizationId);
    return authorization?.organizationId === organizationId ? authorization : null;
  }

  async createAssessment(
    organizationId: string,
    _userId: string,
    input: CreateAssessmentInput,
    idempotencyKey: string,
  ): Promise<Assessment> {
    const key = `${organizationId}:${idempotencyKey}`;
    const existingId = this.#idempotency.get(key);
    if (existingId) {
      const existing = assessmentSchema.parse(this.#assessments.get(existingId));
      assertSameAssessmentRequest(existing, input);
      return existing;
    }

    const assessment = assessmentSchema.parse({
      ...input,
      id: randomUUID(),
      organizationId,
      state: "queued",
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      result: null,
    });
    this.#assessments.set(assessment.id, assessment);
    this.#idempotency.set(key, assessment.id);
    return assessment;
  }

  async getAssessment(organizationId: string, assessmentId: string): Promise<Assessment | null> {
    const assessment = this.#assessments.get(assessmentId);
    return assessment?.organizationId === organizationId ? assessment : null;
  }

  async finalizeAssessment(
    organizationId: string,
    assessmentId: string,
    input: FinalizeAssessmentInput,
  ): Promise<Assessment> {
    const existing = await this.getAssessment(organizationId, assessmentId);
    if (!existing) throw new Error("Assessment not found");
    const completedAt = new Date().toISOString();
    const assessment = assessmentSchema.parse({
      ...existing,
      state: input.state,
      startedAt: existing.startedAt ?? existing.createdAt,
      completedAt,
      result: input.result,
    });
    this.#assessments.set(assessment.id, assessment);
    const asset = this.#assets.get(assessment.assetId);
    if (asset?.organizationId === organizationId) {
      this.#assets.set(asset.id, {
        ...asset,
        trustScore: input.result.score,
        status: statusForDecision(input.result.decision),
        lastAssessedAt: completedAt,
        updatedAt: completedAt,
      });
    }
    return assessment;
  }

  async dashboard(organizationId: string): Promise<DashboardSummary> {
    const assets = await this.listAssets(organizationId);
    const scored = assets.filter((asset) => asset.trustScore !== null);
    const overallTrustScore =
      scored.length === 0
        ? null
        : Math.round(scored.reduce((total, asset) => total + (asset.trustScore ?? 0), 0) / scored.length);
    const byStatus = assets.reduce<Record<string, number>>((counts, asset) => {
      counts[asset.status] = (counts[asset.status] ?? 0) + 1;
      return counts;
    }, {});
    return {
      overallTrustScore,
      totalAssets: assets.length,
      byStatus,
      urgentAssets: assets.filter((asset) => asset.status === "blocked" || asset.status === "restricted"),
    };
  }
}

export function assertSameAssessmentRequest(existing: Assessment, input: CreateAssessmentInput): void {
  const existingIdentity = assessmentRequestIdentity(existing);
  const inputIdentity = assessmentRequestIdentity(input);
  if (existingIdentity !== inputIdentity) throw new IdempotencyConflictError();
}

function assessmentRequestIdentity(input: CreateAssessmentInput): string {
  return JSON.stringify({
    assetId: input.assetId,
    authorizationId: input.authorizationId,
    reason: input.reason,
    requestedScans: [...input.requestedScans].sort(),
  });
}

function statusForDecision(decision: TrustScoreResult["decision"]): Asset["status"] {
  if (decision === "approved") return "approved";
  if (decision === "approved_with_restrictions") return "restricted";
  if (decision === "security_review_required") return "under_review";
  if (decision === "blocked") return "blocked";
  return "draft";
}
