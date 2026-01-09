# 后端架构升级与MySQL集成实施方案

本方案旨在将现有的基于SQLite的后端架构升级为基于MySQL 8.0的高性能架构，并实现RESTful API规范化、Swagger文档集成及数据迁移。

## 1. 核心架构设计

### 1.1 前后端分离API接口设计
- **RESTful规范**: 保持现有资源路径结构(`/api/tables`, `/api/rows`)，统一使用HTTP动词(GET, POST, PUT, DELETE)。
- **JSON数据传输**: 维持现有的JSON交互格式，确保前端兼容性。
- **分页查询**: 在`GET /api/tables/:tableId/rows`接口增加`page`和`limit`参数，后端实现基于`LIMIT/OFFSET`的分页逻辑，解决大数据量性能瓶颈。
- **Swagger文档**: 引入`swagger-jsdoc`和`swagger-ui-express`，为所有API端点自动生成在线文档，访问路径为`/api-docs`。

### 1.2 MySQL 8.0 集成方案
- **数据存储模式**: 采用**元数据模式(Meta-Schema)**迁移。将SQLite中的`tables`和`rows`表结构迁移至MySQL，利用MySQL 8.0的JSON字段特性存储动态数据，兼顾灵活性与关系型数据库的强大功能。
- **动态数据源**: 封装`DatabaseManager`类，支持根据配置动态切换数据库连接实例，实现多租户或读写分离的基础设施。
- **连接池优化**: 使用`mysql2`驱动的连接池(`createPool`)，配置合理的`connectionLimit`、`queueLimit`等参数，提升并发处理能力。

### 1.3 环境配置管理
- **多环境支持**: 建立`.env.development`, `.env.test`, `.env.production`配置文件体系。
- **配置项**: 包含`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_CONNECTION_LIMIT`, `DB_CONNECT_TIMEOUT`, `DB_CHARSET`。

### 1.4 数据迁移策略
- **迁移工具**: 开发`server/scripts/migrate.js`脚本。
- **全量/增量模式**: 
    - **全量**: 清空MySQL目标表，从SQLite完整导入。
    - **增量**: 基于`id`主键判断，仅导入MySQL中不存在的记录。
- **数据校验**: 迁移后比对源端和目标端的记录总数(Count Check)。
- **日志记录**: 迁移过程中的成功/失败记录将输出到`migration.log`。

---

## 2. 实施步骤

### 第一阶段：基础设施搭建
1.  **依赖安装**: 安装`mysql2`, `dotenv`, `swagger-jsdoc`, `swagger-ui-express`。
2.  **配置中心**: 创建`server/config/`目录，实现环境配置加载逻辑。
3.  **数据库层重构**: 创建`server/db/mysql-database.js`，实现与现有`DatabaseWrapper`一致的接口，但在内部使用MySQL连接池和SQL语法。

### 第二阶段：API增强与文档
1.  **分页实现**: 修改`getTableRows`方法，接受分页参数并在SQL中应用。
2.  **API适配**: 更新`server/routes/rows.js`以解析前端传递的分页参数。
3.  **文档编写**: 在路由文件中添加JSDoc注释，配置Swagger生成器。

### 第三阶段：数据迁移与验证
1.  **脚本开发**: 编写迁移脚本，实现SQLite到MySQL的数据搬运。
2.  **验证测试**: 
    - 运行迁移脚本。
    - 启动服务器指向MySQL。
    - 使用Postman或前端测试CRUD操作及分页功能。

---

## 3. 关键问题与思考 (Socratic Questioning)

为了确保方案的稳健性，我们需要从以下角度进行审视：

1.  **为什么我们要坚持使用元数据模式（Meta-Schema）而不是为每个"表"创建真实的MySQL表？**
    - *原因*: 现有的前端架构高度依赖动态的JSON结构配置。如果改为为每个用户定义的表格创建真实的物理表，将导致前端逻辑（如列定义解析、动态表单渲染）需要重写，且频繁的DDL操作（修改表结构）在生产环境中风险较高。MySQL 8.0的JSON支持完美契合当前需求。

2.  **引入分页功能后，前端是否做好了适配准备？**
    - *风险*: 如果后端强制分页，而前端仍然期望一次性获取所有数据并在客户端分页，可能会导致数据展示不全。
    - *对策*: 初期API将设置较大的默认`limit`（如1000）或允许`limit=-1`（获取全部）以保持兼容，同时建议前端逐步适配服务端分页。

3.  **数据迁移过程中，如何处理SQLite特有的数据类型与MySQL的差异？**
    - *细节*: SQLite是弱类型，MySQL是强类型。虽然我们主要使用JSON字段，但在`created_at`等时间字段上可能存在格式差异。迁移脚本需包含时间格式化处理，确保符合MySQL的`DATETIME`标准。

---

## 4. 产品经理(PM)视角建议

- **标准化的价值**: 目前的API设计较为随意，引入Swagger和RESTful规范不仅仅是为了文档，更是为了降低后续开发人员（或AI助手）的理解成本，提升团队协作效率。
- **性能与体验的平衡**: 分页是必须的。当数据量超过1000条时，前端渲染和网络传输都会成为瓶颈。作为PM，我会建议在UI上增加"加载更多"或分页器，而不是无限滚动，以提供更明确的用户控制感。
- **安全性**: 将数据库凭证移出代码库进入`.env`是安全合规的基本要求，必须严格执行，且`.env`文件严禁提交到版本控制系统。
