#!/usr/bin/env node
// Cross-platform build script.
// Runs the same steps as the old shell && chain, but via Node's spawnSync
// so it works on Windows cmd.exe/PowerShell and Unix alike.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const isWin = process.platform === "win32";

/** Find the full path of a command, honoring PATHEXT on Windows. */
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
  // .cmd / .bat files must go through cmd.exe on Windows
  const needsShell = isWin && /\.(cmd|bat|com)$/i.test(path.extname(resolved));
  const result = spawnSync(resolved, args, {
    stdio: "inherit",
    shell: needsShell,
  });
  if (result.error) {
    throw result.error;
  }
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

// Equivalent to the old build script && chain:
run("pnpm", ["canvas:a2ui:bundle"]);
run("pnpm", ["exec", "tsdown"]);
run("pnpm", ["build:plugin-sdk:dts"]);

for (const script of [
  "scripts/write-plugin-sdk-entry-dts.ts",
  "scripts/canvas-a2ui-copy.ts",
  "scripts/copy-hook-metadata.ts",
  "scripts/copy-export-html-templates.ts",
  "scripts/write-build-info.ts",
  "scripts/write-cli-compat.ts",
]) {
  run("node", ["--import", "tsx", script]);
}
