/**
 * PlayerDetail — full-page player / mandate profile
 * Uses PageShell (hero + mainCol + rail) as the universal template.
 *
 * Data comes from Firebase: /mandates/<id>  and  /playerNotes/<name>
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ref, onValue, off, set } from 'firebase/database'
import { db } from '../data/firebase'
import {
  PageShell, Card, FieldGrid, Field, RailItem, RailEmpty,
} from '../components/PageShell'
import { PriorityBadge, StatusPill } from '../components/Badge'
import { Button } from '../components/Button'
import styles from './PlayerDetail.module.css'

/* ── Types ── */
interface Mandate {
  id: string
  name: string
  pos?: string
  pos2?: string
  age?: string
  height?: string
  club?: string
  value?: string
  nationality?: string
  foot?: string
  contract?: string
  type?: string
  contact?: string
  expectedPrice?: string
  salary?: string
  transfer_window?: string
  dotClass?: string
  statusText?: string
  archived?: boolean
  tm_id?: string
  tm_profile_url?: string
  tm_image_url?: string
  source?: string
}

interface PlayerNotes {
  status?: string
  notes?: string
  priority?: number | null
  dealType?: string
  savedAt?: number
}

interface Pitch {
  id?: string
  player?: string
  club?: string
  stage?: string
  note?: string
  date?: string
}

interface FbLinkedClub {
  id: string
  name: string
  league?: string
  country?: string
  linked_mandate_key?: string
  linked_mandate_name?: string
}

const PRIO_LABEL: Record<number, string> = { 1: 'P1', 2: 'P2', 3: 'P3' }

