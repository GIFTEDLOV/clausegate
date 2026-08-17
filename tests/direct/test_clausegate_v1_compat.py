"""Small compatibility checks proving the preserved v1 source still behaves as v1."""

import json


def test_preserved_v1_claim_based_certificate(direct_vm, direct_deploy):
    contract = direct_deploy("contracts/clausegate.py")
    contract.create_rulebook("v1-rb", "V1 rules", "Claim-based fixture", "The proposal must be clear.")
    contract.submit_proposal("v1-sub", "v1-rb", "V1 proposal", "The proposal is clear.")
    direct_vm.mock_llm(r".*validating one proposal.*", json.dumps({"verdict": "COMPLIANT"}))
    contract.review_submission("v1-sub")
    submission = contract.get_submission("v1-sub")
    certificate = contract.get_certificate("v1-sub")
    assert submission["certificate_issued"] is True
    assert certificate["certificate_version"] == "1"
