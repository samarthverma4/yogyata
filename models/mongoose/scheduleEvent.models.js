import mongoose from "mongoose";

const scheduleEventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  date: { type: String, required: true },
  type: {
    type: String,
    enum: ['company', 'subject', 'written', 'verbal', 'svar', 'hr'],
    default: 'company',
  },
  colorIdx: { type: Number, default: 0 },
  status: { type: String, enum: ['scheduled', 'closed'], default: 'scheduled' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const ScheduleEvent = mongoose.model('ScheduleEvent', scheduleEventSchema);
