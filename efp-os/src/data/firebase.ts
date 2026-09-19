/**
 * firebase.ts — initialise Firebase once, export shared handles.
 * Config values are loaded from environment variables (VITE_FIREBASE_*).
 * Copy .env.example → .env.local and fill in your values.
 */
import { initializeApp, getApps } from 'firebase/app'
import { getDatabase }            from 'firebase/database'
import { getAuth }                from 'firebase/auth'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

export const db   = getDatabase(app)
export const auth = getAuth(app)
export default app
