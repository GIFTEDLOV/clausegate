# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""Disposable pre-deployment probe for the pinned GenVM web module."""

import json

from genlayer import *


PROBE_URL = "https://test-server.genlayer.com/static/genvm/hello.html"


class WebAccessProbe(gl.Contract):
    result: str

    def __init__(self):
        self.result = ""

    @gl.public.write
    def probe(self) -> None:
        def fetch() -> dict:
            response = gl.nondet.web.request(PROBE_URL, method="GET")
            rendered = gl.nondet.web.render(PROBE_URL, mode="text")
            return {
                "status": response.status,
                "body_type": "bytes" if isinstance(response.body, bytes) else "other",
                "rendered_text": str(rendered)[:1000],
            }

        self.result = json.dumps(gl.eq_principle.strict_eq(fetch), sort_keys=True, separators=(",", ":"))

    @gl.public.view
    def get_result(self) -> str:
        return self.result
