"""Evidence-based skill-gap engine with transparent scoring.

Classification: deterministic rules and heuristics. No classifier is trained; every number below is a
documented, hand-set convention (see constants), not a measured quantity.

Core principles
- Declared, demonstrated and verified are different things (see common.evidence).
- Missing information is "unassessed", never "weak". Only evidence that actually shows weak
  performance (strength < 0.4) produces a "demonstrated_weakness".
- Resume-only evidence is self-reported: it is capped below the "met" threshold until an automated or
  human-reviewed assessment backs it.
- Every status carries a plain-language explanation and a confidence label.
"""
from __future__ import annotations

from yogyata_ai.common.evidence import (
    EVIDENCE_STATES, MET_CREDIT, WEAK_STRENGTH, EvidenceConfig, SkillEvidenceSummary, level_of, summarize_evidence,
)
from yogyata_ai.common.schemas import StudentProfile

from .roles import RoleConfig
from .schemas import GapReport, SkillAssessment

# MET_CREDIT / WEAK_STRENGTH live in common.evidence so evidence states and statuses cannot drift apart.
SELF_REPORTED_CAP = 0.55
DECLARED_CREDIT = 0.25
SELF_REPORTED_SOURCES = {"declared", "resume_evidence"}
SEVERITY = {"demonstrated_weakness_verified": 1.0, "demonstrated_weakness": 0.9, "unassessed": 0.7,
            "missing_evidence": 0.5, "developing": 0.4, "self_reported_use": 0.3, "met": 0.0}


def _self_reported_only(s: SkillEvidenceSummary) -> bool:
    return bool(s.sources) and set(s.sources) <= SELF_REPORTED_SOURCES


def credit_for(s: SkillEvidenceSummary) -> float:
    if s.level == "none":
        return 0.0
    if s.level == "declared":
        return DECLARED_CREDIT
    st = s.strength if s.strength is not None else 0.0
    if s.level == "verified":
        return round(st, 3)
    c = 0.5 * st if st < WEAK_STRENGTH else 0.1 + 0.8 * st
    if _self_reported_only(s):
        c = min(c, SELF_REPORTED_CAP)
    return round(min(1.0, c), 3)


def status_for(s: SkillEvidenceSummary) -> str:
    if s.level == "none":
        return "missing_evidence" if s.state == "missing_evidence" else "unassessed"
    if s.level == "declared":
        return "missing_evidence"
    st = s.strength if s.strength is not None else 0.0
    if st < WEAK_STRENGTH and not s.capped:   # a cap-limited review score is not evidence of weakness
        return "demonstrated_weakness"
    if _self_reported_only(s):
        return "self_reported_use"
    return "met" if credit_for(s) >= MET_CREDIT else "developing"


def _confidence(s: SkillEvidenceSummary, status: str) -> str:
    if s.level == "none":
        return "none"
    if s.level == "verified":
        c = "high"
    elif s.level == "declared" or status == "self_reported_use":
        c = "low"
    else:
        c = "medium" if len(set(s.sources) - {"declared"}) >= 2 else "low"
    if (s.stale or s.conflict) and c != "low":   # outdated or contradictory evidence is never reported as confidently as clean evidence
        c = {"high": "medium", "medium": "low"}[c]
    return c


def _explain(skill: str, imp: int, s: SkillEvidenceSummary, status: str, blocked: list[str]) -> str:
    srcs = ", ".join(s.sources) if s.sources else "none"
    st = f"{s.strength:.2f}" if s.strength is not None else "n/a"
    if status == "met":
        txt = f"{skill}: demonstrated at strength {st} ({srcs}); no gap."
    elif status == "demonstrated_weakness":
        who = "Human-reviewed result" if s.level == "verified" else "Automated assessment (confirm with a reviewed task)"
        txt = f"{skill} (importance {imp}/5): {who} shows weak performance (strength {st}; sources: {srcs})."
    elif status == "developing":
        txt = f"{skill} (importance {imp}/5): evidence is partial (strength {st}; sources: {srcs})."
    elif status == "self_reported_use":
        txt = f"{skill} (importance {imp}/5): used in described projects (self-reported) but not yet assessed or reviewed."
    elif status == "missing_evidence" and s.state == "missing_evidence":
        txt = f"{skill} (importance {imp}/5): an assessment was attempted but gave no usable evidence; try again."
    elif status == "missing_evidence":
        txt = f"{skill} (importance {imp}/5): listed as a skill but no project, interview or task evidence yet."
    else:
        txt = (f"{skill} (importance {imp}/5): no information (not listed, no evidence). "
               "This is unknown, not a judgement that the skill is weak.")
    if blocked and status != "met":
        txt += " Build prerequisites first: " + ", ".join(blocked) + "."
    if s.notes:
        txt += " Note: " + "; ".join(s.notes) + "."
    return txt


def readiness_exact(profile: StudentProfile, role: RoleConfig, *, config: EvidenceConfig | None = None, as_of=None) -> float:
    """Unrounded readiness (0-100) used for review caps; `analyze_gap(...).readiness_score` is this value rounded to 1 decimal."""
    summaries = summarize_evidence(profile, config=config, as_of=as_of)
    total = sum(rs.importance for rs in role.skills)
    cred = sum(rs.importance * credit_for(level_of(summaries, rs.skill)) for rs in role.skills)
    return max(0.0, min(100.0, 100.0 * cred / total))


