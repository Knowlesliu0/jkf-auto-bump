const express = require('express');
const db = require('../db');
const { autoBump } = require('../scraper');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Assign default user for single-user system (Fallback if no user)
const DEFAULT_USER_ID = 1;

// Protect all /api/tasks routes
router.use(authenticateToken);

router.get('/', (req, res) => {
    try {
        const tasks = db.prepare('SELECT * FROM tasks ORDER BY top_expires_at IS NULL, top_expires_at ASC, created_at DESC').all();
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/', (req, res) => {
    try {
        const { url, cookieString, intervalMinutes, name, topExpiresAt, jkfUsername, jkfPassword, telegramBotToken, telegramChatId } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }
        if (!cookieString && (!jkfUsername || !jkfPassword)) {
            return res.status(400).json({ error: 'Cookie 或 JKF 帳密 至少需提供一項' });
        }

        const interval = intervalMinutes || 60;
        const nextRun = new Date(Date.now() + interval * 60000).toISOString();
        const topExp = topExpiresAt ? new Date(topExpiresAt).toISOString() : null;

        const result = db.prepare(`
            INSERT INTO tasks (user_id, name, url, cookie_string, interval_minutes, status, next_run, top_expires_at, jkf_username, jkf_password, telegram_bot_token, telegram_chat_id)
            VALUES (?, ?, ?, ?, ?, 'idle', ?, ?, ?, ?, ?, ?)
        `).run(DEFAULT_USER_ID, name || '擷取標題中...', url, cookieString || '', interval, nextRun, topExp, jkfUsername || null, jkfPassword || null, telegramBotToken || null, telegramChatId || null);

        const newTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(newTask);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/:id', (req, res) => {
    try {
        const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
        if (result.changes > 0) {
            res.json({ message: 'Task deleted' });
        } else {
            res.status(404).json({ error: 'Task not found or unauthorized' });
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.patch('/:id/cookie', async (req, res) => {
    try {
        const { cookieString, jkfUsername, jkfPassword } = req.body;
        if (!cookieString && !jkfUsername) {
            return res.status(400).json({ error: 'Cookie 或帳密至少需提供一項' });
        }

        // Build dynamic update
        const updates = [];
        const params = [];
        if (cookieString) { updates.push('cookie_string = ?'); params.push(cookieString); }
        if (jkfUsername !== undefined) { updates.push('jkf_username = ?'); params.push(jkfUsername || null); }
        if (jkfPassword !== undefined) { updates.push('jkf_password = ?'); params.push(jkfPassword || null); }
        updates.push("status = 'idle'", 'last_message = NULL');
        params.push(req.params.id);

        const result = db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        if (result.changes > 0) {
            const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);

            // Also refresh cookies in the persistent browser context
            if (cookieString && task.jkf_username) {
                const browserManager = require('../browserManager');
                await browserManager.refreshCookies(task.jkf_username, cookieString);
                console.log(`[API] Refreshed persistent context cookies for "${task.jkf_username}"`);
            }

            res.json(task);
        } else {
            res.status(404).json({ error: 'Task not found' });
        }
    } catch (error) {
        console.error('Error updating cookie:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/:id/trigger', async (req, res) => {
    try {
        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
        if (!task) return res.status(404).json({ error: 'Task not found' });

        db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('running', task.id);

        res.json({ message: 'Triggered successfully, running in background', task: { ...task, status: 'running' } });

        // Run scraper in background
        const result = await autoBump(task.url, task.cookie_string, task.jkf_username, task.jkf_password);

        const newStatus = result.success ? 'success' : 'failed';
        const lastRun = new Date().toISOString();
        const nextRun = new Date(Date.now() + task.interval_minutes * 60000).toISOString();

        if (result.success) {
            const topExp = result.topExpiresAt ? new Date(result.topExpiresAt).toISOString() : null;
            const freeExp = result.freeStatus || null;
            if (result.newCookieString) {
                db.prepare(`
                    UPDATE tasks
                    SET status = ?, last_run = ?, next_run = ?, last_message = ?, top_expires_at = COALESCE(?, top_expires_at), free_status = COALESCE(?, free_status), name = COALESCE(?, name), cookie_string = ?
                    WHERE id = ?
                `).run(newStatus, lastRun, nextRun, result.message, topExp, freeExp, result.threadTitle || null, result.newCookieString, task.id);

                // 🔑 Sync cookies to ALL tasks with the same JKF account
                if (task.jkf_username) {
                    const synced = db.prepare(`
                        UPDATE tasks SET cookie_string = ?
                        WHERE jkf_username = ? AND id != ?
                    `).run(result.newCookieString, task.jkf_username, task.id);
                    if (synced.changes > 0) {
                        console.log(`[Trigger] 🔄 Synced cookies to ${synced.changes} other task(s) for account: ${task.jkf_username}`);
                    }
                }
            } else {
                db.prepare(`
                    UPDATE tasks
                    SET status = ?, last_run = ?, next_run = ?, last_message = ?, top_expires_at = COALESCE(?, top_expires_at), free_status = COALESCE(?, free_status), name = COALESCE(?, name)
                    WHERE id = ?
                `).run(newStatus, lastRun, nextRun, result.message, topExp, freeExp, result.threadTitle || null, task.id);
            }
        } else {
            if (result.newCookieString) {
                db.prepare(`
                    UPDATE tasks
                    SET status = ?, last_run = ?, next_run = ?, last_message = ?, cookie_string = ?, free_status = NULL
                    WHERE id = ?
                `).run(newStatus, lastRun, nextRun, result.message, result.newCookieString, task.id);
            } else {
                db.prepare(`
                    UPDATE tasks
                    SET status = ?, last_run = ?, next_run = ?, last_message = ?, free_status = NULL
                    WHERE id = ?
                `).run(newStatus, lastRun, nextRun, result.message, task.id);
            }
        }

    } catch (error) {
        console.error('Error triggering task:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

router.patch('/:id/telegram', (req, res) => {
    try {
        const { telegramBotToken, telegramChatId } = req.body;
        const result = db.prepare(`
            UPDATE tasks SET telegram_bot_token = ?, telegram_chat_id = ? WHERE id = ?
        `).run(telegramBotToken || null, telegramChatId || null, req.params.id);

        if (result.changes > 0) {
            const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
            res.json(task);
        } else {
            res.status(404).json({ error: 'Task not found' });
        }
    } catch (error) {
        console.error('Error updating telegram settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
