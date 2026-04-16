const axios = require('axios');
const { v7: uuidv7 } = require('uuid');

const createServiceError = (api, message) => ({ status: 502, api, message });

/**
 * Extracts profile data from multiple APIs
 * @param {string} name - The name to analyze
 * @returns {object} - Profile data object
 */
const extractProfileData = async (name) => {
    try {
        const [genderResponse, ageResponse, countryResponse] = await Promise.all([
            axios.get(`https://api.genderize.io?name=${encodeURIComponent(name)}`),
            axios.get(`https://api.agify.io?name=${encodeURIComponent(name)}`),
            axios.get(`https://api.nationalize.io?name=${encodeURIComponent(name)}`)
        ]);

        // Extract data from Genderize API
        const { gender, probability: genderProbability, count: sampleSize } = genderResponse.data;

        // Extract data from Agify API
        const { age } = ageResponse.data;

        // Extract data from Nationalize API
        const { country: countries } = countryResponse.data;

        if (!gender || sampleSize === 0) throw createServiceError('Genderize', 'Genderize returned an invalid response');
        if (typeof age !== 'number' || age === null) throw createServiceError('Agify', 'Agify returned an invalid response');
        if (!countries || countries.length === 0) throw createServiceError('Nationalize', 'Nationalize returned an invalid response');

        const primaryCountry = countries[0] || null;

        const getAgeGroup = (age) => {
            if (age < 13) return 'child';
            if (age < 20) return 'teenager';
            if (age < 60) return 'adult';
            return 'senior';
        };

        const profileData = {
            id: uuidv7(),
            name,
            gender: gender || null,
            gender_probability: genderProbability || null,
            sample_size: sampleSize || null,
            age: age || null,
            age_group: age ? getAgeGroup(age) : null,
            country_id: primaryCountry ? primaryCountry.country_id : null,
            country_probability: primaryCountry ? primaryCountry.probability : null
        };

        return profileData;
    } catch (error) {
        if (error && error.status === 502 && error.api) {
            throw error;
        }

        if (error.isAxiosError) {
            const apiUrl = error.config?.url || '';
            const apiName = apiUrl.includes('genderize.io') ? 'Genderize'
                : apiUrl.includes('agify.io') ? 'Agify'
                : apiUrl.includes('nationalize.io') ? 'Nationalize'
                : 'External API';
            throw createServiceError(apiName, `${apiName} request failed`);
        }

        throw error;
    }
};

module.exports = {
    extractProfileData
};