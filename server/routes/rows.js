const express = require('express'); // 导入express模块
const router = express.Router();
const DatabaseWrapper = require('../db/database'); // 使用DatabaseWrapper类
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const db = new DatabaseWrapper(); // 创建DatabaseWrapper实例

// 封裝：修正原始檔名可能的 Latin1 亂碼並做簡單清理
function normalizeOriginalName(name) {
  try {
    // 將可能按 latin1 解碼的字串轉回 utf8
    const utf8 = Buffer.from(String(name || ''), 'latin1').toString('utf8');
    // 清理不可見控制字元與路徑分隔符
    return utf8
      .replace(/[\x00-\x1F\x7F]/g, '')
      .replace(/[\\/:*?"<>|]/g, '-')
      .trim();
  } catch {
    return String(name || '').trim();
  }
}

// 配置 multer 用於文件上傳
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { tableId, rowId } = req.params;
    const uploadDir = path.join(__dirname, '..', 'uploads', tableId, rowId);
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const originalName = normalizeOriginalName(file.originalname);
    cb(null, uniqueSuffix + '-' + originalName);
  }
});

const upload = multer({ storage });

// 獲取表格的所有行
router.get('/:tableId/rows', (req, res) => {
  const { tableId } = req.params;

  db.getTableRows(tableId, (err, rows) => {
    if (err) {
      console.error('Error getting rows:', err);
      return res.status(500).json({ error: 'Failed to get rows' });
    }

    // 解析數據
    const parsedRows = rows.map(row => {
      const data = JSON.parse(row.data);
      return {
        id: row.id,
        ...data,
        _createdAt: row.created_at,
        _updatedAt: row.updated_at
      };
    });

    res.json(parsedRows);
  });
});

// 新增：獲取指定表的行順序（row_id 陣列）
router.get('/:tableId/rows/order', (req, res) => {
  const { tableId } = req.params;
  db.getRowOrder(tableId, (err, orderIds) => {
    if (err) {
      console.error('Error getting row order:', err);
      return res.status(500).json({ error: 'Failed to get row order' });
    }
    res.json({ orderIds });
  });
});

// 新增：更新指定表的行順序
router.put('/:tableId/rows/order', (req, res) => {
  const { tableId } = req.params;
  const { orderIds } = req.body || {};

  if (!Array.isArray(orderIds)) {
    return res.status(400).json({ error: 'orderIds must be an array' });
  }

  try {
    db.setRowOrder(tableId, orderIds, (err) => {
      if (err) {
        console.error('Error setting row order:', err);
        return res.status(500).json({ error: 'Failed to set row order' });
      }
      res.json({ message: 'Row order saved' });
    });
  } catch (e) {
    console.error('Error setting row order:', e);
    res.status(500).json({ error: 'Failed to set row order' });
  }
});

// 創建新行
router.post('/:tableId/rows', (req, res) => {
  const { tableId } = req.params;
  const rowData = req.body;

  // 生成新的行 ID
  const id = uuidv4();

  // 設置表格 ID 和行 ID
  rowData.table_id = tableId;
  rowData.id = id;

  // 保存數據
  db.createRow(tableId, rowData, (err) => {
    if (err) {
      console.error('Error creating row:', err);
      return res.status(500).json({ error: 'Failed to create row' });
    }

    res.status(201).json({ message: 'Row created successfully', row: rowData });
  });
});

// 更新行
router.put('/:tableId/rows/:rowId', (req, res) => {
  const { rowId } = req.params;
  const rowData = req.body;

  // 確保 ID 一致
  rowData.id = rowId;

  db.updateRow(rowId, rowData, (err) => {
    if (err) {
      console.error('Error updating row:', err);
      return res.status(500).json({ error: 'Failed to update row' });
    }

    res.json({ message: 'Row updated successfully' });
  });
});

// 刪除行
router.delete('/:tableId/rows/:rowId', (req, res) => {
  const { rowId } = req.params;

  db.deleteRow(rowId, (err) => {
    if (err) {
      console.error('Error deleting row:', err);
      return res.status(500).json({ error: 'Failed to delete row' });
    }

    res.json({ message: 'Row deleted successfully' });
  });
});

