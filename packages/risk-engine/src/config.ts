import type {
  BlastRadiusTier,
  Criticality,
  DataCategory,
  FindingConfidence,
  FindingSeverity,
  PermissionAction,
  RiskCategory,
} from "@trustlayer/contracts";

export const MODEL_VERSION = "trust-score-v1" as const;

export const CATEGORY_WEIGHTS: Readonly<Record<RiskCategory, number>> = {
  agent_behavior: 0.25,
  data_privacy: 0.2,
  infrastructure: 0.15,
  permissions: 0.15,
  model_security: 0.1,
  vendor_posture: 0.1,
  historical_stability: 0.05,
};

export const SEVERITY_RISK: Readonly<Record<FindingSeverity, number>> = {
  informational: 0,
  low: 10,
  medium: 35,
  high: 70,
  critical: 100,
};

export const CONFIDENCE_FACTOR: Readonly<Record<FindingConfidence, number>> = {
  low: 0.6,
  medium: 0.8,
  high: 1,
};

export const DATA_FACTOR: Readonly<Record<DataCategory, number>> = {
  public_information: 0.5,
  company_documents: 1,
  source_code: 1.1,
  customer_data: 1.25,
  employee_data: 1.25,
  financial_data: 1.5,
};

export const PERMISSION_FACTOR: Readonly<Record<PermissionAction, number>> = {
  read: 0.75,
  write: 1,
  send: 1,
  delete: 1.25,
  execute: 1.25,
  bulk_export: 1.5,
};

export const CRITICALITY_FACTOR: Readonly<Record<Criticality, number>> = {
  low: 0.75,
  medium: 1,
  high: 1.25,
  critical: 1.5,
};

export const BLAST_RADIUS_FACTOR: Readonly<Record<BlastRadiusTier, number>> = {
  low: 0.75,
  medium: 1,
  high: 1.25,
  critical: 1.5,
};

