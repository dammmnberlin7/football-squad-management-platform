# Review the complete platform

This review uses the disposable development database. No Oracle account or setup is needed. Nothing is deployed to production.

## Start

From the existing cloud checkout run `./scripts/start-cloud`. If outputs are missing, run `./scripts/install-cloud` first. Open the running frontend in the cloud browser on port 5173. The backend uses port 8080. The development database resets when the backend stops.

Development accounts are `admin` / `dev-admin`, `finance` / `dev-finance`, and `coach` / `dev-coach`. These public sample passwords apply only to the dev profile. The production profile never creates them.

## Walk through the screens

1. **Overview as admin:** click **Load demo data**, then confirm. It adds three fictional clubs, eighteen players, eighteen contracts and seventy-two performance records once. Existing work is preserved; repeated loading adds nothing. You can also opt into loading it at startup with `APP_DEMO_DATA=true` in the dev profile.
2. **Clubs and Players:** search, page through records, filter by club, create and edit records. Use the Find inputs above player/club selectors to search the server for additional options. Open a player profile to see aggregate statistics and recent performances.
3. **Performances:** add a performance, edit its date/minutes/goals/assists, and revisit the player's profile. The player on an existing record cannot change. Stale edits are rejected rather than overwriting another change.
4. **Contracts:** create and edit a draft, sign it through the confirmation dialog, inspect history, and prepare a renewal. The renewal starts as a separate draft; the original signed salary/dates stay unchanged. Expiry alerts on Overview open this workflow directly. Try overlapping signed dates to verify the conflict message.
5. **Contract documents:** use Documents on a contract row. Attach a PDF up to 5 MiB, inspect its checksum and download it. Documents are append-only, including on signed contracts. Invalid formats are rejected. Files are downloads, not embedded previews; PDF header checking is not malware scanning.
6. **Transfers:** choose a player, destination and fee. Cancel first to confirm no changes, then complete the transfer. Check that the player moved and their signed contracts were terminated with history events.
7. **Audit:** search by actor, resource or action and page through events. Admins see all events. Finance sees financial contract/transfer/document events only. Audit records never contain passwords or document bytes.
8. **Users as admin:** create an individual account with one or more roles; disable it, reset its password, then enable it. Disabled accounts and old passwords are rejected on the next request. You cannot remove your own administrator access. Changing your own password signs you out.
9. **Finance and Coach:** sign out, then use each role. Finance can operate financial workflows and audit but cannot edit the squad or performances. Coach can manage performances and view player profiles, with no financial documents, contracts, fees, audit or user administration. Multi-role accounts combine their granted capabilities.
10. **Mobile:** resize the browser and check navigation, registers, confirmations and sign-out.

## Test commands

- Backend and executable jar: `./scripts/mvn-cloud -B -f backend/pom.xml package`
- Components: `npm --prefix frontend test`
- TypeScript/Vite: `npm --prefix frontend run build`
- Real browser workflows (services running): `npm --prefix frontend run test:e2e`
- Container image (tested artifacts built first): `docker build -t touchline:review .`

See [deployment](deployment.md) for production packaging and [validation](validation.md) for evidence and boundaries. Oracle execution/connectivity and ML predictions remain deferred. This application does not provide electronic signature verification or antivirus scanning.