def analyze_gap(profile: StudentProfile, role: RoleConfig, *, top_n: int = 8,
                config: EvidenceConfig | None = None, as_of=None) -> GapReport:
    summaries = summarize_evidence(profile, config=config, as_of=as_of)
    by_name = {rs.skill: rs for rs in role.skills}
    base = {name: level_of(summaries, name) for name in by_name}
    status = {n: status_for(s) for n, s in base.items()}

    dependents: dict[str, set[str]] = {n: set() for n in by_name}
    for rs in role.skills:
        for p in rs.prerequisites:
            dependents[p].add(rs.skill)

    def descendants(n: str, seen: set[str] | None = None) -> set[str]:
        seen = seen if seen is not None else set()
        for d in dependents[n]:
            if d not in seen:
                seen.add(d)
                descendants(d, seen)
        return seen

    assessments: list[SkillAssessment] = []
    total_imp = sum(rs.importance for rs in role.skills)
    cred, cred_min, cred_max = 0.0, 0.0, 0.0
    assessed_w = verified_w = 0.0
    for rs in role.skills:
        s, st = base[rs.skill], status[rs.skill]
        credit = credit_for(s)
        blocked = [p for p in rs.prerequisites if status[p] != "met"]
        unlocks = sum(status[d] != "met" for d in descendants(rs.skill))
        key = "demonstrated_weakness_verified" if st == "demonstrated_weakness" and s.level == "verified" else st
        priority = min(100.0, 100 * (rs.importance / 5) * SEVERITY[key] * (1 + 0.1 * min(unlocks, 3)))
        cred += rs.importance * credit
        assessed = s.level == "verified" or (s.level == "demonstrated" and not _self_reported_only(s))
        cred_min += rs.importance * (credit if s.level in ("demonstrated", "verified") else 0.0)
        optimistic = s.level in ("none", "declared") or _self_reported_only(s) and st != "demonstrated_weakness"
        cred_max += rs.importance * (1.0 if optimistic else credit)
        assessed_w += rs.importance if assessed else 0
        verified_w += rs.importance if s.level == "verified" else 0
        assessments.append(SkillAssessment(
            skill=rs.skill, importance=rs.importance, level=s.level, strength=s.strength, credit=credit,
            status=st, confidence=_confidence(s, st), evidence_sources=s.sources, prerequisites=rs.prerequisites,
            blocked_by=blocked, unlocks=unlocks, priority=round(priority, 1),
            explanation=_explain(rs.skill, rs.importance, s, st, blocked),
            evidence_state=s.state, evidence_state_reason=s.state_reason, last_assessed_at=s.last_assessed_at,
            evidence_stale=s.stale, evidence_conflict=s.conflict, evidence_notes=list(s.notes)))

    assessed_cov, verified_cov = assessed_w / total_imp, verified_w / total_imp
    sufficiency = "high" if assessed_cov >= 0.7 and verified_cov >= 0.3 else "medium" if assessed_cov >= 0.4 else "low"
    gaps = sorted((a for a in assessments if a.status != "met"), key=lambda a: (-a.priority, a.skill))
    notes: list[str] = []
    if not profile.evidence and not profile.declared_skills:
        notes.append("No skills or evidence were supplied: every requirement is unassessed, not failed.")
    if sufficiency == "low":
        notes.append("Few skills have assessed or reviewed evidence; treat this report as provisional.")
    if verified_cov == 0:
        notes.append("No human-reviewed evidence yet; nothing here is verified.")
    if any(a.evidence_stale for a in assessments):
        notes.append("Some assessed evidence is outdated: " + ", ".join(a.skill for a in assessments if a.evidence_stale) + ".")
    if any(a.evidence_conflict for a in assessments):
        notes.append("Assessed evidence disagrees for: " + ", ".join(a.skill for a in assessments if a.evidence_conflict) + ".")
    names = lambda st: [a.skill for a in assessments if a.status == st]  # noqa: E731
    return GapReport(
        role_id=role.id, role_title=role.title, readiness_score=round(100 * cred / total_imp, 1),
        readiness_min=round(100 * cred_min / total_imp, 1), readiness_max=round(100 * cred_max / total_imp, 1),
        assessed_coverage=round(assessed_cov, 3), verified_coverage=round(verified_cov, 3),
        evidence_sufficiency=sufficiency, skills=assessments, priority_gaps=gaps[:top_n],
        demonstrated_weaknesses=names("demonstrated_weakness"), missing_evidence=names("missing_evidence"),
        evidence_states={st: [a.skill for a in assessments if a.evidence_state == st] for st in EVIDENCE_STATES},
        as_of=str(as_of) if as_of is not None else None, unassessed=names("unassessed"), self_reported_use=names("self_reported_use"), met=names("met"), notes=notes)


def compare_reports(before: GapReport, after: GapReport) -> dict:
    """What changed between two reports for the same role (used when new reviewed evidence arrives)."""
    b = {s.skill: s for s in before.skills}
    changes = []
    for s in after.skills:
        o = b.get(s.skill)
        if o and (o.status != s.status or o.priority != s.priority):
            changes.append({"skill": s.skill, "status": [o.status, s.status], "priority": [o.priority, s.priority]})
    return {"readiness_delta": round(after.readiness_score - before.readiness_score, 1),
            "sufficiency": [before.evidence_sufficiency, after.evidence_sufficiency], "changed_skills": changes}
