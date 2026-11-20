# Production authentication and deployment configuration

## Package, do not deploy automatically

The Dockerfile packages the tested Java 17 jar and Vite assets into one non-root runtime. Build the jar with Maven and the frontend with `npm ci`/`npm run build`, or run `scripts/install-cloud`, then build the Docker image. Its filesystem can run read-only with a writable `/tmp` mount. Health includes a real database check through `/actuator/health`; the image's health script verifies status 200 and UP. No production deployment is performed by these commands until you explicitly run a container with production settings or invoke Compose.

`deployment/compose.yml` is the production topology: an unexposed application service behind Nginx HTTPS on ports 80/443. It requires a real database, DNS name and certificate directory before use. It does not create an Oracle server or obtain certificates. The app enforces HTTPS in production (except health) and trusts forwarded headers, so it must remain reachable only through the trusted proxy. The supplied proxy replaces client-supplied forwarding headers. Do not expose the app service directly or point public traffic at the dev profile.

## Required secure configuration

Use a deployment secret manager or protected process bindings. Never commit filled environment files, passwords or private keys. `deployment/production.env.template` lists names with blank values; it is not a set of working credentials.

| Binding | Purpose |
|---|---|
| `DB_JDBC_URL`, `DB_USERNAME`, `DB_PASSWORD` | Production JPA datasource; the included Oracle JDBC driver supports an actual Oracle endpoint |
| `APP_BOOTSTRAP_ADMIN_USERNAME` | Initial individual administrator username on an empty user table |
| `APP_BOOTSTRAP_ADMIN_PASSWORD` | Initial password, at least 16 characters (BCrypt supports at most 72 UTF-8 bytes) |
| `APP_DOMAIN` | Hostname served by Nginx |
| `TLS_CERT_DIR` | Read-only directory containing `fullchain.pem` and `privkey.pem` |

Run all three versioned Oracle SQL scripts through an authorized migration process before starting production. `ddl-auto=validate` never creates or resets the production schema. Oracle scripts and native locking remain untested while Oracle is deferred. Existing deployments need `003_operations.sql` for accounts, audit, documents and the dev marker table. Do not run migrations against production as part of review.

## Authentication behavior

Accounts are stored in the configured database with unique usernames, enabled flags and BCrypt password hashes. Passwords and hashes never appear in user API responses. A production empty database creates only the securely configured initial admin. Subsequent changes to bootstrap bindings do not overwrite existing accounts. Use the Users screen for individual provisioning, password resets, role assignment and access revocation. API reads use current account state on every request. Admins cannot remove their own administrator access; enabled-admin checks guard account changes.

The application uses stateless HTTP Basic over HTTPS, with credentials held only in browser memory. Invalid authentication returns JSON 401 without a browser authentication challenge, so the application handles errors consistently. Sign-out clears browser state and authorization headers; it does not change the account password. Production adds a bounded per-instance failed-authentication throttle (five failures per client IP in five minutes) and the proxy adds request rate limiting. In multi-instance deployments, use shared ingress rate limits and controlled trusted-proxy settings. SSO/OIDC and MFA are not part of this implementation; external identity integration is a separate authentication choice.

Mutations accept JSON, except PDF uploads, which require the custom `X-Requested-With: Touchline` header. CORS is not enabled. Revisiting cookie authentication or cross-origin access requires revisiting CSRF protection. Production sends a restrictive Content Security Policy and HTTPS security headers. Rotate credentials and keep Java, Spring and container base images patched through your normal release process.

## Data and operations

Audit writes are committed atomically with business mutations. Financial audit visibility is enforced on the server. Document bytes and metadata are stored in the database; SHA-256 detects integrity changes, not malicious content. Serve attachments only as downloads and only to authorized financial roles. Apply database encryption, encrypted backups, retention policy and antivirus/quarantine integration before accepting untrusted external documents. The application itself has no antivirus engine or encryption-key management.

Back up the database, including contract events, audit rows, account hashes and document BLOBs, and test restoration before a real rollout. The dev database is intentionally disposable and is not a backup or durable production store. No migration rollback, production network access, DNS, real certificates, Oracle execution or production deployment is claimed by a successful local smoke test.
