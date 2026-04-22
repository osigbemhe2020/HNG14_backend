// profiles.model.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const profileSchema = new Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, unique: true },
    gender: { 
        type: String, 
        enum: ['male', 'female'], 
        default: null 
    },
    gender_probability: { type: Number, default: null },
    age: { type: Number, default: null },
    age_group: { 
        type: String, 
        enum: ['child', 'teenager', 'adult', 'senior'], 
        default: null 
    },
    country_id: { 
        type: String, 
        maxlength: 2,
        default: null 
    },
    country_name: { type: String, default: null },
    country_probability: { type: Number, default: null }
}, {
    timestamps: true
});

// Performance indexes for common queries
profileSchema.index({ gender: 1 });
profileSchema.index({ age: 1 });
profileSchema.index({ age_group: 1 });
profileSchema.index({ country_id: 1 });
profileSchema.index({ gender: 1, age: 1, country_id: 1 });

const Profile = mongoose.model('Profile', profileSchema);

module.exports = Profile;