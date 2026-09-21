/**
 * PlayerDetail — full-page player / mandate profile
 * Uses PageShell (hero + mainCol + rail) as the universal template.
 *
 * Data comes from Firebase: /mandates/<id>  and  /playerNotes/<name>
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ref, onValue, off, set, update } from 'firebase/database'
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

const POSITIONS     = ['GK','CB','RB','RWB','LB','LWB','CDM','CM','CAM','RW','LW','CF','ST','SS']
const WINDOWS       = ['Summer 2026','Winter 2027','Summer 2027','Winter 2028','Summer 2028']
const MANDATE_TYPES = ['Exclusive','Co-mandate','Non-exclusive','Advisory']
const FEET          = ['Right','Left','Both']
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
  const [draftPriority, setDraftPriority] = useState<number | null>(null)

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

  function enterEditMode() {
    setDraft(mandate ? { ...mandate } : {})
    setDraftPriority(notes.priority ?? null)
    setEditMode(true)
  }

  async function handleSave() {
    if (!id || !mandate) return
    const updated = { ...mandate, ...draft }
    await set(ref(db, `mandates/${id}`), updated)
    // Save priority in playerNotes
    const noteKey = encodeURIComponent(mandate.name)
    const updatedNotes: PlayerNotes = { ...notes }
    if (draftPriority) updatedNotes.priority = draftPriority
    else delete updatedNotes.priority
    const notesPayload = Object.keys(updatedNotes).length > 0 ? updatedNotes : null
    await set(ref(db, `playerNotes/${noteKey}`), notesPayload)
    setMandate(updated)
    setNotes(updatedNotes)
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
    <Button size="sm" variant="secondary" onClick={enterEditMode}>✏ Edit</Button>
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
        {editMode ? (
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className={styles.editRow}>
              <label className={styles.editLabel}>Full Name</label>
              <input className={styles.editInput} value={draft.name ?? mandate.name}
                onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className={styles.editRow}>
                <label className={styles.editLabel}>Position</label>
                <select className={styles.editSelect} value={draft.pos ?? mandate.pos ?? ''}
                  onChange={e => setDraft(d => ({ ...d, pos: e.target.value }))}>
                  <option value="">—</option>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className={styles.editRow}>
                <label className={styles.editLabel}>Secondary Pos</label>
                <select className={styles.editSelect} value={draft.pos2 ?? mandate.pos2 ?? ''}
                  onChange={e => setDraft(d => ({ ...d, pos2: e.target.value }))}>
                  <option value="">—</option>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className={styles.editRow}>
                <label className={styles.editLabel}>Age</label>
                <input className={styles.editInput} type="number" min="15" max="45"
                  value={draft.age ?? mandate.age ?? ''}
                  onChange={e => setDraft(d => ({ ...d, age: e.target.value }))} />
              </div>
              <div className={styles.editRow}>
                <label className={styles.editLabel}>Height (cm)</label>
                <input className={styles.editInput} type="number" min="150" max="220"
                  value={draft.height ?? mandate.height ?? ''}
                  onChange={e => setDraft(d => ({ ...d, height: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className={styles.editRow}>
                <label className={styles.editLabel}>Nationality</label>
                <select className={styles.editSelect} value={draft.nationality ?? mandate.nationality ?? ''}
                  onChange={e => setDraft(d => ({ ...d, nationality: e.target.value }))}>
                  <option value="">—</option>
                  {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className={styles.editRow}>
                <label className={styles.editLabel}>Preferred Foot</label>
                <select className={styles.editSelect} value={draft.foot ?? mandate.foot ?? ''}
                  onChange={e => setDraft(d => ({ ...d, foot: e.target.value }))}>
                  <option value="">—</option>
                  {FEET.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className={styles.editRow}>
                <label className={styles.editLabel}>Current Club</label>
                <input className={styles.editInput} value={draft.club ?? mandate.club ?? ''}
                  onChange={e => setDraft(d => ({ ...d, club: e.target.value }))}
                  placeholder="Club name" />
              </div>
              <div className={styles.editRow}>
                <label className={styles.editLabel}>Market Value</label>
                <input className={styles.editInput} value={draft.value ?? mandate.value ?? ''}
                  onChange={e => setDraft(d => ({ ...d, value: e.target.value }))}
                  placeholder="€4M" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className={styles.editRow}>
                <label className={styles.editLabel}>Contract Expires</label>
                <input className={styles.editInput} value={draft.contract ?? mandate.contract ?? ''}
                  onChange={e => setDraft(d => ({ ...d, contract: e.target.value }))}
                  placeholder="Jun 2026" />
              </div>
              <div className={styles.editRow}>
                <label className={styles.editLabel}>Mandate Type</label>
                <select className={styles.editSelect} value={draft.type ?? mandate.type ?? ''}
                  onChange={e => setDraft(d => ({ ...d, type: e.target.value }))}>
                  <option value="">—</option>
                  {MANDATE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>
        ) : (
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
        )}
      </Card>

      {/* ── Deal & Financials ── */}
      <Card title="Deal & Financials" titleIcon="💰">
        {editMode ? (
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className={styles.editRow}>
                <label className={styles.editLabel}>Transfer Window</label>
                <select className={styles.editSelect} value={draft.transfer_window ?? mandate.transfer_window ?? ''}
                  onChange={e => setDraft(d => ({ ...d, transfer_window: e.target.value }))}>
                  <option value="">—</option>
                  {WINDOWS.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div className={styles.editRow}>
                <label className={styles.editLabel}>Expected Price</label>
                <input className={styles.editInput} value={draft.expectedPrice ?? mandate.expectedPrice ?? ''}
                  onChange={e => setDraft(d => ({ ...d, expectedPrice: e.target.value }))}
                  placeholder="€2.5M" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className={styles.editRow}>
                <label className={styles.editLabel}>Salary (p/m)</label>
                <input className={styles.editInput} value={draft.salary ?? mandate.salary ?? ''}
                  onChange={e => setDraft(d => ({ ...d, salary: e.target.value }))}
                  placeholder="€80K" />
              </div>
              <div className={styles.editRow}>
                <label className={styles.editLabel}>Source / Via</label>
                <input className={styles.editInput} value={draft.contact ?? mandate.contact ?? ''}
                  onChange={e => setDraft(d => ({ ...d, contact: e.target.value }))}
                  placeholder="Contact name" />
              </div>
            </div>
            <div className={styles.editRow}>
              <label className={styles.editLabel}>Priority</label>
              <select className={styles.editSelect} value={draftPriority ?? ''}
                onChange={e => setDraftPriority(e.target.value ? Number(e.target.value) : null)}>
                <option value="">None</option>
                <option value="1">P1 — Priority 1</option>
                <option value="2">P2 — Priority 2</option>
                <option value="3">P3 — Priority 3</option>
              </select>
            </div>
          </div>
        ) : (
          <FieldGrid>
            <Field label="Transfer Window" value={mandate.transfer_window || '—'} />
            <Field label="Deal Type"       value={notes.dealType || '—'} />
            <Field label="Expected Price"  value={mandate.expectedPrice || '—'} />
            <Field label="Salary (p/m)"    value={mandate.salary || '—'} />
            <Field label="Source / Via"    value={mandate.contact || '—'} />
            <Field label="Priority"        value={prio ? `P${prio}` : '—'} />
            <Field label="Status"          value={status} />
          </FieldGrid>
        )}
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
