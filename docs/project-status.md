# Project status and next steps

Last updated: November 11, 2026. This is a handoff snapshot; verify the deployed configuration and repository status before making changes.

## Current state

Know Your Questions is a Next.js application backed by Firebase Authentication and Firestore. Its main workflows include participant boards, questions, votes and replies; instructor accounts; board management and exports; board-specific manager roles; multiple team owners; and an optional team recovery contact. A recovery contact can grant themselves full ownership, so teams should choose that person carefully. Legacy boards created under the former shared instructor login are inaccessible; migration remains outside the current scope.

Authenticator-app (TOTP) enrollment, sign-in and ownership reauthentication are implemented. The experience uses app dialogs and six separate code fields. Invalid or expired verification codes clear the fields and focus the first; connection and service errors preserve the entered code. The user reported the 2FA interface was working and tested an incorrect code before the most recent retry-behavior adjustment. The adjustment was verified locally with a simulated invalid code and network failure, but has not been confirmed by the user against a live Firebase sign-in.

The user identified Firebase project `kyq-coding-intensive` as safe for testing. They upgraded its authentication to Identity Platform. TOTP was subsequently enabled and read back successfully through the project configuration API. At the time of that check, the Firestore MFA-enforcement setting was absent, so mandatory MFA was off. The user configured `NEXT_PUBLIC_TOTP_MFA_ENABLED` for Vercel Production and reported the interface working. Do not assume the current deployed app, Firestore rules, environment variables or remote settings still match this snapshot; inspect them before deployment or enforcement. The Identity Platform upgrade screen showed anonymous-account cleanup selected, but its final state was not independently confirmed. Verify that setting before relying on anonymous accounts being retained.

## Recommended next steps

1. Finish a real test of TOTP enrollment, successful sign-in, incorrect code retry, and reauthentication for an ownership action. Confirm that the latest code-reset change works against the deployed or test app. Do not ask the user to share passwords, authenticator codes, QR codes or setup keys.
2. Define and validate a lost-authenticator recovery procedure. Multiple team owners and recovery contacts preserve **team** access; they do not restore a person's Firebase account or their second factor. Consider the security and operational consequences before implementing or enabling mandatory MFA.
3. If mandatory MFA is desired, verify app and Firestore rules are deployed together, the enrollment UI is available to affected users, and the recovery procedure works. Enforcement is controlled by the server-managed Firestore document `_settings/security`, boolean `requireInstructorMfa`; see [instructor accounts](instructor-accounts.md) for details. It applies to all instructor accounts, including managers and recovery contacts, and denies pre-existing instructor board sessions without a verified second factor. Obtain the user's approval before changing the deployed enforcement setting.
4. Add server-enforced abuse controls. The question-posting cooldown currently uses browser local storage and can be bypassed. Review board password attempt limiting and trusted proxy/IP handling as well.
5. Make the existing integration and rules tests easy to run in CI; `npm test` is currently a placeholder. Add monitoring, data retention and backup decisions, pagination for shared boards and manager lists, and load/cost testing before wider production use.

Ownership and recovery-contact email alerts remain desirable, but no general-purpose email provider is configured. The user agreed to defer that work. There is also no support-assisted recovery process if all team owners and the recovery contact lose access.

## Verification and operational notes

- `npm run build` checks the production build. `node --experimental-strip-types scripts/test-verification-error.mjs` checks code-error classification on Node 22.6 or newer.
- Firebase Auth and Firestore emulator scripts cover instructor authorization, recovery, MFA-enforcement behavior with simulated token claims, and Firestore rules. The Auth emulator does not support TOTP, so a real Identity Platform test project is required to verify actual authenticator enrollment and challenges. See [instructor accounts](instructor-accounts.md) for commands and Java requirements.
- The Vercel `NEXT_PUBLIC_TOTP_MFA_ENABLED` setting is embedded at build time and currently must be set for each desired deployment environment; a new deployment is needed after a change.
- In the prior session, a failed admin SDK request printed a short-lived service-account access token in tool output. The user was informed. Do not reproduce or copy the token; treat those execution logs as sensitive. The service-account private key was not printed.
- The user prefers app modals instead of browser `alert`, `confirm`, or `prompt` dialogs. Avoid introducing new native browser dialogs.
