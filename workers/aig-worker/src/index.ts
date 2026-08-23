import { AigScanner, scanJobSchema } from "@trustlayer/scanner-sdk";
import { executeAndReport } from "./runner.js";

const serializedJob = process.env.SCAN_JOB_JSON;
const aigBaseUrl = process.env.AIG_BASE_URL ?? "http://127.0.0.1:8088";
const aigVersion = process.env.AIG_VERSION;
if (!serializedJob) throw new Error("SCAN_JOB_JSON is required");
if (!aigVersion) throw new Error("AIG_VERSION is required");

const job = scanJobSchema.parse(JSON.parse(serializedJob));
const scanner = new AigScanner({ baseUrl: aigBaseUrl, version: aigVersion });
const outcome = await executeAndReport(job, { scanner });
if (outcome.state !== "succeeded") process.exitCode = 1;
