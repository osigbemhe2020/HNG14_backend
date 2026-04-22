// stage1.controller.js
const { extractProfileData } = require('../services/profile.service');
const ProfileService = require('../services/profiles.service');
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

    const page = Math.max(parseInt(req.query.page) || 1, 1);
const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const { page: _, limit: __, ...filters } = req.query;
    try {
    const result = await ProfileService.getAllProfiles(filters, page, limit);
        res.status(200).json({
          status: 'success',
          page: page,
          limit: limit,
          total: result.pagination.totalProfiles || 0,
          data: result.profiles || []
        });
      } catch (error) {
        res.status(500).json({ message: "Server Error" });
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

const searchProfiles = async (req, res) => {
    const { q } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    try {
        if (!q || !q.trim()) {
            return res.status(400).json({
                status: 'error',
                message: 'Query parameter "q" is required'
            });
        }

        const result = await ProfileService.searchProfiles(q.trim(), page, limit);
        if (result.status === 'error') {
    return res.status(400).json(result);
}
        return res.status(200).json({
          status: 'success',
          page: page,
          limit: limit,
          total: result.pagination.totalProfiles || 0,
          data: result.profiles || [],
          query: result.query,
          interpreted_as: result.parsedFilters,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
};

module.exports = {
    createProfile,
    getAllProfiles,
    getProfileById,
    deleteProfile,
    searchProfiles
};