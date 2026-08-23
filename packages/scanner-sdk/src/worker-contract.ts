import { z } from "zod";
import {
  blastRadiusTiers,
  dataCategories,
  normalizedFindingSchema,
  permissionActions,
  scanTypes,
} from "@trustlayer/contracts";

const modelConfigurationSchema = z.object({
  model: z.string().min(1),
  token: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
});

export const scannerRequestSchema = z.discriminatedUnion("scanType", [
  z.object({
    scanType: z.literal("agent"),
    agentConfig: z.string().min(1),
    evaluationModel: modelConfigurationSchema.optional(),
    prompt: z.string().optional(),
    language: z.string().optional(),
  }),
  z.object({
    scanType: z.literal("infrastructure"),
    targets: z.array(z.string().url()).min(1),
    headers: z.record(z.string(), z.string()).optional(),
    timeoutSeconds: z.number().int().positive().max(300).optional(),
    model: modelConfigurationSchema.optional(),
  }),
  z.object({
    scanType: z.literal("mcp"),
    targetUrl: z.string().url(),
    headers: z.record(z.string(), z.string()).optional(),
    model: modelConfigurationSchema.optional(),
    prompt: z.string().optional(),
    concurrency: z.number().int().positive().max(16).optional(),
  }),
  z.object({
    scanType: z.literal("model"),
    targets: z.array(modelConfigurationSchema).min(1),
    evaluationModel: modelConfigurationSchema,
    datasets: z.array(z.string()).min(1),
    promptCount: z.number().int().positive().max(2_000),
    randomSeed: z.number().int(),
    techniques: z.array(z.string()).optional(),
  }),
]);

export const scanJobSchema = z.object({
  jobId: z.string().uuid(),
  organizationId: z.string().uuid(),
  assessmentId: z.string().uuid(),
  scanId: z.string().uuid(),
  assetName: z.string().min(1).max(120),
  targetsToValidate: z.array(z.string().url()).min(1).max(10),
  dataCategories: z.array(z.enum(dataCategories)),
  permissions: z.array(z.enum(permissionActions)),
  blastRadius: z.enum(blastRadiusTiers),
  scanType: z.enum(scanTypes),
  secretBrokerUrl: z.string().url(),
  secretToken: z.string().min(32),
  callbackUrl: z.string().url(),
  callbackToken: z.string().min(32),
  timeoutMs: z.number().int().min(10_000).max(14_400_000).default(3_600_000),
  pollIntervalMs: z.number().int().min(100).max(60_000).default(5_000),
});

export const workerOutcomeSchema = z.object({
  jobId: z.string().uuid(),
  organizationId: z.string().uuid(),
  assessmentId: z.string().uuid(),
  scanId: z.string().uuid(),
  state: z.enum(["succeeded", "failed"]),
  scannerHandle: z.string().optional(),
  findings: z.array(normalizedFindingSchema),
  redactedRawResult: z.unknown().optional(),
  errorCode: z.string().optional(),
  redactedError: z.string().optional(),
});

export type ScanJob = z.infer<typeof scanJobSchema>;
export type BrokeredScannerRequest = z.infer<typeof scannerRequestSchema>;
export type WorkerOutcomeContract = z.infer<typeof workerOutcomeSchema>;

