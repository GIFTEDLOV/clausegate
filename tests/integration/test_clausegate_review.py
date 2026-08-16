"""Stage 5 multi-validator review proof against a live GenLayer network.

These tests exercise the only nondeterministic path -- review_submission --
end to end through real leader + validator consensus and a real LLM. They are
marked ``slow`` because they make live model calls and are nondeterministic;
run them deliberately, paced to respect Studio rate limits:

    gltest tests/integration/test_clausegate_review.py -v -s -m slow --network studionet

The fixtures are the exact Stage 5 scenarios: a clearly COMPLIANT proposal, a
clearly NON_COMPLIANT proposal, and a genuinely UNCLEAR proposal. The core
security assertion is not merely the verdict but the certificate invariant:
a certificate exists if and only if the committed verdict is COMPLIANT.
"""

import uuid

import pytest

from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded, tx_execution_failed


RULES = (
    "1. The submission must be open source.\n"
    "2. It must include a working demo.\n"
    "3. It must not contain gambling functionality."
)
DESCRIPTION = "Rules for the builder round."
TITLE = "Hackathon Submission Rules"

COMPLIANT_PROPOSAL = (
    "The project is open source under MIT. A working demo is deployed. "
    "The application has no betting, wagering, staking, or gambling functionality."
)
NON_COMPLIANT_PROPOSAL = (
    "The source code is private. The application lets users wager tokens on "
    "football results. A demo is deployed."
)
UNCLEAR_PROPOSAL = "The project is ready for submission."


def _deploy_with_rulebook():
    """Deploy a fresh contract and seed one rulebook; return (contract, rb_id)."""
    contract = get_contract_factory("ClauseGate").deploy(args=[])
    rulebook_id = f"rb-{uuid.uuid4().hex[:12]}"
    receipt = contract.create_rulebook(
        args=[rulebook_id, TITLE, DESCRIPTION, RULES]
    ).transact()
    assert tx_execution_succeeded(receipt)
    return contract, rulebook_id


def _submit(contract, rulebook_id, proposal):
    submission_id = f"sub-{uuid.uuid4().hex[:12]}"
    receipt = contract.submit_proposal(
        args=[submission_id, rulebook_id, "Submission", proposal]
    ).transact()
    assert tx_execution_succeeded(receipt)
    return submission_id


def _review(contract, submission_id):
    receipt = contract.review_submission(args=[submission_id]).transact()
    assert tx_execution_succeeded(receipt)
    return contract.get_submission(args=[submission_id]).call()


@pytest.mark.integration
@pytest.mark.slow
def test_stage5_compliant_issues_certificate():
    contract, rulebook_id = _deploy_with_rulebook()
    submission_id = _submit(contract, rulebook_id, COMPLIANT_PROPOSAL)

    submission = _review(contract, submission_id)
    assert submission["status"] == "REVIEWED"
    assert submission["verdict"] == "COMPLIANT"
    assert submission["certificate_issued"] is True

    certificate = contract.get_certificate(args=[submission_id]).call()
    assert certificate != {}
    assert certificate["verdict"] == "COMPLIANT"
    assert certificate["result_digest"] == submission["result_digest"]
    assert submission["result_digest"] != ""


@pytest.mark.integration
@pytest.mark.slow
def test_stage5_non_compliant_has_no_certificate():
    contract, rulebook_id = _deploy_with_rulebook()
    submission_id = _submit(contract, rulebook_id, NON_COMPLIANT_PROPOSAL)

    submission = _review(contract, submission_id)
    assert submission["status"] == "REVIEWED"
    assert submission["verdict"] == "NON_COMPLIANT"
    assert submission["certificate_issued"] is False
    assert submission["result_digest"] == ""
    assert contract.get_certificate(args=[submission_id]).call() == {}


@pytest.mark.integration
@pytest.mark.slow
def test_stage5_unclear_has_no_certificate():
    contract, rulebook_id = _deploy_with_rulebook()
    submission_id = _submit(contract, rulebook_id, UNCLEAR_PROPOSAL)

    submission = _review(contract, submission_id)
    assert submission["status"] == "REVIEWED"
    assert submission["verdict"] == "UNCLEAR"
    assert submission["certificate_issued"] is False
    assert submission["result_digest"] == ""
    assert contract.get_certificate(args=[submission_id]).call() == {}


@pytest.mark.integration
@pytest.mark.slow
def test_stage5_reviewed_submission_is_terminal():
    """A committed REVIEWED verdict cannot be overwritten by a second review."""
    contract, rulebook_id = _deploy_with_rulebook()
    submission_id = _submit(contract, rulebook_id, COMPLIANT_PROPOSAL)

    first = _review(contract, submission_id)
    assert first["status"] == "REVIEWED"
    first_verdict = first["verdict"]
    first_digest = first["result_digest"]

    # Second review must fail closed; the committed state must be unchanged.
    try:
        second_receipt = contract.review_submission(args=[submission_id]).transact()
        assert tx_execution_failed(second_receipt)
    except Exception:
        pass  # A hard revert surfacing as a client exception is also fail-closed.

    after = contract.get_submission(args=[submission_id]).call()
    assert after["status"] == "REVIEWED"
    assert after["verdict"] == first_verdict
    assert after["result_digest"] == first_digest
