import mongoose from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email_id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    phone: {
        type: String,
        minLength: 10,
        maxLength: 10,
        required: true,
        unique: true,
        index: true
    },
    is_admin: {
        type: Boolean,
        default: false
    },
    feedback_submitted:{
        type:Boolean,
        default:false,
    },
    interview_photos:{
        type:[String],
        default:[]
    },
    password: {
        type: String,
        required: true,
        minLength: 4
    },
    is_email_verified: {
        type: Boolean,
        default: false
    },
    refreshToken: {
        type: String
    }
}, { timestamps: true })


const studentProfileSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    token: {
        type: Number,
        default: 10
    },
    avatar: {
        type: String
    },
    interview_taken: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Interview"
    }],
    course: {
        type: String
    },
    branch: {
        type: String
    },
    semester: {
        type: Number
    },
    section: {
        type: String
    },
    rollNo: {
        type: Number 
    },
    address: {
        type: String
    },
    idCard: {
        type: String
    },
    resume: {
        type: String
    },
}, { timestamps: true })

userSchema.plugin(mongooseAggregatePaginate)

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, 10);
    next()
})

userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password)
}

userSchema.methods.generateAccessToken = function () {
    return jwt.sign({
        _id: this._id,
        email_id: this.email_id,
    },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

userSchema.methods.generateRefreshToken = function () {
    return jwt.sign({
        _id: this._id,
    },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

const User = mongoose.model("User", userSchema)
const Student = mongoose.model("Student", studentProfileSchema)

export { User, Student };