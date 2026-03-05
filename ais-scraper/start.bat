@echo off
chcp 65001 > nul
echo.
echo ==========================================
echo       AIS 成交行情爬蟲系統 啟動腳本
echo ==========================================
echo.
echo 正在啟動伺服器...請勿關閉此視窗
echo.

:: 啟動 node.js 應用程式
start /b node server.js

:: 等待 2 秒讓伺服器準備好
timeout /t 2 /nobreak > nul

:: 使用系統預設瀏覽器開啟系統首頁
start http://localhost:3000

echo.
echo 系統已成功啟動！
echo 若要關閉系統，請直接關閉本黑色視窗。
echo.

:: 保持視窗開啟以查看 node 伺服器的輸出 log
cmd /k
