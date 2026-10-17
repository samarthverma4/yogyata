import mongoose from "mongoose";

const sharedPreparationSchema = new mongoose.Schema({
    batchName: { 
        type: String, 
        required: true 
    },
    purpose: { 
        type: String, 
        required: true 
    },
    target: { 
        type: String, 
        required: true 
    },
    types: [{ 
        type: String, 
        enum: ['link', 'file', 'questions']
    }],
    linkUrl: { 
        type: String 
    },
    fileUrl: { 
        type: String 
    },
    questions: [{ 
        question: String,
        topic: String,
        difficulty: String,
        company: String
    }]
}, { timestamps: true });

export const SharedPreparation = mongoose.model("SharedPreparation", sharedPreparationSchema);
