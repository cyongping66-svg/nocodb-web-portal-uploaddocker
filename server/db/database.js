const path = require('path');
const { v4: uuidv4 } = require('uuid');
const SQLiteDatabase = require('better-sqlite3'); // 导入better-sqlite3模块

class DatabaseWrapper {
  constructor() {
    // 使用環境變量指定的路徑，默認為當前目錄
    const dbDir = process.env.DB_PATH || __dirname;
    this.dbPath = path.join(dbDir, 'nocodb.sqlite');
    this.init();
  }

  init() {
    try {
      // better-sqlite3是同步的，直接创建实例
      this.db = new SQLiteDatabase(this.dbPath);
      console.log('Connected to SQLite database');
      this.createTables();
    } catch (err) {
      console.error('Error opening database:', err);
    }
  }

  createTables() {
    try {
      // 創建表格結構表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS tables (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          columns TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // 創建行數據表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS rows (
          id TEXT PRIMARY KEY,
          table_id TEXT NOT NULL,
          data TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (table_id) REFERENCES tables (id) ON DELETE CASCADE
        )
      `);

      // 新增：行順序持久化表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS row_orders (
          table_id TEXT NOT NULL,
          row_id TEXT NOT NULL,
          position INTEGER NOT NULL,
          PRIMARY KEY (table_id, row_id),
          FOREIGN KEY (table_id) REFERENCES tables (id) ON DELETE CASCADE,
          FOREIGN KEY (row_id) REFERENCES rows (id) ON DELETE CASCADE
        )
      `);

