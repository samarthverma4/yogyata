import pytest

from yogyata_ai.resume_intelligence.parser import (
    extract_contact,
    extract_skills,
    is_quantified,
    parse_resume,
    split_sections,
    starts_with_action_verb,
)

SAMPLE = """Test Person
test@example.com | +91 98765 43210 | github.com/test-demo

Education
B.Tech CSE, Demo Institute, 2027

Skills
Python, SQL

Projects
- Built a model in Python that cut errors by 20%
- Worked on a team
"""


def names(parsed):
    return {s.name for s in parsed.skills}


def test_sections_detected():
    s = split_sections(SAMPLE)
    assert {"header", "education", "skills", "projects"} <= set(s)


def test_headings_with_colon_and_caps():
    s = split_sections("NAME\nEDUCATION:\nBSc 2024\nSKILLS:\nExcel")
    assert "education" in s and "skills" in s


def test_contact_extraction():
    c = extract_contact(SAMPLE)
    assert c.email == "test@example.com"
    assert c.phone and "98765" in c.phone
    assert any("github.com" in link for link in c.links)


def test_no_contact():
    c = extract_contact("just words here")
    assert c.email is None and c.phone is None and c.links == []


def test_github_link_is_not_git_skill():
    p = parse_resume("Name\nme@example.com\ngithub.com/someone\nEducation\nBSc 2024\nSkills\nExcel")
    assert "Git" not in names(p)


def test_nodejs_does_not_trigger_javascript():
    p = parse_resume("Skills\nNode.js, Express")
    assert "Node.js" in names(p)
    assert "JavaScript" not in names(p)


def test_java_not_matched_inside_javascript():
    assert names(parse_resume("Skills\nJavaScript")) == {"JavaScript"}


def test_cpp_alias_with_symbols():
    assert "C++" in names(parse_resume("Skills\nC++, Python"))


def test_skill_case_insensitive():
    assert "Python" in names(parse_resume("skills\nPYTHON"))


def test_skill_applied_evidence_flags():
    p = parse_resume(SAMPLE)
    py = next(s for s in p.skills if s.name == "Python")
    sql = next(s for s in p.skills if s.name == "SQL")
    assert py.in_skills_section and py.in_experience_or_projects
    assert sql.in_skills_section and not sql.in_experience_or_projects


def test_bullets_and_quantification():
    p = parse_resume(SAMPLE)
    assert p.bullet_count == 2
    assert p.quantified_bullet_count == 1
    assert p.action_verb_bullet_count == 1  # "Built" yes, "Worked" not in verb list


def test_year_alone_is_not_quantification():
    assert not is_quantified("Graduated in 2024 with honours")
    assert is_quantified("Improved speed by 30%")


def test_action_verb_detection():
    assert starts_with_action_verb("Developed a tool")
    assert not starts_with_action_verb("Responsible for tools")
    assert not starts_with_action_verb("")


def test_graduation_year():
    assert parse_resume(SAMPLE).graduation_year == 2027


def test_windows_line_endings():
    p = parse_resume(SAMPLE.replace("\n", "\r\n"))
    assert "education" in p.sections


def test_empty_text_parses_without_error():
    p = parse_resume("")
    assert p.word_count == 0 and p.skills == []


def test_unicode_bullets():
    p = parse_resume("Projects\n• Built a thing with Python 3 times\n● Created another")
    assert p.bullet_count == 2


def test_extract_skills_ignores_empty():
    assert extract_skills({}, "") == []


@pytest.mark.parametrize("text", ["   \n\n  ", "!!!???", "12345"])
def test_garbage_inputs_do_not_crash(text):
    parse_resume(text)
