const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Check if user exists
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Calculate 5 days free trial
        const trialExpiresAt = new Date();
        trialExpiresAt.setDate(trialExpiresAt.getDate() + 5);

        // Insert user
        const result = db.prepare(`
            INSERT INTO users (email, password_hash, trial_expires_at)
            VALUES (?, ?, ?)
        `).run(email, passwordHash, trialExpiresAt.toISOString());

        // Generate token
        const token = generateToken({ id: result.lastInsertRowid, email, role: 'user' });

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: result.lastInsertRowid,
                email,
                role: 'user',
                trial_expires_at: trialExpiresAt.toISOString()
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate token
        const token = generateToken(user);

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                trial_expires_at: user.trial_expires_at,
                credits: user.credits
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const { authenticateToken } = require('../middleware/auth');
router.get('/me', authenticateToken, (req, res) => {
    const user = db.prepare('SELECT id, email, role, trial_expires_at, credits, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
});

module.exports = router;