      // 新增：表格歷史版本表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS table_history (
          id TEXT PRIMARY KEY,
          table_id TEXT NOT NULL,
          label TEXT,
          source TEXT,
          snapshot TEXT NOT NULL,
          actor TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (table_id) REFERENCES tables (id) ON DELETE CASCADE
        )
      `);

      // 只有在表格創建成功後才插入示例數據
      this.insertSampleData();
    } catch (err) {
      console.error('Error creating tables:', err);
    }
  }

  insertSampleData() {
    try {
      // 檢查是否已有數據
      const result = this.db.prepare("SELECT COUNT(*) as count FROM tables").get();
      
      if (result.count === 0) {
        console.log('Inserting sample data...');
        
        const tableId = 'sample-employees';
        const columns = [
          { id: 'name', name: '姓名', type: 'text' },
          { id: 'department', name: '部門', type: 'select', options: ['研發部', '行銷部', '人資部', '財務部'] },
          { id: 'salary', name: '薪資', type: 'number' },
          { id: 'hired_date', name: '到職日期', type: 'date' },
          { id: 'email', name: '電子郵件', type: 'email' },
          { id: 'phone', name: '聯絡電話', type: 'phone' },
          { id: 'active', name: '在職狀態', type: 'boolean' }
        ];

        // 插入表格定義
        const insertTable = this.db.prepare(
          "INSERT INTO tables (id, name, columns) VALUES (?, ?, ?)"
        );
        insertTable.run(tableId, '員工資料', JSON.stringify(columns));

        // 插入示例行數據
        const sampleRows = [
          {
            id: 'emp1',
            name: '張小明',
            department: '研發部',
            salary: 65000,
            hired_date: '2023-01-15',
            email: 'ming.zhang@company.com',
            phone: '0912-345-678',
            active: true
          },
          {
            id: 'emp2',
            name: '李小華',
            department: '行銷部',
            salary: 58000,
            hired_date: '2023-03-10',
            email: 'hua.li@company.com',
            phone: '0923-456-789',
            active: true
          },
          {
            id: 'emp3',
            name: '王大偉',
            department: '財務部',
            salary: 72000,
            hired_date: '2022-11-20',
            email: 'david.wang@company.com',
            phone: '0934-567-890',
            active: false
          }
        ];

        const insertRow = this.db.prepare(
          "INSERT INTO rows (id, table_id, data) VALUES (?, ?, ?)"
        );
        
        sampleRows.forEach((rowData) => {
          insertRow.run(rowData.id, tableId, JSON.stringify(rowData));
        });

        console.log('Sample data inserted successfully');
      }
    } catch (err) {
      console.error('Error inserting sample data:', err);
    }
  }

  // 獲取所有表格
  getTables(callback) {
    try {
      const tables = this.db.prepare("SELECT * FROM tables ORDER BY created_at").all();
      callback(null, tables);
    } catch (err) {
      callback(err, null);
    }
  }

  // 獲取單個表格
  getTable(tableId, callback) {
    try {
      const table = this.db.prepare("SELECT * FROM tables WHERE id = ?").get(tableId);
      callback(null, table);
    } catch (err) {
      callback(err, null);
    }
  }

  // 創建表格
  createTable(tableData, callback) {
    try {
      const { id, name, columns } = tableData;
      const insert = this.db.prepare(
        "INSERT INTO tables (id, name, columns) VALUES (?, ?, ?)"
      );
      insert.run(id, name, JSON.stringify(columns));
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  // 更新表格
  updateTable(tableData, callback) {
    try {
      const { id, name, columns } = tableData;
      const update = this.db.prepare(
        "UPDATE tables SET name = ?, columns = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      );
      update.run(name, JSON.stringify(columns), id);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  // 刪除表格
  deleteTable(tableId, callback) {
    try {
      const del = this.db.prepare("DELETE FROM tables WHERE id = ?");
      del.run(tableId);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  // 獲取表格的所有行
  getTableRows(tableId, callback) {
    try {
      const rows = this.db
        .prepare(
          `SELECT rows.* , row_orders.position as _position
           FROM rows
           LEFT JOIN row_orders ON row_orders.row_id = rows.id AND row_orders.table_id = rows.table_id
           WHERE rows.table_id = ?
           ORDER BY (row_orders.position IS NULL), row_orders.position ASC, rows.created_at ASC`
        )
        .all(tableId);
      callback(null, rows);
    } catch (err) {
      callback(err, null);
    }
  }

  // 根據行ID獲取單行（新增）
  getRow(rowId, callback) {
    try {
      const row = this.db.prepare("SELECT * FROM rows WHERE id = ?").get(rowId);
      callback(null, row);
    } catch (err) {
      callback(err, null);
    }
  }

  // 創建行
  createRow(tableId, rowData, callback) {
    try {
      const { id, ...data } = rowData;
      const insert = this.db.prepare(
        "INSERT INTO rows (id, table_id, data) VALUES (?, ?, ?)"
      );
      insert.run(id, tableId, JSON.stringify(rowData));
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  // 更新行
  updateRow(rowId, rowData, callback) {
    try {
      const update = this.db.prepare(
        "UPDATE rows SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      );
      update.run(JSON.stringify(rowData), rowId);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  // 刪除行
  deleteRow(rowId, callback) {
    try {
      const del = this.db.prepare("DELETE FROM rows WHERE id = ?");
      del.run(rowId);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  // 關閉數據庫連接
  close() {
    try {
      this.db.close();
      console.log('Database connection closed');
    } catch (err) {
      console.error('Error closing database:', err);
    }
  }

  // 取得指定表的行順序（返回 row_id 陣列）
  getRowOrder(tableId, callback) {
    try {
      const ids = this.db
        .prepare('SELECT row_id FROM row_orders WHERE table_id = ? ORDER BY position ASC')
        .all(tableId)
        .map((r) => r.row_id);
      callback(null, ids);
    } catch (err) {
      callback(err, null);
    }
  }

  // 設定指定表的行順序
  setRowOrder(tableId, orderIds, callback) {
    try {
      const tx = this.db.transaction((ids) => {
        const del = this.db.prepare('DELETE FROM row_orders WHERE table_id = ?');
        del.run(tableId);
        const ins = this.db.prepare(
          'INSERT OR REPLACE INTO row_orders (table_id, row_id, position) VALUES (?, ?, ?)'
        );
        ids.forEach((rowId, idx) => {
          ins.run(tableId, rowId, idx);
        });
      });
      tx(orderIds || []);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  // 新增：生成指定表的快照（表結構 + 行資料 + 行順序）
  getTableSnapshot(tableId, callback) {
    try {
      const table = this.db.prepare('SELECT * FROM tables WHERE id = ?').get(tableId);
      if (!table) return callback(new Error('Table not found'), null);
      const rows = this.db
        .prepare('SELECT * FROM rows WHERE table_id = ? ORDER BY created_at ASC')
        .all(tableId)
        .map((r) => JSON.parse(r.data));
      const orderIds = this.db
        .prepare('SELECT row_id FROM row_orders WHERE table_id = ? ORDER BY position ASC')
        .all(tableId)
        .map((r) => r.row_id);
      const snapshot = {
        id: table.id,
        name: table.name,
        columns: JSON.parse(table.columns || '[]'),
        rows,
        order: orderIds,
      };
      callback(null, snapshot);
    } catch (err) {
      callback(err, null);
    }
  }

  // 新增：新增歷史版本快照
  addHistorySnapshot(tableId, { label, source, actor, snapshot }, callback) {
    try {
      const id = uuidv4();
      const snapStr = typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot);
      const stmt = this.db.prepare(
        'INSERT INTO table_history (id, table_id, label, source, snapshot, actor) VALUES (?, ?, ?, ?, ?, ?)'
      );
      stmt.run(id, tableId, label || null, source || null, snapStr, actor || null);
      const created = this.db
        .prepare('SELECT id, table_id, label, source, actor, created_at FROM table_history WHERE id = ?')
        .get(id);
      callback(null, created);
    } catch (err) {
      callback(err);
    }
  }

  // 新增：取得歷史版本列表
  getHistoryList(tableId, callback) {
    try {
      const list = this.db
        .prepare(
          'SELECT id, table_id, label, source, actor, created_at FROM table_history WHERE table_id = ? ORDER BY created_at DESC'
        )
        .all(tableId);
      callback(null, list);
    } catch (err) {
      callback(err, null);
    }
  }

  // 新增：取得指定歷史版本
  getHistoryEntry(tableId, historyId, callback) {
    try {
      const entry = this.db
        .prepare('SELECT * FROM table_history WHERE table_id = ? AND id = ?')
        .get(tableId, historyId);
      if (!entry) return callback(new Error('History not found'), null);
      entry.snapshot = JSON.parse(entry.snapshot);
      callback(null, entry);
    } catch (err) {
      callback(err, null);
    }
  }

  // 新增：清除指定表的所有歷史
  clearHistory(tableId, callback) {
    try {
      const del = this.db.prepare('DELETE FROM table_history WHERE table_id = ?');
      del.run(tableId);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  // 新增：回溯表到指定快照
  revertTableToSnapshot(tableId, snapshot, callback) {
    try {
      const tx = this.db.transaction(() => {
        // 更新表結構
        const updTable = this.db.prepare(
          'UPDATE tables SET name = ?, columns = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        );
        updTable.run(snapshot.name, JSON.stringify(snapshot.columns || []), tableId);

        // 讀取現有行
        const existingRows = this.db
          .prepare('SELECT id, data FROM rows WHERE table_id = ?')
          .all(tableId)
          .reduce((acc, r) => {
            acc[r.id] = JSON.parse(r.data);
            return acc;
          }, {});

        const desiredRows = (snapshot.rows || []).reduce((acc, r) => {
          acc[r.id] = r;
          return acc;
        }, {});

        const insRow = this.db.prepare('INSERT INTO rows (id, table_id, data) VALUES (?, ?, ?)');
        const updRow = this.db.prepare(
          'UPDATE rows SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        );
        const delRow = this.db.prepare('DELETE FROM rows WHERE id = ?');

        // 刪除不在快照中的行
        Object.keys(existingRows).forEach((rid) => {
          if (!desiredRows[rid]) {
            delRow.run(rid);
          }
        });

        // 新增或更新快照中的行
        Object.keys(desiredRows).forEach((rid) => {
          const payload = JSON.stringify(desiredRows[rid]);
          if (!existingRows[rid]) {
            insRow.run(rid, tableId, payload);
          } else {
            updRow.run(payload, rid);
          }
        });

        // 設定行順序
        const orderIds = (snapshot.order || (snapshot.rows || []).map((r) => r.id));
        const delOrder = this.db.prepare('DELETE FROM row_orders WHERE table_id = ?');
        delOrder.run(tableId);
        const insOrder = this.db.prepare(
          'INSERT OR REPLACE INTO row_orders (table_id, row_id, position) VALUES (?, ?, ?)'
        );
        orderIds.forEach((rid, idx) => insOrder.run(tableId, rid, idx));
      });
      tx();
      callback(null);
    } catch (err) {
      callback(err);
    }
  }
}

module.exports = DatabaseWrapper;
