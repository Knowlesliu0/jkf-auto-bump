const fs = require('fs');
const path = require('path');

const KNOWLEDGE_DIR = path.join(__dirname, '..', 'knowledge');

// ── 知識庫快取 ──────────────────────────────────────────

const cache = new Map();
const watchers = new Map();

function loadFile(name) {
    const filePath = path.join(KNOWLEDGE_DIR, `${name}.json`);

    if (!fs.existsSync(filePath)) return null;

    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        cache.set(name, data);
        return data;
    } catch (err) {
        console.error(`知識庫讀取失敗 [${name}]:`, err.message);
        return null;
    }
}

// 初始載入所有 JSON
function init() {
    if (!fs.existsSync(KNOWLEDGE_DIR)) {
        fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
        return;
    }

    const files = fs.readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith('.json'));

    for (const file of files) {
        const name = path.basename(file, '.json');
        loadFile(name);
        watchFile(name);
    }

    console.log(`📚 知識庫已載入: ${files.map((f) => path.basename(f, '.json')).join(', ')}`);
}

// 監視檔案變更 → hot-reload
function watchFile(name) {
    if (watchers.has(name)) return;

    const filePath = path.join(KNOWLEDGE_DIR, `${name}.json`);

    try {
        const watcher = fs.watch(filePath, (eventType) => {
            if (eventType === 'change') {
                console.log(`🔄 知識庫更新: ${name}`);
                loadFile(name);
            }
        });
        watchers.set(name, watcher);
    } catch (err) {
        // file might not exist yet
    }
}

// ── 公開 API ────────────────────────────────────────────

const knowledgeBase = {
    get(name) {
        if (cache.has(name)) return cache.get(name);
        return loadFile(name);
    },

    update(name, data) {
        const filePath = path.join(KNOWLEDGE_DIR, `${name}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        cache.set(name, data);
        watchFile(name);
    },

    list() {
        if (!fs.existsSync(KNOWLEDGE_DIR)) return [];
        return fs
            .readdirSync(KNOWLEDGE_DIR)
            .filter((f) => f.endsWith('.json'))
            .map((f) => path.basename(f, '.json'));
    },
};

// 啟動時初始化
init();

module.exports = { knowledgeBase };
