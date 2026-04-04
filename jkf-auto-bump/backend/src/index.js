const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Load database connection
require('./db');

// Routes
const authRoutes = require('./routes/auth');
const tasksRoutes = require('./routes/tasks');

app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);

const { startScheduler } = require('./scheduler');
const browserManager = require('./browserManager');

app.get('/api/debug-env', (req, res) => {
    try {
        const fs = require('fs');
        const dbPath = process.env.DB_PATH || 'no path';
        const publicPath = path.join(__dirname, '..', 'public');
        res.json({
            ok: true,
            dbPath,
            __dirname,
            publicPath,
            publicExists: fs.existsSync(publicPath),
            indexExists: fs.existsSync(path.join(publicPath, 'index.html')),
            uptime: process.uptime()
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Serve static frontend files (absolute path, Express 5 compatible)
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Catch-all: use app.use (works in Express 4 & 5, unlike app.get('*'))
app.use((req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(port, async () => {
    console.log(`Backend API listening on port ${port}`);

    // Pre-launch the persistent browser so first bump is fast
    await browserManager.ensureBrowser().catch(err => {
        console.error('[Startup] Failed to pre-launch browser:', err.message);
    });

    startScheduler();
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('[App] Received SIGTERM - shutting down gracefully');
    require('./db').close();
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('[App] Received SIGINT - shutting down gracefully');
    require('./db').close();
    process.exit(0);
});
