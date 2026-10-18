"""Generate docs/samples/*.json: one real request and (trimmed) real response per public function.

Lists longer than 4 items are cut to 3 followed by a {"_truncated": N} marker so samples stay readable.
Run: python scripts/generate_samples.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from yogyata_ai import interview, mentor_recommendation, opportunity_matching, practical_tasks, resume_intelligence, roadmap, skill_gap, university_analytics  # noqa: E402
from yogyata_ai.agent import confirm_action, run_agent  # noqa: E402

DEMO = ROOT / "data" / "demo"
OUT = ROOT / "docs" / "samples"


def trim(x):
    if isinstance(x, list):
        if len(x) > 4:
            return [trim(i) for i in x[:3]] + [{"_truncated": len(x) - 3}]
        return [trim(i) for i in x]
    if isinstance(x, dict):
        return {k: trim(v) for k, v in x.items()}
    return x


def save(name, req, resp):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.json").write_text(json.dumps({"request": trim(req), "response": trim(resp)}, indent=2, ensure_ascii=False), encoding="utf-8")


def main():
    resume = (DEMO / "resumes" / "r3_ananya_ml.txt").read_text(encoding="utf-8")
    jd = "Machine Learning Intern. Required: Python, scikit-learn, Machine Learning. Preferred: Docker, SQL."
    opps = json.loads((DEMO / "opportunities.json").read_text(encoding="utf-8"))["opportunities"]
    mentors = json.loads((DEMO / "mentors.json").read_text(encoding="utf-8"))["mentors"]

    r = {"resume_text": resume}
    save("resume_analyze", {"resume_text": "<demo resume r3_ananya_ml.txt>"}, resume_intelligence.analyze(r))
    r = {"resume_text": resume, "job_description": jd}
    save("resume_compare_job", {"resume_text": "<demo resume>", "job_description": jd}, resume_intelligence.compare_job(r))
    save("resume_build_profile", {"resume_text": "<demo resume>", "target_role": "ml_engineer"}, resume_intelligence.build_profile({"resume_text": resume, "target_role": "ml_engineer"}))
    ans = {"question_id": "sql_join_types", "answer_text": "An inner join keeps only matching rows; a left join keeps all left rows and fills NULL where there is no match."}
    out = interview.evaluate(ans)
    save("interview_evaluate", ans, out)
    save("interview_next_question", {"interview_type": "technical", "role": "data_analyst", "history": [out["history_item"]]},
         interview.next_question({"interview_type": "technical", "role": "data_analyst", "history": [out["history_item"]]}))
    profile = {"declared_skills": ["Python", "SQL"], "target_role": "data_analyst", "weekly_hours": 6, "timeline_weeks": 6, "budget_per_session_inr": 700,
               "goals": "data analyst internship",
               "evidence": [{"skill": "Python", "source": "resume_evidence", "strength": 0.65}, {"skill": "SQL", "source": "task_review", "strength": 0.3, "ref_id": "t1"}]}
    gp = {"profile": profile, "role_id": "data_analyst"}
    save("skill_gap_analyze", gp, skill_gap.analyze_skill_gap(gp))
    mp = {"profile": profile, "opportunities": opps, "top_k": 3}
    save("opportunity_match", {**mp, "opportunities": f"<{len(opps)} demo opportunities>"}, opportunity_matching.match_opportunities(mp))
    save("roadmap_generate", gp, roadmap.generate_roadmap(gp))
    save("roadmap_update", {"payload": gp, "new_evidence": [{"skill": "SQL", "source": "task_review", "strength": 0.9, "ref_id": "t2"}]},
         roadmap.update_roadmap(gp, new_evidence=[{"skill": "SQL", "source": "task_review", "strength": 0.9, "ref_id": "t2"}]))
    save("tasks_recommend", gp, practical_tasks.recommend({**gp, "limit": 3}))
    save("tasks_evaluate", {"task_id": "t_sql_sales", "submission_text": "I used an inner join ... GROUP BY region ... COALESCE for NULL ..."},
         practical_tasks.evaluate("t_sql_sales", "I used an inner join between orders and customers, then GROUP BY region with SUM. COALESCE handled NULL discounts and each query is explained.", emit_evidence=True))
    save("tasks_record_review", {"item_id": "t_sql_sales", "reviewer_id": "reviewer-1", "criterion_scores": {"joins": 1, "aggregation": 0.5, "result_correctness": 0.8}},
         practical_tasks.record_review({"item_id": "t_sql_sales", "reviewer_id": "reviewer-1", "criterion_scores": {"joins": 1, "aggregation": 0.5, "result_correctness": 0.8}}))
    mq = {**gp, "mentors": mentors, "availability": [{"day": "Sat", "start": "10:00", "end": "11:30"}], "limit": 3}
    save("mentors_recommend", {**mq, "mentors": f"<{len(mentors)} synthetic demo mentors>"}, mentor_recommendation.recommend_mentors(mq))
    cohort = [{"department": d, "graduation_year": 2027, "target_role": "data_analyst",
               "profile": {"evidence": [{"skill": "SQL", "source": "interview_auto", "strength": 0.2 if d == "CSE" else 0.8, "ref_id": f"{d}{i}"}]}, "placed": None}
              for d, n in (("CSE", 12), ("ECE", 11), ("MECH", 3)) for i in range(n)]
    save("analytics_cohort", {"records": "<26 pseudonymous synthetic records>", "group_by": "department", "k": 10}, university_analytics.cohort_analytics(cohort, k=10))
    ag = {"target_role": "data_analyst", "resume_text": resume, "opportunities": opps[:4], "user_message": "Make a roadmap and apply to the best job for me",
          "session": {"profile": {"weekly_hours": 6, "timeline_weeks": 6}}}
    res = run_agent(ag)
    save("agent_run", {**ag, "resume_text": "<demo resume>", "opportunities": "<4 demo opportunities>"}, {k: v for k, v in res.items() if k != "results"} | {"results": {k: "<omitted: see module samples>" for k in res["results"]}})
    saved = run_agent({"target_role": "data_analyst", "user_message": "make a roadmap and save it"})
    act = next(x for x in saved["proposed_actions"] if x["kind"] == "save_roadmap")
    save("agent_confirm", {"session": "<session returned by agent_run>", "action_id": act["id"], "user_confirmed": True},
         {**confirm_action(saved["session"], act["id"], user_confirmed=True), "session": "<updated session>"})
    print("wrote", len(list(OUT.glob("*.json"))), "samples to", OUT)


if __name__ == "__main__":
    main()
