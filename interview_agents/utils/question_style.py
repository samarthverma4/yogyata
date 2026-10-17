"""Per-question STRUCTURE steering shared by every question-generating agent.

Each difficulty tier draws from its OWN pool of question shapes, so the
difficulty of a turn determines its category, not just its wording depth:

  * EASY   - direct, straightforward shapes (definitions, plain concept
    checks, simple comparisons) - a candidate can answer without needing to
    reason through a scenario or trace code.
  * MEDIUM - coding/algorithmic shapes (trace output, find the bug, dictate
    an approach, complexity, optimization, testing, ...).
  * HARD   - senior/judgment shapes (real-world scenario, trade-offs,
    design, architecture, production troubleshooting, ...).

Within a tier, the pool is SHUFFLED PER INTERVIEW (seeded by session /
subject / company / candidate), so different subjects, companies, and
candidates get different orderings, and no single shape repeats within one
pass through that tier's pool. Voice-only is respected throughout: "coding"
means reading, tracing, or dictating aloud - never typing runnable code.

NOTE: each directive is a plain instruction to the model with NO label prefix -
an earlier version led with "DEBUGGING QUESTION:" etc. and the model sometimes
copied that label straight into the question it showed the candidate.
"""
from __future__ import annotations

import random

# EASY - direct, straightforward shapes. Explicitly permits definitional /
# "what is X" framing (unlike Medium/Hard) - that directness IS the point at
# this level, and this note is the override for the "avoid what-is-X" rule
# that appears elsewhere in these prompts.
_EASY: list[str] = [
    "Ask a direct, plain question that has the candidate define or explain ONE core concept or "
    "term clearly and simply, in their own words. A straightforward 'what is X' or 'explain X' "
    "style question is appropriate and expected here - this overrides any general instruction "
    "elsewhere in this prompt to avoid definition questions. Do NOT wrap it in a real-world "
    "scenario, system, or 'imagine you are tasked with...' framing - ask about the concept "
    "directly and nothing else. Worked example of the required shape (match this style, not "
    "this exact topic): 'What is a hash map, and how does it achieve fast lookups?'",

    "Ask the candidate to state one basic property, rule, or fact about a concept and give a "
    "simple, concrete example of it. No scenario framing. Worked example of the required shape: "
    "'What is one key property of a stack, and what's a simple real-life example of that behavior?'",

    "Ask them to compare two related concepts/tools/approaches (X vs Y) - the differences and "
    "when each is the better choice. No scenario framing. Worked example of the required shape: "
    "'What is the difference between a process and a thread, and when would you use one over the other?'",

    "Ask them to explain the internal working of a mechanism, under the hood, in plain terms. "
    "No scenario framing. Worked example of the required shape: 'How does garbage collection "
    "work under the hood in most modern languages?'",

    "Ask when a technique/tool is the right choice AND when it is NOT - its appropriate use cases "
    "and its limitations. No scenario framing. Worked example of the required shape: 'When is a "
    "linked list the right choice over an array, and when is it not?'",
]

# MEDIUM - coding/algorithmic shapes, split into two groups. CODE shapes are
# front-loaded ahead of VERBAL ones (see _ordered_medium) so a Medium question
# is guaranteed actual code/pseudocode before any purely-verbal shape gets
# used - a single uniform shuffle across all of them could otherwise land two
# Medium questions in a row on the verbal shapes, showing no code at all.
#
# Each directive below explicitly overrides any general "don't ask them to
# write code" instruction elsewhere in the prompt - several subject templates
# word that rule broadly enough ("do NOT ask them to write code... instead
# ask them to explain verbally") that models were skipping code entirely
# rather than distinguishing "write new code" (not voice-compatible) from
# "read/trace/debug an EMBEDDED snippet aloud" (exactly what these shapes ask
# for, and fully voice-compatible).
_MEDIUM_CODE: list[str] = [
    "Embed a short snippet (3-8 lines of code/pseudocode/config) in the question, formatted as a "
    "fenced code block using triple backticks (```), and ask the candidate to read it aloud and "
    "predict its output, or trace it on a specific sample input step by step. No typing required. "
    "This OVERRIDES any general instruction elsewhere to avoid showing code - reading/tracing an "
    "embedded snippet aloud is voice-compatible and required here; only writing NEW code is not.",

    "Embed a short snippet (3-8 lines) that contains a bug, formatted as a fenced code block using "
    "triple backticks (```), and ask the candidate to read it aloud, identify the bug, and explain "
    "how they would fix it. No typing required. This OVERRIDES any general instruction elsewhere to "
    "avoid showing code - reading an embedded snippet aloud to find a bug is voice-compatible and "
    "required here; only writing NEW code is not.",

    "Embed a short, working snippet (3-8 lines), formatted as a fenced code block using triple "
    "backticks (```), and ask them to read it aloud and suggest improvements or issues. No typing "
    "required. This OVERRIDES any general instruction elsewhere to avoid showing code - reading an "
    "embedded snippet aloud is voice-compatible and required here; only writing NEW code is not.",

    "Embed a small algorithm as pseudocode (3-8 lines), formatted as a fenced code block using "
    "triple backticks (```), together with a concrete sample input, and ask them to trace its "
    "execution step by step and state the final result. No typing required. This OVERRIDES any "
    "general instruction elsewhere to avoid showing code - reading/tracing an embedded snippet "
    "aloud is voice-compatible and required here; only writing NEW code is not.",
]

