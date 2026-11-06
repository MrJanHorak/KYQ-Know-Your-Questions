'use client';

import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Keep instructor credentials independent of the participant's board identity.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const app = Object.values(config).every(Boolean)
  ? (getApps().find(item => item.name === 'kyq-instructor') || initializeApp(config, 'kyq-instructor'))
  : null;
export const instructorAuth = app ? getAuth(app) : null;
