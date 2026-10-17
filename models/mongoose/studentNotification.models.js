import mongoose from 'mongoose';

const studentNotificationSchema = new mongoose.Schema({
  recipientEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', default: null },
  interviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', default: null },
  type: {
    type: String,
    enum: ['batch_activated', 'batch_closed', 'interview_scheduled', 'custom'],
    required: true,
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
}, { timestamps: true });

export const StudentNotification = mongoose.model('StudentNotification', studentNotificationSchema);
