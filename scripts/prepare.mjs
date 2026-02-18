#!/usr/bin/env node
// Cross-platform replacement for the bash prepare script.
// Sets git core.hooksPath to "git-hooks" when run inside a git repo.
import { execFileSync } from "node:child_process";

function run(cmd, args) {
  try {
    execFileSync(cmd, args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// Skip silently if git is not available or not in a git repo
if (!run("git", ["rev-parse", "--is-inside-work-tree"])) {
  process.exit(0);
}

run("git", ["config", "core.hooksPath", "git-hooks"]);
