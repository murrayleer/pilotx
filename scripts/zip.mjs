import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const dist = path.join(root, "dist");
const out = path.join(root, "pilotx.zip");

if (!existsSync(dist)) {
  console.error("Missing dist/. Run npm run build first.");
  process.exit(1);
}

execSync(`cd ${dist} && zip -r ${out} .`, { stdio: "inherit" });
console.log("Created", out);
