/**
 * seed-real.mjs — seeds REAL EFP data into Firebase Realtime Database
 * Run: node seed-real.mjs
 */
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, set, remove } from 'firebase/database'

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
  console.log('Seeding real EFP data…')

  /* ── CLEAN DEMO RECORDS ── */
  console.log('Removing demo records…')
  await remove(ref(db, 'clubs/demo-club-1'))
  await remove(ref(db, 'clubs/demo-club-2'))
  await remove(ref(db, 'mandates/demo-mandate-1'))
  await remove(ref(db, 'mandates/demo-mandate-2'))
  await remove(ref(db, 'needs/demo-need-1'))
  await remove(ref(db, 'needs/demo-need-2'))
  await remove(ref(db, 'contacts/demo-contact-1'))
  await remove(ref(db, 'contacts/demo-contact-2'))
  await remove(ref(db, 'pitches/demo-pitch-1'))
  await remove(ref(db, 'pitches/demo-pitch-2'))
  await remove(ref(db, 'playerNotes/Marco%20Rossi'))
  await remove(ref(db, 'playerNotes/Luca%20Bianchi'))
  console.log('Demo records removed.')

  /* ── CONTACTS ── */
  console.log('Writing contacts…')

  await set(ref(db, 'contacts/alex-kroes'), {
    name:         'Alex Kroes',
    role:         'Technical Director',
    organisation: 'LASK',
    club:         'LASK',
    email:        null,
    phone:        null,
    whatsapp:     null,
    linkedin:     null,
    language:     'Dutch / English',
    notes:        'Direct mandate for all LASK players. Summer 2026 window. Key decision maker.',
    savedAt:      Date.now(),
  })

  await set(ref(db, 'contacts/romeo-castelen'), {
    name:         'Romeo Castelen',
    role:         'Contact',
    organisation: 'FC Twente / Club Brugge',
    club:         null,
    email:        null,
    phone:        null,
    whatsapp:     null,
    linkedin:     null,
    language:     'Dutch',
    notes:        'Buying requirements at FC Twente and Club Brugge.',
    savedAt:      Date.now(),
  })

  /* ── BUYING CLUBS ── */
  console.log('Writing clubs…')

  await set(ref(db, 'clubs/fc-twente'), {
    name:    'FC Twente',
    league:  'Eredivisie',
    country: 'Netherlands',
    flag:    '🇳🇱',
    status:  'In Talks',
    notes:   'Buying requirement via Romeo Castelen. Active in Summer 2026.',
    windowNotes: {
      'Summer 2026': 'Open buying requirement. Contact: Romeo Castelen.',
    },
    linkedContacts: [{ name: 'Romeo Castelen', role: 'Contact' }],
    savedAt: Date.now(),
  })

  await set(ref(db, 'clubs/club-brugge'), {
    name:    'Club Brugge',
    league:  'Pro League',
    country: 'Belgium',
    flag:    '🇧🇪',
    status:  'In Talks',
    notes:   'Buying requirement via Romeo Castelen. Active in Summer 2026.',
    windowNotes: {
      'Summer 2026': 'Open buying requirement. Contact: Romeo Castelen.',
    },
    linkedContacts: [{ name: 'Romeo Castelen', role: 'Contact' }],
    savedAt: Date.now(),
  })

  await set(ref(db, 'clubs/lask'), {
    name:    'LASK',
    league:  'Austrian Bundesliga',
    country: 'Austria',
    flag:    '🇦🇹',
    status:  'Active Client',
    notes:   'Selling mandate for 7 players via Alex Kroes (Technical Director). Summer 2026.',
    windowNotes: {
      'Summer 2026': '7-player mandate from Alex Kroes. Active sale window.',
    },
    linkedContacts: [{ name: 'Alex Kroes', role: 'Technical Director' }],
    savedAt: Date.now(),
  })

  await set(ref(db, 'clubs/werder-bremen'), {
    name:    'Werder Bremen',
    league:  'Bundesliga',
    country: 'Germany',
    flag:    '🇩🇪',
    status:  'Pending',
    notes:   'Skelly Alvero mandate pending. Summer 2026.',
    windowNotes: {
      'Summer 2026': 'Skelly Alvero selling mandate in discussion.',
    },
    savedAt: Date.now(),
  })

  /* ── SELLING MANDATES — LASK players (all via Alex Kroes) ── */
  console.log('Writing mandates…')

  // Kasper Jörgensen – GK
  await set(ref(db, 'mandates/kasper-jorgensen'), {
    name:             'Kasper Jörgensen',
    pos:              'GK',
    pos2:             null,
    age:              null,
    height:           null,
    nationality:      'Danish',
    foot:             null,
    club:             'LASK',
    club_id:          null,
    value:            null,
    expected_price:   null,
    salary:           null,
    contract_expires: null,
    mandate_type:     'Sell',
    transfer_window:  'Summer 2026',
    contact_person:   'Alex Kroes',
    contact_id:       'alex-kroes',
    notes:            'Direct mandate from Alex Kroes (Technical Director, LASK).',
    savedAt:          Date.now(),
    archived:         false,
  })

  // Melayro Bogarde – LB
  await set(ref(db, 'mandates/melayro-bogarde'), {
    name:             'Melayro Bogarde',
    pos:              'LB',
    pos2:             'CB',
    age:              null,
    height:           null,
    nationality:      'Dutch',
    foot:             'Left',
    club:             'LASK',
    club_id:          null,
    value:            null,
    expected_price:   null,
    salary:           null,
    contract_expires: null,
    mandate_type:     'Sell',
    transfer_window:  'Summer 2026',
    contact_person:   'Alex Kroes',
    contact_id:       'alex-kroes',
    notes:            'Direct mandate from Alex Kroes (Technical Director, LASK). Dutch passport.',
    savedAt:          Date.now(),
    archived:         false,
  })

  // Moses Usor – LW / RW
  await set(ref(db, 'mandates/moses-usor'), {
    name:             'Moses Usor',
    pos:              'LW',
    pos2:             'RW',
    age:              null,
    height:           null,
    nationality:      'Nigerian',
    foot:             null,
    club:             'LASK',
    club_id:          null,
    value:            null,
    expected_price:   null,
    salary:           null,
    contract_expires: null,
    mandate_type:     'Sell',
    transfer_window:  'Summer 2026',
    contact_person:   'Alex Kroes',
    contact_id:       'alex-kroes',
    notes:            'Direct mandate from Alex Kroes (Technical Director, LASK).',
    savedAt:          Date.now(),
    archived:         false,
  })

  // Samuel Adeniran – ST
  await set(ref(db, 'mandates/samuel-adeniran'), {
    name:             'Samuel Adeniran',
    pos:              'ST',
    pos2:             null,
    age:              null,
    height:           null,
    nationality:      'English',
    foot:             null,
    club:             'LASK',
    club_id:          null,
    value:            null,
    expected_price:   null,
    salary:           null,
    contract_expires: null,
    mandate_type:     'Sell',
    transfer_window:  'Summer 2026',
    contact_person:   'Alex Kroes',
    contact_id:       'alex-kroes',
    notes:            'Direct mandate from Alex Kroes (Technical Director, LASK).',
    savedAt:          Date.now(),
    archived:         false,
  })

  // Maximilian Entrup – ST
  await set(ref(db, 'mandates/maximilian-entrup'), {
    name:             'Maximilian Entrup',
    pos:              'ST',
    pos2:             'LW',
    age:              null,
    height:           null,
    nationality:      'Austrian',
    foot:             null,
    club:             'LASK',
    club_id:          null,
    value:            null,
    expected_price:   null,
    salary:           null,
    contract_expires: null,
    mandate_type:     'Sell',
    transfer_window:  'Summer 2026',
    contact_person:   'Alex Kroes',
    contact_id:       'alex-kroes',
    notes:            'Direct mandate from Alex Kroes (Technical Director, LASK).',
    savedAt:          Date.now(),
    archived:         false,
  })

  // Christoph Lang – CAM
  await set(ref(db, 'mandates/christoph-lang'), {
    name:             'Christoph Lang',
    pos:              'CAM',
    pos2:             'CM',
    age:              null,
    height:           null,
    nationality:      'Austrian',
    foot:             null,
    club:             'LASK',
    club_id:          null,
    value:            null,
    expected_price:   null,
    salary:           null,
    contract_expires: null,
    mandate_type:     'Sell',
    transfer_window:  'Summer 2026',
    contact_person:   'Alex Kroes',
    contact_id:       'alex-kroes',
    notes:            'Direct mandate from Alex Kroes (Technical Director, LASK).',
    savedAt:          Date.now(),
    archived:         false,
  })

  // Art Smakaj – CM
  await set(ref(db, 'mandates/art-smakaj'), {
    name:             'Art Smakaj',
    pos:              'CM',
    pos2:             null,
    age:              null,
    height:           null,
    nationality:      'Albanian',
    foot:             null,
    club:             'LASK',
    club_id:          null,
    value:            null,
    expected_price:   null,
    salary:           null,
    contract_expires: null,
    mandate_type:     'Sell',
    transfer_window:  'Summer 2026',
    contact_person:   'Alex Kroes',
    contact_id:       'alex-kroes',
    notes:            'Direct mandate from Alex Kroes (Technical Director, LASK).',
    savedAt:          Date.now(),
    archived:         false,
  })

  // Thiago Nuss – selling mandate
  await set(ref(db, 'mandates/thiago-nuss'), {
    name:             'Thiago Nuss',
    pos:              'RW',
    pos2:             'LW',
    age:              null,
    height:           null,
    nationality:      'Brazilian',
    foot:             null,
    club:             null,
    club_id:          null,
    value:            null,
    expected_price:   null,
    salary:           null,
    contract_expires: null,
    mandate_type:     'Sell',
    transfer_window:  'Summer 2026',
    contact_person:   null,
    contact_id:       null,
    notes:            'Selling mandate.',
    savedAt:          Date.now(),
    archived:         false,
  })

  // Skelly Alvero – Werder Bremen (pending)
  await set(ref(db, 'mandates/skelly-alvero'), {
    name:             'Skelly Alvero',
    pos:              'AM',
    pos2:             'LW',
    age:              null,
    height:           null,
    nationality:      null,
    foot:             null,
    club:             'Werder Bremen',
    club_id:          'werder-bremen',
    value:            null,
    expected_price:   null,
    salary:           null,
    contract_expires: null,
    mandate_type:     'Sell',
    transfer_window:  'Summer 2026',
    contact_person:   null,
    contact_id:       null,
    notes:            'Selling mandate — pending confirmation.',
    savedAt:          Date.now(),
    archived:         false,
  })

  /* ── BUYING NEEDS ── */
  console.log('Writing needs…')

  await set(ref(db, 'needs/twente-open'), {
    club:            'FC Twente',
    club_id:         'fc-twente',
    league:          'Eredivisie',
    pos:             null,
    positions:       [],
    ageMin:          null,
    ageMax:          null,
    player_nat:      null,
    budMin:          null,
    budMax:          null,
    loan_fee:        null,
    salary:          null,
    dealType:        'Transfer',
    urgency:         'High',
    transfer_window: 'Summer 2026',
    contact:         'Romeo Castelen',
    contact_id:      'romeo-castelen',
    notes:           'Open buying requirement. Details TBC. Contact: Romeo Castelen.',
    status:          'open',
    savedAt:         Date.now(),
    archived:        false,
  })

  await set(ref(db, 'needs/brugge-open'), {
    club:            'Club Brugge',
    club_id:         'club-brugge',
    league:          'Pro League',
    pos:             null,
    positions:       [],
    ageMin:          null,
    ageMax:          null,
    player_nat:      null,
    budMin:          null,
    budMax:          null,
    loan_fee:        null,
    salary:          null,
    dealType:        'Transfer',
    urgency:         'High',
    transfer_window: 'Summer 2026',
    contact:         'Romeo Castelen',
    contact_id:      'romeo-castelen',
    notes:           'Open buying requirement. Details TBC. Contact: Romeo Castelen.',
    status:          'open',
    savedAt:         Date.now(),
    archived:        false,
  })

  console.log('✅ Real EFP data seeded successfully!')
  console.log('   → 2 contacts')
  console.log('   → 4 clubs (LASK, Werder Bremen, FC Twente, Club Brugge)')
  console.log('   → 9 mandates (7× LASK, Thiago Nuss, Skelly Alvero)')
  console.log('   → 2 needs (FC Twente, Club Brugge)')
  process.exit(0)
}

seed().catch(e => { console.error(e); process.exit(1) })
