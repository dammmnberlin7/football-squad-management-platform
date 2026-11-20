# Oracle connectivity — pending validation

No Oracle endpoint or credential bindings were present when inspected (names/presence only). Oracle connectivity, DDL execution, PL/SQL compilation, and Oracle-specific concurrency have **not** been tested. H2 Oracle compatibility mode is not an Oracle validation substitute.

To enable Oracle in a separate validation session:

1. Supply `ORACLE_JDBC_URL` (for example `jdbc:oracle:thin:@//HOST:1521/SERVICE`), `ORACLE_USERNAME`, `ORACLE_PASSWORD`, and development account password overrides as needed in secure cloud environment settings. Never paste passwords into chat or commit them. The JDBC password must be a process environment binding; HTTP proxy secret substitution is not JDBC authentication.
2. Configure authorized network access to the actual Oracle host/port. Raw Oracle TCP may require the managed TCP forwarding/VPN workflow; HTTP domain access alone is insufficient. Do not disable TLS certificate verification to work around connectivity.
3. Using an authorized schema owner, apply `001_schema.sql`, then `002_integrity.sql` and `003_operations.sql` with SQLcl/SQL*Plus. These are one-time, non-idempotent scripts for a fresh schema. Back up any existing schema before migration. Check `USER_ERRORS` and `USER_OBJECTS.STATUS` after compilation.
4. For production, use `SPRING_PROFILES_ACTIVE=production` with `DB_JDBC_URL`, `DB_USERNAME`, `DB_PASSWORD` and bootstrap-admin bindings documented in `docs/deployment.md`. The alternate `SPRING_PROFILES_ACTIVE=oracle` profile still supports `ORACLE_*` bindings for a configured non-dev validation session. Hibernate validates the schema and never creates/drops it in this profile. Start with `java -jar backend/target/squad-0.1.0.jar` in the configured process; do not pass passwords as command-line arguments.
5. Verify database health, then exercise the same club/player/contract/transfer/performance workflow and concurrent overlap tests against a disposable Oracle schema. Confirm schema types, immutable triggers, row locks, rollback behavior, and version conflicts. Do not use a production schema for these checks.

The runtime Oracle JDBC driver is included. Sequences use allocation size 50 matching JPA's explicit generators. SQL targets Oracle 19c or newer. No Oracle server, SQLcl client, or privileged database account is bundled. Do not publish claims of Oracle readiness until actual connection and functional checks pass.
