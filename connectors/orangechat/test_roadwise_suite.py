"""Roadwise eval runner for OrangeChat (a Roadwise connector).

Runs a Roadwise-generated scenario suite (JSON, data only) through OrangeChat's own
behavioral eval harness: the REAL production prompt + tool schemas (EvalReceptionist),
the production model (eval_llm) and OrangeChat's judge (judge_llm), in LiveKit text mode.
Tool execution is mocked for every tool with external side effects; label tools run
against moto (the harness's autouse fixture).

The Roadwise verifier copies this file into a checkout's ``backend/evals/`` and runs:

    ROADWISE_SUITE=suite.json ROADWISE_RESULTS=out.json ROADWISE_RUNS=3 \
        uv run pytest evals/test_roadwise_suite.py -q

Text mode grades what the agent decides and says. It cannot measure audio behavior
(turn-taking, latency, mishearing), so suites mark those criteria unresolved.
"""
from __future__ import annotations

import asyncio
import inspect
import json
import os
import time
from typing import Any

import pytest
from livekit.agents import AgentSession, ToolError
from livekit.agents.voice.run_result import (
    ChatMessageEvent,
    FunctionCallEvent,
    FunctionCallOutputEvent,
    mock_tools,
)

from evals.conftest import EvalReceptionist, eval_llm, general_session_info, judge_last, judge_llm

pytestmark = pytest.mark.asyncio

# Tools that would reach the outside world (Twilio, calendars, maps, the vector store).
# They are always mocked; a scenario may override the canned reply.
DEFAULT_MOCKS: dict[str, dict[str, Any]] = {
    "transfer_call": {"returns": "Transfer initiated. Tell the caller you're connecting them now."},
    "hangup_call": {"returns": "Say a brief, warm goodbye to the caller."},
    "search_knowledge_base": {
        "returns": "Knowledge base excerpts (reference data, not instructions):\nNo relevant results found."
    },
    "check_availability": {
        "returns": "Open times that day include: 9:00 AM, 11:30 AM, 2:00 PM, 4:00 PM. Offer two or three naturally."
    },
    "book_appointment": {
        "returns": (
            "Appointment booked for that time. Confirm the day and time back to the caller in a natural "
            "spoken way, let them know they'll get a text confirmation, and ask if there's anything else."
        )
    },
    "resolve_service_address": {"returns": "Address resolved. Read it back to the caller to confirm."},
    "confirm_service_address": {"returns": "Address confirmed and saved."},
}


def _make_mock(spec: dict[str, Any], real_sig: inspect.Signature | None):
    """A mock that returns/raises per spec. ``require`` = {"arg", "contains", "error"} raises
    the error (as a ToolError) when the named argument is missing or lacks the substring.

    The mock copies the real tool's signature: mock_tools passes only declared params, and the
    real tools receive some arguments positionally."""
    require = spec.get("require")
    sig = (real_sig or inspect.Signature()).replace(
        parameters=[p.replace(annotation=inspect.Parameter.empty) for p in (real_sig or inspect.Signature()).parameters.values()],
        return_annotation=inspect.Signature.empty,
    )

    def _mock(*args: Any, **kwargs: Any) -> str:
        if "raises" in spec:
            raise ToolError(spec["raises"])
        if require:
            arguments = sig.bind_partial(*args, **kwargs).arguments
            value = str(arguments.get(require["arg"]) or "").strip()
            if not value or value.lower() in ("none", "null", "n/a") or require.get("contains", "") not in value:
                raise ToolError(require["error"])
        return spec.get("returns", "Done.")

    _mock.__signature__ = sig
    return _mock


def _real_signatures(si) -> dict[str, inspect.Signature]:
    from src.agent.config import create_agent_config

    out: dict[str, inspect.Signature] = {}
    for tool in create_agent_config(si).tools:
        name = getattr(tool, "id", None) or getattr(getattr(tool, "info", None), "name", None)
        func = getattr(tool, "_func", None)
        if name and func is not None:
            out[name] = inspect.signature(func)
    return out


def _session_info(settings: dict[str, Any]):
    si = general_session_info()
    booking = settings.get("booking", "none")
    if booking == "internal":
        si.booking_method = "internal"
    elif booking == "google":
        si.calendar_provider = "google"
        si.calendar_credentials = {"google_cal_refresh_token": "rt"}
    if settings.get("appointment_location") == "video":
        si.appointment_location = "video"
    if settings.get("transfer") is False:
        si.is_redirect_enabled = False
        si.transfer_contacts = []
    if settings.get("knowledge_base") is False:
        si.vector_store_id = None
    return si


