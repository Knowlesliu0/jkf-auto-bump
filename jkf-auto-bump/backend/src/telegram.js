const https = require('https');

const chatQueues = new Map();
const MAX_RATE_LIMIT_RETRIES = 3;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendTelegramMessage(botToken, chatId, message) {
    const queueKey = `${botToken}:${chatId}`;
    const previous = chatQueues.get(queueKey) || Promise.resolve();
    const sendOperation = previous
        .catch(() => { })
        .then(() => sendTelegramMessageWithRetry(botToken, chatId, message));
    const queuedOperation = sendOperation.catch(() => { }).finally(() => {
        if (chatQueues.get(queueKey) === queuedOperation) {
            chatQueues.delete(queueKey);
        }
    });

    chatQueues.set(queueKey, queuedOperation);
    return sendOperation;
}

async function sendTelegramMessageWithRetry(botToken, chatId, message, attempt = 0) {
    try {
        return await sendTelegramRequest(botToken, chatId, message);
    } catch (error) {
        if (error.telegramErrorCode !== 429 || attempt >= MAX_RATE_LIMIT_RETRIES) {
            throw error;
        }

        const retryAfterSeconds = Number.isFinite(error.retryAfterSeconds)
            ? error.retryAfterSeconds
            : attempt + 1;
        await sleep(Math.max(0, retryAfterSeconds) * 1000);
        return sendTelegramMessageWithRetry(botToken, chatId, message, attempt + 1);
    }
}

async function sendTelegramRequest(botToken, chatId, message) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
        });

        const options = {
            hostname: 'api.telegram.org',
            path: `/bot${botToken}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.ok) {
                        resolve(parsed);
                    } else {
                        const error = new Error(parsed.description || 'Telegram API error');
                        error.telegramErrorCode = parsed.error_code;
                        const retryAfterSeconds = Number(parsed.parameters?.retry_after);
                        if (Number.isFinite(retryAfterSeconds)) {
                            error.retryAfterSeconds = retryAfterSeconds;
                        }
                        reject(error);
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

module.exports = { sendTelegramMessage };
