const test = require('node:test');
const assert = require('node:assert/strict');

const { buildTaskIssueMessage, notifyTaskIssue } = require('../src/taskNotifications');

test('buildTaskIssueMessage names the problem ad and escapes Telegram HTML', () => {
    const message = buildTaskIssueMessage(
        {
            id: 7,
            name: '豪華 <VIP> & 置頂',
            url: 'https://example.com/thread?x=1&y=<2>'
        },
        'failed',
        'Button <not> found & screenshot saved'
    );

    assert.match(message, /自動有空狀態異常/);
    assert.match(message, /任務：#7/);
    assert.match(message, /廣告：豪華 &lt;VIP&gt; &amp; 置頂/);
    assert.match(message, /連結：https:\/\/example\.com\/thread\?x=1&amp;y=&lt;2&gt;/);
    assert.match(message, /狀態：failed/);
    assert.match(message, /原因：Button &lt;not&gt; found &amp; screenshot saved/);
});

test('notifyTaskIssue sends Telegram when task status is not success', async () => {
    let call;
    const sent = await notifyTaskIssue(
        {
            id: 3,
            name: '測試廣告',
            url: 'https://example.com/ad',
            telegram_bot_token: 'token',
            telegram_chat_id: 'chat'
        },
        'failed',
        'Cookie expired',
        {},
        async (botToken, chatId, message) => {
            call = { botToken, chatId, message };
        }
    );

    assert.equal(sent, true);
    assert.equal(call.botToken, 'token');
    assert.equal(call.chatId, 'chat');
    assert.match(call.message, /廣告：測試廣告/);
    assert.match(call.message, /原因：Cookie expired/);
});

test('notifyTaskIssue skips success status and tasks without Telegram settings', async () => {
    let calls = 0;
    const sendMessage = async () => {
        calls += 1;
    };

    const successSent = await notifyTaskIssue(
        {
            id: 1,
            name: '正常廣告',
            url: 'https://example.com/ok',
            telegram_bot_token: 'token',
            telegram_chat_id: 'chat'
        },
        'success',
        'ok',
        {},
        sendMessage
    );

    const missingSettingsSent = await notifyTaskIssue(
        {
            id: 2,
            name: '未設定通知',
            url: 'https://example.com/missing'
        },
        'failed',
        'Button not found',
        {},
        sendMessage
    );

    assert.equal(successSent, false);
    assert.equal(missingSettingsSent, false);
    assert.equal(calls, 0);
});
