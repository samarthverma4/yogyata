"""Adaptive question selection, topic-wise performance tracking and practice recommendations.

Pure functions over a `history` list supplied by the caller; this module stores nothing.
Classification: deterministic rules.
"""
from __future__ import annotations

from collections import defaultdict

from yogyata_ai.common.schemas import AssessmentAttempt, EvidenceRecord

from .bank import QuestionBank, default_bank
from .schemas import AnswerEvaluation, HistoryItem, SelectedQuestion, TopicPerformance

_CONF_WEIGHT = {"low": 0.5, "medium": 1.0, "high": 1.0}
WEAK_BELOW = 50.0
STRONG_FROM = 70.0


def evaluation_to_history_item(ev: AnswerEvaluation) -> HistoryItem:
    return HistoryItem(question_id=ev.question_id, topic=ev.topic, difficulty=ev.difficulty,
                       overall=ev.overall, interview_type=ev.interview_type, confidence=ev.confidence)


def _wmean(items: list[HistoryItem]) -> float:
    w = [_CONF_WEIGHT[i.confidence] for i in items]
    return sum(i.overall * wi for i, wi in zip(items, w)) / sum(w)


def summarize_topic_performance(history: list[HistoryItem], *, min_attempts: int = 2) -> list[TopicPerformance]:
    """Per-topic summary in chronological order. Topics with too few attempts are 'insufficient_data',
    which is deliberately distinct from 'weak'."""
    by_topic: dict[str, list[HistoryItem]] = defaultdict(list)
    for h in history:
        by_topic[h.topic].append(h)
    out = []
    for topic, items in sorted(by_topic.items()):
        mean = _wmean(items)
        status = "insufficient_data" if len(items) < min_attempts else (
            "weak" if mean < WEAK_BELOW else "strong" if mean >= STRONG_FROM else "developing")
        out.append(TopicPerformance(topic=topic, attempts=len(items), mean_score=round(mean, 1),
                                    latest_score=items[-1].overall,
                                    trend=round(items[-1].overall - items[0].overall, 1) if len(items) > 1 else None,
                                    status=status))
    return out


def _target_difficulty(history: list[HistoryItem]) -> int:
    if not history:
        return 1
    recent = history[-3:]
    base = round(sum(h.difficulty for h in recent) / len(recent))
    mean = _wmean(recent)
    step = 1 if mean >= 75 else -1 if mean < 45 else 0
    return max(1, min(3, base + step))


def select_next_question(role: str | None, interview_type: str, history: list[HistoryItem] | None = None,
                         bank: QuestionBank | None = None) -> SelectedQuestion | None:
    bank = bank or default_bank()
    history = [h for h in (history or []) if h.interview_type == interview_type]
    eligible = bank.filter(interview_type=interview_type, role=role)
    if not eligible:
        return None
    asked = {h.question_id for h in history}
    pool = [q for q in eligible if q.id not in asked]
    repeat_note = ""
    if not pool:
        pool, repeat_note = eligible, " All eligible questions were already asked, so a repeat is allowed."
    target = _target_difficulty(history)

    stats = {t.topic: t for t in summarize_topic_performance(history, min_attempts=1)}
    pool_topics = sorted({q.topic for q in pool})
    weak = sorted([t for t in pool_topics if t in stats and stats[t].mean_score < WEAK_BELOW], key=lambda t: stats[t].mean_score)
    untried = [t for t in pool_topics if t not in stats]
    if weak:
        topic = weak[0]
        reason = f"Practising a weaker topic ('{topic}', mean {stats[topic].mean_score})."
    elif untried:
        topic = untried[0]
        reason = f"Covering a topic not yet assessed ('{topic}')."
    else:
        topic = min(pool_topics, key=lambda t: (stats[t].mean_score, t))
        reason = f"All topics attempted; revisiting the lowest-scoring one ('{topic}')."
    choice = sorted((q for q in pool if q.topic == topic), key=lambda q: (abs(q.difficulty - target), q.id))[0]
    return SelectedQuestion(question=choice, target_difficulty=target,
                            reason=f"{reason} Target difficulty {target}.{repeat_note}")


def recommend_practice(history: list[HistoryItem], bank: QuestionBank | None = None, *,
                       interview_type: str | None = None, max_topics: int = 3) -> dict:
    """Focus topics (supported by >= 2 attempts) and, separately, topics not yet assessed."""
    bank = bank or default_bank()
    hist = [h for h in history if interview_type in (None, h.interview_type)]
    perf = summarize_topic_performance(hist)
    focus = []
    for t in sorted((p for p in perf if p.status in ("weak", "developing")), key=lambda p: p.mean_score)[:max_topics]:
        ids = [q.id for q in bank.questions if q.topic == t.topic and (interview_type in (None, q.type))]
        focus.append({"topic": t.topic, "status": t.status, "mean_score": t.mean_score,
                      "reason": f"Average {t.mean_score} over {t.attempts} attempts.", "suggested_question_ids": ids})
    attempted = {h.topic for h in hist}
    not_assessed = sorted({q.topic for q in bank.questions if q.topic not in attempted
                           and interview_type in (None, q.type)})
    thin = [p.topic for p in perf if p.status == "insufficient_data"]
    return {"focus_topics": focus, "not_yet_assessed": not_assessed, "insufficient_data_topics": thin,
            "note": "'not_yet_assessed' and 'insufficient_data' topics are unknown, not weak."}


def evaluations_to_evidence(evals: list[AnswerEvaluation], bank: QuestionBank | None = None) -> list[EvidenceRecord]:
    """Technical evaluations -> competency evidence (source 'interview_auto', never verified).

    Low-confidence evaluations are skipped: they are too weak to count as evidence either way.
    """
    bank = bank or default_bank()
    out = []
    for ev in evals:
        q = bank.get(ev.question_id)
        if q is None or ev.interview_type != "technical" or ev.confidence == "low":
            continue
        for skill in q.skills:
            out.append(EvidenceRecord(skill=skill, source="interview_auto", strength=round(ev.overall / 100, 3),
                                      ref_id=ev.question_id, note=f"automated evaluation, confidence {ev.confidence}",
                                      assessed_at=ev.assessed_at))
    return out


def evaluations_to_attempts(evals: list[AnswerEvaluation], bank: QuestionBank | None = None) -> list[AssessmentAttempt]:
    """Technical evaluations that yielded no evidence (low confidence) -> assessment attempts (skill state `missing_evidence`)."""
    bank = bank or default_bank()
    out = []
    for ev in evals:
        q = bank.get(ev.question_id)
        if q is None or ev.interview_type != "technical" or ev.confidence != "low":
            continue
        for skill in q.skills:
            out.append(AssessmentAttempt(skill=skill, kind="interview", reason="low-confidence automated evaluation",
                                         ref_id=ev.question_id, assessed_at=ev.assessed_at))
    return out
