/**
 * firebase.ts — initialise Firebase once, export shared handles.
 */
import { initializeApp, getApps } from 'firebase/app'
import { getDatabase }            from 'firebase/database'
import { getAuth }                from 'firebase/auth'

const firebaseConfig = {
  apiKey:            'AIzaSyBFDsN4wr6wFY44I_iqKzJvH9KK3uCjHPo',
  authDomain:        'efp-os.firebaseapp.com',
  databaseURL:       'https://efp-os-default-rtdb.europe-west1.firebasedatabase.app',
  projectId:         'efp-os',
  storageBucket:     'efp-os.firebasestorage.app',
  messagingSenderId: '218183702',
  appId:             '1:218183702:web:b1ae91b3b9c95e1e68b7b4',
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

export const db   = getDatabase(app)
export const auth = getAuth(app)
export default app