export function PlayerDetail() {
  const { id }   = useParams<{ id: string }>()
  const nav      = useNavigate()
  const [mandate, setMandate]   = useState<Mandate | null>(null)
  const [notes,   setNotes]     = useState<PlayerNotes>({})
  const [pitches, setPitches]   = useState<Pitch[]>([])
  const [linkedClubs, setLinkedClubs] = useState<FbLinkedClub[]>([])
  const [loading, setLoading]   = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [draft,   setDraft]     = useState<Partial<Mandate>>({})

  useEffect(() => {
    if (!id) return

    // Load mandate by id
    const mRef = ref(db, `mandates/${id}`)
    const mHandler = (snap: any) => {
      if (snap.exists()) {
        const m = { id, ...snap.val() } as Mandate
        setMandate(m)
        setDraft(m)
      }
      setLoading(false)
    }
    onValue(mRef, mHandler)

    // Load player notes by name (loaded lazily once mandate arrives)
    let nUnsub: (() => void) | null = null
    const mRefOnce = ref(db, `mandates/${id}`)
    onValue(mRefOnce, (snap) => {
      if (!snap.exists()) return
      const name: string = snap.val().name
      if (!name) return
      const nRef = ref(db, `playerNotes/${encodeURIComponent(name)}`)
      const nHandler = (nSnap: any) => { if (nSnap.exists()) setNotes(nSnap.val()) }
      onValue(nRef, nHandler)
      nUnsub = () => off(nRef, 'value', nHandler)
    }, { onlyOnce: true })

    // Load pitches
    const pRef = ref(db, 'pitches')
    const pHandler = (snap: any) => {
      if (!snap.exists()) return setPitches([])
      const name = mandate?.name
      const all: Pitch[] = Object.values(snap.val())
      setPitches(name ? all.filter(p => p.player === name) : [])
    }
    onValue(pRef, pHandler)

    // Load clubs scouted for this mandate
    const cRef = ref(db, 'clubs')
    const cHandler = (snap: any) => {
      if (!snap.exists()) return setLinkedClubs([])
      const all: FbLinkedClub[] = Object.entries(snap.val())
        .map(([cid, v]: [string, any]) => ({ id: cid, ...v }))
        .filter((c: FbLinkedClub) => c.linked_mandate_key === id)
      setLinkedClubs(all)
    }
    onValue(cRef, cHandler)

    return () => {
      off(mRef, 'value', mHandler)
      if (nUnsub) nUnsub()
      off(pRef, 'value', pHandler)
      off(cRef, 'value', cHandler)
    }
  }, [id])

  async function handleSave() {
    if (!id || !mandate) return
    const updated = { ...mandate, ...draft }
    await set(ref(db, `mandates/${id}`), updated)
    setMandate(updated)
    setEditMode(false)
  }

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

  if (!mandate) {
    return (
      <div className={styles.notFound}>
        <p>Mandate not found.</p>
        <Button variant="ghost" size="sm" onClick={() => nav('/mandates')}>
          ← Back to Mandates
        </Button>
      </div>
    )
  }

  const status   = notes.status || mandate.statusText || 'Active Mandate'
  const prio     = notes.priority
  const position = [mandate.pos, mandate.pos2].filter(Boolean).join(' / ')

  const chips = [
    position              && `⚽ ${position}`,
    mandate.age           && `🎂 ${mandate.age}`,
    mandate.nationality   && `🌍 ${mandate.nationality}`,
    mandate.club          && `🏟 ${mandate.club}`,
    mandate.value         && `💰 ${mandate.value}`,
  ].filter(Boolean) as string[]

  const badges = (
    <>
      {prio && <PriorityBadge priority={PRIO_LABEL[prio] as any} size="sm" />}
      <StatusPill status={status} size="sm" />
      {mandate.archived && <StatusPill status="Archived" size="sm" />}
    </>
  )

  const actions = editMode ? (
    <>
      <Button size="sm" variant="ghost" onClick={() => setEditMode(false)}>Cancel</Button>
      <Button size="sm" variant="primary" onClick={handleSave}>Save Changes</Button>
    </>
  ) : (
    <Button size="sm" variant="secondary" onClick={() => setEditMode(true)}>✏ Edit</Button>
  )

  /* ── Rail ── */
  const rail = (
    <>
      <Card title="Pitch History" titleIcon="📤">
        {pitches.length === 0
          ? <RailEmpty message="No pitches yet" />
          : pitches.map((p, i) => (
              <RailItem
                key={i}
                initials={(p.club || '?').substring(0, 2).toUpperCase()}
                name={p.club || '—'}
                sub={p.stage ? p.stage.charAt(0).toUpperCase() + p.stage.slice(1) : '—'}
              />
            ))
        }
      </Card>

      <Card title="Quick Info" titleIcon="ℹ️">
        {[
            ['Window',    mandate.transfer_window || '—'],
            ['Deal Type', notes.dealType || '—'],
            ['Expected',  mandate.expectedPrice || '—'],
            ['Salary',    mandate.salary || '—'],
            ['Source',    mandate.contact || '—'],
          ].map(([label, val]) => (
            <div key={label} className={styles.infoRow}>
              <span className={styles.infoLabel}>{label}</span>
              <span className={styles.infoValue}>{val}</span>
            </div>
          ))}
      </Card>
    </>
  )

  return (
    <PageShell
      breadcrumbs={[{ label: 'Mandates', to: '/mandates' }, { label: mandate.name }]}
      avatar={mandate.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
      name={mandate.name}
      sub={[position, mandate.club].filter(Boolean).join(' · ')}
      chips={chips}
      badges={badges}
      actions={actions}
      rail={rail}
    >
      {/* ── Player Details ── */}
      <Card title="Player Details" titleIcon="⚽">
        <FieldGrid>
          <Field label="Full Name"    value={mandate.name} />
          <Field label="Position"     value={position || '—'} />
          <Field label="Age"          value={mandate.age || '—'} />
          <Field label="Height"       value={mandate.height || '—'} />
          <Field label="Nationality"  value={mandate.nationality || '—'} />
          <Field label="Preferred Foot" value={mandate.foot || '—'} />
          <Field label="Current Club" value={mandate.club || '—'} />
          <Field label="Market Value" value={mandate.value || '—'} />
          <Field label="Contract Exp" value={mandate.contract || '—'} />
          <Field label="Mandate Type" value={mandate.type || '—'} />
        </FieldGrid>
      </Card>

      {/* ── Deal & Financials ── */}
      <Card title="Deal & Financials" titleIcon="💰">
        <FieldGrid>
          <Field label="Transfer Window" value={mandate.transfer_window || '—'} />
          <Field label="Deal Type"       value={notes.dealType || '—'} />
          <Field label="Expected Price"  value={mandate.expectedPrice || '—'} />
          <Field label="Salary (p/m)"    value={mandate.salary || '—'} />
          <Field label="Source / Via"    value={mandate.contact || '—'} />
          <Field label="Status"          value={status} />
        </FieldGrid>
      </Card>

      {/* ── Internal Notes ── */}
      {notes.notes && (
        <Card title="Internal Notes" titleIcon="📝">
          <p className={styles.notesText} style={{ padding: '14px 18px' }}>
            {notes.notes}
          </p>
        </Card>
      )}

      {/* ── Clubs Scouted for this Player (from TM Scout) ── */}
      {linkedClubs.length > 0 && (
        <Card title="Scouted Clubs" titleIcon="🔍">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {linkedClubs.map(c => (
              <div
                key={c.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 18px', borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
                onClick={() => nav(`/clubs/${c.id}`)}
              >
                <span style={{ fontSize: 20 }}>🏟</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>{c.name}</div>
                  {c.league && <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{c.league}</div>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Transfermarkt Data (saved from TM Scout) ── */}
      {mandate.tm_id && (
        <Card title="Transfermarkt Data" titleIcon="🌐">
          <FieldGrid>
            <Field label="TM ID"   value={mandate.tm_id} />
            {mandate.source && <Field label="Source" value={mandate.source === 'tm_scout' ? 'TM Scout' : mandate.source} />}
          </FieldGrid>
          {mandate.tm_profile_url && (
            <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)' }}>
              <a href={mandate.tm_profile_url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>
                View on Transfermarkt ↗
              </a>
            </div>
          )}
        </Card>
      )}
    </PageShell>
  )
}
