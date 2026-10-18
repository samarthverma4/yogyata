# PEP 604 unions (`str | None`) below are only legal on Python 3.9 as string
# annotations; this makes that automatic.
from __future__ import annotations

import os
import uuid
import tempfile
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from interview_agents.api.deps import get_interview_orchestrator
from interview_agents.services.interview_service import InterviewOrchestrator
from interview_agents.schemas.admin_task import AdminTaskRequest, AdminTaskResponse
from interview_agents.agents.admin_task_agent import AdminTaskAgent
from services.ingestion.parser_factory import ParserFactory
from services.ingestion.text_parser import TextParser

router = APIRouter(tags=["admin"])


@router.post("/agent/admin-task", response_model=AdminTaskResponse)
def execute_admin_task(
    payload: AdminTaskRequest,
    orchestrator: InterviewOrchestrator = Depends(get_interview_orchestrator),
) -> AdminTaskResponse:
    agent = AdminTaskAgent(orchestrator.openai_service, orchestrator.memory)
    return agent.execute_task(payload.task)


@router.post("/admin/extract-question-bank-text")
def extract_question_bank_text(file: UploadFile = File(...)):
    """Pure text extraction for the SVAR Question Bank's PDF-upload flow.

    Deliberately independent of `/admin/process-question-bank` below: that
    endpoint embeds extracted text into ChromaDB for later semantic
    retrieval, and the general question-bank system it feeds explicitly
    documents itself as retrieving-AND-REWRITING content at generation time
    (see services/retrieval/question_bank_service.py) - the opposite of what
    SVAR needs. This endpoint only reuses the ParserFactory extraction step
    (literal text out of a PDF/DOCX/etc.) and returns it as-is: no LLM call,
    no ChromaDB, no difficulty classification, no embedding. The Node backend
    never persists anything from this response either - the admin reviews
    the extracted text, assigns each item to a SVAR task type by hand, and
    only THEN does it become part of a SvarQuestionBank document, through the
    existing create/update endpoints exactly as a JSON upload would.
    """
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".txt"
    fd, temp_path = tempfile.mkstemp(suffix=ext)
    try:
        with os.fdopen(fd, "wb") as temp_file:
            while chunk := file.file.read(1024 * 1024):
                temp_file.write(chunk)

        parser = ParserFactory.get_parser(temp_path)
        raw_questions = parser.parse(temp_path)
        if not raw_questions:
            parser = TextParser()
            raw_questions = parser.parse(temp_path)
        if not raw_questions:
            raise HTTPException(status_code=400, detail="No text could be extracted from the file.")

        items = [
            {
                "text": (q.get("question") or "").strip(),
                "secondaryText": (q.get("expected_answer") or "").strip(),
                # Audit-only, additive - PDFParser attaches these; other
                # parsers (docx/csv/etc.) simply omit them, so this key set
                # varies by source format rather than breaking the response
                # contract for callers that only ever read text/secondaryText.
                "questionNumber": q.get("question_number"),
                "sourcePageStart": q.get("source_page_start"),
                "sourcePageEnd": q.get("source_page_end"),
            }
            for q in raw_questions
            if (q.get("question") or "").strip()
        ]
        if not items:
            raise HTTPException(status_code=400, detail="No text could be extracted from the file.")

        # Document-level diagnostics from the source PDF's OWN numbering
        # (e.g. "Question 7 — ..."), when the parser found one - never
        # silently claim success if the document's own numbering shows a
        # gap or a repeat. text-only formats (docx/csv/json) have no
        # question_number concept and report all-empty diagnostics rather
        # than a false positive/negative.
        numbered = [q.get("question_number") for q in raw_questions if q.get("question_number") is not None]
        seen = set()
        duplicate_numbers = sorted({n for n in numbered if n in seen or seen.add(n)})
        missing_question_numbers = sorted(set(range(1, max(numbered) + 1)) - set(numbered)) if numbered else []
        diagnostics = {
            "detectedQuestionCount": len(numbered),
            "parsedQuestionCount": len(items),
            "duplicateCount": len(duplicate_numbers),
            "duplicateQuestionNumbers": duplicate_numbers,
            "missingQuestionNumbers": missing_question_numbers,
        }
        return {"items": items, "diagnostics": diagnostics}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


