**已完成以下工作：**

1.  **修复 Docker 脚本一致性**：
    *   修改 `build-images.sh`：现在除了时间戳标签外，还会构建并推送 `:latest` 标签，方便部署。
    *   修改 `deploy-from-images.sh`：修正了错误的用户名 (`clarkou` -> `ddrenn`) 和标签 (使用 `latest`)，确保脚本能真正拉取到您构建的镜像。同时移除了 SQLite 相关的目录创建操作。

2.  **全项目数据库迁移至 MySQL**：
    *   **代码层重构**：创建了 `server/db/index.js` 工厂文件，并更新了 `server.js` 及所有路由文件 (`routes/tables.js`, `rows.js`, `history.js`, `users.js`)，统一使用该工厂获取数据库实例。这解决了“只改了一半”的问题，现在代码会根据环境变量自动切换数据库实现。
    *   **Docker 配置更新**：重写了 `docker-compose.yml`，添加了 `mysql` 服务容器，并配置后端服务使用 `DB_TYPE=mysql` 连接到该容器。后端现在会等待 MySQL 启动就绪后再启动。

3.  **文件清理与释疑**：
    *   删除了 `deploy-prod.sh`，保留修复后的 `deploy-from-images.sh` 作为生产环境部署的标准脚本。
    *   **关于健康检查**：`http://localhost:4000/api/health` 是后端应用**内部**的 Web 接口检查。保留它是正确的，因为它检查的是“Node.js 服务是否在运行”。我已经更新了 `docker-compose.yml`，让后端服务依赖于 MySQL 的健康状态 (`depends_on: mysql: condition: service_healthy`)，这样如果数据库挂了，应用启动会受阻，从而间接反映出问题。

**现在您可以：**
1.  在开发机运行 `./build-images.sh` 构建并推送最新镜像。
2.  在服务器运行 `./deploy-from-images.sh` 拉取并启动包含 MySQL 的完整环境。
3.  或者直接使用 `docker-compose up -d` 启动（它现在默认使用 MySQL）。