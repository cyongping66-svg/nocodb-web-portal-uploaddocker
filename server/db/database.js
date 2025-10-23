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
      const rows = this.db.prepare("SELECT * FROM rows WHERE table_id = ? ORDER BY created_at").all(tableId);
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
}

module.exports = DatabaseWrapper;
