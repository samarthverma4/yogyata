import mongoose from "mongoose";
import { SVAR_TASK_TYPES, SVAR_SCHEDULABLE_TASK_TYPES, computeQuestionContentHash } from "../utils/svarQuestionBank.js";

const interviewSchema = new mongoose.Schema({
    description: {
        type: String,
        required: true
    },
    end_time: {
        type: Date
    },
    start_time: {
        type: Date,
        required: true
    },
    is_active: {
        type: Boolean,
        default: true
    },

    attemptedQuestions: {
        type: Number,
        default: 0
    },
    firstAttemptedAt: {
        type: Date
    },
    lastAttemptedAt: {
        type: Date
    },
    totalQuestions: {
        type: Number,
        // required: true   // todo: make sure to add totalQuestions everywhere in createInterviews
    },
    evaluatedQuestions: {
        type: Number,
        default: 0
        // required: true   // todo: make sure to add totalQuestions everywhere in createInterviews
    },
    tabSwitchCount: {
        type: Number,
        default: 0
    },
    title: {
        type: String,
        required: true
    },
    type: {
        type: String,
        default: "subject",
        required: true
    },
    // Owning student, set at creation time where known (admin-scheduled and
    // materialized-pending-enrollment paths — see admin.controller.js and
    // user.controller.js's materializePendingEnrollments). Optional/additive:
    // interviews created before this field existed simply have it unset:
    // callers must not assume it is always present, and existing lookups
    // (e.g. Student.interview_taken) remain the primary ownership source.
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student"
    },
    // When true, the assigned student takes this interview with the real-time
    // AI avatar (voice + video) instead of the text interview. Set by the admin
    // when scheduling a company interview.
    avatar_enabled: {
        type: Boolean,
        default: false
    },
    // When true, question generation is grounded with live web search results
    // (company/role/subject context) via the agent's WebSearchService.
    web_search_enabled: {
        type: Boolean,
        default: false
    },
    resume_preference: {
        type: String,
        enum: ['Required', 'Optional', 'Skip'],
        default: 'Optional'
    },
    question_bank_id: {
        type: String,
        default: null
    },
    question_bank_ratio: {
        type: Number,
        default: 0
    },
    interview_mode: {
        type: String,
        enum: ['default', 'placement', 'faculty_exam', 'custom', 'adaptive'],
        default: 'default'
    },
    // Audit trail. A voice-scheduled interview is otherwise indistinguishable from a
    // hand-made one, so if one is mis-scheduled these say it came from the voice
    // demo and what was actually said to produce it.
    created_via: {
        type: String,
        enum: ['manual', 'voice'],
        default: 'manual'
    },
    voice_transcript: {
        type: [String],
        default: undefined
    },
    report_snapshot: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    // getSvarReport (svarRound.controller.js) has always set this on a
    // successfully-persisted SVAR report, but the schema never declared the
    // field - Mongoose's strict mode silently dropped every write, so it
    // never actually persisted. `is_active: false` already carries the real
    // "this interview is finished" signal correctly (that field IS declared),
    // so this was previously harmless dead code rather than a behavioral bug;
    // declaring it properly is what makes the persisted/not-persisted
    // distinction added to getSvarReport meaningful for `status` too.
    status: {
        type: String,
        default: null
    }
}, { timestamps: true })

const interviewQuestionSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true
    },
    interview: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Interview'
    },
    answer: {
        type: String
    },
    expectedAnswer: {
        type: String
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student'
    },
    fluency: {
        type: Number
    },
    grammar: {
        type: Number
    },
    overallPerformance: {
        type: Number
    },
    pronunciation: {
        type: Number
    },
    correctness: {
        type: Number
    },
    vocabulary: {
        type: Number
    },
    technicalSkills: {
        type: Number
    },
    technicalExplanation: {
        type: [String]
    },
    vocabularyExplanation: {
        type: [String]
    },
    pronunciationExplanation: {
        type: [String]
    },
    correctnessExplanation: {
        type: [String]
    },
    grammarExplanation: {
        type: [String]
    },
    question_source: {
        type: String,
        // 'bank'/'behavioral' come from the adaptive interview engine's source
        // router; 'qb'/'QB' are the legacy question-bank labels. 'manual' is
        // SVAR-specific: an admin hand-typed this task's exact content at
        // scheduling time (AdminSvarInterview.tasks[].questionSource) rather
        // than picking it from a Question Bank or letting the LLM generate it -
        // distinct from both 'qb' and 'llm', so a recruiter can tell the three
        // apart instead of manual content being misreported as either.
        enum: ['llm', 'web', 'qb', 'QB', 'bank', 'behavioral', 'manual'],
        default: 'llm'
    },
    // 'coding' = a LeetCode-style question answered by writing code (evaluated
    // for logic/structure, not executed) instead of the usual spoken/typed Q&A.
    question_type: {
        type: String,
        enum: ['qa', 'coding'],
        default: 'qa'
    },
    question_bank_id: {
        type: String,
        default: null
    },
    // SVAR Question Bank's own questionId string (see svarQuestionBankQuestionSchema
    // below) - distinct from this document's own _id. Only ever set when
    // question_source is 'qb'.
    questionId: {
        type: String,
        default: null
    },
    // SVAR only: this task's zero-based index within AdminSvarInterview.tasks[]/
    // session.tasks[] at scheduling time. Task IDENTITY within one interview -
    // two tasks can share the same taskType (e.g. read_aloud at position 0 and
    // again at position 3) and must still persist as independent documents;
    // `difficulty` (which stores taskType for SVAR - see getSvarReport) is
    // NOT unique enough for that and must never be used as an upsert/lookup
    // key on its own. undefined for every non-SVAR interview type and for
    // SVAR documents written before this field existed.
    taskPosition: {
        type: Number,
        default: undefined
    },
    // Copied from AdminSvarInterview.tasks[].contentHash at persistence time
    // (see persistTaskResult, svarRound.controller.js) - only set for
    // question_source='qb'. Lets provenance be verified after the fact
    // without re-deriving anything: this exact hash was already checked
    // against the frozen manualConfig before the candidate ever saw the task.
    contentHash: {
        type: String,
        default: null
    },
    pdf_name: {
        type: String,
        default: null
    },
    chunk_id: {
        type: String,
        default: null
    },
    difficulty: {
        type: String,
        default: null
    },
    similarity: {
        type: Number,
        default: 0
    },
    // ── adaptive interview engine audit trail (interview_mode === 'adaptive') ──
    // Coverage bucket the blueprint allocated this slot to (fix 4).
    bucket: {
        type: String,
        default: null
    },
    // Exact per-subtopic web query issued for grounding, if any (fix 3).
    web_query: {
        type: String,
        default: null
    },
    // Discriminating evaluator band: weak | partial | strong (fix 6).
    band: {
        type: String,
        default: null
    },
    // Per-dimension score breakdown from the discriminating evaluator (fix 6).
    dimensions: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    // Upgraded coding round detailed recruiter feedback and scoring parameters
    detailedFeedback: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    scoringParameters: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    // ── SVAR round per-task record ──
    // The separated content + delivery scores for one SVAR task. svarRound's
    // report endpoint has always written this, but the field was missing here,
    // so mongoose strict mode silently dropped it on every save and the report
    // UI's Content/Delivery/Audio columns rendered "—" for every row.
    report_snapshot: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    // Which of the SVAR task types produced this row. Previously smuggled through
    // `difficulty` for want of a home; SvarRoundReport already prefers this field
    // (`r.taskType || r.difficulty`), so populating it is enough to fix the label.
    taskType: {
        type: String,
        default: null
    },
    // Candidate's recorded answer audio for this task, as an objectStore
    // basename. Lets a reviewer play back what was actually said rather than
    // trusting the transcript alone.
    answerAudioFile: {
        type: String,
        default: null
    },
    // ── psychometric-only fields (null for every other interview type) ──
    pillar: {
        type: String,
        default: null
    },
    response_type: {
        type: String,
        default: null
    },
    // The option list shown to the candidate (id/label/score), kept for
    // report/audit purposes - deterministic scoring already happened
    // server-side at evaluation time, this is not re-scored from here.
    options: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    // SJT/scenario_rating narrative the candidate read alongside the terse
    // decision/likelihood prompt in `question` - needed so the report can
    // show the full question, not just "What do you do?" on its own.
    scenario_context: {
        type: String,
        default: null
    },
    pillar_scores: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    consistency_flag: {
        type: Boolean,
        default: false
    }
}, { timestamps: true })

