const mongoose = require("mongoose");
const { Schema } = mongoose;

const profileSchema = new Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    gender: { type: String, default: null },
    gender_probability: { type: Number, default: null },
    sample_size: { type: Number, default: null },
    age: { type: Number, default: null },
    age_group: { type: String, default: null },
    country_id: { type: String, default: null },
    country_probability: { type: Number, default: null }
}, {
    timestamps: true
});

const Profile = mongoose.model('Profile', profileSchema);

module.exports = Profile;