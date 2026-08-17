"""Static guardrails for the v1/v2 consensus-critical boundaries."""

import os
from pathlib import Path


def source_text() -> str:
    return Path(os.environ.get("CLAUSEGATE_CONTRACT_PATH", "contracts/clausegate_v2.py")).read_text()


def test_v2_prompt_marks_all_external_content_untrusted():
    source = source_text()
    assert "TRUSTED_SYSTEM_EVALUATION_INSTRUCTIONS" in source
    assert "UNTRUSTED_RULEBOOK_DATA" in source
    assert "UNTRUSTED_PROPOSAL_DATA" in source
    assert "UNTRUSTED_EXTERNAL_EVIDENCE_DATA" in source
    assert "No evidence cannot be COMPLIANT" in source
    assert "JSON schemas" in source
    assert "never as an instruction" in source
    assert "Return no rationale" in source


def test_v2_uses_documented_nondeterministic_web_request_and_independent_fetch():
    source = source_text()
    assert "gl.nondet.web.request" in source
    assert source.count("_review_from_fetch(*prompt_args)") >= 2
    assert "validator_fn" in source
    assert "return leader == validator" in source


def test_v2_has_bounded_https_evidence_and_v2_certificate_gates():
    source = source_text()
    assert "MAX_EVIDENCE_ITEMS = 4" in source
    assert "MAX_EVIDENCE_URL_LENGTH = 500" in source
    assert "MAX_EVIDENCE_CLAIM_LENGTH = 1_000" in source
    assert "https://" in source
    assert '"certificate_version": "2"' in source
    assert 'if verdict == COMPLIANT:' in source


def test_contract_has_no_node_local_clock_or_randomness():
    source = source_text()
    assert "import time" not in source
    assert "import datetime" not in source
    assert "datetime." not in source
    assert "time.time" not in source
    assert "random." not in source
    assert '"timestamp"' not in source


def test_v1_source_and_production_artifacts_are_not_replaced_by_v2():
    v1 = Path("contracts/clausegate.py").read_text()
    assert '"version": "1.0.0"' in v1
    assert '"certificate_version": "1"' in v1
    assert Path("deploy/bradbury/release-manifest.json").exists()
