const express = require('express');
const cors = require('cors');

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

// Serve static frontend files
app.use(express.static('public'));

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
