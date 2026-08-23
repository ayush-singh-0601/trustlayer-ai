import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { createDevelopmentAuthResolver } from "./auth.js";
import { AssessmentCoordinator, PublicEndpointRequestProvider, RecordingScanDispatcher } from "./coordinator.js";
import { InMemoryTrustLayerStore } from "./store.js";

const organizationId = "00000000-0000-4000-8000-000000000101";
const otherOrganizationId = "00000000-0000-4000-8000-000000000202";
const publicResolver = async () => [{ address: "93.184.216.34", family: 4 }];

const apps: Awaited<ReturnType<typeof createApp>>[] = [];

async function testApp(options: { organizationId?: string; role?: "owner" | "viewer"; store?: InMemoryTrustLayerStore } = {}) {
  const app = await createApp({
    store: options.store ?? new InMemoryTrustLayerStore(),
    resolveAuth: createDevelopmentAuthResolver({
      userId: randomUUID(),
      organizationId: options.organizationId ?? organizationId,
      role: options.role ?? "owner",
    }),
    resolveHost: publicResolver,
  });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

const validAsset = {
  name: "Customer Support Agent",
  vendorName: "Acme AI",
  type: "custom_http_agent",
  purpose: "Resolve customer support requests using CRM context",
  department: "Support",
  businessOwner: "Support Operations",
  criticality: "high",
  environment: "production",
  targetUrl: "https://agent.example.com/api/chat",
  dataCategories: ["customer_data"],
  integrations: [
    {
      provider: "HubSpot",
      dataCategories: ["customer_data"],
      permissions: { current: ["read", "bulk_export"], required: ["read"] },
    },
  ],
};

describe("TrustLayer API vertical slice", () => {
  it("creates inventory and returns compatible scans", async () => {
    const app = await testApp();
    const response = await app.inject({ method: "POST", url: "/v1/assets", payload: validAsset });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      data: { name: "Customer Support Agent", organizationId },
      compatibleScans: ["agent", "infrastructure"],
    });
  });

  it("keeps records scoped to a different local profile isolated", async () => {
    const store = new InMemoryTrustLayerStore();
    const first = await testApp({ store });
    const created = await first.inject({ method: "POST", url: "/v1/assets", payload: validAsset });
    const assetId = created.json().data.id as string;
    const second = await testApp({ store, organizationId: otherOrganizationId });

    const response = await second.inject({ method: "GET", url: `/v1/assets/${assetId}` });
    expect(response.statusCode).toBe(404);
  });

  it("requires registered targets, authorization, compatibility, and idempotency", async () => {
    const app = await testApp();
    const created = await app.inject({ method: "POST", url: "/v1/assets", payload: validAsset });
    const assetId = created.json().data.id as string;

    const authorizationResponse = await app.inject({
      method: "POST",
      url: `/v1/assets/${assetId}/scan-authorizations`,
      payload: {
        targets: [validAsset.targetUrl],
        recurring: true,
        confirmed: true,
        termsVersion: "scan-authorization-v1",
      },
    });
    expect(authorizationResponse.statusCode).toBe(201);
    const authorizationId = authorizationResponse.json().data.id as string;

    const request = {
      method: "POST" as const,
      url: `/v1/assets/${assetId}/assessments`,
      headers: { "idempotency-key": "assessment-fixture-1" },
      payload: { authorizationId, requestedScans: ["agent"], reason: "manual" },
    };
    const first = await app.inject(request);
    const replay = await app.inject(request);
    expect(first.statusCode).toBe(202);
    expect(replay.json().data.id).toBe(first.json().data.id);

    const incompatible = await app.inject({
      ...request,
      headers: { "idempotency-key": "assessment-fixture-2" },
      payload: { authorizationId, requestedScans: ["mcp"], reason: "manual" },
    });
    expect(incompatible.statusCode).toBe(400);
  });

  it("prevents viewers from mutating inventory", async () => {
    const app = await testApp({ role: "viewer" });
    const response = await app.inject({ method: "POST", url: "/v1/assets", payload: validAsset });
    expect(response.statusCode).toBe(403);
  });

  it("brokers one-time scan secrets and finalizes an assessment from an idempotent worker callback", async () => {
    const store = new InMemoryTrustLayerStore();
    const dispatcher = new RecordingScanDispatcher();
    const coordinator = new AssessmentCoordinator(
      store,
      dispatcher,
      new PublicEndpointRequestProvider(),
      "http://api.internal",
    );
    const app = await createApp({
      store,
      coordinator,
      resolveAuth: createDevelopmentAuthResolver({ userId: randomUUID(), organizationId }),
      resolveHost: publicResolver,
    });
    apps.push(app);

    const created = await app.inject({
      method: "POST",
      url: "/v1/assets",
      payload: { ...validAsset, name: "AI Gateway", type: "infrastructure_url" },
    });
    const assetId = created.json().data.id as string;
    const authorization = await app.inject({
      method: "POST",
      url: `/v1/assets/${assetId}/scan-authorizations`,
      payload: {
        targets: [validAsset.targetUrl],
        recurring: true,
        confirmed: true,
        termsVersion: "scan-authorization-v1",
      },
    });
    const authorizationId = authorization.json().data.id as string;
    const queued = await app.inject({
      method: "POST",
      url: `/v1/assets/${assetId}/assessments`,
      headers: { "idempotency-key": "orchestrated-assessment-1" },
      payload: { authorizationId, requestedScans: ["infrastructure"], reason: "manual" },
    });
    expect(queued.statusCode).toBe(202);
    expect(dispatcher.jobs).toHaveLength(1);
    const job = dispatcher.jobs[0]!;

    const secret = await app.inject({
      method: "POST",
      url: "/v1/internal/scans/secret",
      headers: { authorization: `Bearer ${job.secretToken}` },
      payload: { jobId: job.jobId, scanId: job.scanId },
    });
    expect(secret.statusCode).toBe(200);
    expect(secret.json()).toMatchObject({ scanType: "infrastructure", targets: [validAsset.targetUrl] });
    const replayedSecret = await app.inject({
      method: "POST",
      url: "/v1/internal/scans/secret",
      headers: { authorization: `Bearer ${job.secretToken}` },
      payload: { jobId: job.jobId, scanId: job.scanId },
    });
    expect(replayedSecret.statusCode).toBe(401);

    const outcome = {
      jobId: job.jobId,
      organizationId,
      assessmentId: job.assessmentId,
      scanId: job.scanId,
      state: "succeeded",
      scannerHandle: "aig-session-1",
      findings: [],
      redactedRawResult: { findings: [] },
    };
    const callback = await app.inject({
      method: "POST",
      url: "/v1/internal/scans/callback",
      headers: { authorization: `Bearer ${job.callbackToken}` },
      payload: outcome,
    });
    expect(callback.statusCode).toBe(202);
    const duplicate = await app.inject({
      method: "POST",
      url: "/v1/internal/scans/callback",
      headers: { authorization: `Bearer ${job.callbackToken}` },
      payload: outcome,
    });
    expect(duplicate.statusCode).toBe(200);

    const completed = await app.inject({ method: "GET", url: `/v1/assessments/${job.assessmentId}` });
    expect(completed.json()).toMatchObject({
      data: { state: "succeeded", result: { modelVersion: "trust-score-v1" } },
    });
  });
});
