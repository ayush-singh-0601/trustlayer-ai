import { z } from "zod";
import {
  blastRadiusTiers,
  dataCategories,
  normalizedFindingSchema,
  permissionActions,
  scanTypes,
} from "@trustlayer/contracts";

const modelConfigurationSchema = z.object({
  model: z.string().min(1).max(240),
  token: z.string().min(1).max(16_384).optional(),
  baseUrl: z.string().url().max(2_048).optional(),
}).strict();

export const scannerRequestSchema = z.discriminatedUnion("scanType", [
  z.object({
    scanType: z.literal("agent"),
    agentConfig: z.string().min(1),
    evaluationModel: modelConfigurationSchema.optional(),
    prompt: z.string().optional(),
    language: z.string().optional(),
  }).strict(),
  z.object({
    scanType: z.literal("infrastructure"),
    targets: z.array(z.string().url()).min(1),
    headers: z.record(z.string(), z.string()).optional(),
    timeoutSeconds: z.number().int().positive().max(300).optional(),
    model: modelConfigurationSchema.optional(),
  }).strict(),
  z.object({
    scanType: z.literal("mcp"),
    targetUrl: z.string().url(),
    headers: z.record(z.string(), z.string()).optional(),
    model: modelConfigurationSchema.optional(),
    prompt: z.string().optional(),
    concurrency: z.number().int().positive().max(16).optional(),
  }).strict(),
  z.object({
    scanType: z.literal("model"),
    targets: z.array(modelConfigurationSchema).min(1),
    evaluationModel: modelConfigurationSchema,
    datasets: z.array(z.string()).min(1),
    promptCount: z.number().int().positive().max(2_000),
    randomSeed: z.number().int(),
    techniques: z.array(z.string()).optional(),
  }).strict(),
]);

const boundedEvidenceSchema = z.unknown().refine(
  (value) => serializedSize(value) <= 1_000_000,
  "Redacted scanner evidence exceeds the 1 MB limit",
);

export const scanJobSchema = z.object({
  jobId: z.string().uuid(),
  organizationId: z.string().uuid(),
  assessmentId: z.string().uuid(),
  scanId: z.string().uuid(),
  assetName: z.string().min(1).max(120),
  targetsToValidate: z.array(z.string().url().max(2_048)).min(1).max(10),
  dataCategories: z.array(z.enum(dataCategories)).max(dataCategories.length),
  permissions: z.array(z.enum(permissionActions)).max(permissionActions.length),
  blastRadius: z.enum(blastRadiusTiers),
  scanType: z.enum(scanTypes),
  secretBrokerUrl: z.string().url().max(2_048),
  secretToken: z.string().min(32).max(256),
  callbackUrl: z.string().url().max(2_048),
  callbackToken: z.string().min(32).max(256),
  timeoutMs: z.number().int().min(10_000).max(14_400_000).default(3_600_000),
  pollIntervalMs: z.number().int().min(100).max(60_000).default(5_000),
}).strict();

export const workerOutcomeSchema = z.object({
  jobId: z.string().uuid(),
  organizationId: z.string().uuid(),
  assessmentId: z.string().uuid(),
  scanId: z.string().uuid(),
  state: z.enum(["succeeded", "failed"]),
  scannerHandle: z.string().max(256).optional(),
  findings: z.array(normalizedFindingSchema).max(1_000),
  redactedRawResult: boundedEvidenceSchema.optional(),
  errorCode: z.string().max(120).optional(),
  redactedError: z.string().max(2_000).optional(),
}).strict();

export type ScanJob = z.infer<typeof scanJobSchema>;
export type BrokeredScannerRequest = z.infer<typeof scannerRequestSchema>;
export type WorkerOutcomeContract = z.infer<typeof workerOutcomeSchema>;

function serializedSize(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value) ?? "", "utf8");
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}
