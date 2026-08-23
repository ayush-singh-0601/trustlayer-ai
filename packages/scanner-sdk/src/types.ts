import type { ScanType } from "@trustlayer/contracts";

export interface AgentScanInput {
  scanType: "agent";
  agentConfig: string;
  evaluationModel?: ModelConfiguration | undefined;
  prompt?: string | undefined;
  language?: string | undefined;
}

export interface InfrastructureScanInput {
  scanType: "infrastructure";
  targets: string[];
  headers?: Readonly<Record<string, string>> | undefined;
  timeoutSeconds?: number | undefined;
  model?: ModelConfiguration | undefined;
}

export interface McpScanInput {
  scanType: "mcp";
  targetUrl: string;
  headers?: Readonly<Record<string, string>> | undefined;
  model?: ModelConfiguration | undefined;
  prompt?: string | undefined;
  concurrency?: number | undefined;
}

export interface ModelScanInput {
  scanType: "model";
  targets: ModelConfiguration[];
  evaluationModel: ModelConfiguration;
  datasets: string[];
  promptCount: number;
  randomSeed: number;
  techniques?: string[] | undefined;
}

export interface ModelConfiguration {
  model: string;
  token?: string | undefined;
  baseUrl?: string | undefined;
}

export type ScannerRequest = AgentScanInput | InfrastructureScanInput | McpScanInput | ModelScanInput;

export interface ScannerHandle {
  scanner: string;
  externalId: string;
  scanType: ScanType;
}

export type ScannerState = "pending" | "running" | "completed" | "failed";

export interface ScannerStatus {
  state: ScannerState;
  externalId: string;
  title?: string;
  createdAt?: Date;
  updatedAt?: Date;
  redactedLog?: string;
}

export interface ScannerResult {
  scanner: string;
  scannerVersion: string;
  externalId: string;
  scanType: ScanType;
  raw: unknown;
}

export interface ScannerAdapter {
  readonly name: string;
  supports(type: ScanType): boolean;
  submit(request: ScannerRequest): Promise<ScannerHandle>;
  status(handle: ScannerHandle): Promise<ScannerStatus>;
  result(handle: ScannerHandle): Promise<ScannerResult>;
  cancel(handle: ScannerHandle): Promise<void>;
}
