const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many login attempts, please try again later.',
});

const securityMiddleware = (app) => {
    app.use(helmet({
        contentSecurityPolicy: false,
    }));
    app.use('/api/', limiter);
    app.use('/auth/login', authLimiter);
    app.use('/auth/register', authLimiter);
};

module.exports = { securityMiddleware, limiter, authLimiter };