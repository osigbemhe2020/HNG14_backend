const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

app.get('/api/classify', async (req, res) => {
    const { name } = req.query;

    if (name === undefined || name === null) {
        return res.status(400).json({ status: 'error', message: 'Missing name parameter' });
    }
    if (typeof name !== 'string') {
        return res.status(422).json({ status: 'error', message: 'Name must be a string' });
    }
    if (name.trim() === '') {
        return res.status(400).json({ status: 'error', message: 'Empty name parameter' });
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

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        status: 'error',
        message: 'Internal server error'
    });
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

module.exports = app;