const interviewByJD = new mongoose.Schema({
    job_description: {
        type: String,
        required: true
    },
    interview: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Interview'
    }
}, { timestamps: true })


const interviewByResume = new mongoose.Schema({
    resume: {
        type: String,
        required: true
    },
    interview: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Interview'
    }
}, { timestamps: true })


const interviewByCoreSubjects = new mongoose.Schema({
    subject: {
        type: String,
        required: true
    },
    interview: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Interview'
    }
}, { timestamps: true })


const adminInterviewSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    from: {
        type: String,
        required: true
    },
    to: {
        type: String,
        required: true
    },
    students: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: "Student"
    },
    interview: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: "Interview"
    },
    is_active: {
        type: Boolean,
        default: true
    },
    no_of_questions: {
        type: Number,
        required: true
    },
    questions: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: "InterviewQuestionByAdmin"
    },
    link: {
        type: String,
        required: true
    },
    // Whether assigned students take this scheduled interview with the real-time
    // AI avatar interviewer. Set by the admin per interview type; mirrored onto
    // each student's Interview doc. Lives on the base schema so every interview
    // discriminator (company/subject/verbal/written/svar) inherits it.
    avatar_enabled: {
        type: Boolean,
        default: false
    },
    // Whether question generation is grounded by live Tavily web search.
    // Supported for company and subject type interviews.
    web_search_enabled: {
        type: Boolean,
        default: false
    },
    resume_preference: {
        type: String,
        enum: ['Required', 'Optional', 'Skip'],
        default: 'Optional'
    },
    question_bank_id: {
        type: String,
        default: null
    },
    question_bank_ratio: {
        type: Number,
        default: 0
    },
    interview_mode: {
        type: String,
        enum: ['default', 'placement', 'faculty_exam', 'custom', 'adaptive'],
        default: 'default'
    },
    // Invitees who had no account when the drive was scheduled. We captured the
    // EXACT per-student Interview payload they would have received; when they
    // sign up, materializePendingEnrollments (user.controller) creates that
    // Interview and links it, so the drive appears on their dashboard. Each
    // entry is pulled once materialized, so this stays empty for a fully
    // registered cohort. Lives on the base schema so every discriminator has it.
    pending_enrollments: {
        type: [{
            email: { type: String, lowercase: true, trim: true },
            interviewData: { type: mongoose.Schema.Types.Mixed },
        }],
        default: []
    }
}, { timestamps: true });

// Every generateQuestionFor*Admin controller (HR, JD, subject, written, verbal, svar)
// looks up its drive with AdminInterview.findOne({ interview: interviewId }) on every
// single question-generation turn - the hottest read path in the whole app. `interview`
// had no index, so each lookup was an unindexed multikey scan across every drive ever
// created. Safe to add: purely additive, doesn't change query semantics or results.
adminInterviewSchema.index({ interview: 1 });

export const AdminInterview = mongoose.model('AdminInterview', adminInterviewSchema);

