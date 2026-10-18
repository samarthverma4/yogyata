from pathlib import Path

import pytest
from pydantic import ValidationError

from yogyata_ai.common.similarity import TfidfSimilarity
from yogyata_ai.resume_intelligence import analyze, match
from yogyata_ai.resume_intelligence.matching import match_job
from yogyata_ai.resume_intelligence.schemas import MAX_TEXT_CHARS
from yogyata_ai.resume_intelligence.scoring import WEIGHTS, analyze_resume

DEMO = Path(__file__).resolve().parents[2] / "data" / "demo" / "resumes"


def read(name):
    return (DEMO / name).read_text(encoding="utf-8")


def test_weights_sum_to_one():
    assert sum(WEIGHTS.values()) == pytest.approx(1.0)


def test_strong_beats_weak():
    strong = analyze_resume(read("r1_priya_data.txt")).overall_score
    weak = analyze_resume(read("r7_rahul_minimal.txt")).overall_score
    assert strong > weak


def test_score_bounds_and_components():
    a = analyze_resume(read("r2_rohan_web.txt"))
    assert 0 <= a.overall_score <= 100
    assert {c.name for c in a.components} == set(WEIGHTS)
    assert all(0 <= c.score <= 100 for c in a.components)


def test_empty_resume_scores_zero_with_warning():
    a = analyze_resume("")
    assert a.overall_score == 0
    assert a.warnings and a.suggestions


def test_none_like_input_handled():
    assert analyze_resume(None).overall_score == 0  # type: ignore[arg-type]


def test_missing_email_triggers_suggestion():
    a = analyze_resume(read("r6_imran_noskills.txt").replace("imran.khan@example.com", ""))
    assert any("email" in s.message.lower() for s in a.suggestions)


def test_keyword_stuffing_flagged_by_missing_evidence():
    a = analyze_resume(read("r8_sneha_keywords.txt"))
    skills_component = next(c for c in a.components if c.name == "skills")
    assert "0 with applied evidence" in skills_component.detail


def test_deterministic():
    t = read("r3_ananya_ml.txt")
    assert analyze_resume(t).model_dump() == analyze_resume(t).model_dump()


def test_match_identifies_missing_skill():
    r = match_job("Skills\nPython, SQL", "Need Python, SQL and Tableau")
    assert r.matched_skills == ["Python", "SQL"]
    assert r.missing_skills == ["Tableau"]
    assert 0 <= r.match_score <= 100


def test_match_without_jd_skills_uses_similarity_note():
    r = match_job("Skills\nPython", "We value curiosity and kindness")
    assert r.required_skills_found == []
    assert any("similarity only" in n for n in r.notes)


def test_match_empty_inputs():
    r = match_job("", "")
    assert r.match_score == 0
    assert "Empty input." in r.notes


def test_perfect_skill_overlap_scores_high():
    text = "Skills\nPython, SQL, Pandas"
    r = match_job(text, text)
    assert r.match_score > 90


def test_tfidf_similarity_edge_cases():
    sim = TfidfSimilarity()
    assert sim.similarity("", "abc") == 0.0
    assert sim.similarity("the and of", "the and of") == 0.0  # only stop words
    assert sim.similarity("python data", "python data") == pytest.approx(1.0)


def test_api_analyze_and_match_are_json_compatible():
    import json

    out = analyze({"resume_text": read("r1_priya_data.txt")})
    json.dumps(out)
    out2 = match({"resume_text": read("r1_priya_data.txt"), "job_description": "SQL and Python"})
    json.dumps(out2)
    assert out2["matched_skills"] == ["Python", "SQL"]


def test_api_rejects_missing_field():
    with pytest.raises(ValidationError):
        analyze({})


def test_api_rejects_oversized_input():
    with pytest.raises(ValidationError):
        analyze({"resume_text": "a" * (MAX_TEXT_CHARS + 1)})
    with pytest.raises(ValidationError):
        match({"resume_text": "x", "job_description": "a" * (MAX_TEXT_CHARS + 1)})
