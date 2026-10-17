import mongoose from "mongoose";

// Per-recipient record of a CSV-driven invitation to a scheduled/ongoing drive.
// Deliberately separate from BatchCandidate/Batch: the CSV upload is the source
// of truth for who gets invited, so this sidesteps the BatchCandidate vs
// Batch.emails mismatch entirely. Rows are written ONLY when a real send happens
// (dry-run writes nothing), so a resend can see who already went out and when.
const interviewInviteSchema = new mongoose.Schema({
  // The AdminInterview (drive) this invitation belongs to.
  interview: { type: mongoose.Schema.Types.ObjectId, ref: "AdminInterview", required: true, index: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  registered: { type: Boolean, default: false },
  link: { type: String, default: "" },
  // Outcome of the last real send attempt for this recipient.
  status: { type: String, enum: ["sent", "failed"], required: true },
  invitedAt: { type: Date, default: null },
  error: { type: String, default: "" },
}, { timestamps: true });

// One row per recipient per drive; a resend updates it in place.
interviewInviteSchema.index({ interview: 1, email: 1 }, { unique: true });

export const InterviewInvite = mongoose.model("InterviewInvite", interviewInviteSchema);
