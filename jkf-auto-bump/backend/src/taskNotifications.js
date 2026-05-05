const { sendTelegramMessage } = require('./telegram');

function escapeTelegramHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function buildTaskIssueMessage(task, status, reason, result = {}) {
    const taskId = task?.id ? `#${task.id}` : '未知';
    const taskName = result.threadTitle || task?.name || '未命名廣告';
    const taskUrl = task?.url || '未提供';
    const issueReason = reason || '未提供錯誤原因';

    return [
        '⚠️ <b>自動有空狀態異常</b>',
        '',
        `🆔 任務：${escapeTelegramHtml(taskId)}`,
        `📋 廣告：${escapeTelegramHtml(taskName)}`,
        `🔗 連結：${escapeTelegramHtml(taskUrl)}`,
        `📌 狀態：${escapeTelegramHtml(status)}`,
        `📝 原因：${escapeTelegramHtml(issueReason)}`
    ].join('\n');
}

async function notifyTaskIssue(task, status, reason, result = {}, sendMessage = sendTelegramMessage) {
    if (status === 'success') {
        return false;
    }
    if (!task?.telegram_bot_token || !task?.telegram_chat_id) {
        return false;
    }

    const message = buildTaskIssueMessage(task, status, reason, result);
    await sendMessage(task.telegram_bot_token, task.telegram_chat_id, message);
    return true;
}

module.exports = {
    buildTaskIssueMessage,
    notifyTaskIssue
};
