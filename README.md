# Slot QA Release Hub v2

Central control centre for casino game releases, tile compliance, metadata, testing queues, and local QA workers.

## Architecture

The hosted control centre owns game records and the job queue. Testing itself is intentionally executed by local workers:

- **Max Bet Worker** — runs max-bet/compliance checks on the designated local max-bet machine.
- **Gameplay QA Worker** — runs automated gameplay QA on the dedicated automation laptop.
- Jobs can be submitted from any device. Workers poll outbound over HTTPS, so the laptops do not need inbound public ports.
- Offline workers leave jobs queued until they reconnect.
- Jobs use leases/locks to prevent duplicate execution and allow recovery after a worker crash.
- `NEEDS_REVIEW` jobs attach screenshot evidence.

## v2 scope

- Game release register: game, provider, provider game ID, release status/date and operational metadata.
- Automated tile discovery pipeline with provider-first sourcing, compliance assessment, editable/replacement tile, original evidence, and human-review fallback.
- Theme/filter classification using the approved taxonomy.
- Per-game Testing Queue controls.
- Separate gameplay QA and max-bet/compliance jobs routed to the correct worker type.
- Worker Online/Offline + last-seen status.
- Retry/cancel and evidence/results history.
- CMS-friendly export.

No worker secrets, credentials, production URLs, or operator-sensitive data should be committed to this public repository. Use environment variables for deployed configuration and local `.env` files for worker credentials.
