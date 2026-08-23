export const assetTypes = [
  "custom_http_agent",
  "openai_compatible_agent",
  "dify_agent",
  "infrastructure_url",
  "mcp_server",
  "llm_endpoint",
] as const;

export type AssetType = (typeof assetTypes)[number];

export const criticalities = ["low", "medium", "high", "critical"] as const;
export type Criticality = (typeof criticalities)[number];

export const environments = ["development", "test", "staging", "production"] as const;
export type Environment = (typeof environments)[number];

export const permissionActions = ["read", "write", "send", "delete", "execute", "bulk_export"] as const;
export type PermissionAction = (typeof permissionActions)[number];

export const dataCategories = [
  "customer_data",
  "employee_data",
  "financial_data",
  "source_code",
  "company_documents",
  "public_information",
] as const;
export type DataCategory = (typeof dataCategories)[number];

export const scanTypes = ["agent", "infrastructure", "mcp", "model"] as const;
export type ScanType = (typeof scanTypes)[number];

export const assessmentStates = [
  "queued",
  "provisioning",
  "running",
  "normalizing",
  "succeeded",
  "partial_failed",
  "failed",
  "cancelled",
] as const;
export type AssessmentState = (typeof assessmentStates)[number];

export const findingSeverities = ["informational", "low", "medium", "high", "critical"] as const;
export type FindingSeverity = (typeof findingSeverities)[number];

export const findingConfidences = ["low", "medium", "high"] as const;
export type FindingConfidence = (typeof findingConfidences)[number];

export const findingStatuses = ["open", "resolved", "false_positive"] as const;
export type FindingStatus = (typeof findingStatuses)[number];

export const riskCategories = [
  "agent_behavior",
  "data_privacy",
  "infrastructure",
  "permissions",
  "model_security",
  "vendor_posture",
  "historical_stability",
] as const;
export type RiskCategory = (typeof riskCategories)[number];

export const blastRadiusTiers = ["low", "medium", "high", "critical"] as const;
export type BlastRadiusTier = (typeof blastRadiusTiers)[number];

export const impactTypes = [
  "data_exfiltration",
  "authorization_bypass",
  "remote_code_execution",
  "arbitrary_tool_execution",
  "sensitive_data_exposure",
  "prompt_manipulation",
  "excessive_permission",
  "known_vulnerability",
  "harmful_model_output",
] as const;
export type ImpactType = (typeof impactTypes)[number];

export const riskBands = ["unassessed", "excellent", "low", "moderate", "high", "critical"] as const;
export type RiskBand = (typeof riskBands)[number];

export const trustDecisions = [
  "unassessed",
  "approved",
  "approved_with_restrictions",
  "security_review_required",
  "blocked",
] as const;
export type TrustDecision = (typeof trustDecisions)[number];

export const evidenceLevels = [
  "unverified",
  "externally_assessed",
  "verified_tested",
  "continuously_monitored",
] as const;
export type EvidenceLevel = (typeof evidenceLevels)[number];

export const organizationRoles = ["owner", "admin", "security_analyst", "viewer"] as const;
export type OrganizationRole = (typeof organizationRoles)[number];

export const assetStatuses = ["draft", "under_review", "approved", "restricted", "blocked"] as const;
export type AssetStatus = (typeof assetStatuses)[number];

export const scannerSources = ["aig", "trustlayer_context"] as const;
export type ScannerSource = (typeof scannerSources)[number];

