const DB_TYPE = 'mysql';

console.log(`[DB Factory] Using database driver: ${DB_TYPE}`);

module.exports = require('./mysql-database');