class ClassifySvarQuestionRequest(BaseModel):
    text: str


class ClassifySvarQuestionResponse(BaseModel):
    taskType: str | None = None
    difficulty: str | None = None
    confidence: float = 0.0
    detectedFields: dict = {}
    evidence: list[str] = []
    classified: bool = False


@router.post("/admin/classify-svar-question", response_model=ClassifySvarQuestionResponse)
def classify_svar_question(payload: ClassifySvarQuestionRequest):
    """LEVEL 2 of SVAR's hybrid ingestion classifier - called by the Node
    backend (createSvarQuestionBankFromPdf, admin.controller.js) ONLY for a
    question block its own deterministic detectors (detectSvarTaskTypeFromText
    / detectSvarLabeledQuestionFields) could not resolve. Never called by
    the browser directly - the frontend has no knowledge this endpoint, or
    OpenAI, exists at all.

    Deliberately independent of `/admin/process-question-bank` above (which
    requires the RAG stack and is unrelated to SVAR) and of
    `/admin/extract-question-bank-text` (pure, free, LLM-free text
    extraction, unaffected by this endpoint's existence or availability).
    Every field this returns has already been validated against the literal
    source text (see ground_fields_against_source,
    services/ingestion/svar_semantic_classifier.py) before it ever reaches
    this response - `classified: false` (with everything else at its
    default/empty value) covers every failure mode uniformly: no API key
    configured, timeout, malformed model output, or an unexpected error -
    the Node caller's contract is simply "treat classified: false exactly
    like deterministic classification also failing", never a 500.
    """
    from services.ingestion.svar_semantic_classifier import classify_question_candidate

    result = classify_question_candidate(payload.text)
    if result is None:
        return ClassifySvarQuestionResponse(classified=False)
    return ClassifySvarQuestionResponse(
        taskType=result.task_type.value if result.task_type else None,
        difficulty=result.difficulty.value if result.difficulty else None,
        confidence=result.confidence,
        detectedFields=result.detected_fields,
        evidence=result.evidence,
        classified=True,
    )