_MEDIUM_VERBAL: list[str] = [
    "Pose a concrete problem and ask them to walk through their approach - dictate the "
    "algorithm/logic/pseudocode aloud step by step (spoken, not typed) and justify each choice.",

    "Ask them to analyse the time and space complexity of an approach and justify it.",

    "Describe a working-but-naive approach and ask how they'd improve its performance or memory usage.",

    "Ask which unusual or boundary inputs/conditions they'd worry about and how they'd handle them.",

    "Ask how they'd test a given solution - the cases they'd cover and their strategy.",
]

_MEDIUM: list[str] = _MEDIUM_CODE + _MEDIUM_VERBAL

# _MEDIUM_CODE's four shapes each ask the model to invent a fresh snippet, but
# with nothing steering WHAT it's about, it reliably collapses onto the same
# textbook example every time role/company/JD are held constant - verified
# directly: four independent calls for the same "Backend Developer @ Acme
# Corp" role all produced the identical get_user_data()-missing-exception-
# handling function. Only the SHAPE (trace/find-bug/improve/trace-algorithm)
# was session-seeded before; the CONTENT filled into that shape was not. This
# mirrors (and reuses the fix pattern from) coding_question.txt's own
# AVOID DEFAULT-COLLAPSE guard for the typed coding round.
_CODE_ENTITY_HINTS: list[str] = [
    "a user authentication or login check", "a shopping-cart total calculator",
    "a rate limiter", "a cache eviction routine", "a pagination helper",
    "a retry-with-backoff wrapper", "a file-upload validator",
    "a date-range overlap checker", "a queue worker or consumer",
    "a config/settings loader", "a permission or access-control check",
    "a search/filter function over a list", "a data deduplication routine",
    "an inventory stock updater", "a notification dispatcher",
    "a session or token expiry check", "a form-input sanitizer",
    "a batch job's progress tracker", "an API response paginator",
    "a price/discount calculator",
]

# HARD - senior/judgment shapes: real-world scenarios, trade-offs, design.
_HARD: list[str] = [
    "Ground the question in one concrete real-world situation (a specific symptom, failing "
    "metric, production incident, or ambiguous requirement) and ask how they would diagnose it, "
    "what approach they'd take, and which trade-offs they'd weigh. Verbal, no code shown.",

    "Name two viable alternatives and ask which they'd choose for a stated goal/constraint and "
    "why - the trade-offs, and when the other option would win instead.",

    "Ask them to design a component or small system at a high level - the pieces, how they "
    "interact, and the key decisions - explained verbally.",

    "Ask how they'd make a given operation robust to failures, exceptions, or partial errors.",

    "Describe a production issue or outage and ask how they'd diagnose it and what they'd check, in order.",

    "Ask how a given design/approach would need to change to handle 10x or 100x growth.",

    "Pose a problem with an explicit constraint (tight memory, no library, read-only input, etc.) "
    "and ask how they'd solve it within that limit.",

    "Ask about the high-level structure/organisation of a system and how the major parts fit together.",

    "Ask them to identify the security risks or vulnerabilities in a described setup and how they'd "
    "mitigate them.",

    "Pose an end-to-end problem and ask them to reason through it from requirements to solution, verbally.",

    "Ask 'what would you do if...' - a plausible change in requirements or conditions - and how their "
    "solution would adapt.",

    "Ask what would go wrong or which assumptions break if a stated condition changed, and how they'd "
    "notice.",

    "Ask for the reasoning BEHIND a concept or design choice - not just what it is, but why it "
    "exists or why it works that way.",

    "Ask what the recommended, production-grade way to do a given thing is, and what pitfalls to avoid.",
]

_POOLS: dict[str, list[str]] = {"easy": _EASY, "medium": _MEDIUM, "hard": _HARD}


def _ordered_types(seed: str, pool: list[str]) -> list[str]:
    """Shuffle of a single tier's pool. Deterministic for a given seed so every
    question in one interview walks the same order (no repeats within a pass
    through the tier), while different seeds - different subject/company/
    candidate - get different orders."""
    rng = random.Random(seed or "")
    items = pool[:]
    rng.shuffle(items)
    return items


