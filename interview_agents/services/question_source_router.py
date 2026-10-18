from typing import List, Dict, Any, Optional
import hashlib
import logging

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Recruiter-Grade Source Distribution Ratios
# ──────────────────────────────────────────────────────────────────────────────
# 
# These ratios determine what fraction of interview questions come from each
# source bucket.  "behavioral" is now a DISTINCT bucket, not subsumed under
# "llm", so the LLM generates context-aware JD-grounded questions while the
# behavioral bucket is explicitly capped at 15-20%.
#
# Ratios are configurable: override via settings or call get_ratios() with
# extra keyword args.  The QuestionSourceRouter always ensures:
#   sum(ratios) == 1.0
#   behavioral <= 0.20  (never more than 20% of the interview)
#   source variety: no 3+ consecutive turns from the same source
#
# Source bucket meanings:
#   "llm"        — LLM generates a JD-grounded technical/scenario question
#   "web"        — Tavily web search grounds a fresh/recent question
#   "qb"         — Faculty question bank (RAG/ChromaDB retrieved + rewritten)
#   "behavioral" — JD-tied behavioral question (capped at ≤20%)
# ──────────────────────────────────────────────────────────────────────────────

_RATIOS: Dict[str, Dict[str, float]] = {
    # Company interviews (JD is available): heavy LLM + QB + web, behavioral capped
    "company": {
        "llm":        0.40,
        "web":        0.20,
        "qb":         0.25,
        "behavioral": 0.15,
    },
    # Subject / technical interviews
    "subject": {
        "llm":        0.40,
        "web":        0.15,
        "qb":         0.30,
        "behavioral": 0.15,
    },
    # Faculty exam mode — question bank is primary
    "faculty_exam": {
        "llm":        0.20,
        "web":        0.10,
        "qb":         0.60,
        "behavioral": 0.10,
    },
    # HR / behavioral interview — behavioral IS the interview
    "hr": {
        "llm":        0.40,
        "web":        0.10,
        "qb":         0.10,
        "behavioral": 0.40,
    },
    # System design interviews
    "system_design": {
        "llm":        0.50,
        "web":        0.25,
        "qb":         0.15,
        "behavioral": 0.10,
    },
    # Default fallback
    "default": {
        "llm":        0.50,
        "web":        0.20,
        "qb":         0.15,
        "behavioral": 0.15,
    },
}

# When no QB is available, fold the QB quota into LLM (never drop to 0 web/behavioral)
_NO_QB_RATIOS: Dict[str, Dict[str, float]] = {
    "company": {
        "llm":        0.55,
        "web":        0.25,
        "qb":         0.00,
        "behavioral": 0.20,
    },
    "subject": {
        "llm":        0.55,
        "web":        0.25,
        "qb":         0.00,
        "behavioral": 0.20,
    },
    "faculty_exam": {
        "llm":        0.65,
        "web":        0.20,
        "qb":         0.00,
        "behavioral": 0.15,
    },
    "hr": {
        "llm":        0.40,
        "web":        0.10,
        "qb":         0.00,
        "behavioral": 0.50,
    },
    "system_design": {
        "llm":        0.60,
        "web":        0.25,
        "qb":         0.00,
        "behavioral": 0.15,
    },
    "default": {
        "llm":        0.60,
        "web":        0.25,
        "qb":         0.00,
        "behavioral": 0.15,
    },
}


