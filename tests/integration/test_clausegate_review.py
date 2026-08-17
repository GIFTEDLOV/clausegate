"""Real GenVM v2 evidence/control integration cases.

Run deliberately against hosted Studionet after the public integration
attestation fixture is available on the repository default branch:

    gltest --network studionet tests/integration/test_clausegate_review.py -v -s -m integration

These tests are intentionally separate from the frozen v1 evidence history.
"""

import hashlib
import json
import uuid

import pytest

from gltest import get_contract_factory, get_default_account
from gltest.assertions import tx_execution_succeeded


SENDER = "0xeF3c34646049eAf74f7a0eDC4cce143a865085F5"
CONTROLLED_REPOSITORY = "https://github.com/GIFTEDLOV/clausegate"
CONTROLLED_EVIDENCE = [
    {
        "type": "GITHUB_REPOSITORY",
        "url": CONTROLLED_REPOSITORY,
        "claim": "The source repository is publicly accessible.",
    }
]
CONTROLLED_COMMITMENT = "dd5b3044fa5096a744b4ff6f1332ee53e9809b4f208bcbdb8170f654a58b119d"


def _canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def _sha(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _digest(rulebook, submission):
    assessment = submission["evidence_assessment"]
    assessment_digest = _sha(_canonical({"evidence": submission["evidence"], "assessment": assessment}))
    return _sha(
        _canonical(
            {
                "rulebook": {
                    "id": rulebook["rulebook_id"],
                    "title": rulebook["title"],
                    "description": rulebook["description"],
                    "rules": rulebook["rules"],
                },
                "submission": {
                    "id": submission["submission_id"],
                    "submitter": submission["submitter"],
                    "title": submission["title"],
                    "proposal_text": submission["proposal_text"],
                },
                "evidence": submission["evidence"],
                "evidence_commitment": submission["evidence_commitment"],
                "evidence_assessment": assessment,
                "evidence_assessment_digest": assessment_digest,
                "verdict": submission["verdict"],
            }
        )
    )


def _deploy_with_rulebook(rulebook_id):
    contract = get_contract_factory("ClauseGateV2").deploy(args=[])
    receipt = contract.create_rulebook(
        args=[
            rulebook_id,
            "Public repository rule",
            "A source repository must be publicly accessible.",
            "The cited source repository must be publicly accessible.",
        ]
    ).transact()
    assert tx_execution_succeeded(receipt)
    return contract


def _submit(contract, submission_id, rulebook_id, evidence, proposal):
    receipt = contract.submit_proposal(
        args=[submission_id, rulebook_id, "Integration submission", proposal, json.dumps(evidence)]
    ).transact()
    assert tx_execution_succeeded(receipt)


def _review(contract, submission_id):
    receipt = contract.review_submission(args=[submission_id]).transact()
    assert tx_execution_succeeded(receipt)
    return contract.get_submission(args=[submission_id]).call()


@pytest.mark.integration
@pytest.mark.slow
def test_real_github_controlled_evidence_certifies_v2():
    assert get_default_account().address.lower() == SENDER.lower()
    rulebook_id = "v2-real-public-repository"
    submission_id = "v2-real-github-controlled"
    contract = _deploy_with_rulebook(rulebook_id)
    _submit(contract, submission_id, rulebook_id, CONTROLLED_EVIDENCE, "The repository is public.")

    submission = _review(contract, submission_id)
    assert submission["status"] == "REVIEWED"
    assert submission["verdict"] == "COMPLIANT"
    assert submission["evidence_assessment"] == [
        {"index": 0, "status": "SUPPORTED", "control": "VERIFIED"}
    ]
    assert submission["evidence_commitment"] == CONTROLLED_COMMITMENT

    certificate = contract.get_certificate(args=[submission_id]).call()
    assert certificate["certificate_version"] == "2"
    assert certificate["evidence_commitment"] == CONTROLLED_COMMITMENT
    assert certificate["evidence_assessment_digest"] == _sha(
        _canonical(
            {
                "evidence": submission["evidence"],
                "assessment": submission["evidence_assessment"],
            }
        )
    )
    assert certificate["result_digest"] == _digest(
        contract.get_rulebook(args=[rulebook_id]).call(), submission
    )


@pytest.mark.integration
@pytest.mark.slow
def test_real_control_mismatch_cannot_certify():
    rulebook_id = "v2-real-public-repository"
    contract = _deploy_with_rulebook(rulebook_id)
    submission_id = "v2-real-github-mismatch"
    _submit(contract, submission_id, rulebook_id, CONTROLLED_EVIDENCE, "The repository is public.")

    submission = _review(contract, submission_id)
    assert submission["status"] == "REVIEWED"
    assert submission["verdict"] != "COMPLIANT"
    assert submission["certificate_issued"] is False
    assert submission["evidence_assessment"][0]["control"] == "MISMATCH"
    assert contract.get_certificate(args=[submission_id]).call() == {}


@pytest.mark.integration
@pytest.mark.slow
def test_real_missing_control_cannot_certify():
    rulebook_id = "v2-real-missing-control"
    contract = _deploy_with_rulebook(rulebook_id)
    submission_id = f"v2-real-missing-{uuid.uuid4().hex[:8]}"
    evidence = [
        {
            "type": "GITHUB_REPOSITORY",
            "url": "https://github.com/torvalds/linux",
            "claim": "The source repository is publicly accessible.",
        }
    ]
    _submit(contract, submission_id, rulebook_id, evidence, "The repository is public.")

    submission = _review(contract, submission_id)
    assert submission["status"] == "REVIEWED"
    assert submission["verdict"] != "COMPLIANT"
    assert submission["certificate_issued"] is False
    assert submission["evidence_assessment"][0]["control"] == "MISSING"
    assert contract.get_certificate(args=[submission_id]).call() == {}


@pytest.mark.integration
@pytest.mark.slow
def test_real_web_page_request_and_render_are_used():
    rulebook_id = "v2-real-rendered-page"
    contract = _deploy_with_rulebook(rulebook_id)
    submission_id = f"v2-real-render-{uuid.uuid4().hex[:8]}"
    evidence = [
        {
            "type": "WEB_PAGE",
            "url": "https://clausegate.vercel.app",
            "claim": "A live application is publicly reachable.",
        }
    ]
    _submit(contract, submission_id, rulebook_id, evidence, "The application is live.")

    # A successful REVIEWED result proves request + render completed; the
    # production origin has no test control attestation, so it cannot certify.
    submission = _review(contract, submission_id)
    assert submission["status"] == "REVIEWED"
    assert submission["verdict"] != "COMPLIANT"
    assert submission["certificate_issued"] is False
    assert submission["evidence_assessment"][0]["control"] == "MISSING"
    assert contract.get_certificate(args=[submission_id]).call() == {}
