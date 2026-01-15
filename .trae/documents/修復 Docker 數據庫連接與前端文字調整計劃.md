# Docker 部署修復與前端文字調整方案

## 1. 問題分析
- **數據庫連接錯誤**：`server.js` 目前強制使用 MySQL，但 Docker 環境默認配置為 SQLite（缺少 MySQL 連接資訊），導致啟動失敗。
- **前端文字不符**：
  - `App.tsx` 中顯示「本地存儲 (SQLite)」，您希望修改為「MySQL」。
  - `DataTable.tsx` 中存在簡體中文（如「关联信息」），需要調整為繁體中文。

## 2. 解決方案

### 後端 (Backend)
- **修改 `server/server.js`**：
  - 增加 `DB_TYPE` 環境變量判斷。
  - 當 `DB_TYPE=mysql` 時使用 MySQL；否則默認使用 SQLite。這樣既能支持您的 MySQL 需求，也能防止在未配置 MySQL 時崩潰。

### Docker 配置
- **修改 `docker-compose.yml`**：
  - 添加 `DB_TYPE` 環境變量。
  - **注意**：為了讓您的服務器立刻能跑起來（修復連接錯誤），我會先將其設為兼容模式。若您已準備好 MySQL 數據庫，請在 `docker-compose.yml` 中填入 `PROD_DB_HOST` 等資訊並將 `DB_TYPE` 改為 `mysql`。

### 前端 (Frontend)
- **修改 `src/App.tsx`**：
  - 將「本地存儲 (SQLite)」修改為「數據庫 (MySQL)」。
- **修改 `src/components/DataTable.tsx`**：
  - 將簡體中文提示（关联信息、关联表等）修改為繁體中文（關聯資訊、關聯表格等）。

## 3. 執行步驟
1.  修改 `server/server.js` 增加數據庫切換邏輯。
2.  修改 `docker-compose.yml` 完善環境變量配置。
3.  修改 `src/App.tsx` 更新數據庫顯示文字。
4.  修改 `src/components/DataTable.tsx` 修正繁體中文用語。

請問是否同意執行此計劃？