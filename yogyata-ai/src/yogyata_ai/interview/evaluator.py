"""Deterministic rubric-based answer evaluation (technical and HR).

Classification: hybrid of deterministic rules and statistical text similarity (TF-IDF by default,
Sentence Transformers optionally). Nothing is trained. Correctness is NOT keyword overlap alone; it
combines (a) concept coverage where a bare comma-list of terms earns only partial credit,
(b) similarity to the reference answer, (c) misconception detection, and (d) a keyword-stuffing cap.
The evaluator is lexical: a correct answer phrased with unfamiliar vocabulary can be under-scored, so
confidence is never reported as "high" and every result is labelled automated and unverified.
"""
from __future__ import annotations

import re

from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS

from yogyata_ai.common.safety import detect_injection, sanitize_untrusted
from yogyata_ai.common.similarity import EmbeddingSimilarity, SimilarityBackend, get_backend

from .schemas import DEFAULT_WEIGHTS, AnswerEvaluation, EvidenceSnippet, Question

_SENT = re.compile(r"(?<=[.!?])\s+|\n+")
_WORD = re.compile(r"[A-Za-z0-9']+")
_REASONING = [r"\bbecause\b", r"\bsince\b", r"\btherefore\b", r"\bhence\b", r"\bso that\b", r"\bwhich means\b",
              r"\bas a result\b", r"\btrade-?off\b", r"\bwhereas\b", r"\bwhile\b", r"\bhowever\b",
              r"\bif\b.{0,60}\bthen\b", r"\bthis (?:is why|allows|means|causes|prevents|helps)\b", r"\bso\b"]
_EXAMPLE = re.compile(r"\bfor example\b|\bfor instance\b|\be\.g\.|\bsuch as\b", re.I)

_STAR = {
    "situation": re.compile(r"\b(when|during|while|last (?:year|semester|month)|in my (?:first|second|third|final|last) year|"
                            r"at (?:my|the|our)|in (?:a|my|our) (?:project|team|internship|class|college|club)|once|one time)\b", re.I),
    "task": re.compile(r"\b(my (?:role|task|job|responsibility)|i was (?:responsible|asked|assigned|supposed|tasked)|"
                       r"the goal|we needed|i needed|challenge|had to)\b", re.I),
    "action": re.compile(r"\bi (?:\w+ed|decided|built|made|wrote|led|took|set up|spoke|talked|asked|suggested|proposed|split|"
                         r"divided|created|started|began|worked|listened|met|called|planned|gave|ran|taught|found)\b", re.I),
    "result": re.compile(r"\b(as a result|the result|outcome|ended up|eventually|in the end|led to|which helped|"
                         r"we (?:won|finished|delivered|completed|achieved)|improved|reduced|increased|learned|learnt|"
                         r"resolved|\d+\s?%)", re.I),
}
_STAR_TIPS = {
    "situation": "Set the scene: when and where did this happen?",
    "task": "State your specific role or responsibility in the situation.",
    "action": "Describe what *you* did, in the first person, step by step.",
    "result": "End with the result: what changed because of your action (a number helps) and what you learned.",
}
_CLICHES = ["hard worker", "hard-working", "team player", "quick learner", "fast learner", "passionate",
            "detail oriented", "detail-oriented", "go-getter", "self-motivated"]
_FILLERS = re.compile(r"\b(um+|uh+|like|basically|actually|kind of|sort of|you know|stuff|things)\b", re.I)


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENT.split(text) if s.strip()]


def _words(text: str) -> list[str]:
    return _WORD.findall(text)


def _contains(text: str, phrase: str) -> bool:
    return re.search(r"(?<![a-z0-9])" + re.escape(phrase.lower()) + r"(?![a-z0-9])", text) is not None


def _cue_present(low: str, cue: str) -> bool:
    """HR theme cue match: multi-word cues by phrase, single words by stem so 'resolved' matches 'resolve'."""
    cue = cue.lower()
    if " " in cue:
        return _contains(low, cue)
    stem = cue if len(cue) <= 5 else cue[:5]
    return re.search(r"(?<![a-z0-9])" + re.escape(stem) + r"\w*", low) is not None


