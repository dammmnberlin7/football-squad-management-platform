# Architecture and API

The React console calls a same-origin Spring MVC REST API. Spring Security authenticates HTTP Basic credentials and enforces method-level roles. JPA transactions use sequence-generated IDs and optimistic `version` fields. Amounts are decimal, denominated in EUR; salary is annual. Transfer completion is immediate, not a negotiation pipeline.

| Capability | ADMIN | FINANCE | COACH |
|---|---|---|---|
| Read clubs/players/performance | Yes | Yes | Yes |
| Create/edit clubs and players | Yes | No | No |
| Record/edit performance | Yes | No | Yes |
| Contract PDFs | Yes | Yes | No |
| Audit | All events | Financial events | No |
| User administration | Yes | No | No |
| Read/write contracts, history, transfer fees | Yes | Yes | No |
| Dashboard financial totals | Yes | Yes | No |

Financial values are excluded by the backend, not merely hidden by the UI. There is no public registration. Accounts are database-backed with BCrypt hashes, individual role assignments, enabled flags and administrator-only password resets. Production requires secure bootstrap credentials and HTTPS; see deployment.md. API requests are stateless; JSON mutation endpoints require `Content-Type: application/json`. CSRF is disabled for this non-cookie API, CORS is not enabled, and the frontend supplies Authorization explicitly. Do not enable permissive CORS or cookie authentication without revisiting CSRF protection.

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
| `/api/players/{id}/summary` | GET non-financial totals, goals per 90, and five most recent performances |
| `/api/players/{id}` | PUT `{name,position,clubId,version}` (club cannot change here) |
| `/api/contracts` | GET; POST `{playerId,clubId,starts,ends,salary}` |
| `/api/contracts/expiring?days=90` | GET signed contracts ending today through the next `days` (0–366), sorted by end date then ID; finance/admin only |
| `/api/contracts/{id}` | PUT same fields plus `version`, draft only |
| `/api/contracts/{id}/sign` | POST `{version}` |
| `/api/contracts/{id}/terminate` | POST `{version}` |
| `/api/contracts/{id}/history` | GET immutable action/actor/time history |
| `/api/transfers` | GET; POST `{playerId,toClubId,fee,playerVersion}` |
| `/api/performances` | GET; POST `{playerId,matchDate,minutes,goals,assists}` |

Dates use ISO `YYYY-MM-DD`. A transfer uses the version from the latest player read. PUT and lifecycle operations require the latest version from their resource. Refresh after writes before submitting another mutation. Registers use server-side search, club/status filters and ten-row pages. Search uses literal escaped text (including `%` and `_`), rather than user-supplied SQL wildcards. Lookup selectors search bounded server results; register responses include the referenced names for the current page. Original list endpoints remain for API compatibility, but the console uses paged register/lookup routes. Transfers filter by either recorded club; performance records filter by the player’s current club.

## Contract and transfer integrity

Draft terms may be edited. Signing freezes all commercial and identity terms. A renewal is a new draft; signed rows are never repurposed or deleted. Termination changes only lifecycle status and adds an event. Inclusive date intervals cannot overlap another SIGNED contract for the player, even at another club. The dashboard distinguishes currently active contracts (SIGNED with today inside the inclusive date interval) from all signed contracts and lists contracts ending within 90 days. These date calculations use UTC. Expiry is represented by the signed contract's end date; no automatic expiry job or electronic signature/document verification is implemented.

Signing, draft edits, player edits, termination, and transfers use a pessimistic lock on the player row. The lock serializes competing sign/transfer operations; JPA versions reject concurrent stale resource updates. No API permits editing transfer records or event history. Completing a transfer checks the player version, terminates all signed contracts with an event, moves the player, and saves the fee atomically. Existing drafts remain drafts; they cannot sign if their club differs from the player's current club. Any failure rolls the transaction back.

Oracle schema scripts add foreign keys, checks, immutable-term/history triggers, and a PL/SQL validation package. All database writers must follow the same player-lock protocol; arbitrary direct SQL is not an alternate supported write interface. The database owner must not be exposed to end users. H2 verifies Java service behavior, not Oracle PL/SQL or Oracle locking semantics.

## Daily workflows

Player profiles are available to every authenticated role without financial fields. Totals cover all recorded performances for that player; goals per 90 uses total minutes (rounded to two decimals, zero when no minutes). Recent records are ordered by match date descending and ID descending for ties, limited to five.

The Renew/Prepare renewal actions prefill a new one-year draft beginning the day after the original contract ends. Review its dates and salary before saving. Creating a renewal does not change or terminate the original; signing remains a separate, confirmed action subject to the same server overlap checks. Signing, termination and transfers have cancellable confirmation dialogs and disable repeat submission while saving. Errors preserve input and offer an explicit records reload. Sign-out resets all page, edit, profile, history and financial state, including on mobile; late profile/history responses are ignored after navigation or sign-out.

## Completion endpoints

- `GET /api/registers/{clubs|players|contracts|transfers|performances}?page=0&size=10&q=&clubId=&status=` returns content, totals, page metadata and referenced player/club names. Size is 1–100; query text is at most 120 characters. Financial register routes retain role restrictions.
- `GET /api/lookups/{clubs|players}?q=&page=0&size=50` returns bounded selector options. `id` resolves an existing selected record outside the current search page.
- `PUT /api/performances/{id}` accepts the existing fields plus version. Player identity is immutable; other validated fields can be corrected by ADMIN/COACH.
- `GET/POST /api/contracts/{id}/documents` lists metadata or appends a multipart PDF (5 MiB maximum, PDF header validation, custom upload header required). `GET /api/contracts/{id}/documents/{documentId}` downloads a scoped immutable attachment. ADMIN/FINANCE only.
- `GET /api/audit?page=0&size=20&q=` pages audit events. ADMIN sees all, FINANCE sees financial resources only. No audit update/delete endpoint exists.
- `GET/POST /api/users`, `PUT /api/users/{id}` manage accounts as ADMIN. Creates require username, password and roles. Updates require version, roles, enabled and an optional replacement password. Responses exclude passwords/hashes.
- `POST /api/dev/demo` is ADMIN-only, idempotent, append-only and registered only in dev. `GET /api/auth/config` is public and exposes mode/demo availability without secrets.
