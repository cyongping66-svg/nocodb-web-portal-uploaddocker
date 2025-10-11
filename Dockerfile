# 多階段構建 - 構建階段
# 使用 Node.js 20 作為基礎鏡像，並命名為 builder 階段
FROM node:20-alpine AS builder

WORKDIR /app

# 升级 openssl 到 3.5.4 版本和 libxml2 到 2.13.9 版本
RUN apk update && apk upgrade openssl=3.5.4-r0 libxml2=2.13.9-r0

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝依賴
RUN npm ci

# 複製源代碼
COPY . .

# 構建應用程式
RUN npm run build

# 生產階段 - 使用 nginx 提供靜態文件
FROM nginx:alpine

# 升级 openssl 到 3.5.4 版本和 libxml2 到 2.13.9 版本
RUN apk update && apk upgrade openssl=3.5.4-r0 libxml2=2.13.9-r0

# 複製構建好的文件到 nginx 目錄
COPY --from=builder /app/dist /usr/share/nginx/html

# 複製 nginx 配置文件
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 8081

# 啟動 nginx
CMD ["nginx", "-g", "daemon off;"]
