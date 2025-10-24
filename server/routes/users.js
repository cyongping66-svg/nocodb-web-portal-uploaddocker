const express = require('express');
const router = express.Router();
const DatabaseWrapper = require('../db/database');

const db = new DatabaseWrapper();

// 取得指定使用者的角色與權限設定
router.get('/:username/settings', (req, res) => {
  const { username } = req.params;
  db.getUserSettings(username, (err, settings) => {
    if (err) {
      console.error('Error getting user settings:', err);
      return res.status(500).json({ error: 'Failed to get user settings' });
    }
    if (!settings) {
      return res.json({ username, role: null, permissions: [] });
    }
    let perms = [];
    try {
      const raw = settings.permissions;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) perms = parsed;
      }
    } catch (e) {
      perms = String(settings.permissions || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    res.json({ username: settings.username, role: settings.role || null, permissions: perms });
  });
});

// 保存/更新指定使用者的角色與權限設定
router.put('/:username/settings', (req, res) => {
  const { username } = req.params;
  const { role, permissions } = req.body || {};

  if (permissions && !Array.isArray(permissions)) {
    return res.status(400).json({ error: 'permissions must be an array' });
  }

  db.upsertUserSettings(username, role || null, permissions || [], (err, saved) => {
    if (err) {
      console.error('Error saving user settings:', err);
      return res.status(500).json({ error: 'Failed to save user settings' });
    }
    let perms = [];
    try {
      const raw = saved.permissions;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) perms = parsed;
      }
    } catch (e) {
      perms = String(saved.permissions || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    res.json({ message: 'User settings saved', settings: { username: saved.username, role: saved.role || null, permissions: perms, updated_at: saved.updated_at } });
  });
});

module.exports = router;