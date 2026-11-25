// Copies dist/ to dist-e2e/ and grants the copy access to loopback pages.
// The shipped extension uses activeTab and only runs after a toolbar click, which a test
// cannot press. With host access, the test can inject content.js the same way the click does.
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const src = resolve(root, "dist");
const out = resolve(root, "dist-e2e");

if (!existsSync(resolve(src, "manifest.json"))) {
  console.error("Job Autofill e2e: dist/ has no manifest.json. Run `npm run build` first.");
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
cpSync(src, out, { recursive: true });

const manifestPath = resolve(out, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.host_permissions = ["http://127.0.0.1/*", "http://localhost/*"];
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log("Job Autofill e2e: wrote dist-e2e/ with loopback host access");
