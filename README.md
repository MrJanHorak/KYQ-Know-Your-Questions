# KYQ · Know Your Questions

A private, live question board for classrooms and coding intensives. Give each group its own space to ask questions, compare notes, and surface what needs attention—without requiring participants to create an account.

## What it does

- **Ask and discuss:** Post questions with an optional name and lesson reference, and reply in a thread.
- **Find what matters:** Upvote questions and browse by Hot, New, or FAQ (answered questions).
- **Follow along live:** Firestore updates the board as the conversation changes.
- **Run a class:** Instructors can create password-protected boards, update question statuses, edit or delete questions, and use presenter mode.
- **Keep a record:** Export a board as Markdown or JSON.

Built with Next.js, React, TypeScript, Tailwind CSS, Firebase Authentication, and Cloud Firestore.

## Getting started

### Prerequisites

- Node.js and npm
- A Firebase project with a web app, **Anonymous** sign-in enabled, and a Firestore database
- Firebase Admin credentials for the server, plus the Firebase CLI if deploying Firestore rules

### Configure and run

1. Install dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the Firebase web app configuration from the Firebase console. Set a strong instructor password and a long, random session secret.

3. Give the server Firebase Admin credentials using **one** of these options:
   - Set `GOOGLE_APPLICATION_CREDENTIALS` to the path of a service-account JSON file.
   - Set `FIREBASE_SERVICE_ACCOUNT_JSON` to the service-account JSON contents.
   - Use Application Default Credentials in an environment where they are available.

   Keep the service-account credentials, `ADMIN_PASSWORD`, and `SESSION_SECRET` secret. Do not prefix them with `NEXT_PUBLIC_` or commit them to the repository.

4. Deploy the Firestore rules to your Firebase project:

   ```sh
   firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
   ```

5. Start the development server:

   ```sh
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000), or visit [the instructor dashboard](http://localhost:3000/admin) to create a board.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web app API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Authentication domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase web app ID |
| `ADMIN_PASSWORD` | Password for the instructor dashboard |
| `SESSION_SECRET` | Secret used to sign instructor sessions |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Optional service-account JSON for the server |
| `GOOGLE_APPLICATION_CREDENTIALS` | Optional path to a service-account JSON file |

## Using a board

1. Sign in at `/admin` with the instructor password.
2. Create a board with a name and a shared password of at least eight characters.
3. Use **Share** to copy the board link or download its QR code, and share the password separately with participants.
4. Participants open the link, unlock the board, and can ask, vote, and reply. Instructors can open **Manage board** to moderate questions and change their status.

Questions and replies support visual formatting, including bold, italics, lists, and tables. Their Markdown formatting is retained in Markdown exports. The 2,000-character limit and editor counter measure the stored Markdown, including formatting characters.

Changing a board password requires participants to unlock it again. Deleting a board permanently removes its questions and replies; export it first if you need a copy.

## Privacy and deployment

Board passwords are salted and hashed on the server. After a participant unlocks a board, Firestore rules check a board-specific Firebase token and its access version. Access persists in the same browser until the password changes, the participant locks the board or signs out, or site data is cleared. Use HTTPS and strong, unique passwords; anyone with a board password can access that board.

Password attempts are limited in Firestore by client IP. This depends on correct trusted proxy and IP configuration. The question-posting cooldown is a client-side convenience, not a server-enforced spam limit. Anonymous Firebase identities are browser-specific and can change when site data is cleared.

Deploy the app and `firestore.rules` together, especially when updating board access behavior. The rules deny access to the original single-board collection. Coordinate deployment: publishing the rules first interrupts the old app, while publishing the app first temporarily prevents access to new boards.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Run the production build |

The repository also contains Firestore rules and board API integration scripts in `scripts/`; they require a configured Firebase emulator environment. The default `npm test` script is a placeholder.
