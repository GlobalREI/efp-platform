/**
 * AddNeedForm — Add a new club need / buying requirement
 * Writes to Firebase /needs/{push-id}
 */
import { useState } from 'react'
import { ref, push } from 'firebase/database'
import { db } from '../data/firebase'
import { Drawer, DrawerBody, DrawerFoot, drawerStyles as s } from '../components/Drawer'
import { Button } from '../components/Button'
import {
  ClubSearchField,  type ClubResult,
  ContactSearchField, type ContactResult,
  MoneyInput,
} from '../components/FormFields'

const POSITIONS = ['GK','CB','RB','RWB','LB','LWB','CDM','CM','CAM','RW','LW','CF','ST','SS']

interface Props {
  open: boolean
  onClose: () => void
  onSaved?: (id: string) => void
}

export function AddNeedForm({ open, onClose, onSaved }: Props) {
  // Club
  const [clubName,   setClubName]   = useState('')
  const [clubId,     setClubId]     = useState<string | undefined>()
  const [league,     setLeague]     = useState('')

  // Requirement
  const [selPos,     setSelPos]     = useState<string[]>([])
  const [ageMin,     setAgeMin]     = useState('')
  const [ageMax,     setAgeMax]     = useState('')
  const [playerNat,  setPlayerNat]  = useState('')

  // Budget & deal
  const [budMin,     setBudMin]     = useState('')
  const [budMax,     setBudMax]     = useState('')
  const [loanFee,    setLoanFee]    = useState('')
  const [salary,     setSalary]     = useState('')
  const [dealType,   setDealType]   = useState('transfer')
  const [urgency,    setUrgency]    = useState('open')
  const [window,     setWindow]     = useState('Summer 2026')

  // Contact
  const [contactQuery,  setContactQuery]  = useState('')
  const [contactPerson, setContactPerson] = useState<ContactResult | null>(null)

  // Notes
  const [notes, setNotes] = useState('')

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const togglePos = (p: string) =>
    setSelPos(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])

  const reset = () => {
    setClubName(''); setClubId(undefined); setLeague('')
    setSelPos([]); setAgeMin(''); setAgeMax(''); setPlayerNat('')
    setBudMin(''); setBudMax(''); setLoanFee(''); setSalary('')
    setDealType('transfer'); setUrgency('open'); setWindow('Summer 2026')
    setContactQuery(''); setContactPerson(null)
    setNotes(''); setError('')
  }

  const handleClose = () => { reset(); onClose() }

  const handleSave = async () => {
    if (!clubName.trim())       { setError('Club name is required'); return }
    if (selPos.length === 0)    { setError('Select at least one position'); return }
    setSaving(true); setError('')
    try {
      const result = await push(ref(db, 'needs'), {
        club:             clubName.trim(),
        club_id:          clubId || null,
        league:           league.trim() || null,
        pos:              selPos[0],
        positions:        selPos,
        ageMin:           ageMin ? Number(ageMin) : null,
        ageMax:           ageMax ? Number(ageMax) : null,
        player_nat:       playerNat.trim() || null,
        budMin:           budMin.trim() || null,
        budMax:           budMax.trim() || null,
        loan_fee:         loanFee.trim() || null,
        salary:           salary.trim() || null,
        dealType,
        urgency,
        transfer_window:  window,
        contact:          contactPerson?.name || null,
        contact_id:       contactPerson?.id   || null,
        notes:            notes.trim() || null,
        status:           'open',
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
    <Drawer open={open} onClose={handleClose} title="New Club Need" sub="Register a buying requirement">
      <DrawerBody>
        {error && <div className={s.saveError}>{error}</div>}

        {/* ── CLUB ─────────────────────────────────── */}
        <p className={s.section}>Club</p>

        <ClubSearchField
          label="Club name"
          value={clubName}
          onChange={setClubName}
          onSelect={(c: ClubResult) => { setClubName(c.name); setClubId(c.id) }}
          placeholder="e.g. NEC Nijmegen"
          required
        />

        <div className={s.field}>
          <label className={s.fieldLabel}>League / country</label>
          <input
            className={s.fieldInput}
            value={league}
            onChange={e => setLeague(e.target.value)}
            placeholder="e.g. Eredivisie · Netherlands"
          />
        </div>

        {/* ── REQUIREMENT ──────────────────────────── */}
        <p className={s.section}>Requirement</p>

        <div className={s.field}>
          <label className={s.fieldLabel}>Position(s) <span className={s.req}>*</span></label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
            {POSITIONS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => togglePos(p)}
                style={{
                  padding: '5px 11px',
                  borderRadius: '6px',
                  border: `1.5px solid ${selPos.includes(p) ? 'var(--brand)' : 'var(--border)'}`,
                  background: selPos.includes(p) ? 'rgba(58,139,74,0.1)' : 'var(--surface-0)',
                  color: selPos.includes(p) ? 'var(--brand)' : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: selPos.includes(p) ? '600' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.1s',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.fieldLabel}>Age min</label>
            <input
              className={s.fieldInput}
              type="number" min="15" max="45"
              value={ageMin}
              onChange={e => setAgeMin(e.target.value)}
              placeholder="e.g. 18"
            />
          </div>
          <div className={s.field}>
            <label className={s.fieldLabel}>Age max</label>
            <input
              className={s.fieldInput}
              type="number" min="15" max="45"
              value={ageMax}
              onChange={e => setAgeMax(e.target.value)}
              placeholder="e.g. 25"
            />
          </div>
        </div>

        <div className={s.field}>
          <label className={s.fieldLabel}>Nationality preference</label>
          <input
            className={s.fieldInput}
            value={playerNat}
            onChange={e => setPlayerNat(e.target.value)}
            placeholder="e.g. EU passport, Dutch"
          />
        </div>

        {/* ── BUDGET & DEAL ────────────────────────── */}
        <p className={s.section}>Budget & deal</p>

        <div className={s.fieldRow}>
          <MoneyInput label="Budget min" value={budMin} onChange={setBudMin} placeholder="€1M" />
          <MoneyInput label="Budget max" value={budMax} onChange={setBudMax} placeholder="€4M" />
        </div>

        <div className={s.fieldRow}>
          <MoneyInput label="Loan fee (if loan)" value={loanFee} onChange={setLoanFee} placeholder="€200K" />
          <MoneyInput label="Salary (p/m)" value={salary} onChange={setSalary} placeholder="€80K" />
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.fieldLabel}>Deal type</label>
            <select className={s.fieldSelect} value={dealType} onChange={e => setDealType(e.target.value)}>
              <option value="transfer">Transfer</option>
              <option value="loan">Loan</option>
              <option value="either">Transfer or loan</option>
              <option value="free">Free agent</option>
            </select>
          </div>
          <div className={s.field}>
            <label className={s.fieldLabel}>Urgency</label>
            <select className={s.fieldSelect} value={urgency} onChange={e => setUrgency(e.target.value)}>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        <div className={s.field}>
          <label className={s.fieldLabel}>Transfer window</label>
          <select className={s.fieldSelect} value={window} onChange={e => setWindow(e.target.value)}>
            {['Summer 2026','Winter 2027','Summer 2027','Winter 2028','Summer 2028'].map(w =>
              <option key={w} value={w}>{w}</option>
            )}
          </select>
        </div>

        {/* ── CONTACT ──────────────────────────────── */}
        <p className={s.section}>Club contact</p>

        <ContactSearchField
          label="Contact person at club"
          value={contactQuery}
          onChange={q => { setContactQuery(q); if (!q) setContactPerson(null) }}
          onSelect={(c: ContactResult) => { setContactPerson(c); setContactQuery(c.name) }}
          placeholder="Search your contacts…"
        />

        {contactPerson && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: -8, marginBottom: 8 }}>
            ✓ Linked to contact record
          </p>
        )}

        {/* ── NOTES ────────────────────────────────── */}
        <p className={s.section}>Notes</p>

        <div className={s.field}>
          <label className={s.fieldLabel}>Notes</label>
          <textarea
            className={s.fieldTextarea}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Intel, context, deal history…"
            rows={4}
          />
        </div>
      </DrawerBody>

      <DrawerFoot>
        <Button variant="primary" loading={saving} onClick={handleSave}>Save need</Button>
        <Button variant="ghost" onClick={handleClose} disabled={saving}>Cancel</Button>
      </DrawerFoot>
    </Drawer>
  )
}
