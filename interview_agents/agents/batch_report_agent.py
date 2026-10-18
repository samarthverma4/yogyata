"""
Batch Report Agent — cohort-level summary across multiple student sessions.
Closes the 'Admin Summary Agent — no batch-level cross-student summary' diagram gap.
"""
from __future__ import annotations

import logging
from statistics import mean, stdev
from collections import Counter
from typing import Any

from interview_agents.agents.base import BaseInterviewAgent
from interview_agents.agents.report_generator import ReportGeneratorAgent
from interview_agents.schemas.interview import FinalReportResult

logger = logging.getLogger(__name__)

_COMPANY_THRESHOLDS: dict[str, int] = {
    "TCS": 50, "Infosys": 50, "Wipro": 50, "Cognizant": 55,
    "Accenture": 65, "Capgemini": 62, "HCL": 60, "Tech Mahindra": 58,
    "KPIT": 68, "Amazon": 80, "Microsoft": 82, "Google": 85,
}


class BatchReportAgent(BaseInterviewAgent):
    """Aggregates individual session reports into a cohort-level placement summary."""

    def summarize(self, session_ids: list[str]) -> dict[str, Any]:
        """
        Generate a batch summary across multiple sessions.
        Returns a cohort analytics dict that can be serialised and returned by the admin API.
        """
        if not session_ids:
            return {"error": "No session IDs provided", "cohort_size": 0}

        reports: list[FinalReportResult] = []
        failed_sessions: list[str] = []

        for sid in session_ids:
            try:
                rg = ReportGeneratorAgent(self.openai_service, self.memory)
                report = rg.generate(sid)
                reports.append(report)
            except Exception:
                logger.warning("Failed to generate report for session %s", sid, exc_info=True)
                failed_sessions.append(sid)

        if not reports:
            return {
                "error": "Could not generate any reports",
                "cohort_size": len(session_ids),
                "failed_sessions": failed_sessions,
            }

        # Core score aggregations
        overall_scores = [r.overall_score for r in reports]
        tech_scores = [r.technical_score for r in reports]
        comm_scores = [r.communication_score for r in reports]
        ps_scores = [r.problem_solving_score for r in reports]
        readiness = [r.placement_readiness_percent for r in reports]
        cultural_fits = [r.cultural_fit_score for r in reports]

        avg_overall = round(mean(overall_scores), 2)
        avg_tech = round(mean(tech_scores), 2)
        avg_comm = round(mean(comm_scores), 2)
        avg_ps = round(mean(ps_scores), 2)
        avg_readiness = round(mean(readiness), 1)
        avg_cultural = round(mean(cultural_fits), 2)

        score_std = round(stdev(overall_scores), 2) if len(overall_scores) > 1 else 0.0

        # Pass / borderline / fail bands (same thresholds as individual report)
        pass_count = sum(1 for s in overall_scores if s >= 7)
        borderline_count = sum(1 for s in overall_scores if 5 <= s < 7)
        fail_count = sum(1 for s in overall_scores if s < 5)

        # Company placement eligibility across the cohort
        company_eligible: dict[str, int] = {c: 0 for c in _COMPANY_THRESHOLDS}
        for r in reports:
            for company, eligible in r.company_fit.items():
                if company in company_eligible:
                    company_eligible[company] += eligible

        # Most common weak areas across the cohort
        all_weaknesses: list[str] = []
        for r in reports:
            all_weaknesses.extend(r.weaknesses)
        common_weaknesses = [w for w, _ in Counter(all_weaknesses).most_common(5)]

        # All red flags across the cohort
        cohort_red_flags: list[dict[str, Any]] = []
        for r in reports:
            if r.red_flags:
                cohort_red_flags.append({
                    "candidate": r.candidate_name,
                    "flags": r.red_flags,
                })

        # Score distribution buckets (0-3, 4-5, 6-7, 8-10)
        distribution = {
            "0-3 (Not Ready)": sum(1 for s in overall_scores if s <= 3),
            "4-5 (Needs Work)": sum(1 for s in overall_scores if 4 <= s <= 5),
            "6-7 (Borderline)": sum(1 for s in overall_scores if 6 <= s <= 7),
            "8-10 (Strong)": sum(1 for s in overall_scores if s >= 8),
        }

        # Top performers and candidates needing support
        top_performers = [r.candidate_name for r in reports if r.overall_score >= 8]
        needs_support = [r.candidate_name for r in reports if r.overall_score < 5]

        return {
            "cohort_size": len(reports),
            "failed_sessions": failed_sessions,
            "score_summary": {
                "avg_overall_score": avg_overall,
                "avg_technical_score": avg_tech,
                "avg_communication_score": avg_comm,
                "avg_problem_solving_score": avg_ps,
                "avg_placement_readiness_percent": avg_readiness,
                "avg_cultural_fit_score": avg_cultural,
                "score_std_deviation": score_std,
                "pass_count": pass_count,
                "borderline_count": borderline_count,
                "fail_count": fail_count,
                "pass_rate_percent": round(pass_count / len(reports) * 100, 1),
            },
            "score_distribution": distribution,
            "company_eligible_count": company_eligible,
            "common_weaknesses": common_weaknesses,
            "cohort_red_flags": cohort_red_flags,
            "top_performers": top_performers,
            "needs_support": needs_support,
            "recommendation": _cohort_recommendation(avg_overall, common_weaknesses),
        }


def _cohort_recommendation(avg_score: float, weak_areas: list[str]) -> str:
    if avg_score >= 8:
        return "Cohort is placement-ready. Focus remaining prep on FAANG-tier companies."
    if avg_score >= 6:
        area = weak_areas[0] if weak_areas else "identified weak areas"
        return f"Cohort is borderline-ready. Organise a focused workshop on {area} before placements."
    area = weak_areas[0] if weak_areas else "core technical concepts"
    return f"Cohort needs significant prep. Prioritise {area} and conduct at least two more mock rounds."
