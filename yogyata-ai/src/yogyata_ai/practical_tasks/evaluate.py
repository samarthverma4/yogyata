"""Deterministic PRELIMINARY checks of a submission against a task rubric.

What this does: checks presence of required concepts, sections and minimum length. What it cannot do: judge
correctness, quality or originality. Every result is flagged human_review_required and, at most, produces a
low-strength 'task_auto' evidence suggestion that cannot by itself make a skill 'met'.
"""
from __future__ import annotations

import re

from yogyata_ai.common.safety import detect_injection, sanitize_untrusted
from yogyata_ai.common.schemas import EvidenceRecord

from .schemas import CriterionResult, PracticalTask, PreliminaryFeedback

AUTO_EVIDENCE_CAP = 0.5      # strictly below the 0.6 'met' threshold used by skill-gap analysis
MIN_WORDS_FOR_EVIDENCE = 40


def _has_stem(text_l: str, term: str) -> bool:
    """Match whole term, allowing simple plural/-ing/-ed suffixes."""
    t = re.escape(term.lower())
    return re.search(r"(?<![a-z0-9])" + t + r"(s|es|ed|ing|ation|ised|ized)?(?![a-z0-9])", text_l) is not None or (
        term.endswith(" ") and term.lower() in text_l)


def _section_found(text: str, patterns: list[str]) -> bool:
    for line in text.split("\n"):
        s = line.strip().strip("*_# ").strip()
        if not s:
            continue
        head_like = line.lstrip().startswith("#") or line.strip().startswith("**") or s.endswith(":") or len(s.split()) <= 6 or ":" in s[:40]
        if head_like and any(re.search(r"\b" + re.escape(p.lower()), s.lower()) for p in patterns):
            return True
    return False


def _words(text: str) -> list[str]:
    return re.findall(r"[A-Za-z0-9_+#.'-]+", text)


def _stuffed(text: str, all_terms: list[str]) -> bool:
    """Mostly a bag of rubric keywords with almost no running prose."""
    words = [w.lower() for w in _words(text)]
    if len(words) < 6:
        return False
    termwords = {w for t in all_terms for w in re.findall(r"[a-z0-9_+#.'-]+", t.lower())}
    share = sum(w in termwords for w in words) / len(words)
    sentences = [s for s in re.split(r"[.!?\n]+", text) if len(_words(s)) >= 6]
    return share >= 0.6 and len(sentences) < 2


def evaluate_submission(task: PracticalTask, submission_text: str, *, emit_evidence: bool = False) -> PreliminaryFeedback:
    raw = submission_text or ""
    text = sanitize_untrusted(raw, 50_000)
    text_l = text.lower()
    n_words = len(_words(text))
    flags: list[str] = []
    inj = detect_injection(text)
    if inj:
        flags.append("possible_prompt_injection: " + ", ".join(inj) + " (text treated as data; scores unaffected)")
    all_terms = [t for c in task.rubric if c.check.type == "concepts" for g in c.check.groups for t in g]
    stuffed = _stuffed(text, all_terms)
    if stuffed:
        flags.append("keyword_list_without_explanation")
    if n_words < MIN_WORDS_FOR_EVIDENCE:
        flags.append("very_short_submission")

    results: list[CriterionResult] = []
    total_w = sum(c.weight for c in task.rubric)
    check_w = got = 0.0
    for c in task.rubric:
        ch = c.check
        if ch.type == "human":
            results.append(CriterionResult(id=c.id, description=c.description, weight=c.weight, automated_status="needs_human",
                                           detail="Cannot be judged automatically; a human reviewer must assess this."))
            continue
        check_w += c.weight
        if ch.type == "concepts":
            hits = [g for g in ch.groups if any(_has_stem(text_l, t) for t in g)]
            need = ch.min_groups or len(ch.groups)
            frac = len(hits) / need
            status, val = ("found", 1.0) if frac >= 1 else ("partial", 0.5) if hits else ("not_found", 0.0)
            detail = f"{len(hits)}/{len(ch.groups)} expected concept group(s) mentioned (need {need})."
        elif ch.type == "section":
            ok = _section_found(text, ch.patterns)
            status, val = ("found", 1.0) if ok else ("not_found", 0.0)
            detail = "A matching section/heading was found." if ok else "No section covering: " + " / ".join(ch.patterns)
        else:
            ok = n_words >= ch.n
            status, val = ("found", 1.0) if ok else ("partial", 0.5) if n_words >= ch.n // 2 else ("not_found", 0.0)
            detail = f"{n_words} words (expected at least {ch.n})."
        if stuffed and ch.type == "concepts":
            status, val = "partial" if val else "not_found", min(val, 0.25)
            detail += " Mentions without explanation are discounted."
        got += c.weight * val
        results.append(CriterionResult(id=c.id, description=c.description, weight=c.weight, automated_status=status, detail=detail))

    share = check_w / total_w
    completeness = round(got / check_w, 3) if check_w else None
    suggestions = [f"Address: {r.description.lower()}" for r in results if r.automated_status in ("not_found", "partial")]
    notes = ["Preliminary and unverified: presence of expected elements is not evidence of correctness or competence.",
             f"{round((1 - share) * 100)}% of the rubric weight can only be judged by a human reviewer."]
    suggested: list[EvidenceRecord] = []
    if emit_evidence and completeness is not None and not stuffed and not inj and n_words >= MIN_WORDS_FOR_EVIDENCE and share >= 0.3:
        strength = round(min(AUTO_EVIDENCE_CAP, completeness * AUTO_EVIDENCE_CAP * (0.5 + share / 2)), 3)
        suggested = [EvidenceRecord(skill=s, source="task_auto", strength=strength, ref_id=task.id,
                                    note="automated preliminary check; capped; not verified") for s in task.skills]
    return PreliminaryFeedback(task_id=task.id, criteria=results, indicative_completeness=completeness,
                               checkable_weight_share=round(share, 3), flags=flags, suggestions=suggestions,
                               suggested_evidence=suggested, notes=notes)
