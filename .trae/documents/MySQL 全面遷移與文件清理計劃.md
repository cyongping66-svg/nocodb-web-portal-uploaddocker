# MySQL 全面遷移與文件清理計劃

## 1. 核心變更
- **Docker 配置重構 (`docker-compose.yml`)**：
  - **刪除** 所有 SQLite 相關配置（`DB_PATH`, `volumes` 掛載 `data` 目錄）。
  - **強制** 設置 `DB_TYPE=mysql`。
  - **新增** MySQL 必填環境變量（`PROD_DB_HOST` 等），確保連接到您的外部 MySQL 服務。
  - **說明**：不再提供本地 SQLite 回退，強制使用 MySQL。

- **部署腳本更新 (`deploy-from-images.sh`)**：
  - 移除創建 `data` 目錄的步驟（因不再需要）。
  - 更新日誌與提示信息，反映 MySQL 架構。

## 2. 文件清理指引
遷移完成後，您需要處理服務器上的現有文件。
- **`data/` 目錄**：這是舊的 SQLite 數據存儲位置。
  - **操作**：備份後刪除。
  - **指令**：`rm -rf data`
- **`deploy-from-images.sh`**：我將更新此腳本，更新後請使用新版腳本。
- **`docker-compose.yml`**：我將更新此文件，更新後請使用新版文件。
- **`nginx.conf`**：保留不變（前端配置）。

## 3. 執行步驟
1.  **修改 `docker-compose.yml`**：
    - 移除 SQLite 卷掛載。
    - 添加 MySQL 變量佔位符。
2.  **修改 `deploy-from-images.sh`**：
    - 移除 `mkdir -p data`。
    - 更新提示文字。
3.  **確認環境變量**：
    - 您需要在服務器上設置 MySQL 連接信息（Host, User, Password, DB Name），或直接填入 `docker-compose.yml`（不推薦用於生產，但方便測試）。我會將其設為環境變量注入模式。

請問是否同意執行此計劃？