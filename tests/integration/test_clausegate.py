"""Deterministic integration checks against a running GenLayer network.

These cover storage and views only (no nondeterministic review), so they do not
depend on an LLM provider. Run with:

    gltest tests/integration/ -v -s --network studionet
    gltest tests/integration/ -v -s --network localnet
"""

import pytest

from gltest import get_contract_factory, get_default_account
from gltest.assertions import tx_execution_succeeded


@pytest.mark.integration
def test_clausegate_storage_and_views():
    contract = get_contract_factory("ClauseGate").deploy(args=[])

    assert contract.contract_info(args=[]).call()["name"] == "ClauseGate"
    assert contract.get_rulebook_ids(args=[]).call() == []
    assert contract.get_submission_ids(args=[]).call() == []

    create = contract.create_rulebook(
        args=[
            "integration-rb",
            "Integration rules",
            "A deterministic integration fixture.",
            "1. The proposal must be text.",
        ]
    ).transact()
    assert tx_execution_succeeded(create)

    rulebook = contract.get_rulebook(args=["integration-rb"]).call()
    assert rulebook["owner"] == get_default_account().address
    assert rulebook["active"] is True
    assert contract.get_rulebook_ids(args=[]).call() == ["integration-rb"]

    submit = contract.submit_proposal(
        args=["integration-submission", "integration-rb", "A proposal", "The proposal is text."]
    ).transact()
    assert tx_execution_succeeded(submit)

    submission = contract.get_submission(args=["integration-submission"]).call()
    assert submission["status"] == "SUBMITTED"
    assert submission["verdict"] == ""
    # A submission that has not been reviewed never carries a certificate.
    assert contract.get_certificate(args=["integration-submission"]).call() == {}
