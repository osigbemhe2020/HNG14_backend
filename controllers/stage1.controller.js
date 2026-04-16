
const { extractProfileData } = require('../services/profile.service');
const Profile = require('../models/profiles.model');


const createProfile = async (req, res) => {
    const { name } = req.body;
      try {
    if (!name || !name.trim()) {
        return res.status(400).json({
            status: 'error',
            message: 'Name is required'
        });
    }

    const trimmedName = name.trim();

    const existingProfile = await Profile.findOne({ name: new RegExp(`^${trimmedName}$`, 'i') });
    if (existingProfile) {
    return res.status(200).json({
        status: 'success',
        message: 'Profile already exists',
        data: existingProfile
    });
}
        // Extract profile data using the service
        const profileData = await extractProfileData(trimmedName);

        // Add profile to db
        const newProfile = await Profile.create(profileData);

        return res.status(201).json({
            status: 'success',
            data: newProfile
        });

    } catch(error) {
        console.error(error);
        if (error && error.status === 502 && error.api) {
            return res.status(502).json({
                status: 'error',
                message: `${error.api} returned an invalid response`
            });
        }
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
};

const getAllProfiles = async (req, res) => {
    const { gender, country_id, age_group } = req.query;
    try {
        let filter = {};
        if (gender) filter.gender = { $regex: new RegExp('^' + gender.trim() + '$', 'i') };
        if (country_id) filter.country_id = { $regex: new RegExp('^' + country_id.trim() + '$', 'i') };
        if (age_group) filter.age_group = { $regex: new RegExp('^' + age_group.trim() + '$', 'i') };

        const profiles = await Profile.find(filter);
        return res.status(200).json({
            status: 'success',
            count: profiles.length,
            data: profiles
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
};

const getProfileById = async (req, res) => {
    const { id } = req.params;

    try {
        const profile = await Profile.findOne({ id });
        if (!profile) {
            return res.status(404).json({
                status: 'error',
                message: 'Profile not found'
            });
        }
        return res.status(200).json({
            status: 'success',
            data: profile
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
};

const deleteProfile = async (req, res) => { 
    const { id } = req.params;

    try {
        const profile = await Profile.findOneAndDelete({ id });
        if (!profile) {
            return res.status(404).json({
                status: 'error',
                message: 'Profile not found'
            });
        }
        return res.status(204).send();
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
};

module.exports = {
    createProfile,
    getAllProfiles,
    getProfileById,
    deleteProfile
};