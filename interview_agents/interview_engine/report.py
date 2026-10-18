"""Deliverable 3 — per-interview run report.

Renders the audit trail (source, blueprint bucket, difficulty, web query issued,
dedup regens, dimensional score) for every question, plus run-level summaries that
prove the fixes: source mix, blueprint coverage, difficulty trajectory, follow-ups
fired, and score spread. Emits JSON (machine) and Markdown (human).
"""
from __future__ import annotations

import dataclasses
import json
from typing import Any, Dict

from interview_agents.interview_engine.protocols import RunReport


def to_dict(report: RunReport) -> Dict[str, Any]:
    return {
        "interview_id": report.interview_id,
        "role": report.role,
        "company": report.company,
        "total_questions": report.total_questions,
        "summary": {
            "source_mix": report.source_mix(),
            "blueprint_quota": report.blueprint_quota,
            "blueprint_filled": report.blueprint_filled,
            "difficulty_sequence": report.difficulty_sequence(),
            "distinct_web_queries": sorted(set(report.web_queries())),
            "web_query_count": len(report.web_queries()),
            "follow_ups_fired": len(report.follow_ups()),
            "scores": report.scores(),
            "score_variance": round(report.score_variance(), 1),
        },
        "questions": [
            {
                "index": t.meta.index + 1,
                "bucket": t.meta.bucket,
                "subtopic": t.meta.subtopic,
                "source": t.meta.source,
                "planned_source": t.meta.planned_source,
                "fallback_reason": t.meta.source_fallback_reason,
                "difficulty": t.meta.difficulty,
                "web_query": t.meta.web_query,
                "dedup_regens": t.meta.dedup_regens,
                "question": t.question,
                "score": t.evaluation.total if t.evaluation else None,
                "band": t.evaluation.band if t.evaluation else None,
                "dimensions": t.evaluation.dimensions.as_dict() if t.evaluation else None,
                "difficulty_decision": t.difficulty_decision,
                "follow_up": t.follow_up,
            }
            for t in report.turns
        ],
    }


def to_json(report: RunReport) -> str:
    return json.dumps(to_dict(report), indent=2, ensure_ascii=False)


def to_markdown(report: RunReport) -> str:
    d = to_dict(report)
    s = d["summary"]
    lines = [
        f"# Interview run report - {report.interview_id}",
        "",
        f"Role: {report.role}  |  Company: {report.company}  |  Questions: {report.total_questions}",
        "",
        "## Summary (audit trail)",
        f"- Source mix: {s['source_mix']}",
        f"- Blueprint quota: {s['blueprint_quota']}",
        f"- Blueprint filled: {s['blueprint_filled']}",
        f"- Distinct web queries: {s['web_query_count']} -> {s['distinct_web_queries']}",
        f"- Follow-ups fired: {s['follow_ups_fired']}",
        f"- Difficulty sequence: {' '.join(s['difficulty_sequence'])}",
        f"- Scores: {s['scores']}  (variance {s['score_variance']})",
        "",
        "## Per-question metadata",
        "",
        "| # | bucket | source (planned) | diff | web query | regens | score | band |",
        "|---|--------|------------------|------|-----------|--------|-------|------|",
    ]
    for q in d["questions"]:
        planned = q["source"] if q["source"] == q["planned_source"] else f"{q['source']} ({q['planned_source']})"
        wq = (q["web_query"] or "-")
        if len(wq) > 34:
            wq = wq[:31] + "..."
        lines.append(
            f"| {q['index']} | {q['bucket']} | {planned} | {q['difficulty']} | "
            f"{wq} | {q['dedup_regens']} | {q['score']} | {q['band']} |"
        )
    lines += ["", "## Questions and follow-ups", ""]
    for q in d["questions"]:
        lines.append(f"**Q{q['index']} [{q['bucket']}/{q['difficulty']}/{q['source']}]** {q['question']}")
        if q["follow_up"]:
            fu = q["follow_up"]
            lines.append(f"  - follow-up ({fu.get('intent')}, refs answer={fu.get('references_answer')}): {fu.get('question')}")
        lines.append("")
    return "\n".join(lines)


def write_report(report: RunReport, path_prefix: str) -> Dict[str, str]:
    json_path = f"{path_prefix}.json"
    md_path = f"{path_prefix}.md"
    with open(json_path, "w", encoding="utf-8") as f:
        f.write(to_json(report))
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(to_markdown(report))
    return {"json": json_path, "markdown": md_path}
