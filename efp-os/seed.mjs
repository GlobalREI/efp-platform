/**
 * seed.mjs — writes demo records to Firebase Realtime Database
 * Run: node seed.mjs
 */
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, set } from 'firebase/database'

const app = initializeApp({
  apiKey:            'AIzaSyC0SbTYsW0yU6qHwP3-c9cAYM_V-hcH0nA',
  authDomain:        'efp-platform-f2aaa.firebaseapp.com',
  databaseURL:       'https://efp-platform-f2aaa-default-rtdb.europe-west1.firebasedatabase.app',
  projectId:         'efp-platform-f2aaa',
  storageBucket:     'efp-platform-f2aaa.firebasestorage.app',
  messagingSenderId: '362810882988',
  appId:             '1:362810882988:web:8d102cf29e82da26a65809',
})
const db = getDatabase(app)

async function seed() {
  console.log('Seeding demo data…')

  /* ── CLUBS ── */
  await set(ref(db, 'clubs/demo-club-1'), {
    name: 'FC Demo United',
    league: 'Bundesliga',
    country: 'Germany',
    flag: '🇩🇪',
    status: 'In Talks',
    notes: 'Strong interest in signing a left winger for Summer 2026.',
    windowNotes: {
      'Summer 2026': 'Budget confirmed at €4m. Need a wide attacker with Champions League experience.',
      'Winter 2027': 'Looking for a defensive midfielder as backup for Kramer.',
    },
    linkedContacts: [
      { name: 'Hans Müller', role: 'Sporting Director' },
      { name: 'Kai Fischer', role: 'Head Scout' },
    ],
    savedAt: Date.now(),
    tm_id: '123',
    tm_market_value: '€180m',
    tm_squad_size: '26',
    tm_avg_age: '25.4',
    tm_profile_url: 'https://www.transfermarkt.com/fc-demo-united/startseite/verein/123',
    tm_search_pos: 'LW / AM',
    tm_search_age: '21–27',
    tm_search_mv: '€2m – €8m',
  })

  await set(ref(db, 'clubs/demo-club-2'), {
    name: 'SS Demo Roma',
    league: 'Serie A',
    country: 'Italy',
    flag: '🇮🇹',
    status: 'Interested',
    notes: 'Scouting for a striker in Summer 2026 window.',
    windowNotes: {
      'Summer 2026': 'Open to loan with option to buy. Budget up to €3m fee or €80k/month loan.',
    },
    savedAt: Date.now(),
  })

  /* ── MANDATES ── */
  await set(ref(db, 'mandates/demo-mandate-1'), {
    name: 'Marco Rossi',
    pos: 'LW',
    pos2: 'AM',
    age: '23',
    height: '1.78m',
    club: 'FC Demo United',
    nationality: 'Italian',
    foot: 'Left',
    contract: '30/06/2027',
    type: 'Sell',
    contact: 'EFP Sports Agency',
    expectedPrice: '€5.5m',
    salary: '€45,000/month',
    transfer_window: 'Summer 2026',
    value: '€6m',
    statusText: 'Active Mandate',
    source: 'direct',
    savedAt: Date.now(),
  })

  await set(ref(db, 'mandates/demo-mandate-2'), {
    name: 'Luca Bianchi',
    pos: 'ST',
    age: '26',
    height: '1.86m',
    club: 'SS Demo Roma',
    nationality: 'Brazilian',
    foot: 'Right',
    contract: '30/06/2026',
    type: 'Loan',
    contact: 'Top Sports',
    expectedPrice: '€2m loan fee',
    salary: '€70,000/month',
    transfer_window: 'Summer 2026',
    value: '€9m',
    statusText: 'Active Mandate',
    source: 'tm_scout',
    tm_id: '456789',
    tm_profile_url: 'https://www.transfermarkt.com/luca-bianchi/profil/spieler/456789',
    savedAt: Date.now(),
  })

  /* ── PLAYER NOTES ── */
  await set(ref(db, 'playerNotes/Marco%20Rossi'), {
    status: 'Advanced Talks',
    notes: 'Represented by Rino Carbone. Very keen to move to Bundesliga. EFP has exclusivity until end of May.',
    priority: 1,
    dealType: 'Transfer',
    savedAt: Date.now(),
  })

  await set(ref(db, 'playerNotes/Luca%20Bianchi'), {
    status: 'Initial Contact',
    notes: 'Loan deal preferred by parent club. Strong scorer – 14 goals in 22 games last season.',
    priority: 2,
    dealType: 'Loan',
    savedAt: Date.now(),
  })

  /* ── NEEDS ── */
  await set(ref(db, 'needs/demo-need-1'), {
    club: 'FC Demo United',
    positions: ['LW', 'AM'],
    budget: '€4m – €8m',
    status: 'Open',
    notes: 'Must be EU passport holder. Age 21-27.',
  })

  await set(ref(db, 'needs/demo-need-2'), {
    club: 'SS Demo Roma',
    positions: ['ST'],
    budget: 'Loan – up to €3m',
    status: 'Open',
    notes: 'Loan preferred with option. Clinical finisher needed.',
  })

  /* ── CONTACTS ── */
  await set(ref(db, 'contacts/demo-contact-1'), {
    name: 'Hans Müller',
    role: 'Sporting Director',
    club: 'FC Demo United',
    email: 'hans.muller@fc-demo.de',
    phone: '+49 170 000 0001',
    notes: 'Key decision maker. Prefers WhatsApp communication.',
    savedAt: Date.now(),
  })

  await set(ref(db, 'contacts/demo-contact-2'), {
    name: 'Kai Fischer',
    role: 'Head Scout',
    club: 'FC Demo United',
    email: 'kai.fischer@fc-demo.de',
    phone: '+49 170 000 0002',
    notes: 'Initial contact for player proposals.',
    savedAt: Date.now(),
  })

  /* ── PITCHES ── */
  await set(ref(db, 'pitches/demo-pitch-1'), {
    player: 'Marco Rossi',
    club: 'FC Demo United',
    stage: 'advanced',
    note: 'Video sent, medical scheduled for next week.',
    date: '2026-09-10',
  })

  await set(ref(db, 'pitches/demo-pitch-2'), {
    player: 'Luca Bianchi',
    club: 'SS Demo Roma',
    stage: 'initial',
    note: 'Profile shared with sporting director.',
    date: '2026-09-14',
  })

  console.log('✅ Demo data seeded successfully!')
  process.exit(0)
}

seed().catch(e => { console.error(e); process.exit(1) })