const adminCompanyInterviewSchema = new mongoose.Schema({
    company: {
        type: String,
        required: true
    },
    job_description: {
        type: String,
        required: true
    },
    easy_remaining: {
        type: Number,
        required: true
    },
    medium_remaining: {
        type: Number,
        required: true
    },
    hard_remaining: {
        type: Number,
        required: true
    },
    position: {
        type: String,
        required: true
    },
    // Appended after all easy/medium/hard questions are exhausted: a LeetCode-style
    // coding round, defaulting to Medium/Hard difficulty. Off for every interview
    // created before this field existed (default false / 0).
    coding_enabled: {
        type: Boolean,
        default: false
    },
    coding_remaining: {
        type: Number,
        default: 0
    },
    // Fixed difficulty for every generated coding question, or "Mixed" to keep
    // the original random Medium/Hard split.
    coding_difficulty: {
        type: String,
        enum: ["Easy", "Medium", "Hard", "Mixed"],
        default: "Mixed"
    },
    // JD skills that appear nowhere in this admin's own question bank text -
    // computed once in the background at interview-creation time (see
    // computeBankSkillGapsForJDAdmin), never on the live per-turn path, so it
    // adds no latency to a candidate's interview. null = not yet computed
    // (or nothing to compute); [] = bank already covers the JD well.
    // generateQuestionForJDAdmin reads this (already-loaded doc, no extra
    // query) to occasionally divert a turn from the static bank to fresh
    // JD-grounded generation while a gap remains.
    bank_skill_gaps: {
        type: [String],
        default: null
    }
});

const adminSubjectInterviewSchema = new mongoose.Schema({
    subject: {
        type: String,
        required: true
    },
    easy: {
        type: Number,
        required: true
    },
    medium: {
        type: Number,
        required: true
    },
    hard: {
        type: Number,
        required: true
    },
    // Appended after all easy/medium/hard questions are exhausted: a LeetCode-style
    // coding round, defaulting to Medium/Hard difficulty. Off for every interview
    // created before this field existed (default false / 0).
    coding_enabled: {
        type: Boolean,
        default: false
    },
    coding: {
        type: Number,
        default: 0
    },
    // Fixed difficulty for every generated coding question, or "Mixed" to keep
    // the original random Medium/Hard split.
    coding_difficulty: {
        type: String,
        enum: ["Easy", "Medium", "Hard", "Mixed"],
        default: "Mixed"
    }
});

const adminVerbalInterviewSchema = new mongoose.Schema({
    easy: {
        type: Number,
        required: true
    },
    medium: {
        type: Number,
        required: true
    },
    hard: {
        type: Number,
        required: true
    }
});

const adminWrittenInterviewSchema = new mongoose.Schema({
    fillInTheBlanks: {
        type: Number,
        required: true
    },
    synonymsAndAntonyms: {
        type: Number,
        required: true
    },
    domain: {
        type: String,
        required: true
    },
    essay: {
        type: Number,
        required: true
    },
    jumbled: {
        type: Number,
        required: true
    },
    errorDetection: {
        type: Number,
        required: true
    }
});

const adminHrInterviewSchema = new mongoose.Schema({
    easy: {
        type: Number,
        required: true
    },
    medium: {
        type: Number,
        required: true
    },
    hard: {
        type: Number,
        required: true
    },
    // Mongoose strict mode silently drops fields not declared on the schema -
    // without this, "type: 'hr'" passed to the constructor never persisted,
    // and the scheduler's company/subject/domain/type label fallback chain
    // fell all the way through to its final "N/A" default (see AdminSvarInterview,
    // which needed the exact same explicit declaration for the same reason).
    type: {
        type: String,
        required: true
    },
    // Optional grounding context - when provided, question generation uses these
    // fields to ask company-specific / role-specific behavioral questions instead of
    // generic HR questions.  Left out of the required list so existing HR drives and
    // the "quick schedule" flow that doesn't collect JD continue to work unchanged.
    company: {
        type: String,
        default: null
    },
    position: {
        type: String,
        default: null
    },
    job_description: {
        type: String,
        default: null
    }
});

