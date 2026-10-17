import mongoose from "mongoose";

const preparationSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['question', 'quiz', 'coding'],
        required: true
    },
    difficulty: {
        type: String,
        enum: ['Easy', 'Medium', 'Hard'],
        default: 'Medium'
    },
    company: {
        type: String,
        trim: true
    },
    topics: {
        type: [String],
        default: []
    },
    link: {
        type: String,
        required: true
    }
}, { timestamps: true });

export const Preparation = mongoose.model("Preparation", preparationSchema);
