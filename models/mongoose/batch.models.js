import mongoose from "mongoose";

const batchSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  domain: { type: String, default: '', trim: true },
  target: { type: String, default: 'Open', trim: true },
  studentCount: { type: Number, default: 0 },
  progress: { type: Number, default: 0 },
  emails: [{ type: String }],
  windowStart: { type: Date },
  windowEnd: { type: Date },
  concurrencyCap: { type: Number, default: 10, min: 1 },
  activeSessions: { type: Number, default: 0, min: 0 },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'active', 'closed', 'archived', 'Wrapping'],
    default: 'draft'
  },
  scheduleEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScheduleEvent', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const batchCandidateSchema = new mongoose.Schema({
  batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
  email: { type: String, required: true, trim: true, lowercase: true },
  name: { type: String, default: '', trim: true },
  rollNo: { type: String, default: '', trim: true },
  status: {
    type: String,
    enum: ['invited', 'registered', 'queued', 'in_session', 'completed', 'no_show'],
    default: 'invited'
  },
  inviteToken: { type: String },
  // Per-candidate invitation-email state, so a resend is visible in the roster
  // and never silently double-sends. Set when an invite email actually goes out.
  invited: { type: Boolean, default: false },
  invitedAt: { type: Date, default: null },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', default: null },
  completedAt: { type: Date }
}, { timestamps: true });

// prevent duplicate enrollment
batchCandidateSchema.index({ batch: 1, email: 1 }, { unique: true });

export const Batch = mongoose.model('Batch', batchSchema);
export const BatchCandidate = mongoose.model('BatchCandidate', batchCandidateSchema);
