# Transaction webhook technical specification

## Flow
Transaction event producer → `POST /webhooks/transactions` → schema validation → success-event filter → Slack-compatible message mapping → POST to `SLACK_WEBHOOK_URL`.

## Expected event schema
- `event_id`: nonempty unique string
- `event_type`: `transaction.succeeded`, `transaction.failed`, or `transaction.pending`
- `occurred_at`: ISO-8601 UTC datetime
- `transaction.id`: nonempty string
- `transaction.status`: `succeeded`, `failed`, or `pending`, consistent with event type
- `transaction.amount_minor`: nonnegative integer in minor currency units
- `transaction.currency`: `INR`, `USD`, or `EUR`
- `transaction.customer_email`: nullable email string
- `transaction.reference`: nullable string

Only `transaction.succeeded` events with `status=succeeded` should produce messages. Do not forward full event objects or include customer email in notifications. Construct a readable Slack-compatible `text` and `blocks` payload. Include transaction ID, amount formatted from minor units, currency, status and event ID. The receiver accepts either `text` or `blocks`.

## Validation & response contract
Malformed JSON → 400. Invalid or missing schema fields → 422. Non-success event → 200 ignored. Successful forwarding → 200 with a `delivered` indicator. Unavailable downstream receiver or timeout → 502 or 504 without crashing. Payload size limit: 64 KB. Maintain clear error messages without leaking personal data.

## Security
Use `SLACK_WEBHOOK_URL` as an environment variable; never commit real keys. The local receiver accepts requests without secrets for controlled development; a real Slack Incoming Webhook URL should not be shared publicly. `WEBHOOK_SHARED_SECRET` is reserved for optional source authorization if implemented, and must not be logged.

## Test scenarios
- `success_01.json`: valid successful transaction
- `success_null_email.json`: valid event with null email
- `failed_event.json`: ignored non-success event
- `missing_id.json`: rejected missing identifier
- `malformed.json`: rejected invalid JSON
- `wrong_amount_type.json`: rejected amount supplied as text
- Timeout: switch `SLACK_WEBHOOK_URL` to `/services/core-ai/timeout` and use a short timeout
- Check output at `GET http://127.0.0.1:4101/messages` after successful forwarding

Only genuine locally observed results belong in the submission report.
