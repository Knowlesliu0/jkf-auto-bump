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

const { startScheduler } = require('./scheduler');

app.listen(port, () => {
    console.log(`Backend API listening on port ${port}`);
    startScheduler();
});
