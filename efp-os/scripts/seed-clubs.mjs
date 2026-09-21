import { initializeApp } from 'firebase/app'
import { getDatabase, ref, get, update } from 'firebase/database'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))

const app = initializeApp({
  apiKey:      'AIzaSyC0SbTYsW0yU6qHwP3-c9cAYM_V-hcH0nA',
  authDomain:  'efp-platform-f2aaa.firebaseapp.com',
  databaseURL: 'https://efp-platform-f2aaa-default-rtdb.europe-west1.firebasedatabase.app',
  projectId:   'efp-platform-f2aaa',
})
const db = getDatabase(app)

// Generate a push-style key (Firebase format)
function pushKey() {
  const CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'
  let t = Date.now()
  let r = Math.random() * 0x100000000 >>> 0
  let k = ''
  for (let i = 7; i >= 0; i--) { k = CHARS[t % 64] + k; t = Math.floor(t / 64) }
  for (let i = 0; i < 12; i++) { k += CHARS[r % 64]; r = Math.floor(r / 64) }
  return '-' + k.slice(1)
}

async function main() {
  const clubs = JSON.parse(readFileSync(join(__dir, 'scout_clubs.json'), 'utf8'))

  const snap = await get(ref(db, 'clubs'))
  const existing = new Set()
  if (snap.exists()) {
    snap.forEach(child => {
      const n = child.val().name || ''
      if (n) existing.add(n.toLowerCase().trim())
    })
  }
  console.log(`Existing: ${existing.size} clubs`)

  // Build one multi-path update object
  const updates = {}
  let count = 0
  for (const club of clubs) {
    if (existing.has(club.name.toLowerCase().trim())) continue
    const key = pushKey()
    updates[`clubs/${key}`] = {
      name:    club.name,
      league:  club.league,
      country: club.country,
      flag:    club.flag,
      status:  'Not Started',
      savedAt: Date.now(),
    }
    count++
  }

  console.log(`Writing ${count} new clubs in one batch...`)
  if (count > 0) {
    await update(ref(db), updates)
    console.log(`Done! ${count} clubs added.`)
  } else {
    console.log('Nothing to add.')
  }
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
