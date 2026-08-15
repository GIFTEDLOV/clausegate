"""Static guardrails for the consensus-critical boundary."""

import os
from pathlib import Path


def source_text() -> str:
    return Path(os.environ.get("CLAUSEGATE_CONTRACT_PATH", "contracts/clausegate.py")).read_text()


def test_prompt_has_explicit_untrusted_data_boundary_and_no_browsing():
    source = source_text()
    assert "UNTRUSTED_RULEBOOK_TITLE" in source
    assert "UNTRUSTED_RULEBOOK_RULES" in source
    assert "UNTRUSTED_PROPOSAL" in source
    assert "Do not browse" in source
    assert "Do not search the web" in source
    assert "Return no rationale and no extra fields" in source


def test_contract_has_no_node_local_clock_or_randomness():
    source = source_text()
    assert "import time" not in source
    assert "import datetime" not in source
    assert "datetime." not in source
    assert "time.time" not in source
    assert "random." not in source
    assert '"timestamp"' not in source
