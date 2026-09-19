/**
 * AddContactForm — Add a new contact
 * Writes to Firebase /contacts/{push-id}
 */
import { useState } from 'react'
import { ref, push } from 'firebase/database'
import { db } from '../data/firebase'
import { Drawer, DrawerBody, DrawerFoot, drawerStyles as s } from '../components/Drawer'
import { Button } from '../components/Button'

const ROLES = [
  'Head of Football','Sporting Director','Head Coach','Assistant Coach',
  'Scout','Head of Scouting','President','CEO','Owner',
  'Agent','Agency','Other',
]

interface Props {
  open: boolean
  onClose: () => void
  onSaved?: (id: string) => void
}

export function AddContactForm({ open, onClose, onSaved }: Props) {
  const [name,     setName]     = useState('')
  const [role,     setRole]     = useState('')
  const [club,     setClub]     = useState('')
  const [email,    setEmail]    = useState('')
  const [phone,    setPhone]    = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [notes,    setNotes]    = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const reset = () => {
    setName(''); setRole(''); setClub(''); setEmail('')
    setPhone(''); setLinkedin(''); setNotes(''); setError('')
  }

  const handleClose = () => { reset(); onClose() }

  const handleSave = async () => {
    if (!name.trim()) { setError('Contact name is required'); return }
    setSaving(true); setError('')
    try {
      const r = ref(db, 'contacts')
      const result = await push(r, {
        name: name.trim(),
        role: role || null,
        club: club.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        linkedin: linkedin.trim() || null,
        notes: notes.trim() || null,
        savedAt: Date.now(),
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
    <Drawer open={open} onClose={handleClose} title="New Contact" sub="Add to your network">
      <DrawerBody>
        {error && <div className={s.saveError}>{error}</div>}

        <p className={s.section}>Identity</p>

        <div className={s.field}>
          <label className={s.fieldLabel}>Name <span className={s.req}>*</span></label>
          <input className={s.fieldInput} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Romeo Castelen" />
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.fieldLabel}>Role</label>
            <select className={s.fieldSelect} value={role} onChange={e => setRole(e.target.value)}>
              <option value="">Select…</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className={s.field}>
            <label className={s.fieldLabel}>Club / org</label>
            <input className={s.fieldInput} value={club} onChange={e => setClub(e.target.value)} placeholder="e.g. FC Twente" />
          </div>
        </div>

        <p className={s.section}>Contact details</p>

        <div className={s.field}>
          <label className={s.fieldLabel}>Email</label>
          <input className={s.fieldInput} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@club.com" />
        </div>
        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.fieldLabel}>Phone / WhatsApp</label>
            <input className={s.fieldInput} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+31 …" />
          </div>
          <div className={s.field}>
            <label className={s.fieldLabel}>LinkedIn</label>
            <input className={s.fieldInput} value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="linkedin.com/in/…" />
          </div>
        </div>

        <p className={s.section}>Notes</p>

        <div className={s.field}>
          <label className={s.fieldLabel}>Notes</label>
          <textarea className={s.fieldTextarea} value={notes} onChange={e => setNotes(e.target.value)} placeholder="How you met, relationship context, deal history…" rows={4} />
        </div>
      </DrawerBody>

      <DrawerFoot>
        <Button variant="primary" loading={saving} onClick={handleSave}>Save contact</Button>
        <Button variant="ghost" onClick={handleClose} disabled={saving}>Cancel</Button>
      </DrawerFoot>
    </Drawer>
  )
}
