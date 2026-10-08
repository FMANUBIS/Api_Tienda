const crypto = require('crypto');

function normalizeUsername(value = '') {
  const text = String(value).trim().toLowerCase();
  return text.replace(/\s+/g, '');
}

function hashPassword(password = '') {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

module.exports = { normalizeUsername, hashPassword };
