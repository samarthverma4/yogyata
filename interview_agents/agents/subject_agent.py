"""
Subject Interview Agent — handles DSA, OS, CN, DBMS, ML, Cybersecurity.
Follows a structured topic progression per subject and maps questions to company difficulty tiers.
"""
from __future__ import annotations

import logging
from typing import Any

from interview_agents.agents.base_child_agent import BaseChildAgent
from interview_agents.config.settings import get_settings
from interview_agents.schemas.agent_schemas import SubjectEvaluationResult, SubjectQuestionResult
from interview_agents.schemas.interview import DifficultyAdjustmentResult, QuestionGenerationResult
from interview_agents.services.web_search_service import WebSearchService, build_grounding_block
from interview_agents.utils.enums import DifficultyLevel, QuestionCategory
from interview_agents.utils.json_utils import safe_json_dumps
from interview_agents.utils.question_style import depth_specific_rules, question_style_directive

logger = logging.getLogger(__name__)
_web_search_service = WebSearchService(get_settings())

# Full topic progressions for systematic coverage — mirrors actual placement interview patterns
TOPIC_PROGRESSIONS: dict[str, list[str]] = {
    "dsa": [
        "Arrays", "Strings", "Linked Lists", "Stacks", "Queues",
        "Binary Trees", "Binary Search Trees", "AVL Trees", "Heaps / Priority Queue",
        "Graphs (BFS/DFS)", "Graph Algorithms (Dijkstra/Prim/Kruskal)",
        "Hashing / Hash Tables", "Searching (Binary Search)", "Sorting Algorithms",
        "Recursion and Backtracking", "Dynamic Programming", "Greedy Algorithms",
        "Divide and Conquer", "Tries", "Segment Trees",
    ],
    "os": [
        "Introduction to OS / Types of OS", "Process vs Thread",
        "Process States and Lifecycle", "Process Scheduling (FCFS, SJF, Round Robin, Priority)",
        "Inter-Process Communication", "Synchronization (Mutex, Semaphore)",
        "Deadlock (Detection, Prevention, Avoidance, Recovery)",
        "Memory Management (Paging, Segmentation)", "Virtual Memory and Page Replacement",
        "File Systems", "Disk Scheduling Algorithms", "I/O Management", "System Calls",
    ],
    "cn": [
        "OSI Model (7 Layers)", "TCP/IP Model", "Physical Layer",
        "Data Link Layer (MAC, ARP, Framing)", "Network Layer (IP, Routing)",
        "IP Addressing and Subnetting / CIDR", "Routing Protocols (RIP, OSPF, BGP)",
        "Transport Layer (TCP vs UDP)", "Flow Control and Congestion Control",
        "Application Layer Protocols (HTTP, DNS, DHCP, SMTP, FTP)",
        "Network Security (SSL/TLS, Firewalls)", "NAT and VPN",
        "Wireless Networks (Wi-Fi, Bluetooth)", "Network Topologies",
    ],
    "dbms": [
        "Introduction to DBMS / RDBMS vs File System", "Relational Model and Keys",
        "SQL Basics (SELECT, INSERT, UPDATE, DELETE)",
        "SQL Joins (Inner, Outer, Cross, Self)", "SQL Aggregations and GROUP BY",
        "Normalization (1NF, 2NF, 3NF, BCNF)",
        "Indexing (Clustered, Non-clustered, B-Tree Index)",
        "Transactions and ACID Properties",
        "Concurrency Control (Locks, Timestamp Ordering, MVCC)",
        "Database Recovery and Logging",
        "ER Diagrams and Schema Design",
        "NoSQL Concepts (Document, Key-Value, Column, Graph DBs)",
        "Stored Procedures, Triggers, and Views",
    ],
    "ml": [
        "Introduction to ML / Types of Learning",
        "Linear Regression", "Logistic Regression",
        "Decision Trees and Information Gain",
        "Random Forest and Ensemble Methods",
        "Support Vector Machines (SVM)",
        "K-Nearest Neighbors (KNN)",
        "K-Means Clustering",
        "Dimensionality Reduction (PCA)",
        "Neural Networks Basics (Perceptron, Activation Functions)",
        "Overfitting, Underfitting, Bias-Variance Tradeoff",
        "Feature Engineering and Selection",
        "Model Evaluation (Precision, Recall, F1, ROC-AUC)",
        "Regularization (L1/L2)",
        "Gradient Descent and Optimization",
    ],
    "cybersecurity": [
        "CIA Triad (Confidentiality, Integrity, Availability)",
        "Authentication vs Authorization",
        "Symmetric Encryption (AES, DES)",
        "Asymmetric Encryption (RSA, ECC)",
        "Hashing (MD5, SHA, bcrypt)",
        "Public Key Infrastructure (PKI) and Certificates",
        "Common Attacks (SQL Injection, XSS, CSRF)",
        "Man-in-the-Middle Attack and Prevention",
        "Firewalls and IDS/IPS",
        "Network Security Protocols (HTTPS, TLS, IPSec)",
        "Social Engineering and Phishing",
        "Penetration Testing Methodology",
        "Security Policies and Compliance (GDPR, ISO 27001)",
        "Cryptographic Protocols",
    ],
    "cloud_computing": [
        "IaaS/PaaS/SaaS Models", "Virtualization vs Containers (Docker, Kubernetes)",
        "Serverless Computing", "Cloud Storage Options",
        "Load Balancing and Auto-Scaling", "CI/CD Pipelines",
        "Cloud Networking (VPC, Subnets)", "Cloud Security Basics",
        "High Availability and Disaster Recovery", "Cost Optimization Strategies",
        "Monitoring and Logging in the Cloud", "Multi-Region Deployments",
    ],
    "web_development": [
        "HTML/CSS Fundamentals and Responsive Design", "DOM and Browser Rendering",
        "HTTP Methods and REST API Design", "Sessions vs Token-based Auth (JWT, OAuth)",
        "CORS and Same-Origin Policy", "Frontend Frameworks (React/Angular/Vue Concepts)",
        "State Management", "Client-side vs Server-side Rendering",
        "Web Performance Optimization", "Web Security (XSS, CSRF, SQL Injection)",
        "Caching Strategies (Browser, CDN)", "Scalable Frontend Architecture",
    ],
    "java": [
        "OOP Concepts (Encapsulation, Inheritance, Polymorphism, Abstraction)",
        "Collections Framework", "Exception Handling", "Multithreading and Concurrency",
        "JVM Architecture and Garbage Collection", "Streams API and Lambda Expressions",
        "Generics", "String Handling and Immutability", "Basic Spring Concepts",
        "Design Patterns in Java", "Serialization", "Java Memory Model",
    ],
    "python": [
        "Core Data Types and Structures (List, Tuple, Dict, Set)", "OOP in Python",
        "Decorators and Generators", "Exception Handling",
        "the GIL and Concurrency (Threading vs Multiprocessing)", "Standard Library Essentials",
        "Pythonic Idioms (Context Managers, *args/**kwargs, Comprehensions)",
        "Memory Management and Garbage Collection", "Iterators and Generators",
        "Virtual Environments and Package Management", "Testing (unittest/pytest)",
    ],
    "javascript": [
        "Closures and Scope (var/let/const)", "Hoisting",
        "this and Prototypal Inheritance", "Async/Await and Promises",
        "the Event Loop and Call Stack", "ES6+ Features (Destructuring, Spread, Arrow Functions)",
        "DOM Manipulation", "Callback Patterns", "Modules (CommonJS vs ES Modules)",
        "Error Handling (try/catch, Promise Rejection)", "Debouncing and Throttling",
    ],
    "cpp": [
        "Pointers and Memory Management", "Structures",
        "malloc/free vs new/delete", "OOP in C++ (Classes, Virtual Functions, Polymorphism)",
        "STL (Vectors, Maps, Sets, Iterators)", "the Compilation Process",
        "References vs Pointers", "Undefined Behavior", "Operator Overloading",
        "Templates", "RAII and Smart Pointers", "Move Semantics",
    ],
}

