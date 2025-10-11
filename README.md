# NoCoDB Web Portal - 数据库界面构建器

一个现代化的 Web 应用，允许用户创建和管理自定义的数据库界面，支持多种数据类型和视图模式。

## ✨ 功能特色

### 核心功能
- **表格管理** - 创建、重命名、删除数据表
- **灵活的列配置** - 支持文本、数字、日期、布尔值、选择、邮箱、电话等数据类型
- **双视图模式** - 网格视图和卡片视图自由切换
- **实时数据编辑** - 内联编辑和表单验证
- **数据导出** - JSON 格式导出功能
- **拖拽排序** - 列和行的拖拽重排

## 🚀 快速开始

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

访问 http://localhost:5000 开始使用

## 📊 数据存储配置

**注意：** 本项目当前强制使用SQLite数据库作为数据连接方式。以下是项目支持的数据存储方式说明：

### 当前首选：SQLite数据库
- **SQLite数据库** - 数据存储在服务器端的SQLite数据库中
- 数据库文件路径：`data/nocodb.sqlite`
- 无需额外配置，开箱即用
- 数据持久化存储在本地文件系统中

### 其他可用存储方式
项目还支持以下存储方式，但当前不建议切换使用：
- **浏览器本地存储 (localStorage)** - 数据保存在浏览器的localStorage中
- **云端存储 (Supabase)** - 数据保存在Supabase云端数据库中

如需启用云端存储功能，请参考 [STORAGE_SETUP.md](./STORAGE_SETUP.md) 详细配置指南。

### 快速切换存储方式

**使用本地存储（默认）：**
- 无需任何配置
- 数据保存在浏览器中

**启用云端存储：**
1. 创建 Supabase 项目
2. 配置环境变量
3. 运行数据库脚本

详细步骤请查看 [STORAGE_SETUP.md](./STORAGE_SETUP.md)

## 存储方式说明（重要）

### 为何选择SQLite作为首选存储
- **本地持久化**：数据存储在本地文件系统中，不会因浏览器缓存清理而丢失
- **无需额外服务**：无需配置外部数据库服务，简化部署流程
- **高性能**：对于中小型数据集，SQLite提供良好的性能
- **稳定性**：成熟的数据库技术，确保数据安全
- **一致性**：统一的存储方案确保所有用户体验一致

### 数据管理
- 数据库文件位于项目根目录的`data`文件夹中
- 备份数据只需复制`nocodb.sqlite`文件
- 支持通过标准SQL工具查看和编辑数据
- 服务器启动时会自动初始化数据库结构和示例数据

### 关于存储方式切换的说明
本项目当前强制使用SQLite数据库存储方案。虽然项目保留了切换至其他存储方式的技术实现，但不建议进行此类切换操作，以确保数据存储的一致性和安全性。如需了解其他存储方式的详细配置，请参阅STORAGE_SETUP.md文件。

## 🛠 技术栈

- **前端框架**: React 19 + TypeScript
- **构建工具**: Vite 6.3.5
- **UI 组件**: Radix UI + Tailwind CSS
- **图标库**: Lucide React
- **数据存储**: Supabase（可选）+ localStorage（默认）
- **状态管理**: React Hooks
- **开发环境**: GitHub Spark Template

## 📁 项目结构

```
src/
├── components/          # UI 组件
│   ├── ui/             # 基础 UI 组件
│   ├── DataTable.tsx   # 数据表格视图
│   ├── CardView.tsx    # 卡片视图
│   └── TableManager.tsx # 表格管理器
├── hooks/              # 自定义 Hooks
│   └── use-tables.ts   # 表格数据管理
├── lib/                # 工具库
│   ├── utils.ts        # 通用工具函数
│   └── supabase.ts     # Supabase 数据服务
├── types.ts            # TypeScript 类型定义
└── App.tsx             # 主应用组件
```

## � 开发指南

### 添加新的列类型
1. 在 `src/types.ts` 中扩展 `Column` 类型
2. 在 `DataTable.tsx` 和 `CardView.tsx` 中添加渲染逻辑
3. 更新列配置界面

### 自定义主题
项目使用 Tailwind CSS，可以在 `tailwind.config.js` 中自定义主题色彩。

### 部署
```bash
npm run build
```

构建产物在 `dist/` 目录中，可部署到任何静态托管服务。

## 📄 许可证

MIT License - 详见 [LICENSE](./LICENSE) 文件

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**当前状态**: ✅ 图标问题已修复，✅ 云端存储已集成
