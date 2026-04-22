// profiles.service.js
const Profile = require('../models/profiles.model');
const { parseNaturalQuery, buildMongooseQuery } = require('./NlqueryParser');

const getAllProfiles = async (filters, page, limit) => {
  let query = {};
  
  const { gender, 
    country_id, 
    age_group, 
    min_age, 
    max_age, 
    min_gender_probability, 
    min_country_probability,
    sort_by,
    order
  } = filters;
  
  // String filters with case-insensitive exact match
  if (gender) query.gender = { $regex: new RegExp('^' + gender.trim() + '$', 'i') };
  if (country_id) query.country_id = { $regex: new RegExp('^' + country_id.trim() + '$', 'i') };
  if (age_group) query.age_group = { $regex: new RegExp('^' + age_group.trim() + '$', 'i') };
  
  // Age range filters
  if (min_age || max_age) {
    query.age = {};
    if (min_age) query.age.$gte = parseInt(min_age);
    if (max_age) query.age.$lte = parseInt(max_age);
  }
  
  // Probability filters (minimum threshold)
  if (min_gender_probability) query.gender_probability = { $gte: parseFloat(min_gender_probability) };
  if (min_country_probability) query.country_probability = { $gte: parseFloat(min_country_probability) };
  
  // Build sort object
  let sortObj = {};
  const validSortFields = ['age', 'created_at', 'gender_probability'];
  const sortField = sort_by && validSortFields.includes(sort_by) ? sort_by : 'created_at';
  const sortOrder = order === 'asc' ? 1 : -1; // Default to desc (-1)
  sortObj[sortField] = sortOrder;
  
  // Pagination
  const skip = (page - 1) * limit;
  
  const [profiles, total] = await Promise.all([
    Profile.find(query).sort(sortObj).skip(skip).limit(limit),
    Profile.countDocuments(query)
  ]);
  
  return {
    profiles: profiles,
    pagination: {
      currentPage: page,
      totalProfiles: total,
      
    }
  };
};

/**
 * Search profiles using natural language query
 * Parses plain English queries and converts them to filters
 */
const searchProfiles = async (naturalQuery, page, limit) => {
  // Parse natural language query
  const parseResult = parseNaturalQuery(naturalQuery);
  
  if (parseResult.error) {
    return {
      status: 'error',
      message: 'Unable to interpret query'
    };
  }
  
  const filters = parseResult.filters;
  
  // Build MongoDB query from parsed filters
  let query = buildMongooseQuery(filters);
  
  // Pagination
  const skip = (page - 1) * limit;
  
  const [profiles, total] = await Promise.all([
    Profile.find(query).skip(skip).limit(limit),
    Profile.countDocuments(query)
  ]);
  
  return {
    status: 'success',
    query: naturalQuery,
    parsedFilters: filters,
    profiles,
    pagination: {
      currentPage: page,
      totalProfiles: total,
      
    }
  };
};

module.exports = {
  getAllProfiles,
  searchProfiles
};