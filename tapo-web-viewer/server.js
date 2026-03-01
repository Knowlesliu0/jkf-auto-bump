require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');
const Stream = require('node-rtsp-stream');

const PORT = process.env.PORT || 3000;
const RTSP_URL = process.env.RTSP_URL;

if (!RTSP_URL || RTSP_URL.includes('[username]')) {
    console.error('請先在 .env 檔案中設定正確的 RTSP_URL！');
    process.exit(1);
}

// 提供靜態網頁檔案
app.use(express.static(path.join(__dirname, 'public')));

// 啟動 Express 伺服器
const server = app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});

// 設定 RTSP 轉 WebSocket
stream = new Stream({
    name: 'tapo-stream',
    streamUrl: RTSP_URL.replace('stream1', 'stream2'), // 強制使用子串流 (較穩定、低延遲)
    wsPort: 9999,
    ffmpegOptions: { // 選用的 FFmpeg 參數
        '-rtsp_transport': 'tcp',
        '-stats': '',
        '-r': 15, // 子串流降低幀率
        '-q:v': 5, // 降低品質要求以求順暢
        '-preset': 'ultrafast' // 加快轉檔速度
    }
});

console.log('WebSocket 影像串流伺服器已啟動於 ws://localhost:9999');
