/**
 * NeedDetail — full page for a single club need
 *
 * Reads:
 *   /needs/<id>
 *   /mandates  (to find candidate players by position/fit)
 *   /clubs/<name> or /clubs  (for club context)
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
import styles from './NeedDetail.module.css'

interface Need {
  club?: string
  pos?: string
  positions?: string[]
  budget?: string
  budMin?: string
  budMax?: string
  ageMin?: string
  ageMax?: string
  contact?: string
  urgency?: string
  status?: string
  notes?: string
  dealType?: string
  window?: string
  archived?: boolean
  flag?: string
  league?: string
  needPrio?: string
}

interface Mandate {
  id: string
  player?: string
  name?: string
  pos?: string
  club?: string
  status?: string
  val?: string
}

const URGENCY_LABEL: Record<string, string> = {
  urgent: '🔴 Urgent',
  high:   '🟡 High',
  open:   '🟢 Open',
  closed: '⚫ Closed',
}

export function NeedDetail() {
  const { id } = useParams<{ id: string }>()
  const nav     = useNavigate()

  const [need,     setNeed]     = useState<Need | null>(null)
  const [mandates, setMandates] = useState<Mandate[]>([])
  const [loading,  setLoading]  = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [draft,    setDraft]    = useState<Need | null>(null)
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    if (!id) return
    const r = ref(db, `needs/${id}`)
    const h = (snap: any) => {
      if (!snap.exists()) { setNeed(null); setLoading(false); return }
      setNeed(snap.val())
      setLoading(false)
    }
    onValue(r, h)
    return () => off(r, 'value', h)
  }, [id])

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

  /* ── edit ── */
  function startEdit() { setDraft(need ? { ...need } : null); setEditMode(true) }
  async function saveEdit() {
    if (!draft || !id) return
    setSaving(true)
    await set(ref(db, `needs/${id}`), draft)
    setSaving(false); setEditMode(false); setDraft(null)
  }
  function cancelEdit() { setEditMode(false); setDraft(null) }
  function patch(field: keyof Need, value: string) {
    setDraft(d => d ? { ...d, [field]: value } : d)
  }

  /* ── derived ── */
  const data      = editMode ? draft : need
  const positions = data?.positions?.length ? data.positions : (data?.pos ? [data.pos] : [])
  const budget    = data?.budMin && data?.budMax
    ? `${data.budMin} – ${data.budMax}`
    : (data?.budget || '—')

  // Candidates: mandates that match one of the need's positions
  const candidates = mandates.filter(m => {
    if (!positions.length) return false
    const mp = (m.pos || '').toLowerCase()
    return positions.some(p => p.toLowerCase() === mp || mp.includes(p.toLowerCase()))
  })

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinnerRow}>
          <div className={styles.spinner} />
          <span>Loading…</span>
        </div>
      </div>
    )
  }

  if (!need) {
    return (
      <div className={styles.notFound}>
        <p>Need not found.</p>
        <Button variant="secondary" size="sm" onClick={() => nav('/needs')}>← Back to Needs</Button>
      </div>
    )
  }

  const rail = (
    <>
      {/* Candidate Players */}
      <Card title="Position Candidates" titleIcon="⚽">
        {candidates.length === 0
          ? <RailEmpty message={positions.length ? 'No players on file match this position' : 'Add a position to see candidates'} />
          : candidates.map(m => (
            <RailItem
              key={m.id}
              name={m.player || m.name || 'Unknown'}
              sub={[m.pos, m.club].filter(Boolean).join(' · ')}
              right={m.status ? <StatusPill status={m.status} /> : undefined}
              onClick={() => nav(`/mandates/${m.id}`)}
            />
          ))
        }
      </Card>

      {/* Quick info */}
      <Card title="Info">
        <div className={styles.infoRow}><span className={styles.infoLabel}>Club</span><span>{data?.club || '—'}</span></div>
        {data?.league && <div className={styles.infoRow}><span className={styles.infoLabel}>League</span><span>{data.league}</span></div>}
        <div className={styles.infoRow}><span className={styles.infoLabel}>Status</span><span>{URGENCY_LABEL[data?.urgency || 'open'] || '—'}</span></div>
        <div className={styles.infoRow}><span className={styles.infoLabel}>Budget</span><span>{budget}</span></div>
        {data?.dealType && <div className={styles.infoRow}><span className={styles.infoLabel}>Deal</span><span style={{ textTransform: 'capitalize' }}>{data.dealType}</span></div>}
        {data?.window && <div className={styles.infoRow}><span className={styles.infoLabel}>Window</span><span>{data.window}</span></div>}
        {candidates.length > 0 && <div className={styles.infoRow}><span className={styles.infoLabel}>Candidates</span><span>{candidates.length}</span></div>}
      </Card>
    </>
  )

  return (
    <PageShell
      breadcrumbs={[{ label: 'Needs', to: '/needs' }, { label: `${data?.club || 'Need'} — ${positions.join(', ') || 'No position'}` }]}
      avatar={data?.flag || (data?.club || 'N')[0].toUpperCase()}
      name={data?.club || 'Club Need'}
      sub={positions.join(' · ') || 'No position specified'}
      chips={[
        budget !== '—' ? `💰 ${budget}` : '',
        data?.window   ? `📅 ${data.window}` : '',
        data?.dealType && data.dealType !== 'either' ? (data.dealType === 'loan' ? '🔄 Loan' : '✍ Buy') : '',
        data?.contact  ? `👤 ${data.contact}` : '',
      ].filter(Boolean)}
      badges={data?.urgency ? <span className={styles.urgencyBadge}>{URGENCY_LABEL[data.urgency] || data.urgency}</span> : undefined}
      rail={rail}
      editMode={editMode}
      onEditToggle={on => { if (on) startEdit(); else cancelEdit() }}
      actions={editMode ? (
        <Button variant="primary" size="sm" onClick={saveEdit} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      ) : undefined}
    >
      {/* ── Need Details ── */}
      <Card title="Requirement Details" titleIcon="📋">
        <FieldGrid>
          {editMode ? (
            <>
              <Field label="Club"    value={<input className={styles.editInput} value={draft?.club   || ''} onChange={e => patch('club',   e.target.value)} />} />
              <Field label="League"  value={<input className={styles.editInput} value={draft?.league || ''} onChange={e => patch('league', e.target.value)} />} />
              <Field label="Position" value={<input className={styles.editInput} value={draft?.pos   || ''} onChange={e => patch('pos',    e.target.value)} />} />
              <Field label="Urgency" value={
                <select className={styles.editSelect} value={draft?.urgency || 'open'} onChange={e => patch('urgency', e.target.value)}>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              } />
              <Field label="Budget Min" value={<input className={styles.editInput} value={draft?.budMin || ''} onChange={e => patch('budMin', e.target.value)} />} />
              <Field label="Budget Max" value={<input className={styles.editInput} value={draft?.budMax || ''} onChange={e => patch('budMax', e.target.value)} />} />
              <Field label="Age Min"   value={<input className={styles.editInput} value={draft?.ageMin || ''} onChange={e => patch('ageMin', e.target.value)} />} />
              <Field label="Age Max"   value={<input className={styles.editInput} value={draft?.ageMax || ''} onChange={e => patch('ageMax', e.target.value)} />} />
              <Field label="Deal Type" value={
                <select className={styles.editSelect} value={draft?.dealType || 'either'} onChange={e => patch('dealType', e.target.value)}>
                  <option value="either">Either</option>
                  <option value="loan">Loan</option>
                  <option value="buy">Buy</option>
                </select>
              } />
              <Field label="Window"  value={<input className={styles.editInput} value={draft?.window  || ''} onChange={e => patch('window',  e.target.value)} />} />
              <Field label="Contact" value={<input className={styles.editInput} value={draft?.contact || ''} onChange={e => patch('contact', e.target.value)} />} />
            </>
          ) : (
            <>
              <Field label="Club"      value={data?.club} />
              <Field label="League"    value={data?.league} />
              <Field label="Position"  value={positions.join(', ') || undefined} />
              <Field label="Urgency"   value={URGENCY_LABEL[data?.urgency || ''] || data?.urgency} />
              <Field label="Budget"    value={budget !== '—' ? budget : undefined} />
              <Field label="Age Range" value={data?.ageMin && data?.ageMax ? `${data.ageMin}–${data.ageMax}` : undefined} />
              <Field label="Deal Type" value={data?.dealType !== 'either' ? data?.dealType : undefined} />
              <Field label="Window"    value={data?.window} />
              <Field label="Contact"   value={data?.contact} />
              <Field label="Status"    value={data?.status ? <StatusPill status={data.status} /> : undefined} />
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
              rows={5}
              placeholder="Notes about this requirement…"
            />
          ) : (
            <p className={styles.notesText}>{data?.notes}</p>
          )}
        </Card>
      )}
    </PageShell>
  )
}
