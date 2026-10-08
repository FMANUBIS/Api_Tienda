const test = require('node:test');
const assert = require('node:assert/strict');

const { hashPassword, normalizeUsername } = require('../auth');

test('hashPassword devuelve una cadena estable y segura', () => {
  const pass = 'admin123';
  const hash = hashPassword(pass);

  assert.equal(typeof hash, 'string');
  assert.equal(hash.length, 64);
  assert.equal(hash, hashPassword(pass));
});

test('normalizeUsername convierte a formato consistente para usuario y correo', () => {
  assert.equal(normalizeUsername('  Sofia.Ramirez@Example.com  '), 'sofia.ramirez@example.com');
  assert.equal(normalizeUsername('ADMIN'), 'admin');
});
