import { execSync } from "node:child_process";
import { mkdir, rm, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const dist = path.join(root, "dist");

if (existsSync(dist)) {
  await rm(dist, { recursive: true, force: true });
}
await mkdir(dist, { recursive: true });

execSync("vite build", { stdio: "inherit" });

await cp(path.join(root, "manifest.json"), path.join(dist, "manifest.json"));
await cp(path.join(root, "LICENSE"), path.join(dist, "LICENSE"));
await cp(path.join(root, "assets"), path.join(dist, "assets"), { recursive: true });
await mkdir(path.join(dist, "content"), { recursive: true });
await cp(path.join(root, "src/content/sidebar.css"), path.join(dist, "content/sidebar.css"));
await mkdir(path.join(dist, "styles"), { recursive: true });
await cp(path.join(root, "styles/tailwind.css"), path.join(dist, "styles/tailwind.css"));

console.log("Build complete. Dist located at", dist);
