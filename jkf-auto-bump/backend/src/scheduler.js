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

    console.log('Scheduler started.');
}

module.exports = { startScheduler };
