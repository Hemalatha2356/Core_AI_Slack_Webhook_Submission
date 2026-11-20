const http = require('node:http');
const { listenerPort, destinationUrl, timeoutMs } = require('./config');

const MAX_BODY_BYTES = 64 * 1024;
const EVENT_TYPES = new Set(['transaction.succeeded', 'transaction.failed', 'transaction.pending']);
const STATUSES = new Set(['succeeded', 'failed', 'pending']);
const CURRENCIES = new Set(['INR', 'USD', 'EUR']);

function sendJson(res, status, body) {
  res.writeHead(status);
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('payload_too_large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function isUtcIsoDate(value) {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

function validateEvent(event) {
  const errors = [];
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    return ['body_must_be_json_object'];
  }
  if (typeof event.event_id !== 'string' || !event.event_id.trim()) errors.push('event_id_required');
  if (!EVENT_TYPES.has(event.event_type)) errors.push('event_type_invalid');
  if (!isUtcIsoDate(event.occurred_at)) errors.push('occurred_at_must_be_iso8601_utc');

  const tx = event.transaction;
  if (!tx || typeof tx !== 'object' || Array.isArray(tx)) {
    errors.push('transaction_object_required');
    return errors;
  }
  if (typeof tx.id !== 'string' || !tx.id.trim()) errors.push('transaction_id_required');
  if (!STATUSES.has(tx.status)) errors.push('transaction_status_invalid');
  if (!Number.isSafeInteger(tx.amount_minor) || tx.amount_minor < 0) {
    errors.push('amount_minor_must_be_nonnegative_integer');
  }
  if (!CURRENCIES.has(tx.currency)) errors.push('currency_invalid');
  if (!Object.prototype.hasOwnProperty.call(tx, 'customer_email') ||
      !(tx.customer_email === null ||
        (typeof tx.customer_email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tx.customer_email)))) {
    errors.push('customer_email_must_be_email_or_null');
  }
  if (!Object.prototype.hasOwnProperty.call(tx, 'reference') ||
      !(tx.reference === null || typeof tx.reference === 'string')) {
    errors.push('reference_must_be_string_or_null');
  }
  if (EVENT_TYPES.has(event.event_type) && tx.status !== event.event_type.split('.')[1]) {
    errors.push('event_type_status_mismatch');
  }
  return errors;
}

function formatAmount(amountMinor, currency) {
  return new Intl.NumberFormat('en', {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(amountMinor / 100);
}

function createSlackPayload(event) {
  const tx = event.transaction;
  const amount = formatAmount(tx.amount_minor, tx.currency);
  const text = `Transaction succeeded: ${tx.id} | Amount: ${amount} | Status: ${tx.status} | Event: ${event.event_id}`;
  return {
    text,
    blocks: [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Transaction successful*\\n*Transaction ID:* ${tx.id}\\n*Amount:* ${amount}\\n*Currency:* ${tx.currency}\\n*Status:* ${tx.status}\\n*Event ID:* ${event.event_id}`
      }
    }]
  };
}

async function forwardNotification(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL(destinationUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid_destination_protocol');
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) {
      const error = new Error('downstream_rejected_request');
      error.statusCode = 502;
      throw error;
    }
    const responseText = await response.text();
    let receiver = {};
    if (responseText) {
      try { receiver = JSON.parse(responseText); } catch { receiver = { response: 'non_json' }; }
    }
    return receiver;
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      const timeoutError = new Error('downstream_timeout');
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    if (error.statusCode) throw error;
    const networkError = new Error('downstream_unavailable');
    networkError.statusCode = 502;
    throw networkError;
  } finally {
    clearTimeout(timeout);
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const pathname = new URL(req.url, 'http://localhost').pathname;

  if (req.method === 'GET' && pathname === '/health') {
    sendJson(res, 200, { status: 'ready', service: 'transaction-webhook-listener' });
    return;
  }
  if (req.method !== 'POST' || pathname !== '/webhooks/transactions') {
    sendJson(res, 404, { error: 'not_found' });
    return;
  }

  let raw;
  try {
    raw = await readBody(req);
  } catch (error) {
    sendJson(res, error.statusCode || 400, { error: error.message === 'payload_too_large' ? 'payload_too_large' : 'request_read_failed' });
    return;
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    sendJson(res, 400, { error: 'malformed_json' });
    return;
  }

  const validationErrors = validateEvent(event);
  if (validationErrors.length) {
    sendJson(res, 422, { error: 'validation_failed', details: validationErrors });
    return;
  }

  if (event.event_type !== 'transaction.succeeded' || event.transaction.status !== 'succeeded') {
    sendJson(res, 200, { ok: true, ignored: true, reason: 'non_success_transaction' });
    return;
  }

  try {
    const receiver = await forwardNotification(createSlackPayload(event));
    sendJson(res, 200, { ok: true, delivered: true, receiver });
  } catch (error) {
    sendJson(res, error.statusCode || 502, { error: error.message });
  }
});

if (require.main === module) {
  server.listen(listenerPort, '127.0.0.1', () => {
    console.log(`Listener http://127.0.0.1:${listenerPort}`);
  });
}
module.exports = { server, validateEvent, createSlackPayload, formatAmount };