def _list_like(sentence: str) -> bool:
    toks = [t.lower() for t in _words(sentence)]
    if len(toks) < 5:
        return True
    stop_ratio = sum(t in ENGLISH_STOP_WORDS for t in toks) / len(toks)
    return stop_ratio < 0.15 and sentence.count(",") >= 2


def _snippet(s: str, n: int = 160) -> str:
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def _scale(backend: SimilarityBackend, tfidf_ref: float) -> float:
    return tfidf_ref * 1.6 if isinstance(backend, EmbeddingSimilarity) else tfidf_ref


def _weights(q: Question) -> dict[str, float]:
    w = dict(q.weights or DEFAULT_WEIGHTS[q.type])
    total = sum(w.values()) or 1.0
    return {k: v / total for k, v in w.items()}


def _empty(q: Question, note: str) -> AnswerEvaluation:
    dims = list(DEFAULT_WEIGHTS[q.type])
    return AnswerEvaluation(
        question_id=q.id, interview_type=q.type, topic=q.topic, difficulty=q.difficulty,
        scores={d: 0.0 for d in dims}, overall=0.0, confidence="low", evaluator="deterministic",
        improvements=["Provide an answer to receive feedback."], practice_topics=[q.topic],
        uncertainty_notes=[note])


def evaluate_answer(question: Question, answer_text: str | None, *,
                    backend: SimilarityBackend | None = None) -> AnswerEvaluation:
    answer = sanitize_untrusted(answer_text, 8_000).strip()
    if not answer or not _words(answer):
        return _empty(question, "Empty answer.")
    backend = backend or get_backend()
    result = _technical(question, answer, backend) if question.type == "technical" else _hr(question, answer, backend)
    if detect_injection(answer):
        result.uncertainty_notes.append(
            "The answer contains instruction-like text (e.g. asking for a score); it was ignored and scored as an ordinary answer.")
    return result


