/**
 * ContactDetail — full-page profile for a contact
 *
 * Reads:
 *   /contacts/<id>
 *   /mandates  (to show linked players)
 *   pitches    (via /pitches, to show active pitches at the contact's club)
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ref, onValue, off, set } from 'firebase/database'
import { db } from '../data/firebase'
import {
  PageShell, Card, FieldGrid, Field,
  RailItem, RailEmpty,
} from '../components/PageShell'
import { StatusPill } from '../components/Badge'
import { Button } from '../components/Button'
import styles from './ContactDetail.module.css'

/* ── Types ── */
interface Contact {
  name: string
  role?: string
  club?: string
  email?: string
  phone?: string
  wa?: string
  linkedin?: string
  notes?: string
  stage?: string
  status?: string
  color?: string
  initials?: string
}

interface Mandate {
  id: string
  player?: string
  club?: string
  contact?: string
  status?: string
}

interface Pitch {
  id?: string
  player?: string
  club?: string
  stage?: string
}

const STAGE_DOT: Record<string, string> = {
  'Sent': '#F59E0B', 'Awaiting Reply': '#F59E0B', 'Feedback': '#F59E0B',
  'Active Interest': '#10B981', 'Negotiating': '#10B981', 'Done': '#10B981',
  'Not Interested': '#EF4444',
}

