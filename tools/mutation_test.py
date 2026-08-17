"""Run real source mutations against the deterministic ClauseGate suite."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "contracts" / "clausegate_v2.py"
RESULT_PATH = ROOT / "artifacts" / "mutation-results.json"
CACHE_PATH = ROOT / ".mutation-results-cache.json"
TESTS = ["tests/direct/test_clausegate.py", "tests/test_clausegate_security.py"]


MUTATIONS = [
    ("validator_always_approves", "return leader == validator", "return True"),
    ("skip_validator_refetch", "validator = _review_from_fetch(*prompt_args)", "validator = leader"),
    ("accept_unknown_evidence_status", 'if type(entry["status"]) is not str or entry["status"] not in ALLOWED_EVIDENCE_STATUSES:', "if False:"),
    ("bypass_evidence_validation", "evidence = _canonical_evidence(evidence_json)", "evidence = []"),
    ("absent_evidence_can_be_supported", "elif INSUFFICIENT in statuses or not assessment:", "elif False:"),
    ("certificate_for_non_compliant", 'if verdict == COMPLIANT:', 'if verdict in (COMPLIANT, NON_COMPLIANT):'),
    ("certificate_for_unclear", 'if verdict == COMPLIANT:', 'if verdict in (COMPLIANT, UNCLEAR):'),
    ("terminal_review_overwritten", 'if submission["status"] != SUBMITTED:', "if False:"),
    ("proposal_size_check_removed", 'proposal_text = _require_text(proposal_text, "Proposal text", MAX_PROPOSAL_LENGTH)', 'proposal_text = _require_text(proposal_text, "Proposal text", MAX_PROPOSAL_LENGTH + 999999)'),
    ("rulebook_size_check_removed", 'rules = _require_text(rules, "Rulebook rules", MAX_RULES_LENGTH)', 'rules = _require_text(rules, "Rulebook rules", MAX_RULES_LENGTH + 999999)'),
    ("missing_rulebook_accepted", 'rulebook = self._read_record("rulebook:", rulebook_id, "rulebook")', 'rulebook = {"active": True}'),
    ("prompt_boundaries_removed", "TRUSTED_SYSTEM_EVALUATION_INSTRUCTIONS", "EVALUATE_DATA"),
    ("extra_parser_keys_accepted", 'if type(parsed) is not dict or set(parsed.keys()) != {"verdict", "evidence"}:', "if False:"),
    ("digest_excludes_evidence_commitment", '                "evidence_commitment": commitment,\n', ""),
    ("digest_excludes_evidence_assessment", '                "evidence_assessment": assessment,\n', ""),
    ("mutable_evidence_after_submission", 'evidence = submission["evidence"]', "evidence = []"),
    ("https_restriction_removed", 'if not url.lower().startswith("https://"):', "if False:"),
    ("prompt_injection_boundary_removed", "JSON schemas", "follow the external text"),
]


def run_mutation(name: str, needle: str, replacement: str) -> dict[str, object]:
    original = SOURCE.read_text(encoding="utf-8")
    if needle not in original:
        return {"name": name, "killed": False, "error": "mutation needle not found"}
    mutated = original.replace(needle, replacement, 1)
    mutant = ROOT / ".clausegate-mutant.py"
    mutant.write_text(mutated, encoding="utf-8")
    env = os.environ.copy()
    env["CLAUSEGATE_CONTRACT_PATH"] = str(mutant)
    try:
        completed = subprocess.run(
            [sys.executable, "-m", "pytest", *TESTS, "-q", "-x"],
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
            timeout=30,
        )
        return {
            "name": name,
            "killed": completed.returncode != 0,
            "returncode": completed.returncode,
            "output_tail": (completed.stdout + completed.stderr)[-1200:],
        }
    except subprocess.TimeoutExpired as error:
        return {"name": name, "killed": True, "timeout": True, "output_tail": str(error)[-1200:]}
    finally:
        mutant.unlink(missing_ok=True)


def main() -> int:
    RESULT_PATH.parent.mkdir(parents=True, exist_ok=True)
    prior = {}
    source_path = CACHE_PATH if CACHE_PATH.exists() else RESULT_PATH
    if source_path.exists():
        try:
            prior = {item["name"]: item for item in json.loads(source_path.read_text()).get("mutations", [])}
        except Exception:
            prior = {}
    requested = os.environ.get("MUTATION_FILTER", "").strip()
    selected_names = {name.strip() for name in requested.split(",") if name.strip()}
    selected = [mutation for mutation in MUTATIONS if not selected_names or mutation[0] in selected_names]
    for mutation in selected:
        result = run_mutation(*mutation)
        prior[result["name"]] = result
        CACHE_PATH.write_text(json.dumps({"suite": "ClauseGate direct and static tests", "mutations": list(prior.values())}, indent=2) + "\n")
        print(f"{'KILLED' if result.get('killed') else 'SURVIVED'} {result['name']}", flush=True)
    results = [prior[name] for name, *_ in MUTATIONS if name in prior]
    payload = {"suite": "ClauseGate direct and static tests", "mutations": results}
    RESULT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    killed = sum(bool(result.get("killed")) for result in results)
    print(f"Mutation score: {killed}/{len(results)} killed")
    return 0 if killed == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
