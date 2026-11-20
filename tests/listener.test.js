const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateEvent, createSlackPayload, formatAmount } = require('../src/listener');

const fixture = name => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', name), 'utf8'));

test('valid success fixture passes schema validation', () => {
  assert.deepEqual(validateEvent(fixture('success_01.json')), []);
});
test('null email success fixture passes schema validation', () => {
  assert.deepEqual(validateEvent(fixture('success_null_email.json')), []);
});
test('missing transaction id is rejected', () => {
  assert.ok(validateEvent(fixture('missing_id.json')).includes('transaction_id_required'));
});
test('string amount is rejected', () => {
  assert.ok(validateEvent(fixture('wrong_amount_type.json')).includes('amount_minor_must_be_nonnegative_integer'));
});
test('amount is formatted from minor units', () => {
  assert.equal(formatAmount(259900, 'INR'), '₹2,599.00');
});
test('Slack payload includes permitted fields and excludes customer email', () => {
  const payload = createSlackPayload(fixture('success_01.json'));
  const serialized = JSON.stringify(payload);
  assert.match(serialized, /txn_CA001/);
  assert.match(serialized, /evt_CA001/);
  assert.match(serialized, /₹2,599.00/);
  assert.doesNotMatch(serialized, /contact01@example\.test/);
});
