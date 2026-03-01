const { client } = require('./lineClient');
const { v4: uuidv4 } = require('crypto');

const ADMIN_ID = process.env.ADMIN_USER_ID;

// 待處理的人工訊息佇列（記憶體中，重啟會清空）
const pendingMessages = new Map();

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

    // 通知管理者回覆成功
    await client.pushMessage({
        to: ADMIN_ID,
        messages: [{ type: 'text', text: `✅ 已回覆客人` }],
    });
}

// ── 從 Web 管理後台回覆 ──────────────────────────────────

async function replyToCustomer(userId, message) {
    await client.pushMessage({
        to: userId,
        messages: [{ type: 'text', text: message }],
    });

    // 清除待處理
    for (const [id, msg] of pendingMessages) {
        if (msg.userId === userId) {
            pendingMessages.delete(id);
        }
    }
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
};