const adminSvarInterviewSchema = new mongoose.Schema({
    // ── Legacy per-sub-type counts (kept for back-compat with old scheduled
    //    rounds; the new 6-task phase-machine flow uses `tasks` below instead). ──
    reading: { type: Number, default: 0 },
    repeating: { type: Number, default: 0 },
    short: { type: Number, default: 0 },
    jumbled: { type: Number, default: 0 },
    comprehension: { type: Number, default: 0 },
    // ── New full-replacement config: the ordered list of graded tasks for the
    //    SVAR round. Each entry is one of the twelve task types (see
    //    app/svar_round/schemas.py TaskType on the agent, and DEFAULT_TASKS in
    //    svarRound.controller.js) plus a difficulty level (1-3). Array order IS
    //    the sequence the candidate sees. This enum previously only listed 6 of
    //    the 12 - every AdminSvarInterview.create() whose tasks array included
    //    word_pronunciation/pace_fluency/passage_retelling/fill_blanks/
    //    error_spotting/describe_image (i.e. any distribution touching more
    //    than half the task types) failed schema validation, blocking the
    //    admin wizard's SVAR creation step entirely. ──
    tasks: {
        type: [{
            taskType: {
                type: String,
                // SVAR_SCHEDULABLE_TASK_TYPES (not the broader SVAR_TASK_TYPES,
                // which also includes `short_answer` - valid ONLY for Question
                // Bank storage/classification, never as an interview task
                // slot's own type - see its own comment, svarQuestionBank.js).
                // A `short_answer`-typed task here would have no candidate-side
                // TaskType counterpart (GLAMIS_agent-master/.../svar_round/
                // schemas.py) and would crash candidate delivery outright.
                enum: SVAR_SCHEDULABLE_TASK_TYPES,
                required: true
            },
            level: { type: Number, min: 1, max: 3, default: 2 },
            // Admin-authored content for this task (reference text / word set /
            // situation / topic / etc. - the exact keys the agent's TaskConfig
            // expects for this taskType). When present, the round uses this
            // verbatim instead of asking the LLM to generate content - see
            // svarRound.controller.js buildTaskRecord(). Mixed because the field
            // set genuinely varies per taskType (see GLAMIS_agent-master
            // app/svar_round/config.py TaskConfig for the full field list).
            // Populated from one of two sources - hand-typed by the admin, or
            // copied verbatim from a SvarQuestionBank question at scheduling
            // time (see admin.controller.js resolveSvarQuestionBankSelections)
            // - manualConfig itself carries no record of which.
            manualConfig: { type: mongoose.Schema.Types.Mixed, default: undefined },
            // ── Audit metadata only - never read by the scoring/candidate path ──
            // Records where this task's manualConfig came from, so an admin/
            // recruiter can answer "did this come from a question bank, and
            // which one" without it affecting round behavior in any way. Left
            // undefined for hand-typed manual content and for AI-generated tasks.
            questionSource: { type: String, enum: ['manual', 'question_bank'], default: undefined },
            questionBankId: { type: mongoose.Schema.Types.ObjectId, ref: 'SvarQuestionBank', default: undefined },
            questionBankName: { type: String, default: undefined },
            questionBankVersion: { type: String, default: undefined },
            selectedQuestionId: { type: String, default: undefined },
            // Copied verbatim from the source SvarQuestionBank question's own
            // contentHash at scheduling time (see resolveSvarQuestionBankSelections,
            // admin.controller.js) - only ever set for questionSource='question_bank'.
            // Re-verified against a hash freshly computed from manualConfig at
            // candidate-init time (resolveTasks, svarRound.controller.js): if they
            // don't match, initialization fails closed rather than silently
            // proceeding with content that no longer provably matches what was
            // frozen. Undefined for 'manual'/AI tasks and for interviews scheduled
            // before this field existed - see the backward-compatibility note there.
            contentHash: { type: String, default: undefined },
        }],
        default: undefined
    },
    type: {
        type: String,
        required: true
    }
});