class QuestionSourceRouter:

    @staticmethod
    def get_ratios(
        interview_mode: str,
        question_bank_id: Optional[str],
        interview_type: str,
    ) -> Dict[str, float]:
        """
        Returns the target distribution ratios based on mode and presence of
        the question bank.  The behavioral bucket is ALWAYS capped at ≤ 0.20
        for non-HR interview types.
        """
        has_qb = bool(question_bank_id)
        # Map interview_mode → canonical mode key
        mode = interview_mode.lower() if interview_mode else "default"

        # Faculty exam always uses QB-heavy ratios regardless of interview_type
        if mode == "faculty_exam":
            table = _RATIOS if has_qb else _NO_QB_RATIOS
            return table["faculty_exam"]

        # Resolve by interview_type first, then mode
        key = interview_type.lower() if interview_type else "default"
        if key not in _RATIOS:
            key = "default"

        table = _RATIOS if has_qb else _NO_QB_RATIOS
        return table[key]

    @classmethod
    def build_turn_plan(
        cls,
        total_questions: int,
        interview_mode: str,
        question_bank_id: Optional[str],
        interview_type: str,
        session_id: Optional[str],
    ) -> List[str]:
        """
        Generates a deterministic, balanced sequence of source labels for the
        entire interview using Deficit Weighted Round Robin (DWRR).

        Guarantees:
          * No 3+ consecutive turns from the same source.
          * Behavioral turns are evenly spread (not front/back-loaded).
          * Total counts match the configured ratios.
        """
        ratios = cls.get_ratios(interview_mode, question_bank_id, interview_type)

        qb_ratio  = ratios.get("qb", 0.0)
        web_ratio = ratios.get("web", 0.0)
        beh_ratio = ratios.get("behavioral", 0.0)
        llm_ratio = ratios.get("llm", 0.0)

        qb_count  = round(total_questions * qb_ratio)
        web_count = round(total_questions * web_ratio)
        beh_count = round(total_questions * beh_ratio)
        llm_count = total_questions - qb_count - web_count - beh_count
        # Guard against rounding drift
        if llm_count < 0:
            llm_count = 0

        # Seed/offset the starting point deterministically using the session_id
        offset = 0
        if session_id:
            h = hashlib.md5(session_id.encode("utf-8")).hexdigest()
            offset = int(h, 16) % total_questions

        plan: List[str] = []
        q_curr, w_curr, b_curr, l_curr = 0, 0, 0, 0

        for i in range(1, total_questions + 1):
            deficits: List[tuple] = []
            if q_curr < qb_count:
                deficits.append(("qb",       qb_ratio  * i - q_curr))
            if w_curr < web_count:
                deficits.append(("web",      web_ratio * i - w_curr))
            if b_curr < beh_count:
                deficits.append(("behavioral", beh_ratio * i - b_curr))
            if l_curr < llm_count:
                deficits.append(("llm",      llm_ratio * i - l_curr))

            if not deficits:
                break

            next_source = max(deficits, key=lambda x: x[1])[0]

            # ── Consecutive-source diversity enforcement ──────────────────────
            # Never allow 3+ consecutive turns from the same source.
            # If this would be the 3rd in a row, pick the next highest-deficit
            # source instead.
            if len(plan) >= 2 and plan[-1] == next_source == plan[-2]:
                # Try the next-best alternative
                alt_deficits = [d for d in deficits if d[0] != next_source]
                if alt_deficits:
                    next_source = max(alt_deficits, key=lambda x: x[1])[0]

            plan.append(next_source)
            if next_source == "qb":
                q_curr += 1
            elif next_source == "web":
                w_curr += 1
            elif next_source == "behavioral":
                b_curr += 1
            else:
                l_curr += 1

        # Fill remaining if rounding left any gap
        while len(plan) < total_questions:
            plan.append("llm")

        # Deterministic shift using session-seeded offset
        if offset > 0 and len(plan) == total_questions:
            plan = plan[offset:] + plan[:offset]

        return plan

    @classmethod
    def determine_source(
        cls,
        turn_no: int,
        total_questions: int,
        interview_mode: str,
        question_bank_id: Optional[str],
        interview_type: str,
        session_id: Optional[str],
    ) -> str:
        """
        Determines the source for a specific turn number.

        Returns one of: "llm", "web", "qb", "behavioral"
        """
        plan = cls.build_turn_plan(
            total_questions=total_questions,
            interview_mode=interview_mode,
            question_bank_id=question_bank_id,
            interview_type=interview_type,
            session_id=session_id,
        )
        idx = turn_no - 1
        if 0 <= idx < len(plan):
            return plan[idx]
        return "llm"

    @classmethod
    def get_turn_source(
        cls,
        turn_no: int,
        total_questions: int,
        interview_mode: str,
        question_bank_id: Optional[str],
        interview_type: str,
        session_id: Optional[str],
    ) -> str:
        return cls.determine_source(
            turn_no=turn_no,
            total_questions=total_questions,
            interview_mode=interview_mode,
            question_bank_id=question_bank_id,
            interview_type=interview_type,
            session_id=session_id,
        )

    @classmethod
    def predict_next_sources(
        cls,
        current_turn: int,
        total_questions: int,
        interview_mode: str,
        question_bank_id: Optional[str],
        interview_type: str,
        session_id: Optional[str],
        lookahead: int = 3,
    ) -> List[str]:
        plan = cls.build_turn_plan(
            total_questions=total_questions,
            interview_mode=interview_mode,
            question_bank_id=question_bank_id,
            interview_type=interview_type,
            session_id=session_id,
        )
        predictions: List[str] = []
        for i in range(1, lookahead + 1):
            idx = current_turn + i - 1
            if 0 <= idx < len(plan):
                predictions.append(plan[idx])
            else:
                predictions.append("llm")
        return predictions

    @classmethod
    def source_to_category_hint(cls, source: str) -> Optional[str]:
        """
        Maps a source label to a category_hint string for the question generator.
        Returns None for "llm" (let the generator decide).
        """
        mapping = {
            "behavioral": "Behavioral",
            "web":        "Technical",   # web-grounded questions are always technical/current
            "qb":         "Technical",   # QB questions are technical by definition
        }
        return mapping.get(source)