# --------------------------------------------------------------------------- technical
def _technical(q: Question, answer: str, backend: SimilarityBackend) -> AnswerEvaluation:
    low = re.sub(r"\s+", " ", answer.lower())
    sents = _sentences(answer)
    words = _words(answer)
    notes = ["Deterministic lexical/statistical evaluation; correct answers in unfamiliar wording may be under-scored."]

    credit: dict[str, float] = {}
    evidence: list[EvidenceSnippet] = []
    list_like_hits = real_hits = 0
    for c in q.concepts:
        aliases = {a.lower() for a in c.aliases} | {c.name.lower()}
        best, snippet = 0.0, None
        for s in sents:
            sl = re.sub(r"\s+", " ", s.lower())
            if any(_contains(sl, a) for a in aliases):
                cr = 0.4 if _list_like(s) else 1.0
                if cr > best:
                    best, snippet = cr, s
        credit[c.name] = best
        if best > 0:
            real_hits += best == 1.0
            list_like_hits += best < 1.0
            evidence.append(EvidenceSnippet(dimension="correctness", quote=_snippet(snippet),
                                            note=f"Addresses '{c.name}'" + (" (listed without explanation)" if best < 1.0 else "")))
    total_w = sum(c.weight for c in q.concepts)
    concept_credit = sum(c.weight * credit[c.name] for c in q.concepts) / total_w
    required = [c for c in q.concepts if c.required] or q.concepts
    req_w = sum(c.weight for c in required)
    # explained coverage: a concept only named in a bare list earns partial credit here too
    completeness = 100 * sum(c.weight * credit[c.name] for c in required) / req_w

    ref_sim = backend.similarity(answer, q.reference_answer) if q.reference_answer else 0.0
    ref_scaled = min(1.0, ref_sim / _scale(backend, 0.45)) if q.reference_answer else concept_credit

    misconceptions, penalty = [], 0.0
    for m in q.misconceptions:
        hit = next((s for s in sents if re.search(m.pattern, s, re.I)), None) or (m.pattern and re.search(m.pattern, low, re.I) and answer)
        if hit:
            penalty += 30
            misconceptions.append(m.explanation)
            evidence.append(EvidenceSnippet(dimension="correctness", quote=_snippet(hit), note=f"Possible error: {m.explanation}"))
    correctness = max(0.0, min(100.0, 100 * (0.65 * concept_credit + 0.35 * ref_scaled) - min(penalty, 60)))

    markers = sum(bool(re.search(p, low)) for p in _REASONING)
    example = bool(_EXAMPLE.search(answer))
    reasoning = min(100.0, 40 * min(markers, 2) + (20 if example else 0))
    if example:
        ex = next(s for s in sents if _EXAMPLE.search(s))
        evidence.append(EvidenceSnippet(dimension="reasoning", quote=_snippet(ex), note="Gives an example"))

    detected = sum(v > 0 for v in credit.values())
    stuffed = detected >= 3 and (list_like_hits / max(1, list_like_hits + real_hits)) >= 0.6 and reasoning < 30
    if stuffed:
        correctness = min(correctness, 45.0)
        notes.append("Many relevant terms appear but mostly as an unexplained list; correctness capped.")

    rel_text = q.text + " " + " ".join(c.explanation for c in q.concepts)
    rel = 100 * min(1.0, backend.similarity(answer, rel_text) / _scale(backend, 0.25))
    if len(words) < 8:
        rel *= 0.5

    scores = {"correctness": correctness, "reasoning": reasoning, "completeness": completeness, "relevance": rel}
    w = _weights(q)
    overall = sum(scores[k] * w.get(k, 0) for k in scores)

    missed = [c.name for c in required if credit[c.name] == 0]
    strengths = [f"Covered '{c.name}'." for c in q.concepts if credit[c.name] >= 1.0]
    improvements = [f"Did not address: {c.explanation}." for c in required if credit[c.name] == 0]
    improvements += [f"Check this point: {m}" for m in misconceptions]
    if reasoning < 40:
        improvements.append("Explain why, not just what: use 'because/therefore' reasoning and give a concrete example.")
    if stuffed:
        improvements.append("Turn the list of terms into sentences that explain how each one relates to the question.")

    follow = []
    for m, ev in zip(misconceptions, [e for e in evidence if e.note.startswith("Possible error")]):
        follow.append(f"You said: \"{ev.quote}\". Can you re-check that statement?")
    for name in missed:
        follow.append(q.follow_ups.get(name) or f"Can you explain {name} and how it relates to {q.topic.replace('_', ' ')}?")
    if reasoning < 40 and len(follow) < 2:
        follow.append("Walk me through a concrete example of this.")

    confidence = "low" if len(words) < 15 else "medium"
    if len(words) < 15:
        notes.append("Very short answer: limited evidence, low confidence.")
    elif detected == 0 and ref_scaled > 0.5:
        confidence = "low"
        notes.append("Answer resembles the reference but matched no key concepts; wording may differ from the rubric.")

    return AnswerEvaluation(
        question_id=q.id, interview_type="technical", topic=q.topic, difficulty=q.difficulty,
        scores={k: round(v, 1) for k, v in scores.items()}, overall=round(overall, 1),
        confidence=confidence, evaluator="deterministic", strengths=strengths, improvements=improvements,
        evidence=evidence, missed_concepts=missed, misconceptions_detected=misconceptions,
        follow_up_questions=follow[:3],
        practice_topics=([q.topic] + [f"{q.topic}: {m}" for m in missed[:2]]) if overall < 60 else [],
        uncertainty_notes=notes)