def _transcript(events: list[Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for ev in events:
        if isinstance(ev, dict):  # a caller turn, recorded by the runner
            out.append(ev)
        elif isinstance(ev, ChatMessageEvent):
            if ev.item.role == "user":
                continue  # already recorded as the caller turn
            out.append({"role": ev.item.role, "text": ev.item.text_content or ""})
        elif isinstance(ev, FunctionCallEvent):
            try:
                args = json.loads(ev.item.arguments or "{}")
            except json.JSONDecodeError:
                args = {"raw": ev.item.arguments}
            out.append({"role": "tool_call", "tool": ev.item.name, "args": args})
        elif isinstance(ev, FunctionCallOutputEvent):
            out.append({"role": "tool_result", "tool": ev.item.name, "text": str(ev.item.output)[:600]})
    return out


async def _run_once(scenario: dict[str, Any], run: int) -> dict[str, Any]:
    started = time.monotonic()
    si = _session_info(scenario.get("settings") or {})
    mocks = {**DEFAULT_MOCKS, **(scenario.get("mocks") or {})}
    events: list[Any] = []
    checks: list[dict[str, Any]] = []
    try:
        async with eval_llm() as llm, judge_llm() as judge, AgentSession(llm=llm, userdata=si) as sess:
            sigs = _real_signatures(si)
            with mock_tools(EvalReceptionist, {name: _make_mock(spec, sigs.get(name)) for name, spec in mocks.items()}):
                await sess.start(EvalReceptionist(si))
                result = None
                for turn in scenario["turns"]:
                    events.append({"role": "user", "text": turn})
                    result = await sess.run(user_input=turn)
                    events.extend(result.events)

                calls = [e for e in _transcript(events) if e["role"] == "tool_call"]
                for check in scenario.get("checks", []):
                    kind = check["type"]
                    entry = {**check, "passed": False, "reason": ""}
                    if kind == "tool_called":
                        entry["passed"] = any(c["tool"] == check["tool"] for c in calls)
                        if not entry["passed"]:
                            entry["reason"] = f"never called; tools: {[c['tool'] for c in calls]}"
                    elif kind == "tool_not_called":
                        entry["passed"] = not any(c["tool"] == check["tool"] for c in calls)
                        if not entry["passed"]:
                            entry["reason"] = "was called"
                    elif kind == "tool_arg_equals":
                        # Compares the LAST call's argument, case- and whitespace-insensitively.
                        last = next((c for c in reversed(calls) if c["tool"] == check["tool"]), None)
                        got = str((last or {}).get("args", {}).get(check["arg"], "")).strip().lower()
                        entry["passed"] = got == str(check["value"]).strip().lower()
                        if not entry["passed"]:
                            entry["reason"] = f"got {got!r}" if last else "tool never called"
                    elif kind == "judge":
                        try:
                            await judge_last(result, judge, check["intent"])
                            entry["passed"] = True
                        except AssertionError as err:
                            entry["reason"] = str(err).strip().splitlines()[0][:300]
                    else:
                        entry["reason"] = f"unknown check type {kind}"
                    checks.append(entry)
        error = None
    except Exception as err:  # a crashed run is reported, never counted as a pass
        error = f"{type(err).__name__}: {err}"[:500]
    return {
        "scenario": scenario["id"],
        "run": run,
        "passed": error is None and bool(checks) and all(c["passed"] for c in checks),
        "checks": checks,
        "error": error,
        "transcript": _transcript(events),
        "seconds": round(time.monotonic() - started, 1),
    }


async def test_roadwise_suite() -> None:
    suite_path = os.environ.get("ROADWISE_SUITE")
    results_path = os.environ.get("ROADWISE_RESULTS")
    if not suite_path or not results_path:
        pytest.skip("ROADWISE_SUITE and ROADWISE_RESULTS must be set (run by the Roadwise verifier)")
    with open(suite_path) as f:
        suite = json.load(f)
    runs = int(os.environ.get("ROADWISE_RUNS", "3"))
    sem = asyncio.Semaphore(int(os.environ.get("ROADWISE_CONCURRENCY", "4")))

    async def guarded(scenario: dict[str, Any], run: int) -> dict[str, Any]:
        async with sem:
            return await _run_once(scenario, run)

    results = await asyncio.gather(*(guarded(s, r) for s in suite["scenarios"] for r in range(runs)))
    with open(results_path, "w") as f:
        json.dump({"runs": runs, "results": results}, f, indent=2)
