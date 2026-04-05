const { client } = require('./lineClient');

const ADMIN_ID = process.env.ADMIN_USER_ID;

// 暫停超時時間（毫秒），預設 30 分鐘
const PAUSE_TIMEOUT_MS = parseInt(process.env.PAUSE_TIMEOUT_MIN || '30', 10) * 60 * 1000;

// 真人回覆後，AI 恢復等待時間（毫秒），預設 1 分鐘
const RESUME_DELAY_MS = parseInt(process.env.RESUME_DELAY_MIN || '1', 10) * 60 * 1000;

// 待恢復計時器：Map<userId, Timer>
const resumeTimers = new Map();

// 待處理的人工訊息佇列（記憶體中，重啟會清空）
const pendingMessages = new Map();

// 暫停中的用戶：Map<userId, { pausedAt, displayName, reason, timer }>
const pausedUsers = new Map();

// ── 暫停 / 恢復 機器人 ───────────────────────────────────

function pauseUser(userId, displayName, reason = '人工接手') {
    // 清除舊的計時器（如果有）
    const existing = pausedUsers.get(userId);
    if (existing?.timer) clearTimeout(existing.timer);

    // 設定自動恢復計時器
    const timer = setTimeout(() => {
        console.log(`⏰ 用戶 ${displayName}(${userId}) 暫停超時，自動恢復機器人`);
        pausedUsers.delete(userId);
    }, PAUSE_TIMEOUT_MS);

    pausedUsers.set(userId, {
        userId,
        displayName,
        reason,
        pausedAt: new Date().toISOString(),
        timer,
    });

    console.log(`🔇 機器人已暫停：${displayName}(${userId}) - ${reason}`);
}

function resumeUser(userId) {
    const entry = pausedUsers.get(userId);
    if (entry?.timer) clearTimeout(entry.timer);
    pausedUsers.delete(userId);
    console.log(`🔔 機器人已恢復：${userId}`);
}

function isUserPaused(userId) {
    return pausedUsers.has(userId);
}

function getPausedUsers() {
    return Array.from(pausedUsers.values()).map(({ timer, ...rest }) => rest);
}

// ── 轉發給管理者 ─────────────────────────────────────────

async function forwardToAdmin(event) {
    const userId = event.source.userId;
    const text = event.message.text;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // 取得客人名稱
    let displayName = '未知';
    try {
        const profile = await client.getProfile(userId);
        displayName = profile.displayName;
    } catch (e) {
        console.error('取得用戶資訊失敗:', e.message);
    }

    // 存入待處理佇列
    pendingMessages.set(id, {
        id,
        userId,
        displayName,
        text,
        timestamp: new Date().toISOString(),
    });

    // 暫停該用戶的機器人自動回覆
    pauseUser(userId, displayName, `客人說：${text.slice(0, 30)}`);

    // 發訊息給管理者
    await client.pushMessage({
        to: ADMIN_ID,
        messages: [
            {
                type: 'text',
                text:
                    `📩 客人訊息\n\n` +
                    `👤 ${displayName}\n` +
                    `💬 ${text}\n\n` +
                    `🔇 機器人已暫停（該客人）\n\n` +
                    `回覆請輸入：\n` +
                    `@回覆 ${userId} 你要回覆的內容`,
            },
        ],
    });
}

// ── 管理者回覆 ──────────────────────────────────────────

async function handleAdminReply(text) {
    // 格式：@回覆 <userId> <內容>
    const match = text.match(/^@回覆\s+(U[a-f0-9]+)\s+(.+)$/s);
    if (!match) {
        await client.pushMessage({
            to: ADMIN_ID,
            messages: [
                {
                    type: 'text',
                    text: '❌ 格式錯誤\n正確格式：@回覆 U使用者ID 回覆內容',
                },
            ],
        });
        return;
    }

    const [, targetUserId, replyText] = match;

    await client.pushMessage({
        to: targetUserId,
        messages: [{ type: 'text', text: replyText }],
    });

    // 從待處理中移除該用戶的訊息
    for (const [id, msg] of pendingMessages) {
        if (msg.userId === targetUserId) {
            pendingMessages.delete(id);
        }
    }

    // 清除舊的恢復計時器（若真人連續回覆，重新計時）
    if (resumeTimers.has(targetUserId)) {
        clearTimeout(resumeTimers.get(targetUserId));
    }

    // 1 分鐘後若真人沒有再回覆，自動恢復 AI
    const t = setTimeout(() => {
        resumeTimers.delete(targetUserId);
        resumeUser(targetUserId);
        console.log(`🔔 真人 1 分鐘未繼續回覆，AI 已自動恢復服務客人 ${targetUserId}`);
    }, RESUME_DELAY_MS);
    resumeTimers.set(targetUserId, t);

    // 通知管理者回覆成功
    await client.pushMessage({
        to: ADMIN_ID,
        messages: [{ type: 'text', text: `✅ 已回覆客人。\n\n⏱ AI 將在 1 分鐘後自動恢復，若要繼續由您回覆，請在 1 分鐘內再傳訊息。` }],
    });
}

// ── 從 Web 管理後台回覆 ──────────────────────────────────

async function replyToCustomer(userId, message) {
    await client.pushMessage({
        to: userId,
        messages: [{ type: 'text', text: message }],
    });

    // 清除待處理 & 恢復機器人
    for (const [id, msg] of pendingMessages) {
        if (msg.userId === userId) {
            pendingMessages.delete(id);
        }
    }
    resumeUser(userId);
}

// ── 待處理列表 ──────────────────────────────────────────

function getPending() {
    return Array.from(pendingMessages.values()).sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
}

function removePending(id) {
    pendingMessages.delete(id);
}

module.exports = {
    forwardToAdmin,
    handleAdminReply,
    replyToCustomer,
    getPending,
    removePending,
    isUserPaused,
    resumeUser,
    getPausedUsers,
};
