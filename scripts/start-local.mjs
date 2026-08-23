import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const noOpen = process.argv.includes("--no-open") || process.env.TRUSTLAYER_NO_OPEN === "1";
const dataDirectory = resolve(process.env.TRUSTLAYER_DATA_DIR ?? join(root, ".trustlayer"));
const buildStamp = join(dataDirectory, "build-stamp");
const requiredOutputs = [
  join(root, "apps/api/dist/server.js"),
  join(root, "workers/aig-worker/dist/index.js"),
  join(root, "apps/web/.next/BUILD_ID"),
];

const existingApi = await isTrustLayerApi();
const existingWeb = await isPortOpen(3000);
if (existingApi && existingWeb) {
  console.log("TrustLayer is already running at http://localhost:3000");
  if (!noOpen) openBrowser("http://localhost:3000");
  process.exit(0);
}
if (await isPortOpen(4000)) throw new Error("Port 4000 is already in use. Stop that process and run TrustLayer again.");
if (existingWeb) throw new Error("Port 3000 is already in use. Stop that process and run TrustLayer again.");

if (needsBuild()) {
  console.log("Preparing TrustLayer for first use...");
  const build = runBuild();
  if (build.error) throw build.error;
  if (build.status !== 0) process.exit(build.status ?? 1);
  mkdirSync(dataDirectory, { recursive: true });
  writeFileSync(buildStamp, new Date().toISOString());
}

const api = spawn(process.execPath, [join(root, "apps/api/dist/server.js")], {
  cwd: root,
  stdio: "inherit",
  windowsHide: true,
  env: { ...process.env, TRUSTLAYER_DATA_DIR: dataDirectory },
});
const web = spawn(
  process.execPath,
  [join(root, "node_modules/next/dist/bin/next"), "start", join(root, "apps/web"), "-H", "127.0.0.1", "-p", "3000"],
  { cwd: root, stdio: "inherit", windowsHide: true },
);

let stopping = false;
function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  api.kill();
  web.kill();
  process.exitCode = exitCode;
}

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
api.on("exit", (code) => {
  if (!stopping) stop(code ?? 1);
});
web.on("exit", (code) => {
  if (!stopping) stop(code ?? 1);
});

await Promise.all([
  waitFor("http://127.0.0.1:4000/healthz"),
  waitFor("http://127.0.0.1:3000/"),
]);
console.log("\nTrustLayer is ready at http://localhost:3000");
console.log("Your data stays in " + dataDirectory);
if (!noOpen) openBrowser("http://localhost:3000");

function needsBuild() {
  if (requiredOutputs.some((path) => !existsSync(path)) || !existsSync(buildStamp)) return true;
  const stampTime = statSync(buildStamp).mtimeMs;
  const sourceRoots = ["apps", "packages", "workers", "scripts"].map((path) => join(root, path));
  const newestSource = Math.max(
    statSync(join(root, "package.json")).mtimeMs,
    statSync(join(root, "package-lock.json")).mtimeMs,
    ...sourceRoots.map(newestModifiedTime),
  );
  return newestSource > stampTime;
}

function runBuild() {
  if (process.env.npm_execpath) {
    return spawnSync(process.execPath, [process.env.npm_execpath, "run", "build"], {
      cwd: root,
      stdio: "inherit",
      windowsHide: true,
    });
  }
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  return spawnSync(npm, ["run", "build"], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
    shell: process.platform === "win32",
  });
}

function newestModifiedTime(path) {
  let newest = statSync(path).mtimeMs;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (["node_modules", "dist", ".next", "coverage"].includes(entry.name)) continue;
    const child = join(path, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? newestModifiedTime(child) : statSync(child).mtimeMs);
  }
  return newest;
}

async function waitFor(url) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (stopping) throw new Error(`TrustLayer stopped before ${url} became ready`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  stop(1);
  throw new Error(`Timed out waiting for ${url}`);
}

async function isTrustLayerApi() {
  try {
    const response = await fetch("http://127.0.0.1:4000/healthz", { signal: AbortSignal.timeout(500) });
    const body = await response.json();
    return response.ok && body?.status === "ok" && body?.mode === "local";
  } catch {
    return false;
  }
}

function isPortOpen(port) {
  return new Promise((resolvePromise) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(500);
    socket.once("connect", () => {
      socket.destroy();
      resolvePromise(true);
    });
    const unavailable = () => {
      socket.destroy();
      resolvePromise(false);
    };
    socket.once("error", unavailable);
    socket.once("timeout", unavailable);
  });
}

function openBrowser(url) {
  const command =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
  const child = spawn(command[0], command[1], { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}
