/**
 * AddMandateForm — Add a new player mandate
 * Writes to Firebase /mandates/{push-id}
 */
import { useState } from 'react'
import { ref, push } from 'firebase/database'
import { db } from '../data/firebase'
import { Drawer, DrawerBody, DrawerFoot, drawerStyles as s } from '../components/Drawer'
import { Button } from '../components/Button'
import {
  ClubSearchField,    type ClubResult,
  ContactSearchField, type ContactResult,
  MoneyInput,
} from '../components/FormFields'
import { getCnfClubInfo, searchCnfPlayers } from '../data/squadData'

const POSITIONS    = ['GK','CB','RB','RWB','LB','LWB','CDM','CM','CAM','RW','LW','CF','ST','SS']
const WINDOWS      = ['Summer 2026','Winter 2027','Summer 2027','Winter 2028','Summer 2028']
const MANDATE_TYPES = ['Exclusive','Co-mandate','Non-exclusive','Advisory']
const FEET         = ['Right','Left','Both']

const NATIONALITIES = [
  'Afghan','Albanian','Algerian','Andorran','Angolan','Argentine','Armenian','Australian',
  'Austrian','Azerbaijani','Belgian','Belarusian','Bosnian','Brazilian','Bulgarian',
  'Cameroonian','Canadian','Chilean','Chinese','Colombian','Congolese','Croatian',
  'Czech','Danish','Dominican','Dutch','Ecuadorian','Egyptian','English','Estonian',
  'Finnish','French','Gambian','Georgian','German','Ghanaian','Greek','Guinean',
  'Hungarian','Icelander','Ivorian','Irish','Israeli','Italian','Jamaican','Japanese',
  'Kosovan','Latvian','Lebanese','Liberian','Lithuanian','Macedonian','Malian',
  'Maltese','Mexican','Moldovan','Montenegrin','Moroccan','Namibian','Nigerian',
  'Norwegian','Paraguayan','Polish','Portuguese','Romanian','Russian','Rwandan',
  'Salvadoran','Scottish','Senegalese','Serbian','Slovakian','Slovenian',
  'South African','South Korean','Spanish','Swedish','Swiss','Togolese',
  'Tunisian','Turkish','Ugandan','Ukrainian','Uruguayan','Venezuelan','Welsh',
  'Zambian','Zimbabwean',
]

interface Props {
  open: boolean
  onClose: () => void
  onSaved?: (id: string) => void
}

