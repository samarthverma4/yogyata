import mongoose from "mongoose";

const adminSettingsSchema = new mongoose.Schema(
    {
        readinessThresholds: {
            ready: {
                type: Number,
                default: 75,
                min: 0,
                max: 100
            },
            developing: {
                type: Number,
                default: 50,
                min: 0,
                max: 100
            }
        },
        preferences: {
            defaultTheme: {
                type: String,
                enum: ['light', 'dark', 'system'],
                default: 'system'
            },
            autoSignOutMinutes: {
                type: Number,
                enum: [15, 30, 60, 0], // 0 means never
                default: 30
            }
        },
        systemFeatures: {
            enableEmailNotifications: {
                type: Boolean,
                default: true
            },
            maxStudentsPerBatch: {
                type: Number,
                default: 50,
                min: 1
            }
        }
    },
    { timestamps: true }
);

export const AdminSettings = mongoose.model("AdminSettings", adminSettingsSchema);
