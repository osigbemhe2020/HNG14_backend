const Profile = require('../models/profiles.model');
const { parseNaturalQuery, buildMongooseQuery } = require('./NlqueryParser');

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Build pagination links for the response envelope
 */
function buildLinks(baseUrl, query, page, limit, totalPages) {
  const buildUrl = (p) => {
    const params = new URLSearchParams({ ...query, page: p, limit });
    return `${baseUrl}?${params.toString()}`;
  };

  return {
    self: buildUrl(page),
    next: page < totalPages ? buildUrl(page + 1) : null,
    prev: page > 1 ? buildUrl(page - 1) : null,
    first: buildUrl(1),
    last: buildUrl(totalPages || 1)
  };
}

/**
 * Build Mongoose filter query from flat filters object
 */
function buildFilterQuery(filters) {
  const {
    gender,
    country_id,
    age_group,
    min_age,
    max_age,
    min_gender_probability,
    min_country_probability
  } = filters;

  const query = {};

  if (gender) query.gender = { $regex: new RegExp('^' + gender.trim() + '$', 'i') };
  if (country_id) query.country_id = { $regex: new RegExp('^' + country_id.trim() + '$', 'i') };
  if (age_group) query.age_group = { $regex: new RegExp('^' + age_group.trim() + '$', 'i') };

  if (min_age || max_age) {
    query.age = {};
    if (min_age) query.age.$gte = parseInt(min_age);
    if (max_age) query.age.$lte = parseInt(max_age);
  }

  if (min_gender_probability) {
    query.gender_probability = { $gte: parseFloat(min_gender_probability) };
  }
  if (min_country_probability) {
    query.country_probability = { $gte: parseFloat(min_country_probability) };
  }

  return query;
}

// ─── GET ALL PROFILES ─────────────────────────────────────────────────────────

const getAllProfiles = async (filters, page, limit, baseUrl) => {
  const {
    sort_by,
    order,
    ...filterFields
  } = filters;

  const query = buildFilterQuery(filterFields);

  // Sort
  const validSortFields = ['age', 'created_at', 'gender_probability'];
  const sortField = sort_by && validSortFields.includes(sort_by) ? sort_by : 'created_at';
  const sortOrder = order === 'asc' ? 1 : -1;
  const sortObj = { [sortField]: sortOrder };

  const skip = (page - 1) * limit;

  const [profiles, total] = await Promise.all([
    Profile.find(query).sort(sortObj).skip(skip).limit(limit),
    Profile.countDocuments(query)
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    profiles,
    pagination: {
      total,
      page,
      limit,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
      links: buildLinks(baseUrl, filters, page, limit, totalPages)
    }
  };
};

// ─── SEARCH PROFILES (NATURAL LANGUAGE) ──────────────────────────────────────

const searchProfiles = async (naturalQuery, page, limit, baseUrl) => {
  const parseResult = parseNaturalQuery(naturalQuery);

  if (parseResult.error) {
    return { status: 'error', message: 'Unable to interpret query' };
  }

  const filters = parseResult.filters;
  const query = buildMongooseQuery(filters);
  const skip = (page - 1) * limit;

  const [profiles, total] = await Promise.all([
    Profile.find(query).skip(skip).limit(limit),
    Profile.countDocuments(query)
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    status: 'success',
    query: naturalQuery,
    parsedFilters: filters,
    profiles,
    pagination: {
      total,
      page,
      limit,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
      links: buildLinks(baseUrl, { q: naturalQuery }, page, limit, totalPages)
    }
  };
};

// ─── EXPORT PROFILES AS CSV ───────────────────────────────────────────────────

const exportProfiles = async (filters) => {
  const { sort_by, order, ...filterFields } = filters;

  const query = buildFilterQuery(filterFields);

  const validSortFields = ['age', 'created_at', 'gender_probability'];
  const sortField = sort_by && validSortFields.includes(sort_by) ? sort_by : 'created_at';
  const sortOrder = order === 'asc' ? 1 : -1;

  // No pagination limit on export — fetch all matching records
  const profiles = await Profile.find(query).sort({ [sortField]: sortOrder });

  return profiles;
};

module.exports = {
  getAllProfiles,
  searchProfiles,
  exportProfiles
};