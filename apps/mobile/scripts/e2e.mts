/**
 * The mobile E2E run (PLAN.md §2.14): the web app's E2E server (a fresh
 * in-memory MongoDB with the seeded accounts, apps/web/e2e/server.mts),
 * Metro pointed at it, both ports reversed into the Android emulator, then
 * every Maestro flow in maestro/.
 *
 * Needs a running emulator (one at a time) with the development build
 * installed, and Maestro in ~/.maestro (or MAESTRO=path). E2E_PORT (default
 * 3100) and METRO_PORT (default 8082) pick the ports; SKIP_E2E_BUILD=1 reuses
 * the web build in apps/web/.next-e2e. Arguments go to `maestro test`, e.g.
 * a single flow: `pnpm mobile:e2e maestro/offline.yaml`.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { E2E_PASSWORD, E2E_PORT } from "../../web/e2e/accounts";

const MOBILE = path.resolve(import.meta.dirname, "..");
const WEB = path.resolve(MOBILE, "../web");
const METRO_PORT = Number(process.env.METRO_PORT || 8082);
const WINDOWS = process.platform === "win32";

const ADB = process.env.ANDROID_HOME
  ? path.join(process.env.ANDROID_HOME, "platform-tools", "adb")
  : WINDOWS && process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "Android", "Sdk", "platform-tools", "adb.exe")
    : "adb";
const MAESTRO =
  process.env.MAESTRO ||
  path.join(homedir(), ".maestro", "bin", WINDOWS ? "maestro.bat" : "maestro");

const children: ChildProcess[] = [];

function start(
  name: string,
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string>,
) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    // Its own process group, so stop() can end the whole tree.
    detached: !WINDOWS,
  });
  const prefix = (chunk: Buffer) =>
    chunk
      .toString()
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => `[${name}] ${line}\n`)
      .join("");
  child.stdout?.on("data", (chunk: Buffer) => process.stdout.write(prefix(chunk)));
  child.stderr?.on("data", (chunk: Buffer) => process.stderr.write(prefix(chunk)));
  child.on("exit", (code) => {
    if (!stopping) fail(`${name} exited (${code}) before the run finished`);
  });
  children.push(child);
}

let stopping = false;
function stop() {
  stopping = true;
  for (const child of children) {
    if (child.pid === undefined || child.exitCode !== null) continue;
    // A shell's children (next start, mongod, Metro) outlive a plain kill.
    if (WINDOWS) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
    else process.kill(-child.pid, "SIGTERM");
  }
}

function fail(message: string): never {
  console.error(`[e2e] ${message}`);
  stop();
  process.exit(1);
}

async function waitFor(name: string, url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  fail(`${name} didn't answer at ${url}`);
}

const runAdb = (...args: string[]) => spawnSync(ADB, args, { encoding: "utf8", timeout: 30_000 });

function adb(...args: string[]) {
  const result = runAdb(...args);
  if (result.status !== 0) fail(`adb ${args.join(" ")} failed: ${result.stderr || result.error}`);
  return result.stdout;
}

process.on("SIGINT", () => {
  stop();
  process.exit(130);
});

// The adb server sometimes wedges between runs: commands hang instead of
// failing. A restart clears it (if not, kill every adb process).
if (runAdb("devices").status !== 0) {
  console.log("[e2e] adb didn't answer; restarting its server");
  runAdb("kill-server");
}
const devices = adb("devices")
  .split("\n")
  .filter((line) => line.trim().endsWith("\tdevice"));
if (devices.length !== 1) {
  fail(
    `found ${devices.length} devices: start one emulator (qct_phone) with the development build`,
  );
}

start("server", "pnpm", ["exec", "tsx", "e2e/server.mts"], WEB, { E2E_PORT: String(E2E_PORT) });
// The web build can take minutes; SKIP_E2E_BUILD=1 skips it.
await waitFor("The E2E server", `http://localhost:${E2E_PORT}/`, 10 * 60_000);

// EXPO_PUBLIC_ values are inlined into the bundle: --clear drops a bundle
// built against another server.
start(
  "metro",
  "pnpm",
  ["exec", "expo", "start", "--dev-client", "--port", String(METRO_PORT), "--clear"],
  MOBILE,
  { EXPO_PUBLIC_API_URL: `http://localhost:${E2E_PORT}`, CI: "1" },
);
await waitFor("Metro", `http://localhost:${METRO_PORT}/status`, 2 * 60_000);

// Build the bundle the app will ask for (its URL is in the Android manifest)
// before the app starts: a cold build starved the emulator, and Android
// killed the starting app as not responding.
console.log("[e2e] building the Android bundle");
const manifest = (await (
  await fetch(`http://localhost:${METRO_PORT}/`, {
    headers: { "expo-platform": "android", accept: "application/expo+json,application/json" },
  })
).json()) as { launchAsset: { url: string } };
const bundle = await fetch(manifest.launchAsset.url);
if (!bundle.ok) fail(`the bundle failed to build (${bundle.status}): ${await bundle.text()}`);
await bundle.arrayBuffer();

// The emulator reaches both through its own localhost.
adb("reverse", `tcp:${METRO_PORT}`, `tcp:${METRO_PORT}`);
adb("reverse", `tcp:${E2E_PORT}`, `tcp:${E2E_PORT}`);

const targets = process.argv.slice(2);
const maestro = spawnSync(
  MAESTRO,
  [
    "test",
    ...(targets.length > 0 ? targets : ["maestro/"]),
    "-e",
    `METRO_URL=http://localhost:${METRO_PORT}`,
    "-e",
    `PASSWORD=${E2E_PASSWORD}`,
  ],
  {
    cwd: MOBILE,
    stdio: "inherit",
    shell: WINDOWS,
    // Arabic in Maestro's output instead of question marks.
    env: { ...process.env, JAVA_TOOL_OPTIONS: "-Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8" },
  },
);
stop();
process.exit(maestro.status ?? 1);
