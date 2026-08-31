import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  assessmentSchema,
  assetSchema,
  createAssetSchema,
  type Asset,
  type Assessment,
  type CreateAssetInput,
  type CreateAssessmentInput,
  type ScanAuthorizationInput,
  type TrustScoreResult,
} from "@trustlayer/contracts";
import type {
  DashboardSummary,
  FinalizeAssessmentInput,
  StoredAuthorization,
  TrustLayerStore,
} from "./store.js";
import { assertSameAssessmentRequest } from "./store.js";

interface JsonRow {
  payload: string;
}

export class SqliteTrustLayerStore implements TrustLayerStore {
  readonly #database: DatabaseSync;

  constructor(databasePath: string) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.#database = new DatabaseSync(databasePath);
    this.#database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA synchronous = NORMAL;

      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS assets_organization_idx ON assets (organization_id);

      CREATE TABLE IF NOT EXISTS scan_authorizations (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS authorizations_organization_idx
        ON scan_authorizations (organization_id, asset_id);

      CREATE TABLE IF NOT EXISTS assessments (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        payload TEXT NOT NULL,
        findings TEXT NOT NULL DEFAULT '[]',
        UNIQUE (organization_id, idempotency_key),
        FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS assessments_organization_idx
        ON assessments (organization_id, asset_id);
    `);
  }

  async listAssets(organizationId: string): Promise<Asset[]> {
    const rows = this.#database
      .prepare("SELECT payload FROM assets WHERE organization_id = ? ORDER BY rowid DESC")
      .all(organizationId) as unknown as JsonRow[];
    return rows.map(({ payload }) => assetSchema.parse(JSON.parse(payload)));
  }

  async getAsset(organizationId: string, assetId: string): Promise<Asset | null> {
    const row = this.#database
      .prepare("SELECT payload FROM assets WHERE organization_id = ? AND id = ?")
      .get(organizationId, assetId) as JsonRow | undefined;
    return row ? assetSchema.parse(JSON.parse(row.payload)) : null;
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
    this.#database
      .prepare("INSERT INTO assets (id, organization_id, payload) VALUES (?, ?, ?)")
      .run(asset.id, organizationId, JSON.stringify(asset));
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
    this.#database
      .prepare(
        "INSERT INTO scan_authorizations (id, organization_id, asset_id, payload) VALUES (?, ?, ?, ?)",
      )
      .run(authorization.id, organizationId, authorization.assetId, JSON.stringify(authorization));
    return authorization;
  }

  async getAuthorization(organizationId: string, authorizationId: string): Promise<StoredAuthorization | null> {
    const row = this.#database
      .prepare("SELECT payload FROM scan_authorizations WHERE organization_id = ? AND id = ?")
      .get(organizationId, authorizationId) as JsonRow | undefined;
    return row ? (JSON.parse(row.payload) as StoredAuthorization) : null;
  }

  async createAssessment(
    organizationId: string,
    _userId: string,
    input: CreateAssessmentInput,
    idempotencyKey: string,
  ): Promise<Assessment> {
    return this.#transaction(() => {
      const existing = this.#database
        .prepare("SELECT payload FROM assessments WHERE organization_id = ? AND idempotency_key = ?")
        .get(organizationId, idempotencyKey) as JsonRow | undefined;
      if (existing) {
        const assessment = assessmentSchema.parse(JSON.parse(existing.payload));
        assertSameAssessmentRequest(assessment, input);
        return assessment;
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
      this.#database
        .prepare(
          "INSERT INTO assessments (id, organization_id, asset_id, idempotency_key, payload) VALUES (?, ?, ?, ?, ?)",
        )
        .run(assessment.id, organizationId, assessment.assetId, idempotencyKey, JSON.stringify(assessment));
      return assessment;
    });
  }

  async getAssessment(organizationId: string, assessmentId: string): Promise<Assessment | null> {
    const row = this.#database
      .prepare("SELECT payload FROM assessments WHERE organization_id = ? AND id = ?")
      .get(organizationId, assessmentId) as JsonRow | undefined;
    return row ? assessmentSchema.parse(JSON.parse(row.payload)) : null;
  }

  async listAssessments(organizationId: string, assetId?: string): Promise<Assessment[]> {
    const rows = assetId
      ? (this.#database
          .prepare("SELECT payload FROM assessments WHERE organization_id = ? AND asset_id = ? ORDER BY rowid DESC")
          .all(organizationId, assetId) as unknown as JsonRow[])
      : (this.#database
          .prepare("SELECT payload FROM assessments WHERE organization_id = ? ORDER BY rowid DESC")
          .all(organizationId) as unknown as JsonRow[]);
    return rows.map(({ payload }) => assessmentSchema.parse(JSON.parse(payload)));
  }

  async finalizeAssessment(
    organizationId: string,
    assessmentId: string,
    input: FinalizeAssessmentInput,
  ): Promise<Assessment> {
    return this.#transaction(() => {
      const row = this.#database
        .prepare("SELECT payload FROM assessments WHERE organization_id = ? AND id = ?")
        .get(organizationId, assessmentId) as JsonRow | undefined;
      if (!row) throw new Error("Assessment not found");
      const existing = assessmentSchema.parse(JSON.parse(row.payload));
      const completedAt = new Date().toISOString();
      const assessment = assessmentSchema.parse({
        ...existing,
        state: input.state,
        startedAt: existing.startedAt ?? existing.createdAt,
        completedAt,
        result: input.result,
      });
      this.#database
        .prepare("UPDATE assessments SET payload = ?, findings = ? WHERE organization_id = ? AND id = ?")
        .run(JSON.stringify(assessment), JSON.stringify(input.findings), organizationId, assessmentId);

      const assetRow = this.#database
        .prepare("SELECT payload FROM assets WHERE organization_id = ? AND id = ?")
        .get(organizationId, assessment.assetId) as JsonRow | undefined;
      if (assetRow) {
        const asset = assetSchema.parse(JSON.parse(assetRow.payload));
        const updated = assetSchema.parse({
          ...asset,
          trustScore: input.result.score,
          status: statusForDecision(input.result.decision),
          lastAssessedAt: completedAt,
          updatedAt: completedAt,
        });
        this.#database
          .prepare("UPDATE assets SET payload = ? WHERE organization_id = ? AND id = ?")
          .run(JSON.stringify(updated), organizationId, asset.id);
      }
      return assessment;
    });
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

  close(): void {
    this.#database.close();
  }

  #transaction<T>(operation: () => T): T {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.#database.exec("COMMIT");
      return result;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }
}

function statusForDecision(decision: TrustScoreResult["decision"]): Asset["status"] {
  if (decision === "approved") return "approved";
  if (decision === "approved_with_restrictions") return "restricted";
  if (decision === "security_review_required") return "under_review";
  if (decision === "blocked") return "blocked";
  return "draft";
}
