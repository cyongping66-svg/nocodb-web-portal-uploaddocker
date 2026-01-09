require('dotenv').config();

const env = process.env.NODE_ENV || 'development';

const configs = {
  development: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'nocodb_portal',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
    queueLimit: 0,
    connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '10000'),
    charset: process.env.DB_CHARSET || 'utf8mb4',
    multipleStatements: true // Required for migration scripts
  },
  test: {
    host: process.env.TEST_DB_HOST || 'localhost',
    port: process.env.TEST_DB_PORT || 3306,
    user: process.env.TEST_DB_USER || 'root',
    password: process.env.TEST_DB_PASSWORD || 'password',
    database: process.env.TEST_DB_NAME || 'nocodb_portal_test',
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    multipleStatements: true
  },
  production: {
    host: process.env.PROD_DB_HOST,
    port: process.env.PROD_DB_PORT,
    user: process.env.PROD_DB_USER,
    password: process.env.PROD_DB_PASSWORD,
    database: process.env.PROD_DB_NAME,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '20'),
    queueLimit: 0,
    connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '10000'),
    charset: process.env.DB_CHARSET || 'utf8mb4',
    multipleStatements: false // Safer for production
  }
};

const currentConfig = configs[env];

module.exports = {
  ...currentConfig,
  // Helper to switch config dynamically if needed
  getConfig: (environment) => configs[environment] || configs.development
};
