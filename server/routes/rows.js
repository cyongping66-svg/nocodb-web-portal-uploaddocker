const express = require('express');
const router = express.Router();
// Use DB Factory
const DatabaseWrapper = require('../db'); 
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const db = new DatabaseWrapper();

/**
 * @swagger
 * components:
 *   schemas:
 *     Row:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         table_id:
 *           type: string
 *           format: uuid
 *         data:
 *           type: object
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

function normalizeOriginalName(name) {
  try {
    const utf8 = Buffer.from(String(name || ''), 'latin1').toString('utf8');
    return utf8
      .replace(/[\x00-\x1F\x7F]/g, '')
      .replace(/[\\/:*?"<>|]/g, '-')
      .trim();
  } catch {
    return String(name || '').trim();
  }
}

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

/**
 * @swagger
 * /tables/{tableId}/rows:
 *   get:
 *     summary: Get rows for a table
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 1000
 *     responses:
 *       200:
 *         description: List of rows
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Row'
 */
router.get('/:tableId/rows', (req, res) => {
  const { tableId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 1000;

  db.getTableRows(tableId, { page, limit }, (err, rows) => {
    if (err) {
      console.error('Error getting rows:', err);
      return res.status(500).json({ error: 'Failed to get rows' });
    }

    const parsedRows = rows.map(row => {
      // MySQL adapter already handles JSON parsing/stringifying consistency?
      // Our MySQL adapter returns 'data' as string (for compat) or object?
      // Check mysql-database.js: getTableRows returns `data: typeof r.data === 'string' ? r.data : JSON.stringify(r.data)`
      // So here row.data IS A STRING.
      const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      return {
        id: row.id,
        ...data,
        _createdAt: row.created_at,
        _updatedAt: row.updated_at,
        _position: row._position // Keep position info
      };
    });

    res.json(parsedRows);
  });
});

/**
 * @swagger
 * /tables/{tableId}/rows/order:
 *   get:
 *     summary: Get row order
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of row IDs in order
 */
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

/**
 * @swagger
 * /tables/{tableId}/rows/order:
 *   put:
 *     summary: Update row order
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Order saved
 */
router.put('/:tableId/rows/order', (req, res) => {
  const { tableId } = req.params;
  const { orderIds } = req.body || {};

  if (!Array.isArray(orderIds)) {
    return res.status(400).json({ error: 'orderIds must be an array' });
  }

  db.setRowOrder(tableId, orderIds, (err) => {
    if (err) {
      console.error('Error setting row order:', err);
      return res.status(500).json({ error: 'Failed to set row order' });
    }
    res.json({ message: 'Row order saved' });
  });
});

/**
 * @swagger
 * /tables/{tableId}/rows:
 *   post:
 *     summary: Create a new row
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Row created
 */
router.post('/:tableId/rows', (req, res) => {
  const { tableId } = req.params;
  const rowData = req.body;
  const id = uuidv4();
  rowData.table_id = tableId;
  rowData.id = id;

  db.createRow(tableId, rowData, (err) => {
    if (err) {
      console.error('Error creating row:', err);
      return res.status(500).json({ error: 'Failed to create row' });
    }
    res.status(201).json({ message: 'Row created successfully', row: rowData });
  });
});

/**
 * @swagger
 * /tables/{tableId}/rows/{rowId}:
 *   put:
 *     summary: Update a row
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: rowId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Row updated
 */
router.put('/:tableId/rows/:rowId', (req, res) => {
  const { rowId } = req.params;
  const rowData = req.body;
  rowData.id = rowId;

  db.updateRow(rowId, rowData, (err) => {
    if (err) {
      console.error('Error updating row:', err);
      return res.status(500).json({ error: 'Failed to update row' });
    }
    res.json({ message: 'Row updated successfully' });
  });
});

/**
 * @swagger
 * /tables/{tableId}/rows/{rowId}:
 *   delete:
 *     summary: Delete a row
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: rowId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Row deleted
 */
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

// File upload endpoints (Simplified swagger for brevity)
router.post('/:tableId/rows/:rowId/files/:columnId', upload.single('file'), (req, res) => {
  const { tableId, rowId, columnId } = req.params;
  const file = req.file;

  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  const encodedFileName = encodeURIComponent(file.filename);
  const fileUrl = `/api/uploads/${tableId}/${rowId}/${encodedFileName}`;

  db.getRow(rowId, (err, row) => {
    if (err) return res.status(500).json({ error: 'Failed to get row' });
    if (!row) return res.status(404).json({ error: 'Row not found' });

    const data = typeof row.data === 'string' ? JSON.parse(row.data || '{}') : row.data;
    const fixedOriginalName = normalizeOriginalName(file.originalname);
    data[columnId] = {
      name: fixedOriginalName,
      size: file.size,
      type: file.mimetype,
      url: fileUrl,
      path: file.path
    };

    db.updateRow(rowId, { id: rowId, ...data }, (updateErr) => {
      if (updateErr) return res.status(500).json({ error: 'Failed to update row with file' });
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

router.delete('/:tableId/rows/:rowId/files/:columnId', (req, res) => {
  const { rowId, columnId } = req.params;
  db.getRow(rowId, (err, row) => {
    if (err) return res.status(500).json({ error: 'Failed to get row' });
    if (!row) return res.status(404).json({ error: 'Row not found' });

    const data = typeof row.data === 'string' ? JSON.parse(row.data || '{}') : row.data;
    const fileInfo = data[columnId];
    if (fileInfo && fileInfo.path) {
      try { fs.unlinkSync(fileInfo.path); } catch (e) { }
    }
    delete data[columnId];

    db.updateRow(rowId, { id: rowId, ...data }, (updateErr) => {
      if (updateErr) return res.status(500).json({ error: 'Failed to delete file from row' });
      res.json({ message: 'File deleted and row updated successfully' });
    });
  });
});

/**
 * @swagger
 * /tables/{tableId}/rows/batch:
 *   post:
 *     summary: Batch operations (create, update, delete)
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               operation:
 *                 type: string
 *                 enum: [create, update, delete]
 *               operations:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Batch operation successful
 */
router.post('/:tableId/rows/batch', async (req, res) => {
  const { tableId } = req.params;
  const { operation, operations } = req.body || {};

  if (!Array.isArray(operations)) {
    return res.status(400).json({ error: 'Invalid operations payload' });
  }

  // Helper to promisify db calls
  const runAsync = (fn, ...args) => new Promise((resolve, reject) => {
    fn(...args, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
  });

  try {
    // Note: We are running these in parallel (Promise.all) for performance.
    // In a real transaction, we'd want atomicity. 
    // The current MySQL adapter doesn't expose a transaction object easily to routes.
    // Given the requirements, we prioritize functionality over strict ACID for batch in this migration step.
    
    switch (operation) {
      case 'create': {
        await Promise.all(operations.map(op => {
          const id = uuidv4();
          const data = { id, table_id: tableId, ...(op.data || {}) };
          return runAsync(db.createRow.bind(db), tableId, data);
        }));
        res.json({ message: `${operations.length} rows created successfully` });
        break;
      }
      case 'delete': {
        await Promise.all(operations.map(op => {
          return runAsync(db.deleteRow.bind(db), op.id);
        }));
        res.json({ message: `${operations.length} rows deleted successfully` });
        break;
      }
      case 'update': {
        await Promise.all(operations.map(op => {
          return runAsync(db.updateRow.bind(db), op.id, { id: op.id, ...(op.data || {}) });
        }));
        res.json({ message: `${operations.length} rows updated successfully` });
        break;
      }
      default:
        res.status(400).json({ error: 'Invalid operation' });
    }
  } catch (err) {
    console.error(`Error in batch ${operation}:`, err);
    res.status(500).json({ error: `Failed to ${operation} rows` });
  }
});

module.exports = router;
