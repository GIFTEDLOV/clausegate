import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";

const root = resolve(import.meta.dirname, "..");
const ignored = new Set([".git", "node_modules", ".next", ".vercel", "__pycache__", ".pytest_cache", "coverage"]);
const extensions = new Set([".js", ".mjs", ".ts", ".tsx", ".json", ".py", ".yml", ".yaml", ".toml", ".txt"]);
const patterns = [
  { name: "private key marker", re: /private[_-]?key\s*[:=]|BEGIN [A-Z ]*PRIVATE KEY/i },
  { name: "mnemonic marker", re: /mnemon[i]c|seed[_-]?phrase/i },
  { name: "extended private key", re: /xprv[0-9a-zA-Z]{20,}/i },
  { name: "GitHub token", re: /(?:gh[pousr]_|github_pat_)[0-9A-Za-z_]{20,}/ },
  { name: "Vercel token", re: /vercel[_-]?token\s*[:=]\s*["'][^"']{20,}/i },
];
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (extensions.has(full.slice(full.lastIndexOf(".")))) files.push(full);
  }
}
walk(root);

const findings = [];
for (const file of files) {
  if (file.endsWith("tools\\secret_scan.mjs") || file.endsWith("tools/secret_scan.mjs")) continue;
  const text = readFileSync(file, "utf8");
  for (const pattern of patterns) {
    if (pattern.re.test(text)) findings.push(`${relative(root, file)} -> ${pattern.name}`);
  }
}

if (findings.length) {
  console.error("secret-scan: possible secret material found:");
  for (const finding of findings) console.error(`  ${finding}`);
  process.exitCode = 1;
} else {
  console.log(`secret-scan: PASS (${files.length} relevant files scanned)`);
}
