require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const templateRoutes = require('./routes/templates');
const uploadRoutes = require('./routes/upload');
const aiRoutes = require('./routes/ai');

// Initialize services
console.log('🔧 Initializing services...');

require('./utils/sendEmail');
require('./utils/ipfsService');

console.log('✅ Services initialized');

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise);
    console.error('❌ Reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    console.error('❌ Stack:', error.stack);
});

const app = express();

// =====================================================
// CORS CONFIGURATION
// =====================================================

const configuredFrontendUrls = String(process.env.FRONTEND_URL || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

const allowedOrigins = new Set([
    ...configuredFrontendUrls,
    'http://localhost:3000',
    'http://localhost:3001',
]);

app.use(
    cors({
        origin(origin, callback) {
            // Allow requests without an Origin header
            // and localhost during development.
            if (
                !origin ||
                allowedOrigins.has(origin) ||
                /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
            ) {
                return callback(null, true);
            }

            console.warn(`⚠️ CORS blocked origin: ${origin}`);
            return callback(null, false);
        },
        credentials: true,
    })
);

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(express.json({ limit: '5mb' }));

// =====================================================
// DATABASE
// =====================================================

connectDB();

// =====================================================
// API ROUTES
// =====================================================

app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/ai', aiRoutes);

// =====================================================
// STATIC UPLOADS
// =====================================================

app.use(
    '/uploads',
    express.static(path.join(__dirname, 'public', 'uploads'))
);

// =====================================================
// HEALTH CHECK
// =====================================================

app.get('/api/health', (_, res) => {
    res.json({
        status: 'ok',
    });
});

// =====================================================
// UNKNOWN API ROUTES
// =====================================================

app.use('/api', (req, res) => {
    res.status(404).json({
        message: 'API route not found',
        method: req.method,
        path: req.originalUrl,
    });
});

// =====================================================
// SERVER
// =====================================================

// Render provides process.env.PORT automatically.
// Locally, it will fall back to port 3001.

const PORT = Number(process.env.PORT || 3001);

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});