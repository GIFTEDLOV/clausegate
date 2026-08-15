"""Run real source mutations against the deterministic ClauseGate suite."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "contracts" / "clausegate.py"
RESULT_PATH = ROOT / "artifacts" / "mutation-results.json"
TESTS = ["tests/direct/test_clausegate.py", "tests/test_clausegate_security.py"]


MUTATIONS = [
    ("validator_always_approves", 'return leader_verdict == validator_verdict', "return True"),
    (
        "unknown_verdict_accepted",
        'if type(verdict) is not str or verdict not in ALLOWED_VERDICTS:',
        "if False:",
    ),
    ("certificate_for_non_compliant", 'if verdict == COMPLIANT:', 'if verdict in (COMPLIANT, NON_COMPLIANT):'),
    ("certificate_for_unclear", 'if verdict == COMPLIANT:', 'if verdict in (COMPLIANT, UNCLEAR):'),
    ('terminal_review_overwritten', 'if submission["status"] != SUBMITTED:', "if False:"),
    (
        "proposal_size_check_removed",
        'proposal_text, "Proposal text", MAX_PROPOSAL_LENGTH',
        'proposal_text, "Proposal text", MAX_PROPOSAL_LENGTH + 999999',
    ),
    (
        "rulebook_size_check_removed",
        'rules, "Rulebook rules", MAX_RULES_LENGTH',
        'rules, "Rulebook rules", MAX_RULES_LENGTH + 999999',
    ),
    (
        "missing_rulebook_accepted",
        'rulebook = self._read_record("rulebook:", rulebook_id, "rulebook")',
        'rulebook = {"active": True}',
    ),
    (
        "prompt_boundaries_removed",
        "Do not browse. Do not search the web.",
        "Evaluate the data.",
    ),
    (
        "extra_parser_keys_accepted",
        'if type(parsed) is not dict or set(parsed.keys()) != {"verdict"}:',
        "if False:",
    ),
    ("digest_excludes_verdict", '            "verdict": verdict,\n', ""),
    ('node_local_timestamp_enters_state', '                "active": True,\n', '                "active": True,\n                "timestamp": 123,\n'),
]


def run_mutation(name: str, needle: str, replacement: str) -> dict[str, object]:
    original = SOURCE.read_text(encoding="utf-8")
    if needle not in original:
        return {"name": name, "killed": False, "error": "mutation needle not found"}
    mutated = original.replace(needle, replacement, 1)
    temp_dir = Path(tempfile.mkdtemp(prefix="clausegate-mutant-"))
    mutant = temp_dir / "clausegate.py"
    mutant.write_text(mutated, encoding="utf-8")
    env = os.environ.copy()
    env["CLAUSEGATE_CONTRACT_PATH"] = str(mutant)
    try:
        completed = subprocess.run(
            [sys.executable, "-m", "pytest", *TESTS, "-q"],
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
            timeout=90,
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
        shutil.rmtree(temp_dir, ignore_errors=True)


def main() -> int:
    RESULT_PATH.parent.mkdir(parents=True, exist_ok=True)
    results = [run_mutation(*mutation) for mutation in MUTATIONS]
    payload = {"suite": "ClauseGate direct and static tests", "mutations": results}
    RESULT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    for result in results:
        print(f"{'KILLED' if result.get('killed') else 'SURVIVED'} {result['name']}")
    killed = sum(bool(result.get("killed")) for result in results)
    print(f"Mutation score: {killed}/{len(results)} killed")
    return 0 if killed == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