// 檔案上傳並更新指定列的數據
router.post('/:tableId/rows/:rowId/files/:columnId', upload.single('file'), (req, res) => {
  const { tableId, rowId, columnId } = req.params;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // 構造可訪問的文件 URL（通過 /api/uploads 提供靜態訪問）
  const encodedFileName = encodeURIComponent(file.filename);
  const fileUrl = `/api/uploads/${tableId}/${rowId}/${encodedFileName}`;

  // 讀取當前行數據，合併文件欄位
  db.getRow(rowId, (err, row) => {
    if (err) {
      console.error('Error getting row:', err);
      return res.status(500).json({ error: 'Failed to get row' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Row not found' });
    }

    const data = JSON.parse(row.data || '{}');
    const fixedOriginalName = normalizeOriginalName(file.originalname);
    data[columnId] = {
      name: fixedOriginalName,
      size: file.size,
      type: file.mimetype,
      url: fileUrl,
      path: file.path
    };

    db.updateRow(rowId, { id: rowId, ...data }, (updateErr) => {
      if (updateErr) {
        console.error('Error updating row with file:', updateErr);
        return res.status(500).json({ error: 'Failed to update row with file' });
      }

      res.json({
        message: 'File uploaded and row updated successfully',
        file: {
          name: fixedOriginalName,
          size: file.size,
          type: file.mimetype,
          url: fileUrl
        }
      });
    });
  });
});

// 刪除指定列的附件
router.delete('/:tableId/rows/:rowId/files/:columnId', (req, res) => {
  const { tableId, rowId, columnId } = req.params;

  // 讀取當前行資料
  db.getRow(rowId, (err, row) => {
    if (err) {
      console.error('Error getting row:', err);
      return res.status(500).json({ error: 'Failed to get row' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Row not found' });
    }

    const data = JSON.parse(row.data || '{}');
    const fileInfo = data[columnId];

    // 如果有實際文件存在，嘗試刪除
    if (fileInfo && fileInfo.path) {
      try { fs.unlinkSync(fileInfo.path); } catch (e) { /* 忽略文件不存在 */ }
    }

    // 移除欄位中的附件資料
    delete data[columnId];

    db.updateRow(rowId, { id: rowId, ...data }, (updateErr) => {
      if (updateErr) {
        console.error('Error deleting file from row:', updateErr);
        return res.status(500).json({ error: 'Failed to delete file from row' });
      }

      res.json({ message: 'File deleted and row updated successfully' });
    });
  });
});

// 批量操作：支持創建、刪除、更新
router.post('/:tableId/rows/batch', (req, res) => {
  const { tableId } = req.params;
  const { operation, operations } = req.body || {};

  if (!Array.isArray(operations)) {
    return res.status(400).json({ error: 'Invalid operations payload' });
  }

  switch (operation) {
    case 'create': {
      const tx = db.db.transaction(() => {
        operations.forEach((op) => {
          const id = uuidv4();
          const data = { id, table_id: tableId, ...(op.data || {}) };
          db.createRow(tableId, data, () => {});
        });
      });
      try {
        tx();
        res.json({ message: `${operations.length} rows created successfully` });
      } catch (err) {
        console.error('Error in batch create:', err);
        res.status(500).json({ error: 'Failed to create rows' });
      }
      break;
    }

    case 'delete': {
      const tx = db.db.transaction(() => {
        operations.forEach((op) => {
          const { id } = op;
          db.deleteRow(id, () => {});
        });
      });
      try {
        tx();
        res.json({ message: `${operations.length} rows deleted successfully` });
      } catch (err) {
        console.error('Error in batch delete:', err);
        res.status(500).json({ error: 'Failed to delete rows' });
      }
      break;
    }

    case 'update': {
      const tx = db.db.transaction(() => {
        operations.forEach((op) => {
          const { id, data } = op;
          db.updateRow(id, { id, ...(data || {}) }, () => {});
        });
      });
      try {
        tx();
        res.json({ message: `${operations.length} rows updated successfully` });
      } catch (err) {
        console.error('Error in batch update:', err);
        res.status(500).json({ error: 'Failed to update rows' });
      }
      break;
    }

    default:
      res.status(400).json({ error: 'Invalid operation. Supported: create, delete, update' });
  }
});

module.exports = router;
