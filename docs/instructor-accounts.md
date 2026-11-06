# Instructor accounts and teams

The initial account flow is available at `/instructor`. It uses a named Firebase client app so that instructor sign-in does not replace a participant's anonymous or board-specific identity. After email verification, a server endpoint verifies the instructor's ID token and transactionally creates an instructor record, a personal team, and an owner membership. Repeated requests return the existing team. Firestore's default-deny rules prevent direct client access to these records.

This is an incremental foundation. Accounts do not yet grant board access, and the shared-password dashboard remains the only way to manage boards. No existing boards are moved or deleted.

## Remaining work before replacing the shared password

1. Define team and board membership, owner recovery and transfer, and the exact permissions of board admins. Query only boards the instructor may administer, with pagination.
2. Implement invitations scoped to specific boards, with expiry, revocation, one-time acceptance, and a verified-email match. Select and configure an email delivery provider, or explicitly support owner-shared invitation links.
3. Authorize every board administration and instructor board-access endpoint against the current server-side membership. Participant board tokens and instructor account identities must remain separate. Cover denial across teams and boards, revoked membership, and expired invitations with integration tests.
4. Provide a deliberate migration that assigns legacy boards to a chosen team; avoid automatically claiming boards for the first person who signs up. Verify the migration before disabling the old login.
5. Add operational safeguards for production: monitoring, abuse controls, account recovery, data retention, pagination and cost/load testing for expected usage. Review Firebase Authentication and Firestore limits and deployment configuration.

The `teams`, `teams/{teamId}/members`, and `instructors` records are server-managed. The team creator is its owner; they do not yet have access to any board through this new account.
