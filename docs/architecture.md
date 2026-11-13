# Architecture and API

The React console calls a same-origin Spring MVC REST API. Spring Security authenticates HTTP Basic credentials and enforces method-level roles. JPA transactions use sequence-generated IDs and optimistic `version` fields. Amounts are decimal, denominated in EUR; salary is annual. Transfer completion is immediate, not a negotiation pipeline.

| Capability | ADMIN | FINANCE | COACH |
|---|---|---|---|
| Read clubs/players/performance | Yes | Yes | Yes |
| Create/edit clubs and players | Yes | No | No |
| Record performance | Yes | No | Yes |
| Read/write contracts, history, transfer fees | Yes | Yes | No |
| Dashboard financial totals | Yes | Yes | No |

Financial values are excluded by the backend, not merely hidden by the UI. There is no public registration. The initial fixed accounts are suitable for development; production identity provisioning, TLS termination, account lifecycle, and secret rotation need a separate deployment design. API requests are stateless; JSON mutation endpoints require `Content-Type: application/json`. CSRF is disabled for this non-cookie API, CORS is not enabled, and the frontend supplies Authorization explicitly. Do not enable permissive CORS or cookie authentication without revisiting CSRF protection.

## Endpoints

All `/api` routes require authentication. JSON requests with missing/invalid fields return 400, missing entities return 404, stale versions and lifecycle conflicts return 409, and unauthorized roles return 403.

| Route | Operations |
|---|---|
| `/actuator/health` | Public GET including database health (details hidden) |
| `/api/me` | GET identity and roles |
| `/api/dashboard` | GET operational counts, goals, and authorized financial totals |
| `/api/clubs` | GET; POST `{name}` |
| `/api/clubs/{id}` | PUT `{name,version}` |
| `/api/players` | GET; POST `{name,position,clubId}` |
| `/api/players/{id}` | PUT `{name,position,clubId,version}` (club cannot change here) |
| `/api/contracts` | GET; POST `{playerId,clubId,starts,ends,salary}` |
| `/api/contracts/{id}` | PUT same fields plus `version`, draft only |
| `/api/contracts/{id}/sign` | POST `{version}` |
| `/api/contracts/{id}/terminate` | POST `{version}` |
| `/api/contracts/{id}/history` | GET immutable action/actor/time history |
| `/api/transfers` | GET; POST `{playerId,toClubId,fee,playerVersion}` |
| `/api/performances` | GET; POST `{playerId,matchDate,minutes,goals,assists}` |

Dates use ISO `YYYY-MM-DD`. A transfer uses the version from the latest player read. PUT and lifecycle operations require the latest version from their resource. Refresh after writes before submitting another mutation. Lists currently return all records; pagination and search are future scaling work.

## Contract and transfer integrity

Draft terms may be edited. Signing freezes all commercial and identity terms. A renewal is a new draft; signed rows are never repurposed or deleted. Termination changes only lifecycle status and adds an event. Inclusive date intervals cannot overlap another SIGNED contract for the player, even at another club. Expiry is represented by the signed contract's end date; no automatic expiry job or electronic signature/document verification is implemented.

Signing, draft edits, player edits, termination, and transfers use a pessimistic lock on the player row. The lock serializes competing sign/transfer operations; JPA versions reject concurrent stale resource updates. No API permits editing transfer records or event history. Completing a transfer checks the player version, terminates all signed contracts with an event, moves the player, and saves the fee atomically. Existing drafts remain drafts; they cannot sign if their club differs from the player's current club. Any failure rolls the transaction back.

Oracle schema scripts add foreign keys, checks, immutable-term/history triggers, and a PL/SQL validation package. All database writers must follow the same player-lock protocol; arbitrary direct SQL is not an alternate supported write interface. The database owner must not be exposed to end users. H2 verifies Java service behavior, not Oracle PL/SQL or Oracle locking semantics.