export function ContactDetail() {
  const { id } = useParams<{ id: string }>()
  const nav     = useNavigate()

  const [contact,   setContact]   = useState<Contact | null>(null)
  const [mandates,  setMandates]  = useState<Mandate[]>([])
  const [pitches,   setPitches]   = useState<Pitch[]>([])
  const [loading,   setLoading]   = useState(true)
  const [editMode,  setEditMode]  = useState(false)
  const [draft,     setDraft]     = useState<Contact | null>(null)
  const [saving,    setSaving]    = useState(false)

  /* ── load contact ── */
  useEffect(() => {
    if (!id) return
    const r = ref(db, `contacts/${id}`)
    const h = (snap: any) => {
      if (!snap.exists()) { setContact(null); setLoading(false); return }
      setContact(snap.val())
      setLoading(false)
    }
    onValue(r, h)
    return () => off(r, 'value', h)
  }, [id])

  /* ── load mandates ── */
  useEffect(() => {
    const r = ref(db, 'mandates')
    const h = (snap: any) => {
      if (!snap.exists()) { setMandates([]); return }
      const rows: Mandate[] = Object.entries(snap.val()).map(([mid, v]: [string, any]) => ({ id: mid, ...v }))
      setMandates(rows)
    }
    onValue(r, h)
    return () => off(r, 'value', h)
  }, [])

  /* ── load pitches ── */
  useEffect(() => {
    const r = ref(db, 'pitches')
    const h = (snap: any) => {
      if (!snap.exists()) { setPitches([]); return }
      const rows: Pitch[] = Array.isArray(snap.val())
        ? snap.val()
        : Object.values(snap.val())
      setPitches(rows)
    }
    onValue(r, h)
    return () => off(r, 'value', h)
  }, [])

  /* ── edit/save ── */
  function startEdit() {
    setDraft(contact ? { ...contact } : null)
    setEditMode(true)
  }

  async function saveEdit() {
    if (!draft || !id) return
    setSaving(true)
    await set(ref(db, `contacts/${id}`), draft)
    setSaving(false)
    setEditMode(false)
    setDraft(null)
  }

  function cancelEdit() {
    setEditMode(false)
    setDraft(null)
  }

  function patch(field: keyof Contact, value: string) {
    setDraft(d => d ? { ...d, [field]: value } : d)
  }

  /* ── derived ── */
  const data    = editMode ? draft : contact
  const linked  = mandates.filter(m =>
    m.contact && contact && m.contact.toLowerCase() === contact.name.toLowerCase()
  )
  const clubPitches = pitches.filter(p =>
    p.club && contact?.club &&
    (p.club.toLowerCase().includes(contact.club.toLowerCase()) ||
     contact.club.toLowerCase().includes(p.club.toLowerCase()))
  )

  const initials = data?.initials
    || (data?.name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    || '?'

  /* ── loading ── */
  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinnerRow}>
          <div className={styles.spinner} />
          <span>Loading contact…</span>
        </div>
      </div>
    )
  }

  if (!contact) {
    return (
      <div className={styles.notFound}>
        <p>Contact not found.</p>
        <Button variant="secondary" size="sm" onClick={() => nav('/contacts')}>
          ← Back to Contacts
        </Button>
      </div>
    )
  }

  /* ── rail ── */
  const rail = (
    <>
      {/* Linked Players */}
      <Card title="Linked Players" titleIcon="⚽">
        {linked.length === 0
          ? <RailEmpty message="No players linked to this contact" />
          : linked.map(m => (
            <RailItem
              key={m.id}
              name={m.player || 'Unknown'}
              sub={m.status}
              onClick={() => nav(`/mandates/${m.id}`)}
            />
          ))
        }
      </Card>

      {/* Pitches at club */}
      {clubPitches.length > 0 && (
        <Card title="Active Pitches" titleIcon="📨">
          {clubPitches.map((p, i) => (
            <div key={i} className={styles.pitchRow}>
              <span className={styles.pitchPlayer}>{p.player}</span>
              {p.stage && (
                <span
                  className={styles.pitchDot}
                  style={{ background: STAGE_DOT[p.stage] || '#94A3B8' }}
                />
              )}
              <span className={styles.pitchStage}>{p.stage || '—'}</span>
            </div>
          ))}
        </Card>
      )}

      {/* Quick facts */}
      <Card title="Info">
        {data?.club  && <div className={styles.infoRow}><span className={styles.infoLabel}>Club</span><span>{data.club}</span></div>}
        {data?.role  && <div className={styles.infoRow}><span className={styles.infoLabel}>Role</span><span>{data.role}</span></div>}
        {data?.stage && <div className={styles.infoRow}><span className={styles.infoLabel}>Stage</span><StatusPill status={data.stage} /></div>}
        {linked.length > 0 && <div className={styles.infoRow}><span className={styles.infoLabel}>Mandates</span><span>{linked.length}</span></div>}
      </Card>
    </>
  )

  return (
    <PageShell
      breadcrumbs={[{ label: 'Contacts', to: '/contacts' }, { label: data?.name || '' }]}
      avatar={data?.color
        ? undefined    // PageShell uses name initials
        : initials}
      name={data?.name || ''}
      sub={[data?.role, data?.club].filter(Boolean).join(' · ')}
      chips={[
        data?.email   ? `✉ ${data.email}`   : '',
        data?.phone   ? `📞 ${data.phone}`   : '',
        data?.wa && !data.phone ? `💬 ${data.wa}` : '',
        data?.linkedin ? `🔗 LinkedIn`        : '',
      ].filter(Boolean)}
      badges={data?.stage ? <StatusPill status={data.stage} /> : undefined}
      rail={rail}
      editMode={editMode}
      onEditToggle={on => { if (on) startEdit(); else cancelEdit() }}
      actions={editMode ? (
        <Button variant="primary" size="sm" onClick={saveEdit} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      ) : undefined}
    >
      {/* ── Contact Info ── */}
      <Card title="Contact Info" titleIcon="📋">
        <FieldGrid>
          {editMode ? (
            <>
              <Field label="Name"  value={<input className={styles.editInput} value={draft?.name  || ''} onChange={e => patch('name',  e.target.value)} />} />
              <Field label="Role"  value={<input className={styles.editInput} value={draft?.role  || ''} onChange={e => patch('role',  e.target.value)} />} />
              <Field label="Club"  value={<input className={styles.editInput} value={draft?.club  || ''} onChange={e => patch('club',  e.target.value)} />} />
              <Field label="Stage" value={<input className={styles.editInput} value={draft?.stage || ''} onChange={e => patch('stage', e.target.value)} />} />
              <Field label="Email" value={<input className={styles.editInput} value={draft?.email || ''} onChange={e => patch('email', e.target.value)} />} full />
              <Field label="Phone" value={<input className={styles.editInput} value={draft?.phone || ''} onChange={e => patch('phone', e.target.value)} />} />
              <Field label="WhatsApp" value={<input className={styles.editInput} value={draft?.wa  || ''} onChange={e => patch('wa',    e.target.value)} />} />
              <Field label="LinkedIn"  value={<input className={styles.editInput} value={draft?.linkedin || ''} onChange={e => patch('linkedin', e.target.value)} />} full />
            </>
          ) : (
            <>
              <Field label="Role"   value={data?.role} />
              <Field label="Club"   value={data?.club} />
              <Field label="Stage"  value={data?.stage ? <StatusPill status={data.stage} /> : undefined} />
              <Field label="Status" value={data?.status} />
              <Field label="Email"  value={data?.email
                ? <a className={styles.link} href={`mailto:${data.email}`}>{data.email}</a>
                : undefined} full />
              <Field label="Phone"     value={data?.phone} />
              <Field label="WhatsApp"  value={data?.wa} />
              <Field label="LinkedIn"  value={data?.linkedin
                ? <a className={styles.link} href={data.linkedin} target="_blank" rel="noopener noreferrer">View Profile →</a>
                : undefined} full />
            </>
          )}
        </FieldGrid>
      </Card>

      {/* ── Notes ── */}
      {(data?.notes || editMode) && (
        <Card title="Notes" titleIcon="📝">
          {editMode ? (
            <textarea
              className={styles.editTextarea}
              value={draft?.notes || ''}
              onChange={e => patch('notes', e.target.value)}
              rows={6}
              placeholder="Add notes about this contact…"
            />
          ) : (
            <p className={styles.notesText}>{data?.notes}</p>
          )}
        </Card>
      )}
    </PageShell>
  )
}