const adminPsychometricInterviewSchema = new mongoose.Schema({
    // fetchInterviewDetails' calendar/table label falls back through
    // interview.company -> .subject -> .domain -> .type (matches
    // AdminSvarInterview's own `type` field, which is why "SVAR" shows
    // correctly there) - psychometric has none of company/subject/domain,
    // so without this every drive showed literally "N/A" on the scheduler.
    type: {
        type: String,
        default: 'Psychometric'
    },
    description: {
        type: String,
        default: 'Psychometric Assessment'
    },
    // The linked Batch created alongside this drive (see createLinkedBatch in
    // admin.controller.js) - scopes the ephemeral admin-uploaded question
    // bank (psychometricQuestionBank.models.js) and question-serving lookups
    // to this drive's cohort without an extra BatchCandidate indirection.
    batch_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Batch',
        default: null
    }
});

export const AdminCompanyInterview = AdminInterview.discriminator('AdminCompanyInterview', adminCompanyInterviewSchema);
export const AdminSubjectInterview = AdminInterview.discriminator('AdminSubjectInterview', adminSubjectInterviewSchema);
export const AdminVerbalInterview = AdminInterview.discriminator('AdminVerbalInterview', adminVerbalInterviewSchema);
export const AdminWrittenInterview = AdminInterview.discriminator('AdminWrittenInterview', adminWrittenInterviewSchema);
export const AdminSvarInterview = AdminInterview.discriminator('AdminSvarInterview', adminSvarInterviewSchema);
export const AdminHrInterview = AdminInterview.discriminator('AdminHrInterview', adminHrInterviewSchema);
export const AdminPsychometricInterview = AdminInterview.discriminator('AdminPsychometricInterview', adminPsychometricInterviewSchema);

const interviewQuestionByAdmin = new mongoose.Schema({
    question: {
        type: String,
        required: true
    },
    difficulty: {
        type: String,
        required: true
    }
},
    { timestamps: true }
);


const SessionQuestion = new mongoose.Schema({
    question: {
        type: String,
        required: true
    },
    questionNo: {
        type: Number,
        required: true
    },
    interview: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Interview'
    },
}, { timestamps: true });


export const InterviewQuestionsByAdmin = mongoose.model('InterviewQuestionByAdmin', interviewQuestionByAdmin);
export const Interview = mongoose.model('Interview', interviewSchema);
export const InterviewQuestion = mongoose.model('InterviewQuestion', interviewQuestionSchema);
export const SessionQuestions = mongoose.model('SessionQuestions', SessionQuestion);
export const InterviewByJD = mongoose.model('InterviewByJD', interviewByJD);
export const InterviewByResume = mongoose.model('InterviewByResume', interviewByResume);
export const InterviewByCoreSubjects = mongoose.model('InterviewByCoreSubjects', interviewByCoreSubjects);

const questionBankSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    question_bank_id: {
        type: String,
        required: true,
        unique: true
    },
    questions_count: {
        type: Number,
        default: 0
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

export const QuestionBank = mongoose.model('QuestionBank', questionBankSchema);

// ── SVAR Question Bank ──────────────────────────────────────────────────────
// Deliberately separate from `QuestionBank` above. That model is metadata only
// for the general vector-RAG question bank (real content lives in ChromaDB,
// ingested via FastAPI's /admin/process-question-bank and retrieved by
// similarity search for company/subject/HR interviews - see
// services/retrieval/question_bank_service.py on the agent side, which
// documents that path as retrieving AND rewriting). This model stores the
// actual question content directly in Mongo, looked up by exact
// (taskType, questionId) - never by similarity - and is consumed only at SVAR
// scheduling time (admin.controller.js createSvarInterview), where a selected
// question's `content` is copied verbatim into an AdminSvarInterview task's
// existing `manualConfig` field. See backend/src/utils/svarQuestionBank.js for
// the field-shape validation shared with that resolution step.
const svarQuestionBankQuestionSchema = new mongoose.Schema({
    // Admin-assigned, stable within the bank (validated unique at
    // create/update time - see validateSvarQuestionBankPayload). Never
    // regenerated by the system.
    questionId: { type: String, required: true, trim: true },
    section: { type: Number, required: true, min: 1, max: 4 },
    taskType: {
        type: String,
        enum: SVAR_TASK_TYPES,
        required: true
    },
    level: { type: Number, min: 1, max: 3, default: 2 },
    // Exactly the fields that taskType's manualConfig/TaskConfig expects (see
    // SVAR_QUESTION_CONTENT_FIELDS) - e.g. { reference_text } for read_aloud,
    // { situation, goal_elements } for roleplay. Mixed for the same reason
    // AdminSvarInterview.tasks[].manualConfig is Mixed: the field set varies
    // per taskType. Validated at write time, not at read time.
    content: { type: mongoose.Schema.Types.Mixed, required: true },
    // SHA-256 of {taskType, level, content} - see computeQuestionContentHash
    // (svarQuestionBank.js). Always recomputed by this schema's own pre-save
    // hook below, never trusted from a caller - a question's hash can never
    // drift from its actual content no matter which code path wrote it.
    contentHash: { type: String, default: null },
}, { _id: false });

// A PDF item the ingestion pipeline extracted and classified (or attempted
// to) but could NOT safely auto-complete into a full `questions[]` entry -
// see createSvarQuestionBankFromPdf's readyQuestions/reviewItems split
// (backend/src/controllers/admin.controller.js). Persisted on the bank
// itself (not just returned once in the upload HTTP response) so an admin
// who doesn't finish the review modal immediately can come back later and
// still complete it - previously this data existed only in that one
// response object and was lost the moment the admin navigated away without
// reviewing, silently leaving the bank covering only whichever task types
// happen to need just one plain-string field (pace_fluency, read_aloud,
// repeat, extempore) while the other 8 of 12 types were never actually
// stored, no matter how many questions for them existed in the source PDF.
const svarQuestionBankPendingReviewSchema = new mongoose.Schema({
    key: { type: String, required: true },
    text: { type: String, default: "" },
    secondaryText: { type: String, default: "" },
    suggestedTaskType: { type: String, default: "" },
    suggestedLevel: { type: Number, min: 1, max: 3, default: 2 },
    // Diagnostics only - never consumed by the planner/candidate pipeline,
    // purely to make the admin review UI show WHY an item is pending and
    // which fields (if any) were already safely determined, instead of an
    // opaque "N questions need review" count (see
    // analyzeSvarPartialContentForReview, backend/src/utils/svarQuestionBank.js).
    reviewReason: { type: String, default: "" },
    detectedFields: { type: [String], default: [] },
    missingFields: { type: [String], default: [] },
    partialContent: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Set only when resolveCompatibleTaskType (svarQuestionBank.js) swapped
    // suggestedTaskType away from what OpenAI originally classified, because
    // the grounded fields fully satisfied a DIFFERENT canonical type's
    // requirements instead - lets the review UI honestly say "automatically
    // resolved from X" rather than presenting the normalized type as if it
    // had been OpenAI's original, unadjusted answer.
    normalizedFrom: { type: String, default: null },
    // requiredFields is the normalized/suggested type's OWN canonical
    // required-field list (SVAR_QUESTION_CONTENT_FIELDS) at the moment this
    // item was generated - purely informational for the review UI so it
    // never has to re-derive this itself; authoritative validation still
    // only ever happens via validateSvarQuestionItem() server-side.
    requiredFields: { type: [String], default: [] },
}, { _id: false });

const svarQuestionBankSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    // Freeform version label (e.g. "1.0"). Purely informational - editing a
    // bank does not retroactively change any interview already scheduled from
    // it, because scheduling copies content into manualConfig at creation time
    // rather than keeping a live reference (see createSvarInterview).
    version: { type: String, default: "1.0" },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    questions: {
        type: [svarQuestionBankQuestionSchema],
        default: []
    },
    pendingReview: {
        type: [svarQuestionBankPendingReviewSchema],
        default: []
    },
    // SHA-256 of the raw uploaded file bytes - set only for PDF-sourced banks
    // (see createSvarQuestionBankFromPdf, admin.controller.js). Lets a
    // second upload of the exact same PDF by the same admin be recognized as
    // "the same source" and merged into the existing bank instead of
    // spawning another one - previously every upload created a brand new
    // bank unconditionally, which is how four separate banks for the same
    // PDF ended up in this database. null/undefined for JSON-created and
    // hand-typed banks, which have no comparable "source file" concept.
    sourceFingerprint: { type: String, default: null },
}, { timestamps: true });

