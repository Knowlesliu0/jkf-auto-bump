const https = require('https');
const childProcess = require('child_process');

const chatQueues = new Map();
const MAX_RATE_LIMIT_RETRIES = 3;
const TLS_CERTIFICATE_ERROR_CODES = new Set([
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    'SELF_SIGNED_CERT_IN_CHAIN',
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'CERT_HAS_EXPIRED'
]);

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
                    resolve(parseTelegramResponse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', error => {
            if (!isTlsCertificateError(error)) {
                reject(error);
                return;
            }

            sendTelegramRequestWithCurl(botToken, body)
                .then(resolve)
                .catch(reject);
        });
        req.write(body);
        req.end();
    });
}

function parseTelegramResponse(data) {
    const parsed = JSON.parse(data);
    if (parsed.ok) {
        return parsed;
    }

    const error = new Error(parsed.description || 'Telegram API error');
    error.telegramErrorCode = parsed.error_code;
    const retryAfterSeconds = Number(parsed.parameters?.retry_after);
    if (Number.isFinite(retryAfterSeconds)) {
        error.retryAfterSeconds = retryAfterSeconds;
    }
    throw error;
}

function isTlsCertificateError(error) {
    return TLS_CERTIFICATE_ERROR_CODES.has(error?.code);
}

async function sendTelegramRequestWithCurl(botToken, body) {
    const command = process.platform === 'win32' ? 'curl.exe' : 'curl';
    const args = [
        '-sS',
        '-X', 'POST',
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        '-H', 'Content-Type: application/json',
        '-d', body
    ];
    if (process.platform === 'win32') {
        args.unshift('--ssl-no-revoke');
    }

    return new Promise((resolve, reject) => {
        childProcess.execFile(command, args, { timeout: 30000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(stderr || error.message));
                return;
            }

            try {
                resolve(parseTelegramResponse(stdout));
            } catch (e) {
                reject(e);
            }
        });
    });
}

module.exports = { sendTelegramMessage };
