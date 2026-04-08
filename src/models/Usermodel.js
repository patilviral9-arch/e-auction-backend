const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    // 🔹 Shared Fields
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['personal', 'business', 'admin'],
        default: "personal",
        required: true
    },

    // 🔹 Personal Fields
    firstName: {
        type: String,
        required: function () { return this.role === 'personal'; }
    },
    lastName: {
        type: String,
        required: function () { return this.role === 'personal'; }
    },
    address: {
        type: String,
    },
     PhoneNumber: {
        type: Number,
    },
    about:{
        type: String,
    },
   

    // 🔹 Business Fields
    businessName: {
        type: String,
        required: function () { return this.role === 'business'; }
    },
    ownerName: {
        type: String,
    },
    businessType: {
        type: String,
    },
    category: {
        type: String,
    },
    joinDate: {
        type: Date,
        default: Date.now
    },
    bio: {
        type: String
    },

    // 🔹 Contact
    phone: {
        type: String,
    },
    alternatePhone: {
        type: String
    },
    website: {
        type: String
    },

    // 🔹 Address (Nested Object)
    address: {
        line1: String,
        line2: String,
        city: {
            type: String,
        },
        state: String,
        country: String,
        pincode: String
    },

    // 🔹 Legal / KYC
    gst: {
        type: String
    },
    pan: {
        type: String
    },
    aadhar: {
        type: String
    },
    registrationNumber: {
        type: String
    },
    verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
    },
    isKYCCompleted: {
        type: Boolean,
        default: false
    },

    // 🔹 Bank Details (Nested)
    bank: {
        accountHolder: String,
        bankName: String,
        accountNumber: String,
        ifsc: String,
        upi: String
    },

    // 🔹 Status
    status: {
        type: String,
        enum: ['active', 'inactive', 'deleted', 'blocked'], // ✅ fixed typo
        default: 'active'
    },

    avatar: {
    type: String,
    default: null,
    },

}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model("User", userSchema)