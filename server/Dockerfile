# 使用 Node.js 20 作為基礎鏡像
FROM node:20-alpine

# 升级系統包並修復安全漏洞 (CVE-2026-22184 zlib)
RUN apk update && apk upgrade && apk add --no-cache zlib python3 make g++

# 設置工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝依賴
RUN npm install --only=production

# 複製應用程式代碼
COPY . .

# 創建數據庫目錄
RUN mkdir -p /app/data

# 暴露端口
EXPOSE 4000

# 設置環境變量
ENV NODE_ENV=production

# 啟動應用程式
CMD ["node", "server.js"]
