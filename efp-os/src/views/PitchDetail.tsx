/**
 * PitchDetail — full page for a single pitch
 *
 * Note: pitches are stored as an array in Firebase, so the :id param is
 * the array index (or the explicit id field if present).
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ref, onValue, off, set } from 'firebase/database'
import { db } from '../data/firebase'
import {
  PageShell, Card, FieldGrid, Field,
  RailItem,
} from '../components/PageShell'
import { Button } from '../components/Button'
import styles from './PitchDetail.module.css'

interface Pitch {
  id?: string | number
  player?: string
  club?: string
  contact?: string
  flag?: string
  pos?: string
  stage?: string
  note?: string
  hot?: boolean
  pdfName?: string
}

interface Mandate {
  id: string
  player?: string
  name?: string
  pos?: string
  club?: string
  status?: string
}

const STAGE_OPTIONS = [
  'sent', 'awaiting', 'feedback', 'interest', 'negotiations', 'done', 'rejected',
]

const STAGE_LABEL: Record<string, string> = {
  sent:         'Sent',
  awaiting:     'Awaiting Reply',
  feedback:     'Feedback Received',
  interest:     'Active Interest',
  negotiations: 'In Negotiations',
  done:         'Deal Done ✓',
  rejected:     'Not Interested',
}

const STAGE_COLOR: Record<string, string> = {
  sent:         '#94A3B8',
  awaiting:     '#F59E0B',
  feedback:     '#8B5CF6',
  interest:     '#3B82F6',
  negotiations: '#F97316',
  done:         '#10B981',
  rejected:     '#EF4444',
}

export function PitchDetail() {
  const { id } = useParams<{ id: string }>()
  const nav     = useNavigate()

  const [pitch,     setPitch]    = useState<Pitch | null>(null)
  const [allPitches, setAll]     = useState<Pitch[]>([])
  const [mandates,  setMandates] = useState<Mandate[]>([])
  const [loading,   setLoading]  = useState(true)
  const [editMode,  setEditMode] = useState(false)
  const [draft,     setDraft]    = useState<Pitch | null>(null)
  const [saving,    setSaving]   = useState(false)

  /* ── load pitches ── */
  useEffect(() => {
    const r = ref(db, 'pitches')
    const h = (snap: any) => {
      if (!snap.exists()) { setPitch(null); setLoading(false); return }
      const raw = snap.val()
      const rows: Pitch[] = Array.isArray(raw)
        ? raw.map((p: any, i: number) => ({ ...p, id: p.id ?? i }))
        : Object.entries(raw).map(([k, v]: [string, any]) => ({ id: k, ...v }))
      setAll(rows)
      const found = rows.find(p => String(p.id) === id)
      setPitch(found || null)
      setLoading(false)
    }
    onValue(r, h)
    return () => off(r, 'value', h)
  }, [id])

  /* ── load mandates ── */
  useEffect(() => {
    const r = ref(db, 'mandates')
    const h = (snap: any) => {
      if (!snap.exists()) return
      const rows: Mandate[] = Object.entries(snap.val()).map(([mid, v]: [string, any]) => ({ id: mid, ...v }))
      setMandates(rows)
    }
    onValue(r, h)
    return () => off(r, 'value', h)
  }, [])

  /* ── edit/save (pitches are an array — save full array) ── */
  function startEdit() { setDraft(pitch ? { ...pitch } : null); setEditMode(true) }
  async function saveEdit() {
    if (!draft || !id) return
    setSaving(true)
    // Replace the pitch in the array
    const updated = allPitches.map(p => String(p.id) === id ? { ...p, ...draft } : p)
    await set(ref(db, 'pitches'), updated)
    setSaving(false); setEditMode(false); setDraft(null)
  }
  function cancelEdit() { setEditMode(false); setDraft(null) }
  function patch(field: keyof Pitch, value: string | boolean) {
    setDraft(d => d ? { ...d, [field]: value } : d)
  }

  const data = editMode ? draft : pitch

  /* Mandate profile for this player */
  const mandate = mandates.find(m =>
    pitch?.player && (m.player || m.name || '').toLowerCase() === pitch.player.toLowerCase()
  )

  /* Other pitches for the same player */
  const relatedPitches = allPitches.filter(p =>
    String(p.id) !== id &&
    pitch?.player &&
    (p.player || '').toLowerCase() === pitch.player.toLowerCase()
  )

  const stageColor = STAGE_COLOR[data?.stage || 'sent']
  const stageLabel = STAGE_LABEL[data?.stage || 'sent'] || data?.stage

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} />
      </div>
    )
  }

  if (!pitch) {
    return (
      <div className={styles.notFound}>
        <p>Pitch not found.</p>
        <Button variant="secondary" size="sm" onClick={() => nav('/pitches')}>← Back to Pitches</Button>
      </div>
    )
  }

  const rail = (
    <>
      {/* Player profile if exists */}
      {mandate && (
        <Card title="Player Profile" titleIcon="⚽">
          <RailItem
            name={mandate.player || mandate.name || ''}
            sub={[mandate.pos, mandate.club].filter(Boolean).join(' · ')}
            onClick={() => nav(`/mandates/${mandate.id}`)}
          />
        </Card>
      )}

      {/* Related pitches */}
      {relatedPitches.length > 0 && (
        <Card title="Other Pitches" titleIcon="📨">
          {relatedPitches.map(p => (
            <RailItem
              key={p.id}
              name={p.club || 'Unknown Club'}
              sub={STAGE_LABEL[p.stage || ''] || p.stage}
              onClick={() => nav(`/pitches/${p.id}`)}
            />
          ))}
        </Card>
      )}

      {/* Stage info */}
      <Card title="Pipeline Stage">
        <div className={styles.stageBlock} style={{ borderColor: stageColor }}>
          <span className={styles.stageDot} style={{ background: stageColor }} />
          <span className={styles.stageText} style={{ color: stageColor }}>{stageLabel}</span>
        </div>
      </Card>
    </>
  )

  return (
    <PageShell
      breadcrumbs={[{ label: 'Pitches', to: '/pitches' }, { label: `${data?.player} → ${data?.club}` }]}
      avatar={data?.flag || (data?.player || 'P')[0].toUpperCase()}
      name={data?.player || 'Unknown Player'}
      sub={[data?.pos, data?.club].filter(Boolean).join(' · ')}
      chips={[
        data?.club    ? `${data.flag || '🌍'} ${data.club}`  : '',
        data?.contact ? `👤 ${data.contact}`                 : '',
        data?.pdfName ? `📎 ${data.pdfName}`                 : '',
      ].filter(Boolean)}
      badges={
        <span className={styles.stagePill} style={{ color: stageColor, borderColor: stageColor }}>
          {stageLabel}
        </span>
      }
      rail={rail}
      editMode={editMode}
      onEditToggle={on => { if (on) startEdit(); else cancelEdit() }}
      actions={editMode ? (
        <Button variant="primary" size="sm" onClick={saveEdit} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      ) : undefined}
    >
      <Card title="Pitch Details" titleIcon="📋">
        <FieldGrid>
          {editMode ? (
            <>
              <Field label="Player"  value={<input className={styles.editInput} value={draft?.player  || ''} onChange={e => patch('player',  e.target.value)} />} />
              <Field label="Club"    value={<input className={styles.editInput} value={draft?.club    || ''} onChange={e => patch('club',    e.target.value)} />} />
              <Field label="Position" value={<input className={styles.editInput} value={draft?.pos  || ''} onChange={e => patch('pos',    e.target.value)} />} />
              <Field label="Contact" value={<input className={styles.editInput} value={draft?.contact || ''} onChange={e => patch('contact', e.target.value)} />} />
              <Field label="Flag"    value={<input className={styles.editInput} value={draft?.flag    || ''} onChange={e => patch('flag',    e.target.value)} />} />
              <Field label="Stage"   value={
                <select className={styles.editSelect} value={draft?.stage || 'sent'} onChange={e => patch('stage', e.target.value)}>
                  {STAGE_OPTIONS.map(s => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                </select>
              } />
              <Field label="Note"    value={<input className={styles.editInput} value={draft?.note || ''} onChange={e => patch('note', e.target.value)} />} full />
              <Field label="Hot"     value={
                <label className={styles.checkbox}>
                  <input type="checkbox" checked={!!draft?.hot} onChange={e => patch('hot', e.target.checked)} />
                  {' '}Mark as hot 🔥
                </label>
              } />
            </>
          ) : (
            <>
              <Field label="Player"   value={data?.player} />
              <Field label="Club"     value={data?.club
                ? <span>{data.flag || '🌍'} {data.club}</span>
                : undefined} />
              <Field label="Position" value={data?.pos} />
              <Field label="Contact"  value={data?.contact} />
              <Field label="Stage"    value={<span style={{ color: stageColor, fontWeight: 600 }}>{stageLabel}</span>} />
              <Field label="Hot"      value={data?.hot ? '🔥 Yes' : undefined} />
              {data?.pdfName && <Field label="PDF" value={`📎 ${data.pdfName}`} full />}
              {data?.note    && <Field label="Note" value={data.note} full />}
            </>
          )}
        </FieldGrid>
      </Card>
    </PageShell>
  )
}
