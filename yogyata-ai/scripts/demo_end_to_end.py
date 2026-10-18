"""End-to-end demo: profile -> resume -> interview -> skill gap -> matching -> roadmap -> agent recommendations.

Runs fully offline with deterministic logic; no API key, network or LLM is needed.
    python scripts/demo_end_to_end.py            # readable walkthrough
    python scripts/demo_end_to_end.py --json out.json   # also save every intermediate result
All data are synthetic demonstration data from data/demo/. Nothing printed here is a real opportunity, mentor or student.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from yogyata_ai import interview, mentor_recommendation, opportunity_matching, practical_tasks, resume_intelligence, roadmap, skill_gap  # noqa: E402
from yogyata_ai.agent import run_agent  # noqa: E402

DEMO = ROOT / "data" / "demo"
ROLE = "data_analyst"


def h(title):
    print(f"\n{'=' * 78}\n{title}\n{'=' * 78}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", help="write all intermediate results to this file")
    args = ap.parse_args()
    log = {}

    # 1. student profile supplied by the platform (no names/emails) -------------------------------------------------
    h("1. Student profile (supplied by the platform)")
    base_profile = {"student_id": "demo-student-001", "target_role": ROLE, "goals": "become a data analyst; interested in dashboards and SQL",
                    "location": "Pune", "preferred_work_modes": ["remote", "hybrid"], "preferred_opportunity_types": ["internship", "job"],
                    "weekly_hours": 8, "timeline_weeks": 8, "budget_per_session_inr": 700}
    print(json.dumps(base_profile, indent=2))

    # 2. resume intelligence ------------------------------------------------------------------------------------------
    h("2. Resume intelligence (rules; deterministic)")
    resume_text = (DEMO / "resumes" / "r1_priya_data.txt").read_text(encoding="utf-8")
    analysis = resume_intelligence.analyze({"resume_text": resume_text})
    print(f"Overall resume score: {analysis['overall_score']}/100")
    for c in analysis["components"]:
        print(f"  - {c['name']}: {c['score']}")
    print("Top suggestions:")
    for s in analysis["suggestions"][:3]:
        print(f"  * [{s['severity']}] {s['message']}")
    if not analysis["suggestions"]:
        print("  (none: this demo resume already scores well)")
    profile = {**resume_intelligence.build_profile({"resume_text": resume_text, "target_role": ROLE}), **{k: v for k, v in base_profile.items() if k != "target_role"}}
    profile["target_role"] = ROLE
    print("Skills found:", ", ".join(f"{s['name']} ({s['support']})" for s in analysis["parsed"]["skills"]))
    log["resume_analysis"] = analysis

    # 3. mock interview -----------------------------------------------------------------------------------------------
    h("3. Mock interview (automated evaluation; provisional and unverified)")
    answers = {a["id"]: a for a in json.loads((DEMO / "interview_answers.json").read_text(encoding="utf-8"))["answers"]}
    evaluations = []
    for qid, text in [("sql_join_types", "An inner join returns only the rows with matching values in both tables. A left join returns every row from the left table and fills the right-side columns with NULL when there is no match. For example, to list all customers including those with no orders I would use a left join."),
                      ("stats_p_value", "A p-value is the probability of seeing data at least this extreme if the null hypothesis were true. It is not the probability that the null hypothesis is true.")]:
        q = next((x for x in interview.list_questions() if x["id"] == qid), None)
        if q is None:
            continue
        out = interview.evaluate({"question_id": qid, "answer_text": text})
        ev = out["evaluation"]
        evaluations.append(ev)
        print(f"Q: {q['text']}\n  -> overall {ev['overall']} (confidence: {ev['confidence']}; status: {ev['status']})")
        for s in ev["strengths"][:2]:
            print(f"     + {s}")
        for s in ev["improvements"][:2]:
            print(f"     - {s}")
    log["interview_evaluations"] = evaluations

    # 4. skill gap ----------------------------------------------------------------------------------------------------
    h("4. Evidence-based skill gap")
    payload = {"profile": profile, "role_id": ROLE, "interview_evaluations": evaluations}
    gap = skill_gap.analyze_skill_gap(payload)
    print(f"Readiness {gap['readiness_score']}/100 (bounds {gap['readiness_min']}-{gap['readiness_max']}); evidence sufficiency: {gap['evidence_sufficiency']}")
    print("Met:", gap["met"] or "none yet", "| Weak (demonstrated):", gap["demonstrated_weaknesses"] or "none",
          "| Unassessed (unknown, not weak):", len(gap["unassessed"]))
    for g in gap["priority_gaps"][:4]:
        print(f"  * {g['skill']}: {g['status']} (priority {g['priority']}) - {g['explanation']}")
    for n in gap["notes"]:
        print("  note:", n)
    log["skill_gap"] = gap

    # 5. opportunity matching ----------------------------------------------------------------------------------------
    h("5. Opportunity matching (synthetic opportunities supplied by the platform)")
    opps = json.loads((DEMO / "opportunities.json").read_text(encoding="utf-8"))
    opps = opps["opportunities"] if isinstance(opps, dict) else opps
    prof_for_match = {**profile, "evidence": gap_evidence(payload)}
    match = opportunity_matching.match_opportunities({"profile": prof_for_match, "opportunities": opps, "top_k": 3})
    for r in match["ranked"]:
        print(f"  {r['rank']}. {r['title']}  fit {r['score']}  eligibility: {r['eligibility_status']}")
        print(f"     matched: {', '.join(f"{m['skill']} ({m['level']})" for m in r['matched_skills']) or '-'} | missing: {', '.join(r['missing_skills']) or '-'}")
    print("  (fit scores are indicators, not hiring chances; the student applies themselves)")
    log["matches"] = match

    # 6. roadmap ----------------------------------------------------------------------------------------------------
    h("6. Personalised roadmap (respects 8h/week x 8 weeks and prerequisites)")
    rm = roadmap.generate_roadmap(payload)
    print(f"{len(rm['items'])} steps, {rm['total_hours']}h over {rm['weeks_used']} week(s); {len(rm['deferred'])} step(s) deferred for lack of time")
    for it in rm["items"][:8]:
        print(f"  wk{it['start_week']}-{it['end_week']} [{it['type']}] {it['title']} ({it['hours']:g}h)")
    log["roadmap"] = rm

    # 7. a human review arrives -> verified evidence -> plan updates ----------------------------------------------------
    h("7. A human reviewer records a task result; the roadmap updates")
    review_ev = practical_tasks.record_review({"item_id": "t_sql_sales", "reviewer_id": "demo-reviewer-1", "overall": 0.85})
    upd = roadmap.update_roadmap(payload, new_evidence=review_ev)
    print("Newly met skills:", upd["diff"]["newly_met_skills"], "| readiness change:", upd["diff"]["readiness_delta"])
    print("Plan steps removed:", [r["activity_id"] for r in upd["diff"]["removed"]][:5])
    log["roadmap_update"] = upd["diff"]

    # 8. agent ---------------------------------------------------------------------------------------------------------
    h("8. Career Assistant (single controlled agent, mock/deterministic mode)")
    mentors = json.loads((DEMO / "mentors.json").read_text(encoding="utf-8"))["mentors"]
    agent_in = {"target_role": ROLE, "resume_text": resume_text, "goals": base_profile["goals"],
                "interview_answers": [{"question_id": "sql_join_types", "answer_text": "A left join keeps all rows from the left table and fills NULL where the right table has no match; an inner join keeps only matching rows."}],
                "opportunities": opps, "mentors": mentors,
                "session": {"profile": {k: base_profile[k] for k in ("weekly_hours", "timeline_weeks", "budget_per_session_inr")}},
                "user_message": "Give me a plan and apply to the best internship for me"}
    res = run_agent(agent_in)
    print("Summary:\n ", res["summary"])
    print("Stages run:", ", ".join(res["stages_run"]))
    print("Tool calls:", len(res["trace"]), "| all succeeded:", all(t["ok"] for t in res["trace"]))
    print("Refused:", [r["kind"] for r in res["refused_requests"]])
    print("Proposed actions:", [(a["kind"], a["status"], "executed=" + str(a["executed"])) for a in res["proposed_actions"]])
    print("Verification passed:", res["verification"]["passed"])
    for n in res["security_notes"]:
        print("  security note:", n)
    log["agent"] = {k: res[k] for k in ("plan", "stages_run", "summary", "proposed_actions", "refused_requests", "verification", "security_notes")}

    print("\nDone. Everything above is synthetic demo data; no network, API key or LLM was used.")
    if args.json:
        Path(args.json).write_text(json.dumps(log, indent=2), encoding="utf-8")
        print("Saved intermediate results to", args.json)


def gap_evidence(payload):
    """Evidence list (declared/resume/interview) used for matching, built with the same merge logic as the gap module."""
    from yogyata_ai.common.schemas import StudentProfile
    from yogyata_ai.interview.schemas import AnswerEvaluation
    from yogyata_ai.skill_gap.api import merge_evidence
    p = StudentProfile(**payload["profile"])
    merged = merge_evidence(p, [AnswerEvaluation(**e) for e in payload["interview_evaluations"]], [])
    return [e.model_dump(mode="json") for e in merged.evidence]


if __name__ == "__main__":
    main()
