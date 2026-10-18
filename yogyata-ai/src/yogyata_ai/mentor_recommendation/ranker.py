from __future__ import annotations

from yogyata_ai.common.schemas import StudentProfile
from yogyata_ai.common.similarity import SimilarityBackend, get_backend_with_status
from yogyata_ai.common.taxonomy import get_taxonomy
from yogyata_ai.skill_gap.analysis import analyze_gap
from yogyata_ai.skill_gap.roles import RoleConfig

from .schemas import ExcludedMentor, Mentor, MentorResult, RankedMentor, Slot, to_min

WEIGHTS = {"gap_fit": 0.55, "text": 0.15, "role": 0.10, "language": 0.05, "experience": 0.05, "rating": 0.10}
RATING_PRIOR, RATING_PRIOR_N = 3.5, 10  # shrink towards a neutral prior so a single 5-star review means little


def slots_overlap(a: list[Slot], b: list[Slot], minutes: int) -> bool:
    for x in a:
        for y in b:
            if x.day == y.day:
                if min(to_min(x.end), to_min(y.end)) - max(to_min(x.start), to_min(y.start)) >= minutes:
                    return True
    return False


def rank_mentors(profile: StudentProfile, role: RoleConfig, mentors: list[Mentor], *, availability: list[Slot] | None = None,
                 languages: list[str] | None = None, session_minutes: int = 60, limit: int = 5, top_gaps: int = 6,
                 backend: SimilarityBackend | None = None) -> MentorResult:
    report = analyze_gap(profile, role, top_n=top_gaps)
    targets = [g for g in report.priority_gaps if g.priority > 0]
    total_pr = sum(g.priority for g in targets) or 1.0
    tax = get_taxonomy()
    status = ""
    if backend is None:
        backend, status = get_backend_with_status()
    else:
        status = type(backend).__name__
    warnings: list[str] = []
    excluded: list[ExcludedMentor] = []
    elig: list[Mentor] = []
    budget = profile.budget_per_session_inr
    for m in mentors:
        if not m.accepting_students:
            excluded.append(ExcludedMentor(mentor_id=m.id, reason="not accepting students"))
        elif budget is not None and m.price_per_session_inr is not None and m.price_per_session_inr > budget:
            excluded.append(ExcludedMentor(mentor_id=m.id, reason=f"price {m.price_per_session_inr:g} exceeds budget {budget:g}"))
        elif availability is not None and m.availability is not None and not slots_overlap(availability, m.availability, session_minutes):
            excluded.append(ExcludedMentor(mentor_id=m.id, reason=f"no overlapping availability of {session_minutes} minutes"))
        else:
            elig.append(m)
    if not targets:
        warnings.append("The student has no open skill gaps on current evidence; matching uses role and goals only.")
    student_doc = " ".join([profile.target_role or role.title, profile.goals, " ".join(g.skill for g in targets)])
    sims = backend.similarities(student_doc, [f"{m.headline} {m.bio} {' '.join(m.expertise)}" for m in elig]) if elig else []
    ranked: list[RankedMentor] = []
    for m, sim in zip(elig, sims):
        exp = {tax.canonical(k) or k: v for k, v in m.expertise.items()}
        matched = [{"skill": g.skill, "mentor_depth": exp[g.skill], "student_status": g.status, "priority": g.priority}
                   for g in targets if g.skill in exp]
        gap_fit = sum(g["priority"] * g["mentor_depth"] / 5 for g in matched) / total_pr
        role_fit = 1.0 if role.id in m.roles else 0.0
        comp = {"gap_fit": gap_fit, "text": sim, "role": role_fit}
        unknowns: list[str] = []
        if languages and m.languages is not None:
            comp["language"] = 1.0 if {x.lower() for x in languages} & {x.lower() for x in m.languages} else 0.0
        elif languages:
            unknowns.append("languages not provided")
        if m.years_experience is not None:
            comp["experience"] = min(m.years_experience, 10) / 10
        if m.rating is not None and m.n_reviews > 0:
            shrunk = (m.rating * m.n_reviews + RATING_PRIOR * RATING_PRIOR_N) / (m.n_reviews + RATING_PRIOR_N)
            comp["rating"] = (shrunk - 1) / 4
        if gap_fit == 0 and role_fit == 0:
            excluded.append(ExcludedMentor(mentor_id=m.id, reason="no expertise relevant to this student's gaps or role"))
            continue
        w = {k: WEIGHTS[k] for k in comp}
        score = 100 * sum(w[k] * comp[k] for k in comp) / sum(w.values())  # renormalise over the signals actually known
        if m.price_per_session_inr is None:
            unknowns.append("price not provided; confirm before booking" + (" (student has a budget limit)" if budget is not None else ""))
        if m.availability is None:
            unknowns.append("availability not provided" + ("; cannot check overlap" if availability is not None else ""))
        reasons = [f"Covers {g['skill']} (depth {g['mentor_depth']}/5), a {g['student_status'].replace('_', ' ')} gap for you" for g in matched[:3]]
        if role_fit:
            reasons.append(f"Experienced in the {role.title} path")
        if not reasons:
            reasons.append("Related to your target role")
        ranked.append(RankedMentor(mentor_id=m.id, score=round(score, 1), components={k: round(v, 3) for k, v in comp.items()},
                                   matched_skills=matched, reasons=reasons, unknowns=unknowns, price_per_session_inr=m.price_per_session_inr))
    ranked.sort(key=lambda r: (-r.score, r.mentor_id))
    if any(m.is_demo_data for m in mentors):
        warnings.append("Some mentors are labelled demo/synthetic data and are not real people.")
    if not mentors:
        warnings.append("No mentors were supplied.")
    return MentorResult(ranked=ranked[:limit], excluded=excluded, backend_status=status, warnings=warnings,
                        target_skills=[{"skill": g.skill, "priority": g.priority, "status": g.status} for g in targets])
