"""Question writer for llm/web slots.

Composes a tagged prompt (extending, not replacing, the existing company.txt
structure: JD skill graph + interview state + generation rules) with the new
blueprint-bucket, subtopic-focus and web-grounding sections, then calls the
injected LLM. Em dashes are stripped from generated copy per the constraints.

Bank slots skip this writer entirely (the bank question is used verbatim).
"""
from __future__ import annotations

import logging
from typing import List, Optional

from interview_agents.interview_engine.blueprint import (
    BEHAVIORAL_HR,
    CS_FUNDAMENTALS,
    DSA_CODING,
    RESUME,
    SYSTEM_TECHNICAL,
)
from interview_agents.interview_engine.protocols import LLMClient

logger = logging.getLogger(__name__)

_BUCKET_INTENT = {
    DSA_CODING: "a DSA / coding problem to reason about aloud (state complexity, no writing new code)",
    CS_FUNDAMENTALS: "a computer-science fundamentals question (OS, networks, DB, memory, concurrency)",
    SYSTEM_TECHNICAL: "a system or technical-depth question grounded in the JD",
    BEHAVIORAL_HR: "a JD-tied behavioral question about real experience, not a generic culture prompt",
    RESUME: "a question grounded in the candidate's actual resume content",
}

_SYSTEM = (
    "You are a senior technical interviewer generating exactly ONE spoken "
    "interview question. Follow the tagged instructions. Never use em dashes. "
    "Do not reuse sentence molds like 'under the hood', 'one key property of', "
    "or 'when is X the right choice'. Return STRICT JSON."
)

_USER_TMPL = """<job_context>
Company: {company}
Role: {role}
</job_context>

<blueprint_bucket>
This turn must be: {bucket_intent}
Bucket id: {bucket}
</blueprint_bucket>

<subtopic_focus>
Assess this specific subtopic (do not drift to a different one): {subtopic}
</subtopic_focus>

<company_focus>
{company_focus}
</company_focus>

<difficulty>{difficulty}</difficulty>

<web_grounding>
{web_grounding}
</web_grounding>

<already_asked>
Do NOT repeat or rephrase any of these (avoid swapped-noun templates too):
{avoid}
</already_asked>

<rules>
1. Exactly one question, spoken form, no sub-questions.
2. Stay on the subtopic above and match the difficulty.
3. Vary the opening phrase; never start like a previously asked question.
4. No em dashes.
5. If you include a code snippet, format it as a fenced ```language block with REAL
   line breaks, one statement per line and normal indentation. Never put the whole
   snippet on a single line.
</rules>

Return JSON: {{"question": "<the question>", "rationale": "<subtopic assessed>"}}
"""


def strip_em_dashes(text: str) -> str:
    return (text or "").replace("—", ", ").replace("–", "-").strip()


class QuestionWriter:
    def __init__(self, llm: Optional[LLMClient] = None) -> None:
        self.llm = llm

    def write(
        self,
        *,
        bucket: str,
        subtopic: str,
        difficulty: str,
        company: str,
        role: str,
        web_grounding: str = "",
        avoid: Optional[List[str]] = None,
        turn_no: int = 0,
    ) -> str:
        avoid = avoid or []
        if self.llm is None:
            # Deterministic offline writer (used only when no LLM is injected).
            return strip_em_dashes(
                f"For a {role} role, {subtopic}: explain how you would approach it and the trade-offs."
            )
        # Restore the company cadence the engine's generator had dropped. Naming
        # the company only lands naturally on system/design questions (forcing
        # "Google" into a two-sum or a threads question reads awkwardly and the
        # model resists it), which is exactly what the legacy company.txt did.
        # So: system_technical slots are framed in the company's context (this is
        # ~1 in 3 of a full run); behavioral slots tie to the role; DSA/CS stay
        # neutral. q_number gives an occasional explicit mention elsewhere.
        q_number = turn_no + 1
        if company and bucket == SYSTEM_TECHNICAL:
            company_focus = (
                f"Frame this in {company}'s context: reference {company}'s scale, a "
                f"{company} product, or a system {company} operates, while assessing "
                f"{subtopic}. Name {company} explicitly in the question."
            )
        elif company and bucket in (DSA_CODING, CS_FUNDAMENTALS) and q_number % 4 == 0:
            company_focus = (
                f"Where it reads naturally, ground this in a scenario at {company} while "
                f"still assessing {subtopic}."
            )
        elif company and bucket == BEHAVIORAL_HR:
            company_focus = (
                f"Tie this behavioral question to the {role} role at {company}."
            )
        elif company:
            company_focus = f"Keep this a strong, company-neutral {role} question."
        else:
            company_focus = f"Standard {role} question."

        user = _USER_TMPL.format(
            company=company or "the company",
            role=role or "Software Engineer",
            bucket_intent=_BUCKET_INTENT.get(bucket, "a role-relevant question"),
            bucket=bucket,
            subtopic=subtopic,
            company_focus=company_focus,
            difficulty=difficulty,
            web_grounding=web_grounding or "No external grounding for this slot.",
            avoid="\n".join(f"- {a}" for a in avoid[-12:]) or "- (none yet)",
        )
        raw = self.llm.structured(_SYSTEM, user)
        return strip_em_dashes(str(raw.get("question", "")).strip())
