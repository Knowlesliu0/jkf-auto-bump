const { sendTelegramMessage } = require('./telegram');

function escapeTelegramHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function getReplyMaxId(result = {}) {
    const replyCount = Number(result.replyCount);
    if (!Number.isFinite(replyCount) || replyCount <= 0) {
        return null;
    }
    return Math.trunc(replyCount);
}

function getPreviousReplyMaxId(task = {}) {
    const previous = Number(task.last_reply_count);
    if (!Number.isFinite(previous) || previous <= 0) {
        return 0;
    }
    return Math.trunc(previous);
}

function hasNewReply(task, result) {
    const newMaxId = getReplyMaxId(result);
    const previousMaxId = getPreviousReplyMaxId(task);
    if (newMaxId === null) {
        return false;
    }
    if (previousMaxId > 0) {
        return newMaxId > previousMaxId;
    }
    return Boolean(task?.last_run);
}

function buildNewReplyMessage(task, result = {}) {
    const taskName = result.threadTitle || task?.name || '未命名廣告';
    const taskUrl = task?.url || '未提供';

    return [
        '🔔 <b>廣告有新留言！</b>',
        '',
        `📋 廣告：${escapeTelegramHtml(taskName)}`,
        `🔗 連結：${escapeTelegramHtml(taskUrl)}`
    ].join('\n');
}

async function notifyNewReply(task, result, sendMessage = sendTelegramMessage) {
    if (!task?.telegram_bot_token || !task?.telegram_chat_id) {
        return false;
    }
    if (!hasNewReply(task, result)) {
        return false;
    }

    const message = buildNewReplyMessage(task, result);
    await sendMessage(task.telegram_bot_token, task.telegram_chat_id, message);
    return true;
}

module.exports = {
    buildNewReplyMessage,
    getReplyMaxId,
    hasNewReply,
    notifyNewReply
};
