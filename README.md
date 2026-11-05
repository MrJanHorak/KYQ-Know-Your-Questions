# KYQ — Know Your Questios

A live question board for a two-week coding intensive, built with Next.js, Tailwind CSS, Firebase Anonymous Auth and Firestore.

## Setup

1. Create a Firebase project and web app. Enable Anonymous sign-in in Authentication and create a Firestore database.
2. Copy `.env.example` to `.env.local` and fill in the web app configuration. Set a strong `ADMIN_PASSWORD` and random `SESSION_SECRET`.
3. Give the Next.js server Firebase Admin credentials: set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account JSON file, or provide the JSON in `FIREBASE_SERVICE_ACCOUNT_JSON`. Never expose these as `NEXT_PUBLIC_` variables.
4. Deploy `firestore.rules` with `firebase deploy --only firestore:rules --project YOUR_PROJECT_ID`.
5. Run `npm install` and `npm run dev`. Visit `/admin` for the instructor dashboard.

## Private boards

Open `/admin`, sign in, and create a board with a shared password. Share the board link and password separately. Instructors can manage questions and download the complete board as Markdown or JSON. The import button copies questions from the original board without deleting them; running it again skips previously imported questions.

Deploy the updated `firestore.rules` together with this application version. The old collection is denied by the new rules, while new questions are isolated under individual boards. Publishing the rules first prevents the old version of the app from reading or writing questions; publishing the app first leaves a short transition where the new boards cannot be accessed until the rules are deployed. Coordinate the release to minimize downtime. The old questions remain in Firestore and can be imported after deployment.

Board passwords are salted and hashed server-side. Firestore checks a board-specific Firebase token, rather than trusting the page's password prompt. Board access persists on the same browser until the password changes or the user selects **Lock board**, signs out, or clears site data; sharing a password also shares access. Use HTTPS and strong, unique passwords. Password attempts are limited in Firestore by client IP, subject to correct trusted proxy/IP configuration. The client question cooldown is a convenience, not a server-enforced spam limit. Anonymous UIDs are browser-specific and can be reset by clearing site data.

In the instructor dashboard, use **Change password** on a board to set a new one. This invalidates previously issued board access; participants must unlock the board with the new password. After changing the access rules, deploy `firestore.rules` along with the application update before using password changes; the old rules do not enforce revocation.
