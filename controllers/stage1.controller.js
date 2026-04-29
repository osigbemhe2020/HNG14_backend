const { extractProfileData } = require('../services/profile.service');
const ProfileService = require('../services/profiles.service');
const Profile = require('../models/profiles.model');

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Build the base URL for pagination links
 * e.g. https://your-api.com/api/profiles
 */
function getBaseUrl(req) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${protocol}://${host}${req.path}`;
}

// ─── CREATE PROFILE ───────────────────────────────────────────────────────────

const createProfile = async (req, res) => {
  const { name } = req.body;
  try {
    if (!name || !name.trim()) {
      return res.status(400).json({ status: 'error', message: 'Name is required' });
    }

    const trimmedName = name.trim();

    const existingProfile = await Profile.findOne({
      name: new RegExp(`^${trimmedName}$`, 'i')
    });

    if (existingProfile) {
      return res.status(200).json({
        status: 'success',
        message: 'Profile already exists',
        data: existingProfile
      });
    }

    const profileData = await extractProfileData(trimmedName);
    const newProfile = await Profile.create(profileData);

    return res.status(201).json({
      status: 'success',
      data: newProfile
    });

  } catch (error) {
    console.error('createProfile error:', error);
    if (error?.status === 502 && error?.api) {
      return res.status(502).json({
        status: 'error',
        message: `${error.api} returned an invalid response`
      });
    }
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── GET ALL PROFILES ─────────────────────────────────────────────────────────

const getAllProfiles = async (req, res) => {
  const page  = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);

  // Strip pagination params — pass everything else as filters
  const { page: _, limit: __, ...filters } = req.query;

  try {
    const baseUrl = getBaseUrl(req);
    const result = await ProfileService.getAllProfiles(filters, page, limit, baseUrl);

    return res.status(200).json({
      status: 'success',
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      total_pages: result.pagination.total_pages,
      links: result.pagination.links,
      data: result.profiles
    });

  } catch (error) {
    console.error('getAllProfiles error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── GET PROFILE BY ID ────────────────────────────────────────────────────────

const getProfileById = async (req, res) => {
  const { id } = req.params;
  try {
    const profile = await Profile.findOne({ id });
    if (!profile) {
      return res.status(404).json({ status: 'error', message: 'Profile not found' });
    }
    return res.status(200).json({ status: 'success', data: profile });

  } catch (error) {
    console.error('getProfileById error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── DELETE PROFILE ───────────────────────────────────────────────────────────

const deleteProfile = async (req, res) => {
  const { id } = req.params;
  try {
    const profile = await Profile.findOneAndDelete({ id });
    if (!profile) {
      return res.status(404).json({ status: 'error', message: 'Profile not found' });
    }
    return res.status(204).send();

  } catch (error) {
    console.error('deleteProfile error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── SEARCH PROFILES ─────────────────────────────────────────────────────────

const searchProfiles = async (req, res) => {
  const { q } = req.query;
  const page  = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);

  try {
    if (!q || !q.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Query parameter "q" is required'
      });
    }

    const baseUrl = getBaseUrl(req);
    const result = await ProfileService.searchProfiles(q.trim(), page, limit, baseUrl);

    if (result.status === 'error') {
      return res.status(400).json(result);
    }

    return res.status(200).json({
      status: 'success',
      query: result.query,
      interpreted_as: result.parsedFilters,
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      total_pages: result.pagination.total_pages,
      links: result.pagination.links,
      data: result.profiles
    });

  } catch (error) {
    console.error('searchProfiles error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── EXPORT PROFILES AS CSV ───────────────────────────────────────────────────

const exportProfiles = async (req, res) => {
  // Accept same filters as getAllProfiles — no pagination
  const { page: _, limit: __, ...filters } = req.query;

  try {
    const profiles = await ProfileService.exportProfiles(filters);

    // CSV headers
    const csvHeaders = [
      'id', 'name', 'gender', 'gender_probability',
      'age', 'age_group', 'country_id', 'country_name',
      'country_probability', 'created_at'
    ];

    // Convert each profile to a CSV row
    const csvRows = profiles.map(profile => {
      return csvHeaders.map(field => {
        const value = profile[field];
        if (value === null || value === undefined) return '';
        // Wrap in quotes if value contains comma, quote, or newline
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',');
    });

    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `profiles-export-${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');

    return res.status(200).send(csvContent);

  } catch (error) {
    console.error('exportProfiles error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

module.exports = {
  createProfile,
  getAllProfiles,
  getProfileById,
  deleteProfile,
  searchProfiles,
  exportProfiles
};