# --------------------------------------------------------------------------- HR
def _hr(q: Question, answer: str, backend: SimilarityBackend) -> AnswerEvaluation:
    low = answer.lower()
    sents = _sentences(answer)
    words = _words(answer)
    n = len(words)
    notes = ["Deterministic structure/clarity evaluation; it cannot judge truthfulness or fit."]

    present = {k: any(p.search(s) for s in sents) for k, p in _STAR.items()}
    structure = 25.0 * sum(present.values())
    evidence = []
    for k, ok in present.items():
        if ok:
            s = next(s for s in sents if _STAR[k].search(s))
            evidence.append(EvidenceSnippet(dimension="structure", quote=_snippet(s), note=f"Shows the {k}"))

    cues = [c for c in q.hr_focus if _cue_present(low, c)]
    sim = backend.similarity(answer, q.text + " " + " ".join(q.hr_focus))
    relevance = 100 * min(1.0, 0.5 * min(1.0, sim / _scale(backend, 0.2)) + 0.5 * min(1.0, len(cues) / 4))
    if n < 8:
        relevance *= 0.5

    action_hits = sum(len(_STAR["action"].findall(s)) for s in sents)
    has_number = bool(re.search(r"\d", answer))
    named = any(re.search(r"(?<![.!?]\s)(?<!^)\b[A-Z][a-z]{2,}", s) for s in sents)
    ex = (25 if has_number else 0) + (15 if named else 0) + (30 if action_hits >= 2 else 15 if action_hits == 1 else 0) \
        + (10 if _EXAMPLE.search(answer) else 0) + (20 if present["situation"] else 0)
    cliches = [c for c in _CLICHES if c in low]
    if len(cliches) >= 2 and action_hits == 0:
        ex *= 0.5
        notes.append("Generic claims (" + ", ".join(cliches[:3]) + ") without a concrete example.")
    examples = min(100.0, float(ex))
    if has_number:
        s = next(s for s in sents if re.search(r"\d", s))
        evidence.append(EvidenceSnippet(dimension="examples", quote=_snippet(s), note="Contains a specific figure"))

    avg_len = n / max(1, len(sents))
    sent_score = 60.0 if 8 <= avg_len <= 25 else (60 * avg_len / 8 if avg_len < 8 else max(0.0, 60 - (avg_len - 25) * 3))
    len_score = 40.0 if 40 <= n <= 250 else (40 * n / 40 if n < 40 else max(0.0, 40 - (n - 250) / 10))
    filler_per_100 = 100 * len(_FILLERS.findall(answer)) / n
    clarity = max(0.0, min(100.0, sent_score + len_score - min(30.0, filler_per_100 * 3)))

    scores = {"relevance": relevance, "structure": structure, "clarity": clarity, "examples": examples}
    w = _weights(q)
    overall = sum(scores[k] * w.get(k, 0) for k in scores)

    strengths = [f"Clearly shows the {k}." for k, ok in present.items() if ok]
    improvements = [_STAR_TIPS[k] for k, ok in present.items() if not ok]
    if not cues:
        improvements.append("Answer the question asked more directly; none of the expected themes were mentioned.")
    if n < 40:
        improvements.append("Add detail: aim for roughly 40-250 words.")
    if filler_per_100 > 5:
        improvements.append("Reduce filler words (e.g. 'like', 'basically', 'you know').")
    follow = []
    if not present["result"]:
        follow.append("What was the outcome, and what would you do differently?")
    if action_hits < 2:
        follow.append("What exactly did you personally do?")
    if not has_number:
        follow.append("Can you quantify the impact (numbers, time, people involved)?")

    return AnswerEvaluation(
        question_id=q.id, interview_type="hr", topic=q.topic, difficulty=q.difficulty,
        scores={k: round(v, 1) for k, v in scores.items()}, overall=round(overall, 1),
        confidence="low" if n < 20 else "medium", evaluator="deterministic", strengths=strengths,
        improvements=improvements, evidence=evidence, follow_up_questions=follow[:3],
        practice_topics=[q.topic] if overall < 60 else [],
        uncertainty_notes=notes + (["Very short answer: low confidence."] if n < 20 else []))
