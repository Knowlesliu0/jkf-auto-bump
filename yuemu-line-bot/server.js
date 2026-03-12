require('dotenv').config();
const express = require('express');
const path = require('path');
const { middleware } = require('./src/lineClient');
const { handleWebhook } = require('./src/webhook');

const app = express();
const PORT = process.env.PORT || 3000;

// 靜態檔案：師傅照片
app.use(
    '/assets',
    express.static(path.join(__dirname, 'assets'))
);

// 靜態檔案：管理後台
app.use(
    '/admin',
    express.static(path.join(__dirname, 'admin'))
);

// LINE Webhook
app.post('/webhook', middleware, handleWebhook);

// Health check
app.get('/', (_req, res) => {
    res.json({ status: 'ok', bot: '悅沐 SPA LINE Bot' });
});

// ── Admin API ──────────────────────────────────────────

const { knowledgeBase } = require('./src/knowledgeBase');
const multer = require('multer');

// JSON body parser for admin API
app.use('/api', express.json());

// GET 知識庫
app.get('/api/knowledge/:file', (req, res) => {
    const data = knowledgeBase.get(req.params.file);
    if (!data) return res.status(404).json({ error: 'not found' });
    res.json(data);
});

// PUT 更新知識庫
app.put('/api/knowledge/:file', (req, res) => {
    try {
        knowledgeBase.update(req.params.file, req.body);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 上傳師傅照片
const upload = multer({
    storage: multer.diskStorage({
        destination: path.join(__dirname, 'assets', 'stylists'),
        filename: (_req, file, cb) => {
            const ext = path.extname(file.originalname);
            const name = `${Date.now()}${ext}`;
            cb(null, name);
        },
    }),
});

app.post('/api/upload-photo', upload.single('photo'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'no file' });
    res.json({
        ok: true,
        filename: req.file.filename,
        url: `${process.env.BASE_URL}/assets/stylists/${req.file.filename}`,
    });
});

// 待回覆訊息 API
const { getPending, removePending, getPausedUsers, resumeUser } = require('./src/humanHandoff');

app.get('/api/pending', (_req, res) => {
    res.json(getPending());
});

app.delete('/api/pending/:id', (req, res) => {
    removePending(req.params.id);
    res.json({ ok: true });
});

// 回覆客人 API
const { replyToCustomer } = require('./src/humanHandoff');

app.post('/api/reply', async (req, res) => {
    const { userId, message } = req.body;
    try {
        await replyToCustomer(userId, message);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 暫停中用戶 API
app.get('/api/paused', (_req, res) => {
    res.json(getPausedUsers());
});

app.post('/api/resume/:userId', (req, res) => {
    resumeUser(req.params.userId);
    res.json({ ok: true });
});

app.listen(PORT, () => {
    console.log(`🤖 悅沐 LINE Bot running on port ${PORT}`);
});
