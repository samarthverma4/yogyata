import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['batch_created', 'batch_activated', 'batch_closed', 'interview_scheduled', 'announcement'],
    required: true,
  },
  title: { type: String, required: true },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  read: { type: Boolean, default: false },
}, { timestamps: true });

export const Notification = mongoose.model('Notification', notificationSchema);
