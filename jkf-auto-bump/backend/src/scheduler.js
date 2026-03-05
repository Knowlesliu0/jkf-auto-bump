const cron = require('node-cron');
const db = require('./db');
const { autoBump } = require('./scraper');

function startScheduler() {
    // Check every minute
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        const isoNow = now.toISOString();

        // Get tasks that are due and not currently running
        try {
            const dueTasks = db.prepare(`
                SELECT * FROM tasks
                WHERE status != 'running' AND next_run <= ?
            `).all(isoNow);

            for (const task of dueTasks) {
                console.log(`[Scheduler] Triggering task ${task.id} (${task.name})`);

                // Mark as running
                db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('running', task.id);

                // Fire and forget so we don't block the loop
                autoBump(task.url, task.cookie_string, task.jkf_username, task.jkf_password).then(result => {
                    const newStatus = result.success ? 'success' : 'failed';
                    const lastRun = new Date().toISOString();
                    const nextRun = new Date(Date.now() + task.interval_minutes * 60000).toISOString();

                    if (result.newCookieString) {
                        db.prepare(`
                            UPDATE tasks
                            SET status = ?, last_run = ?, next_run = ?, last_message = ?, cookie_string = ?, free_status = NULL
                            WHERE id = ?
                        `).run(newStatus, lastRun, nextRun, result.message, result.newCookieString, task.id);

                        // 🔑 Sync cookies to ALL tasks with the same JKF account
                        // This prevents the race condition where Task 1's cookie refresh
                        // invalidates Task 2's old cookies
                        if (result.success && task.jkf_username) {
                            const synced = db.prepare(`
                                UPDATE tasks SET cookie_string = ?
                                WHERE jkf_username = ? AND id != ?
                            `).run(result.newCookieString, task.jkf_username, task.id);
                            if (synced.changes > 0) {
                                console.log(`[Scheduler] 🔄 Synced cookies to ${synced.changes} other task(s) for account: ${task.jkf_username}`);
                            }
                        }
                    } else {
                        db.prepare(`
                            UPDATE tasks
                            SET status = ?, last_run = ?, next_run = ?, last_message = ?, free_status = NULL
                            WHERE id = ?
                        `).run(newStatus, lastRun, nextRun, result.message, task.id);
                    }

                    if (result.success) {
                        if (result.topExpiresAt) {
                            db.prepare('UPDATE tasks SET top_expires_at = ? WHERE id = ?')
                                .run(new Date(result.topExpiresAt).toISOString(), task.id);
                        }
                        if (result.freeStatus) {
                            db.prepare('UPDATE tasks SET free_status = ? WHERE id = ?')
                                .run(result.freeStatus, task.id);
                        }
                        if (result.threadTitle) {
                            db.prepare('UPDATE tasks SET name = ? WHERE id = ?')
                                .run(result.threadTitle, task.id);
                        }
                    }
                }).catch(e => {
                    console.error(`[Scheduler] Error in autoBump for task ${task.id}`, e);
                    db.prepare('UPDATE tasks SET status = ?, last_message = ? WHERE id = ?')
                        .run('failed', e.message, task.id);
                });
            }
        } catch (error) {
            console.error('[Scheduler] Database error:', error);
        }
    });

    // Cookie keep-alive: visit JKF every 20 minutes with each active context
    // to prevent server-side session expiration
    cron.schedule('*/20 * * * *', async () => {
        const browserManager = require('./browserManager');
        for (const [accountKey, context] of browserManager.contexts) {
            try {
                const page = await context.newPage();
                await page.goto('https://www.jkforum.net/', {
                    waitUntil: 'domcontentloaded',
                    timeout: 30000
                });
                await page.waitForTimeout(3000);
                const isLoggedIn = await page.evaluate(() => {
                    const text = document.body?.innerText || '';
                    return !text.includes('訪客') || text.includes('個人空間');
                });
                await page.close();
                if (isLoggedIn) {
                    console.log(`[KeepAlive] ✅ Session alive for "${accountKey}"`);
                } else {
                    console.log(`[KeepAlive] ⚠️ Session expired for "${accountKey}"`);
                }
            } catch (e) {
                console.log(`[KeepAlive] Error for "${accountKey}":`, e.message);
            }
        }
    });

    console.log('Scheduler started.');
}

module.exports = { startScheduler };
