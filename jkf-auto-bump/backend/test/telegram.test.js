const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const https = require('node:https');
const childProcess = require('node:child_process');

const { sendTelegramMessage } = require('../src/telegram');

function mockTelegramResponses(responses, responseDelayMs = 0) {
    const originalRequest = https.request;
    const calls = [];
    let activeRequests = 0;
    let maxActiveRequests = 0;

    https.request = (options, callback) => {
        const req = new EventEmitter();
        req.body = '';
        req.write = chunk => {
            req.body += chunk;
        };
        req.end = () => {
            activeRequests += 1;
            maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
            const responseBody = responses.shift();
            calls.push({ options, body: req.body });

            setTimeout(() => {
                const res = new EventEmitter();
                callback(res);
                res.emit('data', JSON.stringify(responseBody));
                res.emit('end');
                activeRequests -= 1;
            }, responseDelayMs);
        };
        return req;
    };

    return {
        calls,
        get maxActiveRequests() {
            return maxActiveRequests;
        },
        restore() {
            https.request = originalRequest;
        }
    };
}

test('sendTelegramMessage serializes messages for the same chat', async () => {
    const mock = mockTelegramResponses([
        { ok: true, result: { message_id: 1 } },
        { ok: true, result: { message_id: 2 } },
        { ok: true, result: { message_id: 3 } },
        { ok: true, result: { message_id: 4 } },
        { ok: true, result: { message_id: 5 } }
    ], 5);

    try {
        await Promise.all([
            sendTelegramMessage('token', 'chat', 'message 1'),
            sendTelegramMessage('token', 'chat', 'message 2'),
            sendTelegramMessage('token', 'chat', 'message 3'),
            sendTelegramMessage('token', 'chat', 'message 4'),
            sendTelegramMessage('token', 'chat', 'message 5')
        ]);

        assert.equal(mock.calls.length, 5);
        assert.equal(mock.maxActiveRequests, 1);
    } finally {
        mock.restore();
    }
});

test('sendTelegramMessage retries Telegram rate limit responses', async () => {
    const mock = mockTelegramResponses([
        {
            ok: false,
            error_code: 429,
            description: 'Too Many Requests: retry after 0',
            parameters: { retry_after: 0 }
        },
        { ok: true, result: { message_id: 10 } }
    ]);

    try {
        const result = await sendTelegramMessage('token', 'chat', 'message');

        assert.equal(result.ok, true);
        assert.equal(mock.calls.length, 2);
    } finally {
        mock.restore();
    }
});

test('sendTelegramMessage falls back to curl when Node TLS verification fails', async () => {
    const originalRequest = https.request;
    const originalExecFile = childProcess.execFile;
    const calls = [];

    https.request = () => {
        const req = new EventEmitter();
        req.write = () => { };
        req.end = () => {
            const error = new Error('unable to verify the first certificate');
            error.code = 'UNABLE_TO_VERIFY_LEAF_SIGNATURE';
            process.nextTick(() => req.emit('error', error));
        };
        return req;
    };

    childProcess.execFile = (command, args, options, callback) => {
        calls.push({ command, args, options });
        callback(null, JSON.stringify({ ok: true, result: { message_id: 99 } }), '');
    };

    try {
        const result = await sendTelegramMessage('tls-token', 'tls-chat', 'message');

        assert.equal(result.ok, true);
        assert.equal(result.result.message_id, 99);
        assert.equal(calls.length, 1);
        assert.match(calls[0].args.join(' '), /sendMessage/);
    } finally {
        https.request = originalRequest;
        childProcess.execFile = originalExecFile;
    }
});
