# KYQ — Know Your Questios

A live question board for a two-week coding intensive, built with Next.js, Tailwind CSS, Firebase Anonymous Auth and Firestore.

## Setup

1. Create a Firebase project and web app. Enable Anonymous sign-in in Authentication and create a Firestore database.
2. Copy `.env.example` to `.env.local` and fill in the web app configuration. Set a strong `ADMIN_PASSWORD` and random `SESSION_SECRET`.
3. Give the Next.js server Firebase Admin credentials: set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account JSON file, or provide the JSON in `FIREBASE_SERVICE_ACCOUNT_JSON`. Never expose these as `NEXT_PUBLIC_` variables.
4. Deploy `firestore.rules` with `firebase deploy --only firestore:rules --project YOUR_PROJECT_ID`.
5. Run `npm install` and `npm run dev`. Visit `/admin` for the instructor dashboard.

The client cooldown is a convenience, not a server-enforced rate limit. The password screen protects admin operations through a server-side HTTP-only cookie; use a strong password and HTTPS. For production, add login rate limiting, tighter reply validation, and server-side spam controls. Anonymous UIDs are browser-specific and can be reset by clearing site data.
