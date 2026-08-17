import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const decisions = read("app/decisions/page.tsx");
const certificates = read("app/certificates/page.tsx");
const hooks = read("lib/hooks/useClauseGate.ts");
const explorer = read("lib/genlayer/explorer.ts");

const assertions = [
  ["decisions route filters REVIEWED", /status\s*===\s*[\"']REVIEWED[\"']/.test(decisions)],
  ["certificates route filters COMPLIANT", /verdict\s*===\s*[\"']COMPLIANT[\"']/.test(hooks)],
  ["certificates route requires certificate", /certificate_issued/.test(hooks) && /getCertificate/.test(hooks)],
  ["decision links use submission detail", /\/submissions\//.test(decisions)],
  ["explorer helper uses address route", /\/address\//.test(explorer)],
  ["explorer helper uses tx route", /\/tx\//.test(explorer)],
  ["frontend uses Bradbury contract", /0x49446d1e225Ba9821d38457DcdCAb31b2170c061/.test(read("lib/config/deployment.ts"))],
  ["frontend uses Bradbury RPC", /rpc-bradbury\.genlayer\.com/.test(read("lib/genlayer/network.ts"))],
  ["certificate data is read-only", !/reviewSubmission|submitProposal|createRulebook/.test(certificates)],
];
const failures = assertions.filter(([, ok]) => !ok).map(([name]) => name);
if (failures.length) {
  console.error(`frontend presentation invariants failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(`frontend presentation invariants: PASS (${assertions.length} checks)`);
}