// Unique (not just an application-level findOne-then-create check) so two
// concurrent uploads of the identical file by the same admin can never both
// win a create race and produce two banks for the same source. Partial:
// only applies where sourceFingerprint is an actual string - JSON-created
// and hand-typed banks all have sourceFingerprint: null and must remain free
// to coexist (a unique index would otherwise allow at most one null-valued
// bank per admin, which has nothing to do with this constraint's purpose).
svarQuestionBankSchema.index(
    { created_by: 1, sourceFingerprint: 1 },
    { unique: true, partialFilterExpression: { sourceFingerprint: { $type: "string" } } }
);

svarQuestionBankSchema.index({ created_by: 1 });

// Recomputes every question's contentHash from its actual {taskType, level,
// content} on every save - unconditionally, NOT gated behind
// this.isModified("questions"). This is deliberately a schema-level hook
// rather than something each write path (createSvarQuestionBank,
// createSvarQuestionBankFromPdf, updateSvarQuestionBank's review-completion
// merge) has to remember to call correctly - a hash computed by hand at one
// call site and forgotten at another would be worse than no hash at all,
// since a stale/absent hash would go undetected. isModified("questions")
// was tried first and rejected: Mongoose's dirty-tracking does not reliably
// fire for an in-place mutation of a nested property inside a Mixed-typed
// field (content is Mixed) without an explicit markModified("questions")
// call at the mutation site - a real gap this feature cannot tolerate, since
// every write path that ever bypassed a full `bank.questions = [...]`
// reassignment would silently keep a stale hash. Recomputing unconditionally
// removes that whole class of gap. Cheap even for a fairly large bank (pure
// in-memory hashing, no I/O), so doing it on every save is not a
// meaningful cost.
svarQuestionBankSchema.pre("save", function (next) {
    for (const q of this.questions) {
        q.contentHash = computeQuestionContentHash({ taskType: q.taskType, level: q.level, content: q.content });
    }
    // Same reasoning as the contentHash recompute above: enforce this
    // invariant unconditionally on every save, not by trusting each write
    // path to keep questions[] and pendingReview[] in sync by hand.
    // commitSvarQuestionBankReviewItems already does this atomically via its
    // own single $push+$pull update, but updateSvarQuestionBank lets a
    // caller replace `questions` directly without necessarily recomputing
    // `pendingReview` to match (it's a generic bank editor, not a
    // review-completion-specific endpoint) - live-reproduced: two existing
    // banks were found with a pendingReview key already fully resolved into
    // questions[] (PDF-{key} present), doubling that question's count in the
    // Available/Under-Review totals the scheduling UI and planner both read.
    // A resolved question must never remain flagged "still needs review".
    if (this.questions.length > 0 && this.pendingReview.length > 0) {
        const resolvedKeys = new Set(
            this.questions
                .map((q) => q.questionId)
                .filter((id) => id.startsWith("PDF-"))
                .map((id) => id.slice(4))
        );
        if (resolvedKeys.size > 0) {
            this.pendingReview = this.pendingReview.filter((p) => !resolvedKeys.has(p.key));
        }
    }
    next();
});

export const SvarQuestionBank = mongoose.model('SvarQuestionBank', svarQuestionBankSchema);
