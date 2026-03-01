const { autoReply } = require('./autoReply');
const { forwardToAdmin, handleAdminReply } = require('./humanHandoff');
const { client } = require('./lineClient');

// 管理者 ID
const ADMIN_ID = process.env.ADMIN_USER_ID;

// ── 關鍵字分類規則 ──────────────────────────────────────

const RULES = [
    {
        // 營業時間
        keywords: ['營業時間', '幾點開', '幾點關', '幾點營業', '開門', '關門', '休息', '上班時間'],
        category: 'business-hours',
    },
    {
        // 地址 / 位置
        keywords: ['地址', '在哪', '怎麼去', '位置', '地點', '路線', '導航'],
        category: 'address',
    },
    {
        // 電話
        keywords: ['電話', '打電話', '聯絡', '手機'],
        category: 'phone',
    },
    {
        // 停車
        keywords: ['停車', '車位', '停車場'],
        category: 'parking',
    },
    {
        // 服務項目 / 價格
        keywords: ['價格', '多少錢', '價位', '收費', '項目', '服務', '菜單', '精油', '按摩', '洗髮', '越式'],
        category: 'services',
    },
    {
        // 師傅照片 / 介紹
        keywords: ['師傅', '照片', '芳療師', '按摩師', '老師', '技師', '看一下'],
        category: 'stylists',
    },
    {
        // 需要人工：預約、有空、指定
        keywords: ['預約', '有空', '排班', '指定', '約', '還有人嗎', '今天有', '明天有', '可以約'],
        category: 'human',
    },
];

function classify(text) {
    const normalized = text.toLowerCase().trim();

    for (const rule of RULES) {
        if (rule.keywords.some((kw) => normalized.includes(kw))) {
            return rule.category;
        }
    }

    return 'unknown';
}

// ── 處理訊息 ────────────────────────────────────────────

async function handleMessage(event) {
    const text = event.message.text;
    const userId = event.source.userId;
    const replyToken = event.replyToken;

    // 如果是管理者發的回覆指令
    if (userId === ADMIN_ID && text.startsWith('@回覆')) {
        return handleAdminReply(text);
    }

    const category = classify(text);

    console.log(`[分類] "${text}" → ${category}`);

    if (category === 'human' || category === 'unknown') {
        // 人工轉接
        const defaultMsg =
            category === 'human'
                ? '好的，我幫您問一下，請稍等！🙏'
                : '收到您的訊息！我請專人為您回覆，請稍等 🙏';

        await client.replyMessage({
            replyToken,
            messages: [{ type: 'text', text: defaultMsg }],
        });

        await forwardToAdmin(event);
    } else {
        // 自動回覆
        const messages = autoReply(category, text);

        await client.replyMessage({
            replyToken,
            messages,
        });
    }
}

module.exports = { handleMessage, classify };
