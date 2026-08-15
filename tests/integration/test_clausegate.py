"""Integration checks for a running GenLayer Studio/localnet."""

import pytest

from gltest import get_contract_factory, get_default_account
from gltest.assertions import tx_execution_succeeded


@pytest.mark.integration
def test_clausegate_storage_and_views():
    contract = get_contract_factory("ClauseGate").deploy()
    assert contract.contract_info(args=[])["name"] == "ClauseGate"
    assert contract.get_rulebook_ids(args=[]) == []
    assert contract.get_submission_ids(args=[]) == []

    create = contract.create_rulebook(
        args=["integration-rb", "Integration rules", "A deterministic integration fixture.", "1. The proposal must be text."]
    )
    assert tx_execution_succeeded(create)
    rulebook = contract.get_rulebook(args=["integration-rb"])
    assert rulebook["owner"] == get_default_account().address
    assert rulebook["active"] is True

    submit = contract.submit_proposal(
        args=["integration-submission", "integration-rb", "A proposal", "The proposal is text."]
    )
    assert tx_execution_succeeded(submit)
    submission = contract.get_submission(args=["integration-submission"])
    assert submission["status"] == "SUBMITTED"
    assert contract.get_certificate(args=["integration-submission"]) == {}
