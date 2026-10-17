import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    interview: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Interview",
        required: true
    },
    answers: {
        q1: { type: String, required: true },
        q2: { type: String, required: true },
        q3: { type: String, required: true },
        q4: { type: String, required: true },
        q5: { type: String, required: true },
        q6: { type: String, required: true },
        q7: { type: [String], required: true }, // multi-select
        q8: { type: String, required: true },
        q9: { type: String, required: true },
        q10: { type: String, required: true },
        q11: { type: String, required: true },
        q12: { type: String, required: true }
    }
}, { timestamps: true });

// NOTE: A TTL index (expireAfterSeconds: 604800) was removed here - it silently
// deleted every feedback survey 7 days after creation. Feedback is persistent
// analytics data, not a cache. If you have a running DB that already built this
// index, also drop it there: db.feedbacks.dropIndex("createdAt_1").

export const Feedback = mongoose.model("Feedback", feedbackSchema);
