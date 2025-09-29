# 🚀 Docker 鏡像部署指南

## 📋 部署方式說明

這個項目使用 **預構建 Docker 鏡像** 的方式部署，包含兩個鏡像：
- `ddrenn/nocodb-frontend:1.5` - 前端 React 應用
- `ddrenn/nocodb-backend:1.5` - 後端 Node.js API

## 🏗️ 步驟一：本地構建和推送鏡像

在你的開發機器上執行：

```bash
# 運行構建腳本
./build-images.sh
```

這個腳本會：
1. 構建前端和後端 Docker 鏡像
2. 詢問是否推送到 Docker Hub
3. 如果選擇推送，會自動上傳鏡像

## 🚀 步驟二：服務器部署

### 2.1 準備服務器文件

將以下文件上傳到服務器：
- `docker-compose.yml` 
- `deploy-from-images.sh`
- `nginx.conf`（如果有自定義配置）

```bash
# 在服務器上創建項目目錄
mkdir nocodb-web-portal
cd nocodb-web-portal

# 上傳必要文件（docker-compose.yml, deploy-from-images.sh）
```

### 2.2 一鍵部署

```bash
# 設置執行權限
chmod +x deploy-from-images.sh

# 運行部署
./deploy-from-images.sh
```

## 🔧 docker-compose.yml 配置

```yaml
services:
  backend:
    # 修改Docker用户名和镜像版本号（1.5）
    image: ddrenn/nocodb-backend:1.5
    # ... 其他配置

  frontend:
    # 修改Docker用户名和镜像版本号（1.5）
    image: ddrenn/nocodb-frontend:1.5
    # ... 其他配置
```

## 📊 部署後檢查

部署完成後，訪問：
- 🌐 **應用地址**: `http://your-server-ip:8080`
- 🔌 **API 健康檢查**: `http://your-server-ip:8080/api/health`

## 🛠️ 常用管理命令

```bash
# 查看服務狀態
docker-compose ps

# 查看日誌
docker-compose logs
docker-compose logs backend
docker-compose logs frontend

# 重啟服務
docker-compose restart

# 更新到新版本鏡像
docker-compose pull
docker-compose up -d

# 停止服務
docker-compose down
```

## 🔄 更新部署

當你有新版本時：

1. **本地構建新鏡像**（更新版本號）
2. **推送到 Docker Hub**
3. **服務器拉取新鏡像**：
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

## 📁 文件結構

```
服務器部署目錄/
├── docker-compose.yml          # Docker 編排配置
├── deploy-from-images.sh       # 部署腳本
├── data/                       # 數據庫文件（自動創建）
└── nginx.conf                  # nginx 配置（可選）
```

## 🚨 注意事項

1. **鏡像版本**: 確保 docker-compose.yml 中的鏡像版本與你推送的版本一致
2. **網絡端口**: 確保服務器防火牆開放 8080 端口
3. **數據備份**: 定期備份 `./data` 目錄
4. **Docker Hub**: 確保你的 Docker Hub 倉庫是公開的，或者服務器已登錄

## ✅ 優勢

- ✅ **快速部署**: 服務器直接拉取運行，不需要構建
- ✅ **環境一致**: 本地構建的鏡像與生產環境完全一致
- ✅ **安全性高**: 服務器上沒有源代碼
- ✅ **易於管理**: 版本化的鏡像便於回滾和管理
- ✅ **可擴展**: 可以部署到多台服務器