def question_style_directive(
    q_number: int,
    difficulty: str | None = None,
    seed: str | None = None,
    recent_questions: list[str] | None = None,
) -> str:
    """Return the required question STRUCTURE for this turn (1-based q_number).

    The difficulty tier picks the POOL (easy=direct, medium=coding,
    hard=scenario); the type then rotates through that tier's own
    per-interview-shuffled shapes so structure still varies within the tier.

    For Medium, real code/pseudocode is guaranteed at least once per interview
    by checking the ACTUAL history (recent_questions) for a ``` fence rather
    than counting turns - q_number counts every turn including follow-ups
    (which don't call this function but still consume a turn), so a
    position-based "front-load code" scheme silently loses its guarantee the
    moment a follow-up fires between two real Medium questions. Checking
    content instead of position holds regardless of how many follow-ups land
    in between.
    """
    diff = (difficulty or "").strip().lower()
    if diff == "easy":
        pool = _EASY
    elif diff == "hard":
        pool = _HARD
    else:
        code_shown = any("```" in (rq or "") for rq in (recent_questions or []))
        pool = _MEDIUM if code_shown else _MEDIUM_CODE
    order = _ordered_types(seed or "", pool)
    base = order[(max(1, q_number) - 1) % len(order)]

    if base in _MEDIUM_CODE:
        # Shape rotation alone only varies WHICH instruction is used (trace /
        # find-bug / improve / trace-algorithm); it says nothing about what
        # the snippet is actually about, which is exactly what collapsed to
        # the same textbook example every time. Give it a rotating, seeded
        # entity to build the snippet around instead - different seed
        # (session/company/candidate) means a different entity, same seed
        # means a different entity each time this shape recurs within one
        # interview (offset by q_number).
        entity_order = _ordered_types(f"{seed or ''}|entity", _CODE_ENTITY_HINTS)
        entity_hint = entity_order[(max(1, q_number) - 1) % len(entity_order)]
        base += (
            f" Base the snippet on {entity_hint}, adapted to fit the candidate's actual role/domain "
            "(swap it for something else role-appropriate only if it genuinely doesn't fit). AVOID "
            "DEFAULT-COLLAPSE: across many independent calls with this same instruction, there is a "
            "strong tendency to fall back to the same handful of textbook snippets regardless of "
            "role or company - most commonly a get_user_data()-style database-lookup function "
            "missing error handling, an off-by-one loop, a mutable default argument, or '==' vs "
            "'is' confusion. Do not produce any of those; use the entity above instead."
        )

    if diff == "hard":
        base += " Push for depth: edge cases, scale, and explicit trade-offs."
    elif diff == "easy":
        base += " Keep it approachable for a junior candidate."
    return base


def requires_code_block(directive: str) -> bool:
    """True when the shape returned by question_style_directive() mandates an
    embedded ``` snippet - each _MEDIUM_CODE entry names this exact phrase.
    Callers use this to verify the model actually included one: it reliably
    writes the surrounding ask ("read the following code snippet aloud...")
    while dropping the snippet itself, leaving the candidate asked to read
    something that was never generated."""
    return "fenced code block using triple backticks" in (directive or "")


def depth_specific_rules(difficulty: str | None, question_type_variety: bool = False) -> str:
    """Depth/coverage guidance for this turn, as a difficulty-CONDITIONAL string
    rather than a single static rule with a "does not apply at Easy" carve-out.

    Empirically (verified directly against the model, not assumed): an LLM at
    low temperature does not reliably honor "ignore the instruction above for
    Easy turns" carve-outs once a prompt already contains dense "assess
    practical application / not just definitions" framing elsewhere - it kept
    producing scenario/design questions at Easy difficulty even when the
    override was explicit, repeated, and backed by a worked example. A minimal
    prompt with NO competing depth language at all reliably produced a correct
    direct/definitional Easy question on the first try. So this returns
    ENTIRELY DIFFERENT text per tier - the Medium/Hard "cover configuration,
    implementation, troubleshooting" language is never present in the prompt
    for an Easy turn, rather than present-but-overridden.
    """
    diff = (difficulty or "").strip().lower()
    if diff == "easy":
        return (
            "This is an EASY turn: ask a direct, plain definitional or comparison "
            "question about an uncovered topic/skill - e.g. \"What is X and how "
            "does it work?\" or \"What's the difference between X and Y?\". Do NOT "
            "add configuration, implementation, design, troubleshooting, or "
            "real-world scenario framing on top of it - keep it simple and "
            "approachable for a junior candidate."
        )
    variety = (
        "\nAcross the interview, rotate through: Technical (configuration/"
        "implementation/architecture), Scenario/Case (real-world situation), "
        "Troubleshooting (diagnosing a production issue)."
        if question_type_variety else ""
    )
    return (
        "This is a MEDIUM/HARD turn: cover configuration, implementation, "
        "troubleshooting, or design depth for this topic - not just a plain "
        "definition." + variety
    )
