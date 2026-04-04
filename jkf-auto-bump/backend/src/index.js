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

// Serve static frontend files (use absolute path to avoid CWD issues)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Catch-all: serve index.html for any unmatched route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const { startScheduler } = require('./scheduler');
const browserManager = require('./browserManager');

app.get('/api/debug-env', (req, res) => {
    try {
        const fs = require('fs');
        const dbPath = process.env.DB_PATH || 'no path';
        const dataPath = '/data';
        let files = [];
        if (fs.existsSync(dataPath)) {
            files = fs.readdirSync(dataPath);
        }
        res.json({
            ok: true,
            dbPath,
            files: files,
            uptime: process.uptime()
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
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
