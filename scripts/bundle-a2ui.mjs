#!/usr/bin/env node
import { spawnSync } from "node:child_process";
// Cross-platform replacement for scripts/bundle-a2ui.sh.
import { createHash } from "node:crypto";
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hashFile = path.join(rootDir, "src", "canvas-host", "a2ui", ".bundle.hash");
const outputFile = path.join(rootDir, "src", "canvas-host", "a2ui", "a2ui.bundle.js");
const a2uiRendererDir = path.join(rootDir, "vendor", "a2ui", "renderers", "lit");
const a2uiAppDir = path.join(rootDir, "apps", "shared", "OpenClawKit", "Tools", "CanvasA2UI");

const isWin = process.platform === "win32";

function which(name) {
  const dirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const exts = isWin
    ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";").filter(Boolean)
    : [""];
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, `${name}${ext}`);
      try {
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      } catch {
        // ignore
      }
    }
  }
  return name;
}

function run(cmd, args) {
  const resolved = which(cmd);
  const needsShell = isWin && /\.(cmd|bat|com)$/i.test(path.extname(resolved));
  const result = spawnSync(resolved, args, {
    stdio: "inherit",
    cwd: rootDir,
    shell: needsShell,
  });
  if (result.error) {
    throw result.error;
  }
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function walk(entry, out = []) {
  const st = await fsp.stat(entry);
  if (st.isDirectory()) {
    const entries = await fsp.readdir(entry);
    for (const e of entries) {
      await walk(path.join(entry, e), out);
    }
  } else {
    out.push(entry);
  }
  return out;
}

async function computeHash(inputPaths) {
  const files = [];
  for (const p of inputPaths) {
    await walk(p, files);
  }
  files.sort((a, b) => a.split(path.sep).join("/").localeCompare(b.split(path.sep).join("/")));
  const hash = createHash("sha256");
  for (const filePath of files) {
    const rel = path.relative(rootDir, filePath).split(path.sep).join("/");
    hash.update(rel);
    hash.update("\0");
    hash.update(await fsp.readFile(filePath));
    hash.update("\0");
  }
  return hash.digest("hex");
}

// If sources are missing, fall back to prebuilt bundle (e.g. Docker / CI)
const sourcesExist = fs.existsSync(a2uiRendererDir) && fs.existsSync(a2uiAppDir);
if (!sourcesExist) {
  if (fs.existsSync(outputFile)) {
    console.log("A2UI sources missing; keeping prebuilt bundle.");
    process.exit(0);
  }
  console.error(`A2UI sources missing and no prebuilt bundle found at: ${outputFile}`);
  process.exit(1);
}

const inputPaths = [
  path.join(rootDir, "package.json"),
  path.join(rootDir, "pnpm-lock.yaml"),
  a2uiRendererDir,
  a2uiAppDir,
];

const currentHash = await computeHash(inputPaths);
if (fs.existsSync(hashFile)) {
  const previousHash = fs.readFileSync(hashFile, "utf8").trim();
  if (previousHash === currentHash && fs.existsSync(outputFile)) {
    console.log("A2UI bundle up to date; skipping.");
    process.exit(0);
  }
}

run("pnpm", ["-s", "exec", "tsc", "-p", path.join(a2uiRendererDir, "tsconfig.json")]);
run("pnpm", ["exec", "rolldown", "-c", path.join(a2uiAppDir, "rolldown.config.mjs")]);

fs.writeFileSync(hashFile, currentHash + "\n");