SUBJECT_ALIASES: dict[str, str] = {
    "dsa": "dsa", "data structures": "dsa", "data structures and algorithms": "dsa",
    "os": "os", "operating system": "os", "operating systems": "os",
    "cn": "cn", "computer networks": "cn", "networks": "cn",
    "dbms": "dbms", "database": "dbms", "database management system": "dbms",
    "database management systems": "dbms",
    "ml": "ml", "machine learning": "ml",
    "cybersecurity": "cybersecurity", "cyber security": "cybersecurity", "security": "cybersecurity",
    "cloud computing": "cloud_computing", "cloud": "cloud_computing",
    "web development": "web_development", "web dev": "web_development",
    "java": "java",
    "python": "python",
    "javascript": "javascript", "js": "javascript",
    "c/c++": "cpp", "c++": "cpp",
}


def _normalize_subject(raw: str) -> str:
    return SUBJECT_ALIASES.get(raw.strip().lower(), "dsa")


class SubjectAgent(BaseChildAgent):
    """Technical subject interview agent with topic-progressive questioning."""

    def generate_question(self, session_id: str, **kwargs) -> QuestionGenerationResult:
        context = self.memory.get_recent_context(session_id)
        session = self.memory.get_session(session_id)
        subject_raw = getattr(session, "subject", None) or kwargs.get("subject", "dsa") or "dsa"
        subject = _normalize_subject(subject_raw)

        progression = TOPIC_PROGRESSIONS.get(subject, TOPIC_PROGRESSIONS["dsa"])
        recent_questions = self.memory.get_previous_question_texts(session_id, limit=10)

        # Determine topics already covered from evaluation JSON
        recent_answers = self.memory.get_recent_answers(session_id, limit=20)
        topics_covered = [
            a.evaluation_json.get("topic_covered", "")
            for a in recent_answers
            if a.evaluation_json and a.evaluation_json.get("topic_covered")
        ]

        # Weak areas from memory
        weak_areas = self.memory.get_weak_areas(session_id, top_n=3)
        weak_text = ", ".join(weak_areas.keys()) if weak_areas else "none identified yet"

        prompt_payload = {
            "candidate_name": context["candidate_name"],
            "role": context["role"],
            "experience": context["experience"],
            "skills": ", ".join(context["skills"]),
            "difficulty": context["difficulty"],
            "subject": subject.upper(),
            "topic_progression": " → ".join(progression),
            "topics_covered": ", ".join(topics_covered) if topics_covered else "none yet",
            "recent_questions": safe_json_dumps(recent_questions),
            "weak_areas": weak_text,
            "resume_text": getattr(self.memory.get_session(session_id), "resume_text", None) or "Not provided",
            "question_style_directive": question_style_directive(
                len(recent_questions) + 1, context.get("difficulty"),
                seed=f"{session_id}|{subject}",
                recent_questions=recent_questions,
            ),
            "depth_specific_rules": depth_specific_rules(context.get("difficulty")),
            "web_context": build_grounding_block(
                _web_search_service,
                "subject",
                subject=subject,
                role=context["role"],
                web_search_enabled=bool(kwargs.get("web_search_enabled")),
                blocking=False,
            ),
        }

        if self.has_llm:
            try:
                result = self.openai_service.generate_structured(
                    "subject_question",
                    prompt_payload,
                    SubjectQuestionResult,
                    subdirectory="agents",
                )
                if not self.memory.has_asked_question(session_id, result.question):
                    self.memory.mark_question_asked(session_id, result.question)
                    return QuestionGenerationResult(
                        question=result.question,
                        category=QuestionCategory.TECHNICAL,
                        difficulty=DifficultyLevel(result.difficulty),
                        rationale=result.rationale,
                    )
            except Exception:
                logger.warning("SubjectAgent question generation failed, using fallback", exc_info=True)

        fallback = self._fallback_question(subject, progression, topics_covered, context, session_id=session_id)
        try:
            self.memory.mark_question_asked(session_id, fallback.question)
        except Exception:
            pass
        return fallback

    def evaluate(self, session_id: str, question: str, answer: str, **kwargs) -> SubjectEvaluationResult:
        context = self.memory.get_recent_context(session_id)
        session = self.memory.get_session(session_id)
        subject_raw = getattr(session, "subject", None) or "dsa"
        subject = _normalize_subject(subject_raw)

        # Get expected keywords from the last stored question's context if available
        recent_answers = self.memory.get_recent_answers(session_id, limit=1)
        expected_keywords: list[str] = []

        prompt_payload = {
            "candidate_name": context["candidate_name"],
            "role": context["role"],
            "experience": context["experience"],
            "subject": subject.upper(),
            "topic": kwargs.get("topic", ""),
            "difficulty": context["difficulty"],
            "question": question,
            "answer": answer,
            "expected_keywords": safe_json_dumps(expected_keywords),
        }

        if self.has_llm:
            try:
                result = self.openai_service.generate_structured(
                    "subject_evaluate",
                    prompt_payload,
                    SubjectEvaluationResult,
                    subdirectory="agents",
                )
                # Update weak/strong areas based on evaluation
                self._update_performance_tracking(session_id, result)
                return result
            except Exception:
                logger.warning("SubjectAgent evaluation failed, using fallback", exc_info=True)

        return self._fallback_evaluate(question, answer, context)

    def should_follow_up(self, evaluation_result: SubjectEvaluationResult) -> bool:
        return evaluation_result.follow_up_needed or evaluation_result.overall_score < 7

    def adjust_difficulty(self, session_id: str, evaluation: dict[str, Any], current_difficulty: str) -> DifficultyAdjustmentResult:
        # Subject interviews use rolling average across last 3 answers
        overall = evaluation.get("overall_score", 5)
        try:
            recent = self.memory.get_recent_answers(session_id, limit=3)
            scores = [a.evaluation_json.get("overall_score", overall) for a in recent if a.evaluation_json]
            if len(scores) >= 2:
                overall = int(round(sum(scores) / len(scores)))
        except Exception:
            pass
        return super().adjust_difficulty(session_id, {**evaluation, "overall_score": overall}, current_difficulty)

    def _update_performance_tracking(self, session_id: str, result: SubjectEvaluationResult) -> None:
        try:
            topic = result.topic_covered
            if not topic:
                return
            if result.overall_score >= 7:
                self.memory.update_strong_areas(session_id, topic)
            else:
                self.memory.update_weak_areas(session_id, topic)
        except Exception:
            pass

    def _fallback_question(
        self,
        subject: str,
        progression: list[str],
        topics_covered: list[str],
        context: dict[str, Any],
        session_id: str | None = None,
    ) -> QuestionGenerationResult:
        uncovered = [t for t in progression if t not in topics_covered]
        # Per-session offset - see the matching comment in verbal_agent.py.
        # Without it every fresh session's first fallback question covered the
        # exact same topic (list index 0, e.g. "Arrays" for DSA).
        offset = hash(session_id) if session_id else 0
        topic = uncovered[offset % len(uncovered)] if uncovered else progression[-1]
        difficulty = context.get("difficulty", "Medium")

        fallback_questions: dict[str, str] = {
            "Easy": f"Can you explain what {topic} is and give a simple real-life example?",
            "Medium": f"How does {topic} work internally? Where would you use it over alternatives?",
            "Hard": f"Analyse the time and space complexity of {topic} and describe an optimization scenario.",
        }
        question = fallback_questions.get(difficulty, fallback_questions["Medium"])
        return QuestionGenerationResult(
            question=question,
            category=QuestionCategory.TECHNICAL,
            difficulty=DifficultyLevel(difficulty),
            rationale=f"Fallback question for {subject} covering {topic}",
        )

    def _fallback_evaluate(self, question: str, answer: str, context: dict[str, Any]) -> SubjectEvaluationResult:
        from interview_agents.evaluators.scoring import heuristic_evaluate_answer
        base = heuristic_evaluate_answer(question, answer, context["role"], context["skills"], context["experience"])
        return SubjectEvaluationResult(
            conceptual_accuracy=base.technical_score,
            depth_of_explanation=base.completeness_score,
            example_quality=max(0, base.relevance_score - 1),
            edge_case_awareness=max(0, base.problem_solving_score - 1),
            practical_application=base.relevance_score,
            communication_clarity=base.communication_score,
            overall_score=base.overall_score,
            feedback=base.feedback,
            strengths=base.strengths,
            weaknesses=base.weaknesses,
            follow_up_needed=base.follow_up_needed,
            topic_covered="",
            company_readiness="TCS/Infosys" if base.overall_score >= 5 else "Not Ready",
        )
