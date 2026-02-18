#!/usr/bin/env node
// Cross-platform build script.
// Runs the same steps as the old shell && chain, but via Node's spawnSync
// so it works on Windows cmd.exe/PowerShell and Unix alike.
import { spawnSync } from "node:child_process";

const isWin = process.platform === "win32";

function run(cmd, args) {
  // On Windows use shell:true so cmd.exe resolves .cmd/.bat in PATH itself,
  // avoiding broken paths when the tool lives under "C:\Program Files\...".
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: isWin,
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