export function AddMandateForm({ open, onClose, onSaved }: Props) {
  // Player
  const [name,     setName]    = useState('')
  const [pos,      setPos]     = useState('')
  const [pos2,     setPos2]    = useState('')
  const [age,      setAge]     = useState('')
  const [height,   setHeight]  = useState('')
  const [nat,      setNat]     = useState('')
  const [foot,     setFoot]    = useState('Right')

  // Current club (linked)
  const [clubName, setClubName] = useState('')
  const [clubId,   setClubId]   = useState<string | undefined>()

  // Deal
  const [marketValue,   setMarketValue]   = useState('')
  const [expectedPrice, setExpectedPrice] = useState('')
  const [salary,        setSalary]        = useState('')
  const [contractExp,   setContractExp]   = useState('')
  const [mandateType,   setMandateType]   = useState('Exclusive')
  const [window,        setWindow]        = useState('Summer 2026')

  // Contact (linked from /contacts)
  const [contactQuery,  setContactQuery]  = useState('')
  const [contactPerson, setContactPerson] = useState<ContactResult | null>(null)

  // Notes
  const [notes,  setNotes]  = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  // CNF hints
  const [cnfPlayerHint, setCnfPlayerHint] = useState<{ pos: string; club: string } | null>(null)
  const [cnfClubHint,   setCnfClubHint]   = useState<{ league: string; country: string; flag: string } | null>(null)

  const reset = () => {
    setName(''); setPos(''); setPos2(''); setAge(''); setHeight(''); setNat(''); setFoot('Right')
    setClubName(''); setClubId(undefined)
    setMarketValue(''); setExpectedPrice(''); setSalary('')
    setContractExp(''); setMandateType('Exclusive'); setWindow('Summer 2026')
    setContactQuery(''); setContactPerson(null)
    setNotes(''); setError('')
  }

  const handleClose = () => { reset(); onClose() }

  const handleSave = async () => {
    if (!name.trim()) { setError('Player name is required'); return }
    setSaving(true); setError('')
    try {
      const result = await push(ref(db, 'mandates'), {
        name:             name.trim(),
        pos:              pos  || null,
        pos2:             pos2 || null,
        age:              age    ? Number(age)    : null,
        height:           height ? Number(height) : null,
        nationality:      nat.trim()  || null,
        foot:             foot || null,
        club:             clubName.trim() || null,
        club_id:          clubId || null,
        value:            marketValue.trim()   || null,
        expected_price:   expectedPrice.trim() || null,
        salary:           salary.trim()        || null,
        contract_expires: contractExp.trim()   || null,
        mandate_type:     mandateType,
        transfer_window:  window,
        contact_person:   contactPerson?.name || null,
        contact_id:       contactPerson?.id   || null,
        notes:            notes.trim()        || null,
        savedAt:          Date.now(),
        archived:         false,
      })
      reset(); onClose(); onSaved?.(result.key!)
    } catch (e: any) {
      setError(e.message || 'Save failed — check your connection')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} onClose={handleClose} title="Add Player Mandate" sub="Register a player you represent for transfer">
      <DrawerBody>
        {error && <div className={s.saveError}>{error}</div>}

        {/* ── PLAYER ─────────────────────────────── */}
        <p className={s.section}>Player</p>

        <div className={s.field}>
          <label className={s.fieldLabel}>Player Name <span className={s.req}>*</span></label>
          <input
            className={s.fieldInput}
            value={name}
            onChange={e => {
              setName(e.target.value)
              // CNF player lookup
              const hits = searchCnfPlayers(e.target.value, 1)
              if (hits.length > 0) {
                setCnfPlayerHint({ pos: hits[0].pos, club: hits[0].club })
                if (!pos) setPos(hits[0].pos)
              } else {
                setCnfPlayerHint(null)
              }
            }}
            placeholder="Full name"
          />
          {cnfPlayerHint && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)', marginTop: 4 }}>
              📋 Found in CNF data · {cnfPlayerHint.pos} at {cnfPlayerHint.club} — fields pre-filled
            </p>
          )}
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.fieldLabel}>Position <span className={s.req}>*</span></label>
            <select className={s.fieldSelect} value={pos} onChange={e => setPos(e.target.value)}>
              <option value="">Select…</option>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className={s.field}>
            <label className={s.fieldLabel}>Secondary Position</label>
            <select className={s.fieldSelect} value={pos2} onChange={e => setPos2(e.target.value)}>
              <option value="">None</option>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.fieldLabel}>Age</label>
            <input
              className={s.fieldInput}
              type="number" min="15" max="45"
              value={age}
              onChange={e => setAge(e.target.value)}
              placeholder="e.g. 23"
            />
          </div>
          <div className={s.field}>
            <label className={s.fieldLabel}>Height (cm)</label>
            <input
              className={s.fieldInput}
              type="number" min="150" max="220"
              value={height}
              onChange={e => setHeight(e.target.value)}
              placeholder="e.g. 185"
            />
          </div>
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.fieldLabel}>Nationality</label>
            <select className={s.fieldSelect} value={nat} onChange={e => setNat(e.target.value)}>
              <option value="">Select…</option>
              {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className={s.field}>
            <label className={s.fieldLabel}>Preferred Foot</label>
            <select className={s.fieldSelect} value={foot} onChange={e => setFoot(e.target.value)}>
              {FEET.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        {/* ── DEAL ────────────────────────────────── */}
        <p className={s.section}>Deal</p>

        <ClubSearchField
          label="Current Club"
          value={clubName}
          onChange={v => {
            setClubName(v)
            const info = getCnfClubInfo(v)
            setCnfClubHint(info)
          }}
          onSelect={(c: ClubResult) => {
            setClubName(c.name)
            setClubId(c.id)
            const info = getCnfClubInfo(c.name)
            setCnfClubHint(info)
          }}
          placeholder="e.g. LASK"
        />

        {clubId && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: -8, marginBottom: 8 }}>
            ✓ Linked to club record
          </p>
        )}
        {cnfClubHint && !clubId && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)', marginTop: -8, marginBottom: 8 }}>
            {cnfClubHint.flag} CNF: {cnfClubHint.league} · {cnfClubHint.country}
          </p>
        )}

        <div className={s.fieldRow}>
          <MoneyInput label="Market Value"   value={marketValue}   onChange={setMarketValue}   placeholder="€4M" />
          <MoneyInput label="Expected Price" value={expectedPrice} onChange={setExpectedPrice} placeholder="€2.5M" />
        </div>

        <div className={s.fieldRow}>
          <MoneyInput label="Salary (p/m)" value={salary} onChange={setSalary} placeholder="€80K" />
          <div className={s.field}>
            <label className={s.fieldLabel}>Contract Expires</label>
            <input
              className={s.fieldInput}
              value={contractExp}
              onChange={e => setContractExp(e.target.value)}
              placeholder="e.g. Jun 2026"
            />
          </div>
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.fieldLabel}>Mandate Type</label>
            <select className={s.fieldSelect} value={mandateType} onChange={e => setMandateType(e.target.value)}>
              {MANDATE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className={s.field}>
            <label className={s.fieldLabel}>Transfer Window</label>
            <select className={s.fieldSelect} value={window} onChange={e => setWindow(e.target.value)}>
              {WINDOWS.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
        </div>

        {/* ── CONTACT ─────────────────────────────── */}
        <p className={s.section}>Contact</p>

        <ContactSearchField
          label="Contact Person"
          value={contactQuery}
          onChange={q => { setContactQuery(q); if (!q) setContactPerson(null) }}
          onSelect={(c: ContactResult) => { setContactPerson(c); setContactQuery(c.name) }}
          placeholder="Type to search contacts…"
        />

        {contactPerson && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: -8, marginBottom: 8 }}>
            ✓ Linked to contact record
          </p>
        )}

        {/* ── NOTES ───────────────────────────────── */}
        <p className={s.section}>Notes</p>

        <div className={s.field}>
          <label className={s.fieldLabel}>Notes</label>
          <textarea
            className={s.fieldTextarea}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Scouting intel, deal status, context…"
            rows={4}
          />
        </div>
      </DrawerBody>

      <DrawerFoot>
        <Button variant="primary" loading={saving} onClick={handleSave}>Add Mandate</Button>
        <Button variant="ghost" onClick={handleClose} disabled={saving}>Cancel</Button>
      </DrawerFoot>
    </Drawer>
  )
}
