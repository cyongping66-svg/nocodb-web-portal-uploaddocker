# Dockerfile 修复与 API Base URL 配置优化方案

## 1. 修复 Dockerfile 问题

### 前端 Dockerfile (`./Dockerfile`)

* **问题**: `EXPOSE 8081` 与 Nginx 配置文件 (`nginx.conf`) 中的 `listen 80` 不匹配。

* **修复**: 将 `EXPOSE 8081` 修改为 `EXPOSE 80`，以匹配 Nginx 的默认行为和 `docker-compose.yml` 中的端口映射 (`8081:80`)。

### 后端 Dockerfile (`server/Dockerfile`)

* **问题**: 文件头部包含乱码注释 (`# git config --global...`)。

* **修复**: 清理头部乱码注释，保持文件整洁。

## 2. 优化 Web 端 API Base URL 配置

### 修改 API 配置代码 (`src/lib/api.ts`)

* **现状**: `const API_BASE_URL = '/api';` 被硬编码。

* **优化**: 修改为 `const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';`。

* **效果**: 优先从环境变量 `VITE_API_BASE_URL` 读取，如果未设置则回退到默认的 `/api`（利用 Nginx/Vite 代理）。

### 新增环境变量文件 (`.env`)

* 在项目根目录创建 `.env` 文件，设置默认值 `VITE_API_BASE_URL=/api`，方便开发者了解可配置项。

***

## 3. 验证计划

1. **代码审查**: 确认 `src/lib/api.ts` 是否正确引用了环境变量。
2. **构建验证**: 重新构建 Docker 镜像以确保 Dockerfile 修复有效（这一步由用户后续在 CI/CD 或本地执行）。
3. **本地运行**: 确保修改后的配置不影响本地 `npm run dev` 运行。

## 4. 苏格拉底式思考

1. **为什么 Nginx 监听 80 而 Dockerfile 暴露 8081 会有问题？**

   * 虽然 `EXPOSE` 主要是文档作用，但不一致会误导运维人员。更重要的是，如果用户尝试直接运行容器并期望它在 8081 响应，却发现它在 80 响应，会造成困惑。

2. **Vite 的环境变量是在什么时候生效的？**

   * 是在**构建时**（Build Time）。这意味着如果要在不同环境使用不同的 API URL，需要为每个环境构建不同的镜像，或者在运行时通过一种特殊机制（如 `window.config`）注入。鉴于当前架构是 Nginx 代理 `/api`，构建时注入默认值 `/api` 是最稳健的做法，保持了与反向代理架构的一致性。

3. **是否需要更新** **`docker-compose.yml`？**

   * 不需要。`docker-compose.yml` 已经正确配置了 `8081:80` 映射，我们的修复正是为了让 Dockerfile 与此配置保持逻辑一致。

