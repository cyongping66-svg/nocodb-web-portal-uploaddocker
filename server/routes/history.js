const express = require('express');
const router = express.Router();
const DatabaseWrapper = require('../db/database');

const db = new DatabaseWrapper();

// 取得指定表的歷史版本列表
router.get('/:tableId/history', (req, res) => {
  const { tableId } = req.params;
  db.getHistoryList(tableId, (err, list) => {
    if (err) {
      console.error('Error getting history list:', err);
      return res.status(500).json({ error: 'Failed to get history list' });
    }
    res.json(list);
  });
});

// 取得指定歷史版本詳細（包含快照）
router.get('/:tableId/history/:historyId', (req, res) => {
  const { tableId, historyId } = req.params;
  db.getHistoryEntry(tableId, historyId, (err, entry) => {
    if (err) {
      console.error('Error getting history entry:', err);
      return res.status(404).json({ error: 'History not found' });
    }
    res.json(entry);
  });
});

// 新增歷史版本（若未提供 snapshot，後端自動生成當前快照）
router.post('/:tableId/history', (req, res) => {
  const { tableId } = req.params;
  const { label, source, actor, snapshot } = req.body || {};

  const handleCreate = (snap) => {
    db.addHistorySnapshot(
      tableId,
      { label, source, actor, snapshot: snap },
      (err, created) => {
        if (err) {
          console.error('Error adding history snapshot:', err);
          return res.status(500).json({ error: 'Failed to create history snapshot' });
        }
        res.status(201).json({ message: 'History snapshot created', entry: created });
      }
    );
  };

  if (snapshot) {
    // 前端提供了快照
    handleCreate(snapshot);
  } else {
    // 後端生成當前快照
    db.getTableSnapshot(tableId, (snapErr, snap) => {
      if (snapErr) {
        console.error('Error generating snapshot:', snapErr);
        return res.status(500).json({ error: 'Failed to generate snapshot' });
      }
      handleCreate(snap);
    });
  }
});

// 清除指定表的所有歷史
router.delete('/:tableId/history', (req, res) => {
  const { tableId } = req.params;
  db.clearHistory(tableId, (err) => {
    if (err) {
      console.error('Error clearing history:', err);
      return res.status(500).json({ error: 'Failed to clear history' });
    }
    res.json({ message: 'History cleared' });
  });
});

// 回溯到指定歷史版本
router.post('/:tableId/history/:historyId/revert', (req, res) => {
  const { tableId, historyId } = req.params;
  db.getHistoryEntry(tableId, historyId, (err, entry) => {
    if (err || !entry) {
      console.error('Error fetching history for revert:', err);
      return res.status(404).json({ error: 'History not found' });
    }
    db.revertTableToSnapshot(tableId, entry.snapshot, (revErr) => {
      if (revErr) {
        console.error('Error reverting table to snapshot:', revErr);
        return res.status(500).json({ error: 'Failed to revert to snapshot' });
      }
      res.json({ message: 'Reverted to history snapshot' });
    });
  });
});

module.exports = router;