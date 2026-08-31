import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import {
  createAssessmentSchema,
  createAssetSchema,
  scanAuthorizationInputSchema,
} from "@trustlayer/contracts";
import {
  canonicalTargetIdentity,
  UnsafeTargetError,
  type HostResolver,
  validateLocalScanTarget,
} from "@trustlayer/scanner-sdk";
import { analyzeExcessPermissions, calculateTrustScore } from "@trustlayer/risk-engine";
import type { AuthResolver } from "./auth.js";
import { AuthenticationError, AuthorizationError, requireCapability } from "./auth.js";
import { applicableRiskCategories, compatibleScans } from "./compatibility.js";
import type { TrustLayerStore } from "./store.js";
import { businessContext, type AssessmentOrchestrator, ScanConfigurationError } from "./coordinator.js";
import "./types.js";
import type { AuthContext } from "./types.js";

export interface CreateAppOptions {
  store: TrustLayerStore;
  resolveAuth: AuthResolver;
  resolveHost?: HostResolver;
  logger?: boolean;
  webOrigin?: string;
  coordinator?: AssessmentOrchestrator;
  scannerStatus?: { available: boolean; detail: string };
}

const idParamsSchema = z.object({ id: z.string().uuid() });

export async function createApp(options: CreateAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger
      ? {
          redact: {
            paths: [
              "req.headers.authorization",
              "req.headers.cookie",
              "req.body.apiKey",
              "req.body.token",
              "req.body.headers.authorization",
            ],
            censor: "[REDACTED]",
          },
        }
      : false,
    genReqId: () => crypto.randomUUID(),
  });

  await app.register(cors, {
    origin: options.webOrigin ?? "http://localhost:3000",
    credentials: false,
    allowedHeaders: ["authorization", "content-type", "idempotency-key", "x-organization-id"],
  });

  app.decorateRequest("auth", null as unknown as AuthContext);
  app.addHook("onRequest", async (request) => {
    if (request.url === "/healthz" || request.url.startsWith("/v1/internal/scans/")) return;
    request.auth = await options.resolveAuth(request);
  });

  const scannerStatus = options.scannerStatus ?? {
    available: Boolean(options.coordinator),
    detail: options.coordinator ? "Local AIG scanner connected" : "Context-only mode",
  };

  app.get("/healthz", async () => ({ status: "ok", mode: "local", scanner: scannerStatus }));

  app.get("/v1/system/status", async (request) => {
    requireCapability(request.auth, "read");
    return { data: { mode: "local", persistence: "sqlite", scanner: scannerStatus } };
  });

  app.get("/v1/assets", async (request) => {
    requireCapability(request.auth, "read");
    const assets = await options.store.listAssets(request.auth.organizationId);
    return { data: assets };
  });

  app.post("/v1/assets", async (request, reply) => {
    requireCapability(request.auth, "manage_assets");
    const input = createAssetSchema.parse(request.body);
    await validateLocalScanTarget(input.targetUrl, options.resolveHost);
    for (const integration of input.integrations) {
      if (integration.targetUrl) await validateLocalScanTarget(integration.targetUrl, options.resolveHost);
    }
    const asset = await options.store.createAsset(request.auth.organizationId, input);
    return reply.code(201).send({ data: asset, compatibleScans: compatibleScans(asset.type) });
  });

  app.get("/v1/assets/:id", async (request, reply) => {
    requireCapability(request.auth, "read");
    const { id } = idParamsSchema.parse(request.params);
    const asset = await options.store.getAsset(request.auth.organizationId, id);
    if (!asset) return reply.code(404).send(problem(404, "Asset not found", request.id));
    return { data: asset, compatibleScans: compatibleScans(asset.type) };
  });

  app.post("/v1/assets/:id/scan-authorizations", async (request, reply) => {
    requireCapability(request.auth, "run_scans");
    const { id } = idParamsSchema.parse(request.params);
    const input = scanAuthorizationInputSchema.parse({ ...(request.body as object), assetId: id });
    const asset = await options.store.getAsset(request.auth.organizationId, id);
    if (!asset) return reply.code(404).send(problem(404, "Asset not found", request.id));
    const registeredTargets = new Set([
      asset.targetUrl,
      ...asset.integrations.flatMap((integration) => (integration.targetUrl ? [integration.targetUrl] : [])),
    ].map(canonicalTargetIdentity));
    if (input.targets.some((target) => !registeredTargets.has(canonicalTargetIdentity(target)))) {
      return reply.code(400).send(problem(400, "Authorization contains an unregistered target", request.id));
    }
    for (const target of input.targets) await validateLocalScanTarget(target, options.resolveHost);
    const authorization = await options.store.createAuthorization(
      request.auth.organizationId,
      request.auth.userId,
      input,
    );
    return reply.code(201).send({ data: authorization });
  });

  app.post("/v1/assets/:id/assessments", async (request, reply) => {
    requireCapability(request.auth, "run_scans");
    const { id } = idParamsSchema.parse(request.params);
    const idempotencyKey = request.headers["idempotency-key"];
    if (typeof idempotencyKey !== "string" || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
      return reply.code(400).send(problem(400, "A valid Idempotency-Key header is required", request.id));
    }
    const input = createAssessmentSchema.parse({ ...(request.body as object), assetId: id });
    const asset = await options.store.getAsset(request.auth.organizationId, id);
    if (!asset) return reply.code(404).send(problem(404, "Asset not found", request.id));
    const authorization = await options.store.getAuthorization(request.auth.organizationId, input.authorizationId);
    if (!authorization || authorization.assetId !== asset.id || authorization.revokedAt) {
      return reply.code(400).send(problem(400, "An active authorization for this asset is required", request.id));
    }
    if (input.reason === "scheduled" && !authorization.recurring) {
      return reply.code(400).send(problem(400, "This authorization does not permit recurring scans", request.id));
    }
    const supported = new Set(compatibleScans(asset.type));
    if (input.requestedScans.some((scan) => !supported.has(scan))) {
      return reply.code(400).send(problem(400, "One or more scan types are incompatible with this asset", request.id));
    }
    const assessment = await options.store.createAssessment(
      request.auth.organizationId,
      request.auth.userId,
      input,
      idempotencyKey,
    );
    if (options.coordinator) {
      await options.coordinator.start(assessment, asset, authorization.targets);
      return reply.code(202).send({ data: assessment });
    }

    const context = businessContext(asset);
    const findings = analyzeExcessPermissions(context);
    const result = calculateTrustScore({
      findings,
      context,
      applicableCategories: applicableRiskCategories(asset.type),
      assessedCategories: ["permissions"],
      assessmentComplete: false,
      monitoringActive: false,
    });
    const contextOnlyAssessment = await options.store.finalizeAssessment(
      request.auth.organizationId,
      assessment.id,
      { state: "partial_failed", result, findings },
    );
    return reply.code(202).send({ data: contextOnlyAssessment });
  });

  app.get("/v1/assessments/:id", async (request, reply) => {
    requireCapability(request.auth, "read");
    const { id } = idParamsSchema.parse(request.params);
    const assessment = await options.store.getAssessment(request.auth.organizationId, id);
    if (!assessment) return reply.code(404).send(problem(404, "Assessment not found", request.id));
    return { data: assessment };
  });

  app.get("/v1/dashboard", async (request) => {
    requireCapability(request.auth, "read");
    return { data: await options.store.dashboard(request.auth.organizationId) };
  });

  app.post("/v1/internal/scans/secret", async (request, reply) => {
    if (!options.coordinator) return reply.code(404).send(problem(404, "Scan broker is not enabled", request.id));
    const token = bearerToken(request.headers.authorization);
    if (!token) return reply.code(401).send(problem(401, "A worker token is required", request.id));
    const body = z.object({ jobId: z.string().uuid(), scanId: z.string().uuid() }).parse(request.body);
    const scannerRequest = await options.coordinator.consumeSecret(token, body.jobId, body.scanId);
    if (!scannerRequest) return reply.code(401).send(problem(401, "Worker token is invalid or already consumed", request.id));
    return scannerRequest;
  });

  app.post("/v1/internal/scans/callback", async (request, reply) => {
    if (!options.coordinator) return reply.code(404).send(problem(404, "Scan broker is not enabled", request.id));
    const token = bearerToken(request.headers.authorization);
    if (!token) return reply.code(401).send(problem(401, "A callback token is required", request.id));
    const result = await options.coordinator.receiveOutcome(token, request.body);
    if (result === "rejected") return reply.code(401).send(problem(401, "Callback token or payload is invalid", request.id));
    return reply.code(result === "duplicate" ? 200 : 202).send({ status: result });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      const errors = error.issues.reduce<Record<string, string[]>>((result, issue) => {
        const path = issue.path.join(".") || "request";
        (result[path] ??= []).push(issue.message);
        return result;
      }, {});
      return reply.code(400).send({ ...problem(400, "Request validation failed", request.id), errors });
    }
    if (error instanceof AuthenticationError) return reply.code(401).send(problem(401, error.message, request.id));
    if (error instanceof AuthorizationError) return reply.code(403).send(problem(403, error.message, request.id));
    if (error instanceof UnsafeTargetError) return reply.code(400).send(problem(400, error.message, request.id));
    if (error instanceof ScanConfigurationError) return reply.code(409).send(problem(409, error.message, request.id));
    request.log.error({ err: error }, "Unhandled request error");
    return reply.code(500).send(problem(500, "An internal error occurred", request.id));
  });

  return app;
}

function bearerToken(header: string | undefined): string | null {
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
}

function problem(status: number, detail: string, requestId: string) {
  return {
    type: `https://trustlayer.ai/problems/${status}`,
    title: status === 500 ? "Internal Server Error" : detail,
    status,
    detail,
    requestId,
  };
}
