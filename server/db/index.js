const DB_TYPE = process.env.DB_TYPE || 'sqlite';

console.log(`[DB Factory] Using database driver: ${DB_TYPE}`);

if (DB_TYPE === 'mysql') {
  module.exports = require('./mysql-database');
} else {
  module.exports = require('./database');
}