@router.post("/admin/svar-question-bank/ai-first-extract")
def svar_ai_first_extract(file: UploadFile = File(...)):
    """AI-FIRST whole-document SVAR extraction - the new capability behind
    Node's SVAR_AI_FIRST_INGESTION flag (createSvarQuestionBankFromPdf,
    admin.controller.js), OFF by default. Unlike /admin/classify-svar-question
    (Level 2 of the EXISTING pipeline, which classifies one already-boundary-
    split fragment at a time), this endpoint gives OpenAI the document's own
    raw, page-tagged, OCR-already-applied text - via PDFParser directly, not
    ParserFactory.parse() (which already boundary-splits; skipped here on
    purpose since determining boundaries is exactly what this path asks the
    model to do itself) - in overlapping page chunks, and lets it determine
    question boundaries, task type, difficulty, and fields itself.

    Same never-500 degradation contract as /admin/classify-svar-question:
    ANY failure (no API key, timeout, malformed output, unexpected
    exception) returns a normal 200 with success=False so the Node caller
    can fall back to the existing deterministic pipeline for the whole
    document, never a crashed upload.
    """
    from services.ingestion.pdf_parser import PDFParser
    from services.ingestion.svar_document_extractor import (
        chunk_by_pages,
        extract_document_candidates,
        reconcile_cross_chunk_candidates,
    )

    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".pdf"
    if ext != ".pdf":
        return {
            "success": False,
            "questions": [],
            "reason": "AI-first extraction currently supports PDF files only.",
            "diagnostics": {},
        }

    chunk_pages = int(os.environ.get("SVAR_AI_FIRST_CHUNK_PAGES") or 8)
    overlap_pages = int(os.environ.get("SVAR_AI_FIRST_CHUNK_OVERLAP_PAGES") or 2)

    fd, temp_path = tempfile.mkstemp(suffix=ext)
    try:
        with os.fdopen(fd, "wb") as temp_file:
            while chunk := file.file.read(1024 * 1024):
                temp_file.write(chunk)

        try:
            parser = PDFParser()
            pages = parser._extract_line_stream(temp_path)
            # Table rows are extracted through a SEPARATE mechanism from
            # prose (_extract_table_blocks, reusing the exact same
            # pdfplumber table-detection + "Label: value" row normalization
            # the deterministic pipeline already relies on - not a second
            # table parser) and appended into the SAME page-tagged stream
            # the AI-first path chunks over, so a table-formatted question
            # bank is visible to the model exactly like prose is. Without
            # this, every table row was silently invisible to AI-first
            # extraction - live-reproduced against a real table-formatted
            # PDF (4 rows extracted by the deterministic path, 0 by
            # AI-first) before this fix.
            table_blocks = parser._extract_table_blocks(temp_path)
            for block in table_blocks:
                pages.extend(block)
        except Exception as exc:
            return {
                "success": False,
                "questions": [],
                "reason": f"Document extraction failed: {exc}",
                "diagnostics": {},
            }

        if not pages:
            return {
                "success": False,
                "questions": [],
                "reason": "No extractable text found in the document.",
                "diagnostics": {},
            }

        # min()/max() over every element, not pages[0]/pages[-1] - table
        # blocks (appended above, own page numbers) are not guaranteed to
        # keep the list sorted by page (see chunk_by_pages's identical fix).
        page_numbers = [p for _, p in pages]
        page_count = max(page_numbers) - min(page_numbers) + 1
        chunks = chunk_by_pages(pages, max_pages=chunk_pages, overlap_pages=overlap_pages)
        if not chunks:
            return {
                "success": False,
                "questions": [],
                "reason": "Document text could not be chunked.",
                "diagnostics": {"pageCount": page_count, "chunkCount": 0},
            }

        all_candidates = []
        chunk_failures = 0
        for chunk_text in chunks:
            candidates = extract_document_candidates(chunk_text)
            if not candidates and chunk_text.strip():
                chunk_failures += 1
            all_candidates.extend(candidates)

        if chunk_failures == len(chunks):
            # Every single chunk failed (no API key, every call errored, or
            # the model returned zero questions for genuinely non-empty
            # text on every chunk) - total failure, not "this document
            # happens to have zero questions". Let the Node caller fall
            # back to the deterministic pipeline for the whole document.
            return {
                "success": False,
                "questions": [],
                "reason": "AI-first extraction failed for every chunk (OpenAI unavailable, timeout, or malformed output).",
                "diagnostics": {"pageCount": page_count, "chunkCount": len(chunks)},
            }

        reconciled = reconcile_cross_chunk_candidates(all_candidates)
        return {
            "success": True,
            "questions": [c.model_dump(mode="json") for c in reconciled],
            "reason": None,
            "diagnostics": {
                "pageCount": page_count,
                "chunkCount": len(chunks),
                "chunkFailures": chunk_failures,
                "candidatesBeforeReconciliation": len(all_candidates),
                "candidatesAfterReconciliation": len(reconciled),
            },
        }
    except Exception as exc:
        # Never let an unexpected exception here crash the upload - the
        # Node caller treats success:False identically regardless of which
        # specific failure produced it.
        return {
            "success": False,
            "questions": [],
            "reason": f"AI-first extraction encountered an unexpected error: {exc}",
            "diagnostics": {},
        }
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@router.post("/admin/process-question-bank")
def process_question_bank(
    file: UploadFile = File(...),
    orchestrator: InterviewOrchestrator = Depends(get_interview_orchestrator),
):
    # Fail fast (and clearly) when the RAG stack isn't available - otherwise the
    # handler parses the file and burns an LLM difficulty-classification call before
    # dereferencing orchestrator.retriever (None) and surfacing a cryptic 400.
    if orchestrator.retriever is None:
        raise HTTPException(
            status_code=503,
            detail="Question-bank ingestion requires the RAG stack, which is unavailable "
                   "in this deployment. Ensure chromadb is installed and RAG is enabled.",
        )
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".txt"
    fd, temp_path = tempfile.mkstemp(suffix=ext)
    try:
        with os.fdopen(fd, "wb") as temp_file:
            while chunk := file.file.read(1024 * 1024):
                temp_file.write(chunk)

        # Parse text from file using registry factory
        parser = ParserFactory.get_parser(temp_path)
        raw_questions = parser.parse(temp_path)

        if not raw_questions:
            parser = TextParser()
            raw_questions = parser.parse(temp_path)

        if not raw_questions:
            raise HTTPException(status_code=400, detail="No questions could be parsed from the file.")

        # No parser populates `difficulty`, so classify any question missing it
        # (LLM-based, same Easy/Medium/Hard rubric as question_style.py) instead
        # of letting every question silently default to "Medium" below.
        unclassified_idx = [
            i for i, q in enumerate(raw_questions) if not (q.get("difficulty") or "").strip()
        ]
        if unclassified_idx:
            from services.ingestion.difficulty_classifier import classify_difficulties

            texts_to_classify = [raw_questions[i].get("question", "").strip() for i in unclassified_idx]
            classified = classify_difficulties(orchestrator.openai_service, texts_to_classify)
            for i, diff in zip(unclassified_idx, classified):
                raw_questions[i]["difficulty"] = diff

        question_bank_id = f"qb_{uuid.uuid4().hex[:12]}"
        
        ids = []
        texts = []
        metadatas = []

        for q in raw_questions:
            qid = f"q_{uuid.uuid4().hex[:12]}"
            doc = q.get("question", "").strip()
            expected = q.get("expected_answer", "").strip()
            if expected:
                doc = f"{doc}\n\nExpected: {expected}"

            from services.vector_store.embedding_version import EmbeddingVersionManager
            v_mgr = EmbeddingVersionManager()
            embedding_version = v_mgr.get_active_version()

            meta = {
                "question_bank_id": question_bank_id,
                "original_question": q.get("question", "").strip(),
                "parsed_text": q.get("question", "").strip(),
                "difficulty": q.get("difficulty") or "Medium",
                "topic": ", ".join(q.get("expected_topics") or []),
                "topics": ", ".join(q.get("expected_topics") or []),
                "company": q.get("company", "") or "Generic",
                "role": q.get("role", "") or "Software Engineer",
                "subject": q.get("subject", "") or "General",
                "pdf_name": file.filename or "unknown",
                "source_file": file.filename or "unknown",
                "source_pdf": file.filename or "unknown",
                "chunk_id": qid,
                "embedding_version": embedding_version,
                "question_type": q.get("question_type") or "TECHNICAL",
                "skills": ", ".join(q.get("skills") or []),
                "technologies": ", ".join(q.get("technologies") or []),
                "interview_intent": "TECHNICAL"
            }

            ids.append(qid)
            texts.append(doc)
            metadatas.append(meta)

        # Generate embeddings and insert into ChromaDB (allow_sync=True is permitted here since it is admin ingestion tool)
        embeddings = orchestrator.retriever.retrieval_service.embedding_service.embed_texts(texts, allow_sync=True)
        collection_name = orchestrator.retriever.retrieval_service.collection_name
        
        orchestrator.retriever.retrieval_service.store.insert(
            collection_name=collection_name,
            ids=ids,
            embeddings=embeddings,
            metadatas=metadatas,
            documents=texts
        )

        return {"question_bank_id": question_bank_id, "questions_count": len(ids)}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
