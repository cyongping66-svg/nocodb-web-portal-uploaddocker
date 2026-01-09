require('dotenv').config(); // Load environment variables
const express = require('express'); // 导入express模块
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const DatabaseWrapper = require('./db/mysql-database'); // Switch to MySQL Adapter
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');

const app = express();
const port = process.env.PORT || 8000; // 使用8000端口，避免端口冲突

// 初始化數據庫 (Initialize MySQL Pool)
const db = new DatabaseWrapper();

// 中間件
app.use(helmet());
app.use(morgan('combined'));
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// 提供上傳文件的靜態訪問
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// API 路由
app.use('/api/tables', require('./routes/tables'));
app.use('/api/tables', require('./routes/rows'));
app.use('/api/tables', require('./routes/history'));
app.use('/api/users', require('./routes/users'));
app.use('/api/auth', require('./routes/auth'));

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
  console.log(`Swagger Docs: http://localhost:${port}/api-docs`);
});

module.exports = app;
