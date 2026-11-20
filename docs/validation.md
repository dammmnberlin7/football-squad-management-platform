# Validation and remaining work

## Automated checks

- Backend: `./scripts/mvn-cloud -B -f backend/pom.xml test`. Tests cover real and invalid Basic authentication, health, anonymous denial, coach financial restrictions, input validation, draft/sign/transfer lifecycle, immutable signed terms, stale transfer rejection, performance totals, and simultaneous overlapping sign attempts (one 200, one 409).
- Package: `./scripts/mvn-cloud -B -f backend/pom.xml package` builds the executable Java 17 jar and runs tests.
- Frontend: `npm --prefix frontend test` exercises login, error feedback, dashboard rendering, and coach restrictions; `npm --prefix frontend run build` runs strict TypeScript and Vite production compilation.
- Browser: start both services with `./scripts/start-cloud`, then `npm --prefix frontend run test:e2e`. Chromium exercises the complete administrator workflow and coach financial isolation against the real API/database. Browser tests create disposable records and can be repeated.
- Live readiness: `GET /actuator/health` must return `UP`; an authenticated request to `/api/me` through the frontend proxy must return the intended identity. A listening port alone is insufficient.

## Limits

Oracle remains blocked by missing endpoint, runtime credentials, and confirmed network access. Its SQL/PLSQL has not been executed. H2 state is intentionally disposable and does not survive restart. ML implementation is intentionally deferred. No electronic signature provider, document upload, negotiation pipeline, scheduled expiry job, multi-currency accounting, pagination, SSO, or production deployment is included. These are explicit future extensions, not simulated capabilities.

Java 17.0.17 and Maven 3.9.9 are pinned for reproducibility; keep runtime and framework security patches current before deployment. The cloud install script uses upstream checksums and TLS verification. The browser runner expects Chromium in the cloud image or `CHROMIUM_PATH`; installing Chromium on another image may require approved system packages. Live processes do not survive environment replacement, so use saved startup instructions on each new instance.

## Initial implementation verification

Eight backend tests passed, with zero failures/errors/skips. Two frontend component tests and two Chromium end-to-end tests passed. The Java 17 executable jar and strict TypeScript/Vite production build succeeded. The install script completed, both services were stopped and restarted through the startup helper, repeated startup reused healthy services, database health returned UP, and an authenticated coach dashboard request through Vite returned no financial fields. The browser workflow also verified editing a player. GitHub Actions has been added to repeat these checks on pushes/PRs, but its remote outcome has not been observed in this session.

## Latest development verification

The next increment adds six backend integration tests (14 backend tests total) for isolated player aggregates, recent-record ordering/limit, zero-minute and missing-player cases, inclusive expiry boundaries, invalid expiry windows, accurate active-contract counts, and coach access restrictions. Four component tests now cover search/paging and switching from an admin financial edit to a coach session. Browser workflows additionally cover cancellable signing/transfers, immutable source terms during renewal, player profiles, contract filtering, mobile sign-out and renewal preparation from the expiry dashboard. These use the disposable H2 database; Oracle validation remains pending and ML remains deferred.

Latest results: all 14 backend tests, 4 frontend component tests and 4 live Chromium workflows passed with no failures or skips. Java packaging and strict TypeScript/Vite builds passed, and live database health returned UP. The existing cloud startup commands remain unchanged. No Oracle connection, environment publication, merge to main or production deployment was performed.
