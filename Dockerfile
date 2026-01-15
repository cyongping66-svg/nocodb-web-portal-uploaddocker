# 多階段構建 - 構建階段
# 使用 Node.js 20 作為基礎鏡像，並命名為 builder 階段
FROM node:20-alpine AS builder

WORKDIR /app

# 升级系統包並修復安全漏洞 (CVE-2026-22184 zlib)
RUN apk update && apk upgrade && apk add --no-cache zlib openssl libxml2

# 1. 先复制 package.json 和 package-lock.json（关键：避免后续覆盖）
COPY package*.json ./

# 2. 安装所有依赖（包括 cookie-parser，需确保 package.json 中已添加）

# 安裝依賴 - 使用npm install替代npm ci以解决依赖同步问题 - 使用npm install替代npm ci以解决依赖同步问题
RUN npm install

# 複製源代碼
COPY . .

# 構建應用程式
RUN npm run build

# 生產階段 - 使用 nginx 提供靜態文件
FROM nginx:alpine

# 升级系統包並修復安全漏洞 (CVE-2026-22184 zlib)
RUN apk update && apk upgrade && apk add --no-cache zlib openssl libxml2

# 複製構建好的文件到 nginx 目錄
COPY --from=builder /app/dist /usr/share/nginx/html

# 複製 nginx 配置文件
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 啟動 nginx
CMD ["nginx", "-g", "daemon off;"]
