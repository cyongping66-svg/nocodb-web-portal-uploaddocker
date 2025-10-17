const express = require('express'); // 导入express模块
const router = express.Router();
const DatabaseWrapper = require('../db/database'); // 使用DatabaseWrapper类
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const db = new DatabaseWrapper(); // 创建DatabaseWrapper实例

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
    cb(null, uniqueSuffix + '-' + file.originalname);
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

// 創建新行
router.post('/:tableId/rows', (req, res) => {
  const { tableId } = req.params;
  const rowData = req.body;

  if (!rowData.id) {
    rowData.id = uuidv4();
  }

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
  const fileUrl = `/api/uploads/${tableId}/${rowId}/${file.filename}`;

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
    data[columnId] = {
      name: file.originalname,
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
          name: file.originalname,
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

    // 嘗試刪除磁碟檔案（若存在路徑）
    if (fileInfo && fileInfo.path) {
      fs.unlink(fileInfo.path, (unlinkErr) => {
        if (unlinkErr) {
          console.warn('Warning: failed to remove file:', fileInfo.path, unlinkErr);
        }
      });
    }

    // 清空欄位中的附件資訊
    data[columnId] = null;

    db.updateRow(rowId, { id: rowId, ...data }, (updateErr) => {
      if (updateErr) {
        console.error('Error clearing file from row:', updateErr);
        return res.status(500).json({ error: 'Failed to clear file from row' });
      }

      res.json({ message: 'File removed successfully' });
    });
  });
});

// 批量操作
router.post('/:tableId/rows/batch', (req, res) => {
  const { tableId } = req.params;
  const { operation, rows, rowIds } = req.body;

  switch (operation) {
    case 'create':
      // 批量創建
      const promises = rows.map(rowData => {
        return new Promise((resolve, reject) => {
          if (!rowData.id) {
            rowData.id = uuidv4();
          }
          db.createRow(tableId, rowData, (err) => {
            if (err) reject(err);
            else resolve(rowData);
          });
        });
      });

      Promise.all(promises)
        .then(results => {
          res.status(201).json({ message: 'Rows created successfully', rows: results });
        })
        .catch(err => {
          console.error('Error in batch create:', err);
          res.status(500).json({ error: 'Failed to create rows' });
        });
      break;

    case 'delete':
      // 批量刪除
      if (!rowIds || !Array.isArray(rowIds)) {
        return res.status(400).json({ error: 'rowIds array is required for delete operation' });
      }

      const deletePromises = rowIds.map(rowId => {
        return new Promise((resolve, reject) => {
          db.deleteRow(rowId, (err) => {
            if (err) reject(err);
            else resolve(rowId);
          });
        });
      });

      Promise.all(deletePromises)
        .then(() => {
          res.json({ message: `${rowIds.length} rows deleted successfully` });
        })
        .catch(err => {
          console.error('Error in batch delete:', err);
          res.status(500).json({ error: 'Failed to delete rows' });
        });
      break;

    default:
      res.status(400).json({ error: 'Invalid operation. Supported: create, delete' });
  }
});

module.exports = router;
