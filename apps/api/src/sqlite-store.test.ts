import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { calculateTrustScore } from "@trustlayer/risk-engine";
import { SqliteTrustLayerStore } from "./sqlite-store.js";
import { IdempotencyConflictError } from "./store.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("SqliteTrustLayerStore", () => {
  it("persists local inventory and completed assessments across restarts", async () => {
    const directory = mkdtempSync(join(tmpdir(), "trustlayer-sqlite-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "trustlayer.db");
    const organizationId = randomUUID();
    const userId = randomUUID();
    const store = new SqliteTrustLayerStore(databasePath);
    const asset = await store.createAsset(organizationId, {
      name: "Local AI gateway",
      vendorName: "Self hosted",
      type: "infrastructure_url",
      purpose: "Assess the locally managed AI gateway endpoint.",
      department: "Engineering",
      businessOwner: "Local user",
      criticality: "medium",
      environment: "development",
      targetUrl: "https://gateway.example.com",
      dataCategories: ["company_documents"],
      integrations: [],
    });
    const authorization = await store.createAuthorization(organizationId, userId, {
      assetId: asset.id,
      targets: [asset.targetUrl],
      recurring: false,
      confirmed: true,
      termsVersion: "scan-authorization-v1",
    });
    const assessment = await store.createAssessment(
      organizationId,
      userId,
      {
        assetId: asset.id,
        authorizationId: authorization.id,
        requestedScans: ["infrastructure"],
        reason: "manual",
      },
      "local-persistence-test",
    );
    const result = calculateTrustScore({
      findings: [],
      context: {
        criticality: "medium",
        dataCategories: ["company_documents"],
        currentPermissions: [],
        requiredPermissions: [],
        blastRadius: "low",
      },
      applicableCategories: ["infrastructure", "permissions"],
      assessedCategories: ["infrastructure", "permissions"],
      assessmentComplete: true,
      monitoringActive: false,
    });
    await store.finalizeAssessment(organizationId, assessment.id, {
      state: "succeeded",
      result,
      findings: [],
    });
    store.close();

    const reopened = new SqliteTrustLayerStore(databasePath);
    expect((await reopened.listAssets(organizationId))[0]?.trustScore).toBe(result.score);
    expect((await reopened.getAssessment(organizationId, assessment.id))?.state).toBe("succeeded");
    expect((await reopened.dashboard(organizationId)).totalAssets).toBe(1);
    reopened.close();
  });

  it("rejects idempotency-key reuse with a different request", async () => {
    const directory = mkdtempSync(join(tmpdir(), "trustlayer-sqlite-"));
    temporaryDirectories.push(directory);
    const store = new SqliteTrustLayerStore(join(directory, "trustlayer.db"));
    const organizationId = randomUUID();
    const userId = randomUUID();
    const asset = await store.createAsset(organizationId, {
      name: "Idempotency fixture",
      vendorName: "Self hosted",
      type: "infrastructure_url",
      purpose: "Verify persistent idempotency request identity.",
      department: "Engineering",
      businessOwner: "Local user",
      criticality: "medium",
      environment: "test",
      targetUrl: "https://gateway.example.com",
      dataCategories: ["company_documents"],
      integrations: [],
    });
    const authorization = await store.createAuthorization(organizationId, userId, {
      assetId: asset.id,
      targets: [asset.targetUrl],
      recurring: false,
      confirmed: true,
      termsVersion: "scan-authorization-v1",
    });
    const input = {
      assetId: asset.id,
      authorizationId: authorization.id,
      requestedScans: ["infrastructure"] as const,
      reason: "manual" as const,
    };

    try {
      await store.createAssessment(organizationId, userId, input, "same-key");
      await expect(
        store.createAssessment(
          organizationId,
          userId,
          { ...input, authorizationId: randomUUID() },
          "same-key",
        ),
      ).rejects.toBeInstanceOf(IdempotencyConflictError);
    } finally {
      store.close();
    }
  });
});
