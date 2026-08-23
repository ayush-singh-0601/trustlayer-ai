import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const action = process.argv[2];
if (!new Set(["start", "stop", "status"]).has(action)) {
  fail("Usage: node scripts/scanner.mjs <start|stop|status>");
}

const dockerCheck = spawnSync("docker", ["--version"], { encoding: "utf8", windowsHide: true });
if (dockerCheck.status !== 0) {
  fail("Docker is not available. TrustLayer still works in context-only mode. Install Docker Desktop only if you want technical scans.");
}

if (action === "start") {
  runDocker(["compose", "-f", "compose.yaml", "up", "-d"]);
  await waitForScanner();
  console.log("Local AIG scanner is ready at http://127.0.0.1:8088");
} else if (action === "stop") {
  runDocker(["compose", "-f", "compose.yaml", "stop"]);
} else {
  runDocker(["compose", "-f", "compose.yaml", "ps"]);
}

function runDocker(arguments_) {
  const result = spawnSync("docker", arguments_, { cwd: root, stdio: "inherit", windowsHide: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function fail(message) {
  console.error(`\n${message}`);
  process.exit(1);
}

async function waitForScanner() {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch("http://127.0.0.1:8088/")).ok) return;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000));
  }
  throw new Error("The scanner did not become healthy within three minutes. Run npm run scanner:status.");
}
