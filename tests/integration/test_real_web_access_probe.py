"""Real GenVM Web Access probe; run deliberately against Studio/Studionet."""

import json

import pytest

from gltest import get_contract_factory, get_default_account
from gltest.assertions import tx_execution_succeeded


@pytest.mark.integration
@pytest.mark.slow
def test_real_request_status_body_and_render():
    print(f"studionet_default_account={get_default_account().address}")
    contract = get_contract_factory("WebAccessProbe").deploy(args=[])
    receipt = contract.probe(args=[]).transact()
    assert tx_execution_succeeded(receipt)
    result = json.loads(contract.get_result(args=[]).call())
    assert result["status"] == 200
    assert result["body_type"] in {"bytes", "other"}
    assert result["rendered_text"]
