"""Optional LLM-assisted evaluation layered on the deterministic evaluator.

Classification: hybrid (LLM inference + deterministic rules). Safeguards:
- The deterministic result is always computed first and is the fallback for every failure mode.
- LLM output must be valid JSON with exactly the expected rubric dimensions, each 0-100.
- Quoted evidence is kept only if it appears verbatim in the student's answer.
- Final dimension scores are the mean of LLM and deterministic scores, so one component alone cannot
  set a grade. Disagreement above 25 points lowers confidence to "low".
- If the answer contains instruction-like text and the LLM score exceeds the deterministic one by more
  than 25, the LLM score is discarded as possible manipulation.
- Output is always `automated_unverified`; LLM judgments are never presented as verified.
"""
from __future__ import annotations

import json
import re

from pydantic import BaseModel, Field

from yogyata_ai.common.llm import LLMAdapter, call_llm_json
from yogyata_ai.common.safety import UNTRUSTED_NOTICE, detect_injection, sanitize_untrusted, wrap_untrusted
from yogyata_ai.common.similarity import SimilarityBackend

from .evaluator import _weights, evaluate_answer
from .schemas import DEFAULT_WEIGHTS, AnswerEvaluation, EvidenceSnippet, Question

DISAGREEMENT_LIMIT = 25.0


class LLMScores(BaseModel):
    scores: dict[str, float]
    rationale: str = ""
    evidence_quotes: list[str] = Field(default_factory=list)


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.lower()).strip()


def _prompt(q: Question, answer: str) -> str:
    dims = list(DEFAULT_WEIGHTS[q.type])
    key_points = [f"- {c.name}: {c.explanation}" for c in q.concepts] if q.type == "technical" else \
                 [f"- themes: {', '.join(q.hr_focus)}"]
    return (
        f"Interview type: {q.type}\nQuestion: {q.text}\n"
        f"Key points an expert answer covers:\n" + "\n".join(key_points) + "\n"
        + (f"Reference answer: {q.reference_answer}\n" if q.reference_answer else "")
        + f"Score each dimension from 0 to 100: {', '.join(dims)}.\n"
        'Return JSON only: {"scores": {"<dimension>": number}, "rationale": "<one sentence>", '
        '"evidence_quotes": ["<exact quote from the answer>"]}\n'
        + wrap_untrusted("student_answer", answer, 8_000))


def evaluate_with_llm(question: Question, answer_text: str | None, llm: LLMAdapter | None, *,
                      backend: SimilarityBackend | None = None, timeout: float = 20.0) -> AnswerEvaluation:
    det = evaluate_answer(question, answer_text, backend=backend)
    answer = sanitize_untrusted(answer_text, 8_000).strip()
    if llm is None:
        det.llm_status = "llm_disabled"
        return det
    if not answer:
        det.llm_status = "skipped_empty_answer"
        return det

    parsed, err = call_llm_json(llm, UNTRUSTED_NOTICE, _prompt(question, answer), LLMScores, timeout=timeout)
    if parsed is None:
        det.llm_status = f"fallback_to_deterministic ({err})"
        det.uncertainty_notes.append("LLM evaluation unavailable or invalid; deterministic result shown.")
        return det

    dims = set(DEFAULT_WEIGHTS[question.type])
    if set(parsed.scores) != dims or any(not (0 <= v <= 100) for v in parsed.scores.values()):
        det.llm_status = "fallback_to_deterministic (invalid_llm_scores)"
        det.uncertainty_notes.append("LLM returned scores that did not match the rubric; ignored.")
        return det

    w = _weights(question)
    llm_overall = sum(parsed.scores[d] * w.get(d, 0) for d in dims)
    if detect_injection(answer) and llm_overall > det.overall + DISAGREEMENT_LIMIT:
        det.llm_status = "ignored_suspected_manipulation"
        det.uncertainty_notes.append("LLM score discarded: the answer contains instruction-like text and the LLM scored it much higher.")
        return det

    blended = {d: round((det.scores[d] + parsed.scores[d]) / 2, 1) for d in dims}
    overall = round(sum(blended[d] * w.get(d, 0) for d in dims), 1)
    disagreement = abs(llm_overall - det.overall)

    kept, dropped = [], 0
    for quote in parsed.evidence_quotes[:5]:
        if quote.strip() and _norm(quote) in _norm(answer):
            kept.append(EvidenceSnippet(dimension="llm", quote=quote.strip()[:200], note="Quoted by LLM; verified present in the answer"))
        else:
            dropped += 1
    notes = list(det.uncertainty_notes)
    if dropped:
        notes.append(f"{dropped} LLM evidence quote(s) were not found in the answer and were removed.")
    if parsed.rationale:
        notes.append("LLM rationale (unverified): " + sanitize_untrusted(parsed.rationale, 300))
    confidence = "medium"
    if disagreement > DISAGREEMENT_LIMIT:
        confidence = "low"
        notes.append(f"LLM and deterministic evaluators disagree by {disagreement:.0f} points; treat this score as uncertain.")
    elif det.confidence == "low":
        confidence = "low"

    return det.model_copy(update={
        "scores": blended, "overall": overall, "confidence": confidence, "evaluator": "hybrid_llm",
        "evidence": det.evidence + kept, "uncertainty_notes": notes, "llm_status": "used"})
