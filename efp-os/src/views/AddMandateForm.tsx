/**
 * AddMandateForm — Add a new player mandate
 * Writes to Firebase /mandates/{push-id}
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

export function AddMandateForm({ open, onClose, onSaved }: Props) {
  const [name,     setName]     = useState('')
  const [pos,      setPos]      = useState('')
  const [pos2,     setPos2]     = useState('')
  const [age,      setAge]      = useState('')
  const [club,     setClub]     = useState('')
  const [value,    setValue]    = useState('')
  const [nat,      setNat]      = useState('')
  const [window,   setWindow]   = useState('Summer 2026')
  const [notes,    setNotes]    = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const reset = () => {
    setName(''); setPos(''); setPos2(''); setAge(''); setClub('')
    setValue(''); setNat(''); setWindow('Summer 2026'); setNotes('')
    setError('')
  }

  const handleClose = () => { reset(); onClose() }

  const handleSave = async () => {
    if (!name.trim()) { setError('Player name is required'); return }
    setSaving(true); setError('')
    try {
      const r = ref(db, 'mandates')
      const result = await push(r, {
        name: name.trim(),
        pos: pos || null,
        pos2: pos2 || null,
        age: age ? Number(age) : null,
        club: club.trim() || null,
        value: value.trim() || null,
        nationality: nat.trim() || null,
        transfer_window: window,
        notes: notes.trim() || null,
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
    <Drawer open={open} onClose={handleClose} title="New Player Mandate" sub="Add to active mandate list">
      <DrawerBody>
        {error && <div className={s.saveError}>{error}</div>}

        <p className={s.section}>Player</p>

        <div className={s.field}>
          <label className={s.fieldLabel}>Name <span className={s.req}>*</span></label>
          <input className={s.fieldInput} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Dennis Geiger" />
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.fieldLabel}>Primary position</label>
            <select className={s.fieldSelect} value={pos} onChange={e => setPos(e.target.value)}>
              <option value="">Select…</option>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className={s.field}>
            <label className={s.fieldLabel}>Secondary position</label>
            <select className={s.fieldSelect} value={pos2} onChange={e => setPos2(e.target.value)}>
              <option value="">—</option>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.fieldLabel}>Age</label>
            <input className={s.fieldInput} type="number" min="15" max="45" value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 24" />
          </div>
          <div className={s.field}>
            <label className={s.fieldLabel}>Nationality</label>
            <input className={s.fieldInput} value={nat} onChange={e => setNat(e.target.value)} placeholder="e.g. German" />
          </div>
        </div>

        <p className={s.section}>Deal</p>

        <div className={s.field}>
          <label className={s.fieldLabel}>Current club</label>
          <input className={s.fieldInput} value={club} onChange={e => setClub(e.target.value)} placeholder="e.g. LASK" />
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.fieldLabel}>Transfer fee / value</label>
            <input className={s.fieldInput} value={value} onChange={e => setValue(e.target.value)} placeholder="e.g. €4M" />
          </div>
          <div className={s.field}>
            <label className={s.fieldLabel}>Window</label>
            <select className={s.fieldSelect} value={window} onChange={e => setWindow(e.target.value)}>
              <option>Summer 2026</option>
              <option>Winter 2027</option>
              <option>Summer 2027</option>
            </select>
          </div>
        </div>

        <p className={s.section}>Notes</p>

        <div className={s.field}>
          <label className={s.fieldLabel}>Notes</label>
          <textarea className={s.fieldTextarea} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Scouting intel, deal status, context…" rows={4} />
        </div>
      </DrawerBody>

      <DrawerFoot>
        <Button variant="primary" loading={saving} onClick={handleSave}>Save mandate</Button>
        <Button variant="ghost" onClick={handleClose} disabled={saving}>Cancel</Button>
      </DrawerFoot>
    </Drawer>
  )
}
