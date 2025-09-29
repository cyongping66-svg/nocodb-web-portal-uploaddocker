const express = require('express'); // 导入express模块
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const DatabaseWrapper = require('./db/database'); // 使用DatabaseWrapper类

const app = express();
const port = process.env.PORT || 8000; // 使用8000端口，避免端口冲突

// 初始化數據庫
const db = new DatabaseWrapper();

// 中間件
app.use(helmet());
app.use(morgan('combined'));
app.use(cors());
app.use(express.json());

// API 路由
app.use('/api/tables', require('./routes/tables'));
app.use('/api/tables', require('./routes/rows'));

// 健康檢查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 錯誤處理中間件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 處理
app.use((req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/api/health`);
});

module.exports = app;
