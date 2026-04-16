const express = require('express');
const axios = require('axios');
const { validateNameUtil } = require('./middlewares/validateName');

const router = express.Router();

router.get('/classify', async (req, res) => {
    const { name } = req.query;

    // Validate name parameter
    const validation = validateNameUtil(name);
    if (!validation.isValid) {
        return res.status(validation.error.status).json({
            status: 'error',
            message: validation.error.message
        });
    }

    try {
        const response = await axios.get(`https://api.genderize.io?name=${encodeURIComponent(name)}`);
        const { gender, probability, count, name: genderizedName } = response.data;

        if (gender === null || count === 0) {
            return res.status(200).json({ status: 'error', message: 'No prediction available for the provided name' });
        }

        const is_confident = probability >= 0.7 && count >= 100;
        const processed_at = new Date().toISOString();

        return res.status(200).json({
            status: 'success',
            data: {
                name: genderizedName,
                gender,
                probability,
                sample_size: count,
                is_confident,
                processed_at
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
});

module.exports = router;