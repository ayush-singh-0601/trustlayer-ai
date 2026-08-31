import { z } from "zod";
import {
  assessmentStates,
  assetStatuses,
  assetTypes,
  blastRadiusTiers,
  criticalities,
  dataCategories,
  environments,
  evidenceLevels,
  findingConfidences,
  findingSeverities,
  findingStatuses,
  impactTypes,
  permissionActions,
  riskBands,
  riskCategories,
  scanTypes,
  scannerSources,
  trustDecisions,
} from "./domain.js";

export const uuidSchema = z.string().uuid();
export const isoDateTimeSchema = z.string().datetime({ offset: true });

export const targetUrlSchema = z.string().url().superRefine((value, context) => {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    context.addIssue({ code: "custom", message: "Only HTTP and HTTPS targets are accepted" });
  }
  if (url.username || url.password) {
    context.addIssue({ code: "custom", message: "Target URLs cannot contain credentials" });
  }
});

export const httpsUrlSchema = targetUrlSchema;

function uniqueValues<T>(values: readonly T[]): boolean {
  return new Set(values).size === values.length;
}

const uniquePermissionArraySchema = z
  .array(z.enum(permissionActions))
  .max(permissionActions.length)
  .refine(uniqueValues, "Permissions must not contain duplicates");

const uniqueDataCategoryArraySchema = z
  .array(z.enum(dataCategories))
  .max(dataCategories.length)
  .refine(uniqueValues, "Data categories must not contain duplicates");

export const permissionSetSchema = z
  .object({
    current: uniquePermissionArraySchema,
    required: uniquePermissionArraySchema,
  })
  .superRefine(({ current, required }, context) => {
    const granted = new Set(current);
    required.forEach((permission, index) => {
      if (!granted.has(permission)) {
        context.addIssue({
          code: "custom",
          path: ["required", index],
          message: `Required permission ${permission} is not present in current access`,
        });
      }
    });
  });

export const integrationInputSchema = z.object({
  provider: z.string().trim().min(1).max(120),
  targetUrl: targetUrlSchema.optional(),
  dataCategories: uniqueDataCategoryArraySchema.min(1),
  permissions: permissionSetSchema,
  exposureEstimate: z.number().int().nonnegative().max(1_000_000_000).optional(),
});

export const createAssetSchema = z.object({
  name: z.string().trim().min(2).max(120),
  vendorName: z.string().trim().min(1).max(120),
  type: z.enum(assetTypes),
  purpose: z.string().trim().min(10).max(1_000),
  department: z.string().trim().min(1).max(120),
  businessOwner: z.string().trim().min(1).max(160),
  criticality: z.enum(criticalities),
  environment: z.enum(environments),
  targetUrl: targetUrlSchema,
  dataCategories: uniqueDataCategoryArraySchema.min(1),
  integrations: z.array(integrationInputSchema).max(25).default([]),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;

export const assetSchema = createAssetSchema.extend({
  id: uuidSchema,
  organizationId: uuidSchema,
  status: z.enum(assetStatuses),
  trustScore: z.number().int().min(0).max(100).nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  lastAssessedAt: isoDateTimeSchema.nullable(),
});

export type Asset = z.infer<typeof assetSchema>;

export const recommendationSchema = z.object({
  id: z.string().min(1).max(160),
  title: z.string().min(1).max(240),
  action: z.string().min(1).max(2_000),
  priority: z.enum(["immediate", "next", "advisory"]),
});

export type Recommendation = z.infer<typeof recommendationSchema>;

export const normalizedFindingSchema = z.object({
  fingerprint: z.string().min(8).max(256),
  source: z.enum(scannerSources),
  scannerVersion: z.string().min(1).max(120),
  scanType: z.enum(scanTypes).nullable(),
  category: z.enum(riskCategories),
  severity: z.enum(findingSeverities),
  confidence: z.enum(findingConfidences).default("medium"),
  status: z.enum(findingStatuses).default("open"),
  title: z.string().min(1).max(300),
  technicalSummary: z.string().max(10_000),
  businessExplanation: z.string().min(1).max(4_000),
  affectedData: z.array(z.enum(dataCategories)),
  permissions: z.array(z.enum(permissionActions)),
  impactTypes: z.array(z.enum(impactTypes)),
  blastRadius: z.enum(blastRadiusTiers),
  evidenceRef: z.string().max(1_024).nullable().default(null),
  recommendations: z.array(recommendationSchema),
  firstDetectedAt: isoDateTimeSchema,
  lastDetectedAt: isoDateTimeSchema,
});

export type NormalizedFinding = z.infer<typeof normalizedFindingSchema>;

export const businessContextSchema = z.object({
  criticality: z.enum(criticalities),
  dataCategories: z.array(z.enum(dataCategories)),
  currentPermissions: z.array(z.enum(permissionActions)),
  requiredPermissions: z.array(z.enum(permissionActions)),
  blastRadius: z.enum(blastRadiusTiers),
});

export type BusinessContext = z.infer<typeof businessContextSchema>;

export const riskScoreComponentSchema = z.object({
  category: z.enum(riskCategories),
  weight: z.number().min(0).max(1),
  assessed: z.boolean(),
  score: z.number().min(0).max(100).nullable(),
  findingCount: z.number().int().nonnegative(),
});

export const trustScoreResultSchema = z.object({
  score: z.number().int().min(0).max(100).nullable(),
  riskBand: z.enum(riskBands),
  decision: z.enum(trustDecisions),
  coveragePercent: z.number().int().min(0).max(100),
  evidenceLevel: z.enum(evidenceLevels),
  modelVersion: z.literal("trust-score-v1"),
  components: z.array(riskScoreComponentSchema),
  appliedGates: z.array(z.string()),
});

export type TrustScoreResult = z.infer<typeof trustScoreResultSchema>;

export const createAssessmentSchema = z.object({
  assetId: uuidSchema,
  authorizationId: uuidSchema,
  requestedScans: z.array(z.enum(scanTypes)).min(1).max(scanTypes.length).refine(uniqueValues, "Requested scans must not contain duplicates"),
  reason: z.enum(["manual", "scheduled"]).default("manual"),
});

export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

export const assessmentSchema = createAssessmentSchema.extend({
  id: uuidSchema,
  organizationId: uuidSchema,
  state: z.enum(assessmentStates),
  createdAt: isoDateTimeSchema,
  startedAt: isoDateTimeSchema.nullable(),
  completedAt: isoDateTimeSchema.nullable(),
  result: trustScoreResultSchema.nullable(),
});

export type Assessment = z.infer<typeof assessmentSchema>;

export const scanAuthorizationInputSchema = z.object({
  assetId: uuidSchema,
  targets: z.array(targetUrlSchema).min(1).max(10).refine(uniqueValues, "Targets must not contain duplicates"),
  recurring: z.boolean(),
  confirmed: z.literal(true),
  termsVersion: z.literal("scan-authorization-v1"),
});

export type ScanAuthorizationInput = z.infer<typeof scanAuthorizationInputSchema>;

export const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  instance: z.string().optional(),
  requestId: z.string().optional(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
});

export type ApiProblem = z.infer<typeof problemSchema>;
