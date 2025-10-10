# git config --global http.proxy http://127.0.0.1:git config --global http.proxy http://127.0.0.1:
# 使用 Node.js 20 作為基礎鏡像
FROM node:20-alpine

# 安裝 Python 和 make（用於 node-gyp 構建）
RUN apk add --no-cache python3 make g++

# 設置工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝依賴
RUN npm ci --only=production

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
