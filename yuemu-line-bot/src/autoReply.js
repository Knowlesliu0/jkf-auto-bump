const { knowledgeBase } = require('./knowledgeBase');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ── 回覆組裝 ────────────────────────────────────────────

function autoReply(category, _text) {
    switch (category) {
        case 'business-hours':
            return replyBusinessHours();
        case 'address':
            return replyAddress();
        case 'phone':
            return replyPhone();
        case 'parking':
            return replyParking();
        case 'services':
            return replyServices();
        case 'stylists':
            return replyStylistPhotos();
        default:
            return [{ type: 'text', text: '請稍等，專人為您服務 🙏' }];
    }
}

// ── 營業時間 ─────────────────────────────────────────────

function replyBusinessHours() {
    const info = knowledgeBase.get('business-info');
    if (!info) return [{ type: 'text', text: '營業資訊更新中，請稍後再詢問 🙏' }];

    const hours = info.businessHours;
    return [
        {
            type: 'text',
            text:
                `🕐 ${info.name} 營業時間\n\n` +
                `平日：${hours.weekday}\n` +
                `假日：${hours.weekend}\n\n` +
                `📍 ${info.address}\n` +
                `📞 ${info.phone}`,
        },
    ];
}

// ── 地址 ────────────────────────────────────────────────

function replyAddress() {
    const info = knowledgeBase.get('business-info');
    if (!info) return [{ type: 'text', text: '地址資訊更新中 🙏' }];

    return [
        {
            type: 'text',
            text: `📍 ${info.name}\n地址：${info.address}\n\n歡迎光臨！`,
        },
    ];
}

// ── 電話 ────────────────────────────────────────────────

function replyPhone() {
    const info = knowledgeBase.get('business-info');
    if (!info) return [{ type: 'text', text: '聯絡資訊更新中 🙏' }];

    return [
        {
            type: 'text',
            text: `📞 ${info.name}\n電話：${info.phone}\nLINE：${info.lineId || '就是這裡唷 😊'}`,
        },
    ];
}

// ── 停車 ────────────────────────────────────────────────

function replyParking() {
    const info = knowledgeBase.get('business-info');
    if (!info) return [{ type: 'text', text: '停車資訊更新中 🙏' }];

    return [
        {
            type: 'text',
            text: `🅿️ 停車資訊\n${info.parking || '請詢問店家'}`,
        },
    ];
}

// ── 服務項目 ─────────────────────────────────────────────

function replyServices() {
    const services = knowledgeBase.get('services');
    if (!services || !services.length) {
        return [{ type: 'text', text: '服務項目更新中，請稍後再詢問 🙏' }];
    }

    let text = '✨ 我們的服務項目\n\n';
    services.forEach((s) => {
        text += `💆 ${s.name}\n`;
        text += `   ⏱ ${s.duration}\n`;
        text += `   💰 ${s.price}\n`;
        if (s.description) text += `   ${s.description}\n`;
        text += '\n';
    });
    text += '歡迎預約體驗！';

    return [{ type: 'text', text }];
}

// ── 師傅照片（Image Carousel）────────────────────────────

function replyStylistPhotos() {
    const stylists = knowledgeBase.get('stylists');
    if (!stylists || !stylists.length) {
        return [{ type: 'text', text: '師傅資訊更新中 🙏' }];
    }

    const availableStylists = stylists.filter((s) => s.available !== false);

    if (!availableStylists.length) {
        return [{ type: 'text', text: '目前沒有可服務的師傅，請稍後再詢問 🙏' }];
    }

    // 用 Flex Message 做圖片輪播
    const bubbles = availableStylists.map((s) => ({
        type: 'bubble',
        size: 'kilo',
        hero: {
            type: 'image',
            url: `${BASE_URL}/assets/stylists/${s.photo}`,
            size: 'full',
            aspectRatio: '3:4',
            aspectMode: 'cover',
        },
        body: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'text',
                    text: s.name,
                    weight: 'bold',
                    size: 'lg',
                    align: 'center',
                },
                {
                    type: 'text',
                    text: s.specialty || '',
                    size: 'sm',
                    color: '#888888',
                    align: 'center',
                    margin: 'sm',
                },
                {
                    type: 'text',
                    text: s.description || '',
                    size: 'xs',
                    color: '#aaaaaa',
                    align: 'center',
                    margin: 'sm',
                    wrap: true,
                },
            ],
        },
        footer: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'button',
                    action: {
                        type: 'message',
                        label: `預約 ${s.name}`,
                        text: `我想預約 ${s.name}`,
                    },
                    style: 'primary',
                    color: '#7c6a5b',
                },
            ],
        },
    }));

    return [
        {
            type: 'text',
            text: '💆 以下是我們的師傅，請參考：',
        },
        {
            type: 'flex',
            altText: '師傅介紹',
            contents: {
                type: 'carousel',
                contents: bubbles,
            },
        },
    ];
}

module.exports = { autoReply };
