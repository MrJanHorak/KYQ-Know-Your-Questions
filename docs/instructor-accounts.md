# Instructor accounts and teams

The initial account flow is available at `/instructor`. It uses a named Firebase client app so that instructor sign-in does not replace a participant's anonymous or board-specific identity. After email verification, a server endpoint verifies the instructor's ID token and transactionally creates an instructor record, a personal team, and an owner membership. Repeated requests return the existing team. Firestore's default-deny rules prevent direct client access to these records.

Team owners can create and manage team-owned boards from `/instructor`. Owners and board admins can create one-time, seven-day invitation links for a verified email, and change or revoke existing managers. Invitations are scoped to one board; the owner shares the link directly. Management requests check the board's current membership and instructor identity on the server. The shared-password login has been removed. Unassigned boards remain inaccessible; migration is out of scope.

## Remaining work

1. Add team owner recovery and transfer.
2. Add operational safeguards for production: monitoring, abuse controls, account recovery, data retention, pagination for shared boards and manager lists, and cost/load testing for expected usage. Review Firebase Authentication and Firestore limits and deployment configuration.

The `teams`, `teams/{teamId}/members`, `boards/{boardId}/admins`, `instructors`, and `boardInvitations` records are server-managed. The team creator is its owner. Board roles are cumulative: responder (reply and change status), moderator (also delete questions and replies), manager (also change passwords and export), and admin (also edit questions, manage board memberships and delete the board). Only the owner creates boards. Board admins can grant any board role, including admin. Instructor-created board sessions check current membership so removing access also closes an existing session; participants who independently know the board password may still use participant access.

`scripts/test-instructor-boards.mjs` checks team isolation using the Auth and Firestore emulators. First build with `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-kyq`, then run `firebase emulators:exec --project demo-kyq --only auth,firestore "node scripts/test-instructor-boards.mjs"`. It refuses to run without both emulator hosts. Run the rules checks with `firebase emulators:exec --project demo-kyq --only firestore "node scripts/test-board-rules.mjs"`. Rebuild with the normal project configuration afterwards. The current Firebase CLI requires Java 21 or newer.
