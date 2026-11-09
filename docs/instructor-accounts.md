# Instructor accounts and teams

The initial account flow is available at `/instructor`. It uses a named Firebase client app so that instructor sign-in does not replace a participant's anonymous or board-specific identity. After email verification, a server endpoint verifies the instructor's ID token and transactionally creates an instructor record, a personal team, and an owner membership. Repeated requests return the existing team. Firestore's default-deny rules prevent direct client access to these records.

Team owners can create and manage team-owned boards from `/instructor`. Management requests check the board's team and instructor identity on the server. The shared-password login has been removed. Unassigned boards remain in Firestore but cannot be accessed or managed; no existing boards are moved or deleted. Board invitations are not available yet.

## Remaining work

1. Finish team and board membership, owner recovery and transfer, and the exact permissions of board admins. The owner dashboard currently pages through its personal team's boards; invited-board listing remains to be built.
2. Implement invitations scoped to specific boards, with expiry, revocation, one-time acceptance, and a verified-email match. Select and configure an email delivery provider, or explicitly support owner-shared invitation links.
3. Authorize every board administration and instructor board-access endpoint against the current server-side membership. Participant board tokens and instructor account identities must remain separate. Cover denial across teams and boards, revoked membership, and expired invitations with integration tests.
4. Provide a deliberate migration that assigns unassigned boards to a chosen team; avoid automatically claiming boards for the first person who signs up.
5. Add operational safeguards for production: monitoring, abuse controls, account recovery, data retention, pagination and cost/load testing for expected usage. Review Firebase Authentication and Firestore limits and deployment configuration.

The `teams`, `teams/{teamId}/members`, `boards/{boardId}/admins`, and `instructors` records are server-managed. The team creator is its owner. Individual board-admin membership is reserved for the upcoming invitation flow; there is no interface for granting it yet.

`scripts/test-instructor-boards.mjs` checks team isolation using the Auth and Firestore emulators. First build with `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-kyq`, then run `firebase emulators:exec --project demo-kyq --only auth,firestore "node scripts/test-instructor-boards.mjs"`. It refuses to run without both emulator hosts. Run the rules checks with `firebase emulators:exec --project demo-kyq --only firestore "node scripts/test-board-rules.mjs"`. Rebuild with the normal project configuration afterwards. The current Firebase CLI requires Java 21 or newer.
