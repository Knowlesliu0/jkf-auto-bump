# 使用微軟官方的 Playwright 映像檔作為基底
FROM mcr.microsoft.com/playwright:v1.42.1-jammy

# 設定工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝 Node.js 套件（Playwright 的瀏覽器依賴已經包在基底中）
RUN npm install

# 複製所有程式碼到容器內 (.dockerignore 會略過 .env, node_modules 等)
COPY . .

# 曝露 3000 埠號
EXPOSE 3000

# 啟動應用程式
CMD ["npm", "start"]
