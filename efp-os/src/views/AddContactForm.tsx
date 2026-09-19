/**
 * AddContactForm — Add a new contact
 * Writes to Firebase /contacts/{push-id}
 */
import { useState } from 'react'
import { ref, push } from 'firebase/database'
import { db } from '../data/firebase'
import { Drawer, DrawerBody, DrawerFoot, drawerStyles as s } from '../components/Drawer'
import { Button } from '../components/Button'
import { ClubSearchField, type ClubResult } from '../components/FormFields'

const ROLES = [
  'Head of Football','Sporting Director','Head Coach','Assistant Coach',
  'Scout','Head of Scouting','President','CEO','Owner',
  'Agent','Agency','Lawyer','Intermediary','Other',
]

interface Props {
  open: boolean
  onClose: () => void
  onSaved?: (id: string) => void
}

export function AddContactForm({ open, onClose, onSaved }: Props) {
  const [name,       setName]      = useState('')
  const [role,       setRole]      = useState('')
  const [clubName,   setClubName]  = useState('')
  const [clubId,     setClubId]    = useState<string | undefined>()
  const [email,      setEmail]     = useState('')
  const [phone,      setPhone]     = useState('')
  const [whatsapp,   setWhatsapp]  = useState('')
  const [linkedin,   setLinkedin]  = useState('')
  const [language,   setLanguage]  = useState('')
  const [notes,      setNotes]     = useState('')
  const [saving,     setSaving]    = useState(false)
  const [error,      setError]     = useState('')

  const reset = () => {
    setName(''); setRole(''); setClubName(''); setClubId(undefined)
    setEmail(''); setPhone(''); setWhatsapp(''); setLinkedin('')
    setLanguage(''); setNotes(''); setError('')
  }

  const handleClose = () => { reset(); onClose() }

  const handleSave = async () => {
    if (!name.trim()) { setError('Contact name is required'); return }
    setSaving(true); setError('')
    try {
      const result = await push(ref(db, 'contacts'), {
        name:         name.trim(),
        role:         role || null,
        organisation: clubName.trim() || null,
        club:         clubName.trim() || null,
        club_id:      clubId || null,
        email:        email.trim()    || null,
        phone:        phone.trim()    || null,
        whatsapp:     whatsapp.trim() || null,
        linkedin:     linkedin.trim() || null,
        language:     language.trim() || null,
        notes:        notes.trim()    || null,
        savedAt:      Date.now(),
      })
      reset(); onClose(); onSaved?.(result.key!)
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

        {/* ── IDENTITY ─────────────────────────────── */}
        <p className={s.section}>Identity</p>

        <div className={s.field}>
          <label className={s.fieldLabel}>Name <span className={s.req}>*</span></label>
          <input
            className={s.fieldInput}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Romeo Castelen"
          />
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
            <label className={s.fieldLabel}>Language(s)</label>
            <input
              className={s.fieldInput}
              value={language}
              onChange={e => setLanguage(e.target.value)}
              placeholder="e.g. Dutch, English"
            />
          </div>
        </div>

        <ClubSearchField
          label="Club / Organisation"
          value={clubName}
          onChange={setClubName}
          onSelect={(c: ClubResult) => { setClubName(c.name); setClubId(c.id) }}
          placeholder="e.g. FC Twente"
        />

        {clubId && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: -8, marginBottom: 8 }}>
            ✓ Linked to club record
          </p>
        )}

        {/* ── CONTACT DETAILS ──────────────────────── */}
        <p className={s.section}>Contact details</p>

        <div className={s.field}>
          <label className={s.fieldLabel}>Email</label>
          <input
            className={s.fieldInput}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="name@club.com"
          />
        </div>

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.fieldLabel}>Phone</label>
            <input
              className={s.fieldInput}
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+31 6 …"
            />
          </div>
          <div className={s.field}>
            <label className={s.fieldLabel}>WhatsApp</label>
            <input
              className={s.fieldInput}
              type="tel"
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
              placeholder="+31 6 … (if different)"
            />
          </div>
        </div>

        <div className={s.field}>
          <label className={s.fieldLabel}>LinkedIn</label>
          <input
            className={s.fieldInput}
            value={linkedin}
            onChange={e => setLinkedin(e.target.value)}
            placeholder="linkedin.com/in/…"
          />
        </div>

        {/* ── NOTES ────────────────────────────────── */}
        <p className={s.section}>Notes</p>

        <div className={s.field}>
          <label className={s.fieldLabel}>Notes</label>
          <textarea
            className={s.fieldTextarea}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="How you met, relationship context, deal history…"
            rows={4}
          />
        </div>
      </DrawerBody>

      <DrawerFoot>
        <Button variant="primary" loading={saving} onClick={handleSave}>Save contact</Button>
        <Button variant="ghost" onClick={handleClose} disabled={saving}>Cancel</Button>
      </DrawerFoot>
    </Drawer>
  )
}
