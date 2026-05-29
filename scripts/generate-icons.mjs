#!/usr/bin/env node
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
execSync("python3 scripts/generate-icons.py", { stdio: "inherit", cwd: root });
