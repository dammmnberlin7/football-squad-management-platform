# Touchline — football squad management

Java 17 / Spring Boot 3 / Maven API with Spring Data JPA and Spring Security; React / TypeScript / Vite console. Oracle SQL and PL/SQL scripts live in `database/`. H2 provides a disposable development database. ML predictions are reserved for later.

## Codex Cloud quick start

Use the existing isolated checkout; do not create a worktree unless requested.

```bash
cd /workspace/football-squad-management-platform
./scripts/install-cloud
./scripts/start-cloud
npm --prefix frontend run test:e2e
```

Installation pins Java 17 and Maven, verifies newly downloaded archive checksums, runs backend tests/package, and installs/builds/tests the frontend with its lockfile. Node 24 and Python 3 are provided by the cloud image. Cloud Maven uses the inherited proxy and system CA trust, with a workspace-owned dependency cache. Chromium is needed for browser tests (`CHROMIUM_PATH` can override `/usr/bin/chromium`).

Development accounts: `admin` / `dev-admin`, `finance` / `dev-finance`, `coach` / `dev-coach`. These are public disposable-development credentials, never production credentials. Development seed passwords can be overridden with `APP_ADMIN_PASSWORD`, `APP_FINANCE_PASSWORD`, and `APP_COACH_PASSWORD` before the user table is initialized. Individual accounts, roles, disabling and password resets are available under Users. The production profile creates only the configured bootstrap admin; see `docs/deployment.md`. Credentials are held only in browser memory, never local storage.

The API uses port 8080; Vite uses 5173 and proxies `/api` and `/actuator`. Health: `GET /actuator/health`. Development data is destroyed on backend shutdown. Logs and owned PID files from the startup helper live in `/tmp/touchline`. Build outputs, dependency caches, and logs are not committed.

Daily workflows include searchable registers, player performance profiles, contract expiry alerts and renewal draft preparation. Financial actions require confirmation, and coach views exclude financial data.

See [architecture and API](docs/architecture.md), [Oracle setup](database/README.md), and [validation and limitations](docs/validation.md). This repository is a development implementation; no production deployment or merge to main is performed.

## Complete review

Start with [the review guide](docs/REVIEW.md) for a walkthrough of every screen, demo data, account management, performance editing, contract documents, audit and server-side search/pagination. [Production configuration](docs/deployment.md) covers the non-root Docker image and HTTPS proxy. No production deployment is automatic.
