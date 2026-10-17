import mongoose from "mongoose";

// One admin-uploaded psychometric question, scoped to whatever batch the
// parent bank document belongs to. Literal fixed text (not LLM-paraphrased),
// so candidate-side dedup against these is a plain answered-ID exclusion —
// no embedding/similarity search needed.
const psychometricBankQuestionSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true
    },
    response_type: {
        type: String,
        required: true,
        enum: [
            'likert', 'frequency', 'agreement', 'importance',
            'multiple_choice', 'multiple_select', 'forced_choice',
            'ranking', 'sjt', 'scenario_rating', 'yes_no', 'true_false', 'open_ended'
        ]
    },
    pillar: {
        type: String,
        required: true,
        enum: [
            'communication', 'teamwork', 'leadership', 'problem_solving',
            'decision_making', 'adaptability', 'emotional_stability',
            'conscientiousness', 'integrity', 'learning_agility'
        ]
    },
    secondary_pillars: {
        type: [String],
        default: []
    },
    // Response-type-specific choice list (label + id, and for scored types
    // an admin-supplied score 0-10 per option so evaluation stays
    // deterministic instead of LLM-judged). Left as Mixed since shape
    // varies by response_type (options vs ranking items vs scenario text).
    options: {
        type: mongoose.Schema.Types.Mixed,
        default: []
    },
    scenario_context: {
        type: String,
        default: ""
    }
}, { _id: true });

// Ephemeral, per-batch admin-uploaded psychometric question bank.
// Deliberately NOT a permanent collection: one upload is tied to one
// scheduled batch, all candidates in that batch draw from it, and it is
// removed once the batch is done. Primary cleanup is an explicit delete
// when the admin marks the batch complete (see admin.controller.js);
// the TTL index below is only a safety net for an abandoned batch.
const psychometricQuestionBankSchema = new mongoose.Schema({
    batch_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Batch',
        required: true,
        index: true
    },
    uploaded_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    questions: {
        type: [psychometricBankQuestionSchema],
        default: []
    },
    // Set by the controller to batch end time + a grace window at upload
    // time. Mongo's TTL monitor deletes the document once this passes.
    expireAt: {
        type: Date,
        required: true
    }
}, { timestamps: true });

psychometricQuestionBankSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export const PsychometricQuestionBank = mongoose.model('PsychometricQuestionBank', psychometricQuestionBankSchema);
