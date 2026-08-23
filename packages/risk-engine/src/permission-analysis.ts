import type {
  BusinessContext,
  FindingSeverity,
  NormalizedFinding,
  PermissionAction,
} from "@trustlayer/contracts";

const rank: readonly FindingSeverity[] = ["informational", "low", "medium", "high", "critical"];

function raise(severity: FindingSeverity): FindingSeverity {
  const index = rank.indexOf(severity);
  return rank[Math.min(index + 1, rank.length - 1)] ?? severity;
}

function baseSeverity(action: PermissionAction): FindingSeverity {
  if (action === "delete" || action === "execute" || action === "bulk_export") return "high";
  if (action === "write" || action === "send") return "medium";
  return "low";
}

export function analyzeExcessPermissions(context: BusinessContext, now = new Date()): NormalizedFinding[] {
  const required = new Set(context.requiredPermissions);
  const excess = [...new Set(context.currentPermissions)].filter((permission) => !required.has(permission));
  const sensitive = context.dataCategories.some((category) => category !== "public_information");
  const timestamp = now.toISOString();

  return excess.map((permission) => {
    const severity = sensitive ? raise(baseSeverity(permission)) : baseSeverity(permission);
    return {
      fingerprint: `trustlayer:permission:${permission}`,
      source: "trustlayer_context",
      scannerVersion: "permission-analysis-v1",
      scanType: null,
      category: "permissions",
      severity,
      confidence: "high",
      status: "open",
      title: `Unnecessary ${permission.replace("_", " ")} permission`,
      technicalSummary: `The declared current permissions include ${permission}, but it is not marked as required for the asset's purpose.`,
      businessExplanation: `This AI can ${permission.replace("_", " ")} business data even though that access is not required for its stated purpose.`,
      affectedData: [...context.dataCategories],
      permissions: [permission],
      impactTypes: ["excessive_permission"],
      blastRadius: context.blastRadius,
      evidenceRef: null,
      recommendations: [
        {
          id: `remove-${permission}`,
          title: `Remove ${permission.replace("_", " ")} access`,
          action: `Reconfigure the integration so the AI cannot ${permission.replace("_", " ")} data unless a documented business need is approved.`,
          priority: severity === "high" || severity === "critical" ? "immediate" : "next",
        },
      ],
      firstDetectedAt: timestamp,
      lastDetectedAt: timestamp,
    };
  });
}

