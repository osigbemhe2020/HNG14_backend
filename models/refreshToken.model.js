const mongoose = require('mongoose');
const { Schema } = mongoose;

const refreshTokenSchema = new Schema({
    jti: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    used: {
        type: Boolean,
        default: false
    },
    expiresAt: {
        type: Date,
        required: true,
        // MongoDB TTL index — auto-deletes expired documents
        index: { expires: 0 }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);