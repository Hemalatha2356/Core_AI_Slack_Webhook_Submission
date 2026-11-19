# Core AI Services India — Transaction Alert Webhook

## Requirements
- Node.js 18 or newer (Node 20+ recommended); no npm packages are required.

## Local setup
1. Open a terminal in `INPUT_FILES`.
2. Copy `.env.example` to `.env` (PowerShell: `Copy-Item .env.example .env`).
3. Keep `SLACK_WEBHOOK_URL=http://127.0.0.1:4101/services/core-ai/alerts` for local testing.
4. Run `npm test`.
5. Terminal A: `npm run receiver`.
6. Terminal B: `npm start`.
7. Check `http://127.0.0.1:4100/health` and `http://127.0.0.1:4101/health`.
8. Import `postman/Core_AI_Webhook_Tests.postman_collection.json` into Postman.

## Webhook
`POST http://127.0.0.1:4100/webhooks/transactions`

Only valid `transaction.succeeded` events are forwarded. Notifications include transaction ID, formatted amount, currency, status and event ID. Customer email and the original event are not forwarded.

## Response contract
- 200: success delivered, or valid non-success event ignored
- 400: malformed JSON
- 413: request body exceeds 64 KB
- 422: invalid/missing schema fields
- 502: downstream unavailable/rejected
- 504: downstream timeout

## Timeout test
1. Stop the listener terminal with Ctrl+C (leave receiver running).
2. In `.env`, set `SLACK_WEBHOOK_URL=http://127.0.0.1:4101/services/core-ai/timeout` and `FORWARD_TIMEOUT_MS=500`.
3. Restart listener with `npm start`.
4. Send the Postman `Success event` request; expect HTTP 504.
5. Restore the normal `/services/core-ai/alerts` URL and `FORWARD_TIMEOUT_MS=1500`, then restart listener.

## Security
Never commit `.env` or a real Slack URL/token. `.env.example` contains local-only settings. The included receiver is a local test double, not a live Slack workspace.
