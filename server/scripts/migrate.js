const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const dbConfig = require('../config/db.config');

const args = process.argv.slice(2);
const isFullMigration = args.includes('--full');

async function migrate() {
  console.log('Starting migration...');
  console.log(`Mode: ${isFullMigration ? 'FULL (Truncate Destination)' : 'INCREMENTAL'}`);

  // Source: SQLite
  const sqlitePath = process.env.DB_PATH 
    ? path.join(process.env.DB_PATH, 'nocodb.sqlite')
    : path.join(__dirname, '../db/nocodb.sqlite');

  if (!fs.existsSync(sqlitePath)) {
    console.error(`SQLite database not found at ${sqlitePath}`);
    process.exit(1);
  }

  const sqlite = new Database(sqlitePath);
  console.log('Connected to SQLite source.');

  // Target: MySQL
  const mysqlPool = mysql.createPool(dbConfig);
  const mysqlConn = await mysqlPool.getConnection();
  console.log('Connected to MySQL target.');

  try {
    // 1. Tables
    console.log('Migrating Tables...');
    if (isFullMigration) {
      await mysqlConn.query('DELETE FROM row_orders');
      await mysqlConn.query('DELETE FROM `rows`'); // Delete rows first due to FK
      await mysqlConn.query('DELETE FROM tables');
    }

    const tables = sqlite.prepare('SELECT * FROM tables').all();
    for (const table of tables) {
      const exists = await mysqlConn.query('SELECT id FROM tables WHERE id = ?', [table.id]);
      if (exists[0].length === 0) {
        await mysqlConn.query(
          'INSERT INTO tables (id, name, columns, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [table.id, table.name, table.columns, table.created_at, table.updated_at]
        );
        process.stdout.write('.');
      } else if (isFullMigration) {
         // Should have been deleted, but just in case or for update logic
      }
    }
    console.log(`\nMigrated ${tables.length} tables.`);

    // 2. Rows
    console.log('Migrating Rows...');
    const rows = sqlite.prepare('SELECT * FROM rows').all();
    let rowCount = 0;
    for (const row of rows) {
      const exists = await mysqlConn.query('SELECT id FROM `rows` WHERE id = ?', [row.id]);
      if (exists[0].length === 0) {
        await mysqlConn.query(
          'INSERT INTO `rows` (id, table_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [row.id, row.table_id, row.data, row.created_at, row.updated_at]
        );
        rowCount++;
        if (rowCount % 100 === 0) process.stdout.write('.');
      }
    }
    console.log(`\nMigrated ${rowCount} rows.`);

    // 3. Row Orders
    console.log('Migrating Row Orders...');
    const orders = sqlite.prepare('SELECT * FROM row_orders').all();
    for (const order of orders) {
       // Check if exists? PK is (table_id, row_id)
       const [exists] = await mysqlConn.query('SELECT 1 FROM row_orders WHERE table_id = ? AND row_id = ?', [order.table_id, order.row_id]);
       if (exists.length === 0) {
         await mysqlConn.query(
           'INSERT INTO row_orders (table_id, row_id, position) VALUES (?, ?, ?)',
           [order.table_id, order.row_id, order.position]
         );
       }
    }
    console.log(`\nMigrated ${orders.length} row orders.`);
    
    // 4. Table History
    console.log('Migrating Table History...');
    try {
        const history = sqlite.prepare('SELECT * FROM table_history').all();
        for (const h of history) {
            const [exists] = await mysqlConn.query('SELECT id FROM table_history WHERE id = ?', [h.id]);
            if (exists.length === 0) {
                await mysqlConn.query(
                    'INSERT INTO table_history (id, table_id, label, source, snapshot, actor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [h.id, h.table_id, h.label, h.source, h.snapshot, h.actor, h.created_at]
                );
            }
        }
        console.log(`\nMigrated ${history.length} history entries.`);
    } catch (e) {
        console.warn('Skipping history migration (table might not exist in source or target):', e.message);
    }

    // 5. User Settings
    console.log('Migrating User Settings...');
    try {
        const settings = sqlite.prepare('SELECT * FROM user_settings').all();
        for (const s of settings) {
             // Upsert
             const sql = `
                INSERT INTO user_settings (id, username, role, permissions, updated_at) 
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE role = VALUES(role), permissions = VALUES(permissions), updated_at = VALUES(updated_at)
             `;
             await mysqlConn.query(sql, [s.id, s.username, s.role, s.permissions, s.updated_at]);
        }
        console.log(`\nMigrated ${settings.length} user settings.`);
    } catch (e) {
        console.warn('Skipping user settings migration:', e.message);
    }

    console.log('Migration completed successfully.');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    sqlite.close();
    mysqlConn.release();
    mysqlPool.end();
  }
}

migrate();
