require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const templateRoutes = require('./routes/templates');
const uploadRoutes = require('./routes/upload');
const aiRoutes = require('./routes/ai');
const notificationRoutes = require('./routes/notifications');

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

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// =====================================================
// CORS CONFIGURATION
// =====================================================

app.use(
    cors({
        origin: true,
        credentials: true,
    })
);

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
app.use('/api/notifications', notificationRoutes);

// =====================================================
// STATIC UPLOADS
// =====================================================

app.use(
    '/uploads',
    express.static(uploadsDir)
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
// DATABASE OFFLINE & GENERAL ERROR MIDDLEWARE
// =====================================================

app.use((err, req, res, next) => {
    if (
        err.name === 'MongooseError' ||
        err.name === 'MongoNetworkError' ||
        (err.message && err.message.includes('buffering timed out'))
    ) {
        console.warn('[AI Studio] Database offline — returning fallback response');
        if (req.method === 'GET') {
            return res.json(req.path.endsWith('s') || req.path.endsWith('s/') ? [] : {});
        }
        return res.status(503).json({ error: 'Service temporarily unavailable (database offline)' });
    }
    console.error('Server error:', err);
    res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

// =====================================================
// FRONTEND SERVING (Vite middleware in dev, static in prod)
// =====================================================

async function setupFrontend() {
    const distPath = path.resolve(__dirname, '../frontend/dist');

    if (process.env.NODE_ENV !== 'production') {
        try {
            const { createServer: createViteServer } = await import('vite');
            const vite = await createViteServer({
                root: path.resolve(__dirname, '../frontend'),
                configFile: path.resolve(__dirname, '../frontend/vite.config.js'),
                server: {
                    middlewareMode: true,
                    hmr: false,
                },
                appType: 'spa',
            });
            app.use(vite.middlewares);
            console.log('⚡ Vite dev middleware loaded for live preview');
            return;
        } catch (viteErr) {
            console.warn('⚠️ Vite middleware note:', viteErr.message);
        }
    }

    if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
        console.log(`📦 Serving static frontend from ${distPath}`);
    } else {
        console.warn(`⚠️ Warning: frontend dist not found at ${distPath}.`);
    }
}

// =====================================================
// SERVER STARTUP
// =====================================================

const PORT = 3000;

async function startServer() {
    await setupFrontend();

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    });
}

startServer();