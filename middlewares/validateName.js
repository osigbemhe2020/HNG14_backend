/**
 * Validates the name parameter - utility function
 * @param {string} name - The name to validate
 * @returns {object} - { isValid: boolean, error?: { status: number, message: string } }
 */
const validateNameUtil = (name) => {
    if (name === undefined || name === null) {
        return {
            isValid: false,
            error: {
                status: 400,
                message: 'Missing name parameter'
            }
        };
    }

    if (typeof name !== 'string') {
        return {
            isValid: false,
            error: {
                status: 422,
                message: 'Name must be a string'
            }
        };
    }

    if (name.trim() === '') {
        return {
            isValid: false,
            error: {
                status: 400,
                message: 'Empty name parameter'
            }
        };
    }

    return { isValid: true };
};

/**
 * Express middleware for validating name parameter
 * Checks req.body.name or req.query.name
 */
const validateName = (req, res, next) => {
    const name = req.body.name || req.query.name;
    
    const validation = validateNameUtil(name);
    if (!validation.isValid) {
        return res.status(validation.error.status).json({
            status: 'error',
            message: validation.error.message
        });
    }

    next();
};

module.exports = validateName;
module.exports.validateNameUtil = validateNameUtil;
