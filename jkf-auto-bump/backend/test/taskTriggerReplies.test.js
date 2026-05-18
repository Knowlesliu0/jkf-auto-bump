const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');

function clearBackendModuleCache() {
    for (const modulePath of [
        '../src/db',
        '../src/routes/tasks',
        '../src/scraper',
        '../src/telegram',
        '../src/replyNotifications'
    ]) {
        try {
            delete require.cache[require.resolve(modulePath)];
        } catch (e) {
            // Module may not exist yet in the red phase.
        }
    }
}

function postJson(port, taskId, token) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port,
            path: `/api/tasks/${taskId}/trigger`,
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Content-Length': '2'
            }
        }, res => {
            let body = '';
            res.on('data', chunk => {
                body += chunk;
            });
            res.on('end', () => {
                resolve({ statusCode: res.statusCode, body });
            });
        });
        req.on('error', reject);
        req.write('{}');
        req.end();
    });
}

async function waitFor(predicate, timeoutMs = 1000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const value = predicate();
        if (value) return value;
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    return predicate();
}

test('manual trigger updates reply baseline and sends new-reply Telegram notification', async () => {
    clearBackendModuleCache();

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jkf-trigger-replies-'));
    process.env.DB_PATH = path.join(tempDir, 'data.db');

    const telegramCalls = [];
    const telegramPath = require.resolve('../src/telegram');
    require.cache[telegramPath] = {
        id: telegramPath,
        filename: telegramPath,
        loaded: true,
        exports: {
            sendTelegramMessage: async (botToken, chatId, message) => {
                telegramCalls.push({ botToken, chatId, message });
                return { ok: true };
            }
        }
    };

    const scraperPath = require.resolve('../src/scraper');
    require.cache[scraperPath] = {
        id: scraperPath,
        filename: scraperPath,
        loaded: true,
        exports: {
            autoBump: async () => ({
                success: true,
                message: 'Already free',
                threadTitle: '新留言 <VIP> & 測試',
                replyCount: 200,
                newCookieString: 'fresh-cookie'
            })
        }
    };

    const db = require('../src/db');
    const insert = db.prepare(`
        INSERT INTO tasks (
            user_id, name, url, cookie_string, interval_minutes, status, next_run,
            last_reply_count, telegram_bot_token, telegram_chat_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        1,
        '原本廣告',
        'https://example.com/ad?x=<1>&y=2',
        'old-cookie',
        60,
        'idle',
        new Date().toISOString(),
        100,
        'token',
        'chat'
    );

    const app = express();
    app.use(express.json());
    app.use('/api/tasks', require('../src/routes/tasks'));
    const server = app.listen(0);

    try {
        const port = server.address().port;
        const token = jwt.sign({ id: 1, role: 'admin' }, 'super-secret-key-change-in-production');

        const response = await postJson(port, insert.lastInsertRowid, token);
        assert.equal(response.statusCode, 200);

        const updatedTask = await waitFor(() => {
            const row = db.prepare('SELECT status, last_reply_count, cookie_string FROM tasks WHERE id = ?').get(insert.lastInsertRowid);
            return row.status === 'success' ? row : null;
        });

        assert.equal(updatedTask.last_reply_count, 200);
        assert.equal(updatedTask.cookie_string, 'fresh-cookie');
        assert.equal(telegramCalls.length, 1);
        assert.deepEqual(
            { botToken: telegramCalls[0].botToken, chatId: telegramCalls[0].chatId },
            { botToken: 'token', chatId: 'chat' }
        );
        assert.match(telegramCalls[0].message, /<b>廣告有新留言！<\/b>/);
        assert.match(telegramCalls[0].message, /新留言 &lt;VIP&gt; &amp; 測試/);
        assert.match(telegramCalls[0].message, /https:\/\/example\.com\/ad\?x=&lt;1&gt;&amp;y=2/);
    } finally {
        await new Promise(resolve => server.close(resolve));
        db.close();
        delete process.env.DB_PATH;
        clearBackendModuleCache();
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
