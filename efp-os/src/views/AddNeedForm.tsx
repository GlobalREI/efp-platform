/**
 * AddNeedForm — Add a new club need / buying requirement
 * Writes to Firebase /needs/{push-id}
 */
import { useState } from 'react'
import { ref, push } from 'firebase/database'
import { db } from '../data/firebase'
import { Drawer, DrawerBody, DrawerFoot, drawerStyles as s } from '../components/Drawer'
import { Button } from '../components/Button'

const POSITIONS = ['GK','CB','RB','RWB','LB','LWB','CDM','CM','CAM','RW','LW','CF','ST','SS']

interface Props {
  open: boolean
  onClose: () => void
  onSaved?: (id: string) => void
}

export function AddNeedForm({ open, onClose, onSaved }: Props) {
  const [club,     setClub]     = useState('')
  const [league,   setLeague]   = useState('')
  const [selPos,   setSelPos]   = useState<string[]>([])
  const [ageMin,   setAgeMin]   = useState('')
  const [ageMax,   setAgeMax]   = useState('')
  const [budMin,   setBudMin]   = useState('')
  const [budMax,   setBudMax]   = useState('')
  const [dealType, setDealType] = useState('transfer')
  const [urgency,  setUrgency]  = useState('open')
  const [contact,  setContact]  = useState('')
  const [notes,    setNotes]    = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const togglePos = (p: string) =>
    setSelPos(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])

  const reset = () => {
    setClub(''); setLeague(''); setSelPos([]); setAgeMin(''); setAgeMax('')
    setBudMin(''); setBudMax(''); setDealType('transfer'); setUrgency('open')
    setContact(''); setNotes(''); setError('')
  }

  const handleClose = () => { reset(); onClose() }

  const handleSave = async () => {
    if (!club.trim()) { setError('Club name is required'); return }
    if (selPos.length === 0) { setError('Select at least one position'); return }
    setSaving(true); setError('')
    try {
      const r = ref(db, 'needs')
      const result = await push(r, {
        club: club.trim(),
        league: league.trim() || null,
        pos: selPos[0],
        positions: selPos,
        ageMin: ageMin ? Number(ageMin) : null,
        ageMax: ageMax ? Number(ageMax) : null,
        budMin: budMin.trim() || null,
        budMax: budMax.trim() || null,
        dealType,
        urgency,
        contact: contact.trim() || null,
        notes: notes.trim() || null,
        status: 'open',
        savedAt: Date.now(),
        archived: false,
      })
      reset()
      onClose()
      onSaved?.(result.key!)
    } catch (e: any) {
      setError(e.message || 'Save failed — check your connection')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} onClose={handleClose} title="New Club Need" sub="Add a buying requirement">
      <DrawerBody>
        {error && <div className={s.saveError}>{error}</div>}

        <p className={s.section}>Club</p>

        <div className={s.field}>
          <label className={s.fieldLabel}>Club name <span className={s.req}>*</span></label>
          <input className={s.fieldInput} value={club} onChange={e => setClub(e.target.value)} placeholder="e.g. NEC Nijmegen" />
        </div>
        <div className={s.field}>
          <label className={s.fieldLabel}>League / country</label>
          <input className={s.fieldInput} value={league} onChange={e => setLeague(e.target.value)} placeholder="e.g. Eredivisie · Netherlands" />
        </div>

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
            <input className={s.fieldInput} type="number" min="15" max="45" value={ageMin} onChange={e => setAgeMin(e.target.value)} placeholder="e.g. 18" />
          </div>
          <div className={s.field}>
            <label className={s.fieldLabel}>Age max</label>
            <input className={s.fieldInput} type="number" min="15" max="45" value={ageMax} onChange={e => setAgeMax(e.target.value)} placeholder="e.g. 25" />
          </div>
        </div>

        <p className={s.section}>Budget & deal</p>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.fieldLabel}>Budget min</label>
            <input className={s.fieldInput} value={budMin} onChange={e => setBudMin(e.target.value)} placeholder="e.g. €1M" />
          </div>
          <div className={s.field}>
            <label className={s.fieldLabel}>Budget max</label>
            <input className={s.fieldInput} value={budMax} onChange={e => setBudMax(e.target.value)} placeholder="e.g. €4M" />
          </div>
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

        <p className={s.section}>Contact & notes</p>

        <div className={s.field}>
          <label className={s.fieldLabel}>Club contact</label>
          <input className={s.fieldInput} value={contact} onChange={e => setContact(e.target.value)} placeholder="e.g. Romeo Castelen · Head of Football" />
        </div>
        <div className={s.field}>
          <label className={s.fieldLabel}>Notes</label>
          <textarea className={s.fieldTextarea} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Intel, context, deal history…" rows={4} />
        </div>
      </DrawerBody>

      <DrawerFoot>
        <Button variant="primary" loading={saving} onClick={handleSave}>Save need</Button>
        <Button variant="ghost" onClick={handleClose} disabled={saving}>Cancel</Button>
      </DrawerFoot>
    </Drawer>
  )
}
