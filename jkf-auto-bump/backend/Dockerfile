FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install
RUN npx playwright install chromium --with-deps

COPY . .

EXPOSE 3001

CMD ["node", "src/index.js"]
