/**
 * ClubDetail — club profile hub
 *
 * Reads: /clubs/<id>   — club data
 *        /mandates     — players EFP represents + players scouted for this club
 *        /needs        — all buying/loan requirements for this club
 *
 * Layout: PageShell (hero · main col · sticky rail)
 *  Main:  Club Info · Notes by Window · Requirements · Players We Represent · Scouted via TM Scout
 *  Rail:  Contacts · Quick Stats
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ref, onValue, off, set } from 'firebase/database'
import { db }             from '../data/firebase'
import {
  PageShell, Card, FieldGrid, Field, RailItem, RailEmpty,
} from '../components/PageShell'
import { StatusPill }     from '../components/Badge'
import { Button }         from '../components/Button'
import styles from './ClubDetail.module.css'
import { PlayerChip }     from '../components/Chip'

interface Club {
  id: string
  name: string
  league?: string
  country?: string
  flag?: string
  status?: string
  notes?: string
  windowNotes?: Record<string, string>
  linkedContacts?: { name: string; role: string }[]
  savedAt?: number
  tm_id?: string
  tm_market_value?: string
  tm_squad_size?: string
  tm_avg_age?: string
  tm_profile_url?: string
  tm_logo_url?: string
  tm_search_pos?: string
  tm_search_age?: string
  tm_search_mv?: string
}

interface Mandate {
  id: string
  name: string
  pos?: string
  pos2?: string
  club?: string
  value?: string
  contract?: string
  type?: string
  statusText?: string
  archived?: boolean
  linked_club_key?: string
}

interface Need {
  id: string
  club: string
  positions?: string[]
  pos?: string
  budget?: string
  status?: string
  dealType?: string
  window?: string
  urgency?: string
  notes?: string
}

const WINDOWS  = ['Summer 2025','Winter 2026','Summer 2026','Winter 2027','Summer 2027','General']
const STATUSES = ['Active Client','In Talks','Interested','Pending','Closed','Not Started']

export function ClubDetail() {
  const { id }  = useParams<{ id: string }>()
  const nav     = useNavigate()

  const [club,      setClub]      = useState<Club | null>(null)
  const [mandates,  setMandates]  = useState<Mandate[]>([])
  const [needs,     setNeeds]     = useState<Need[]>([])
  const [loading,   setLoading]   = useState(true)
  const [editMode,  setEditMode]  = useState(false)
  const [draft,     setDraft]     = useState<Partial<Club>>({})
  const [activeWin, setActiveWin] = useState('Winter 2027')

  useEffect(() => {
    if (!id) return

    const cRef = ref(db, `clubs/${id}`)
    const cHandler = (snap: any) => {
      if (snap.exists()) {
        const c: Club = { id, ...snap.val() }
        setClub(c)
        setDraft(c)
      }
      setLoading(false)
    }
    onValue(cRef, cHandler)

    const mRef = ref(db, 'mandates')
    const mHandler = (snap: any) => {
      if (!snap.exists()) return setMandates([])
      const all: Mandate[] = Object.entries(snap.val()).map(([mid, v]: [string, any]) => ({ id: mid, ...v }))
      setMandates(all)
    }
    onValue(mRef, mHandler)

    const nRef = ref(db, 'needs')
    const nHandler = (snap: any) => {
      if (!snap.exists()) return setNeeds([])
      const all: Need[] = Object.entries(snap.val()).map(([nid, v]: [string, any]) => ({ id: nid, ...v }))
      setNeeds(all)
    }
    onValue(nRef, nHandler)

    return () => {
      off(cRef, 'value', cHandler)
      off(mRef, 'value', mHandler)
      off(nRef, 'value', nHandler)
    }
  }, [id])

  async function handleSave() {
    if (!id || !club) return
    const updated = { ...club, ...draft }
    await set(ref(db, `clubs/${id}`), updated)
    setClub(updated)
    setEditMode(false)
  }

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} />
      </div>
    )
  }

  if (!club) {
    return (
      <div className={styles.notFound}>
        <p>Club not found.</p>
        <Button variant="ghost" size="sm" onClick={() => nav('/clubs')}>
          ← Back to Clubs
        </Button>
      </div>
    )
  }

  // Derived data
  const clubNeeds = needs.filter(n => n.club?.toLowerCase() === club.name?.toLowerCase())

  // Players EFP represents at this club (selling mandates)
  const representedPlayers = mandates.filter(
    m => m.club?.toLowerCase() === club.name?.toLowerCase() && !m.archived
  )

  // Players scouted via TM Scout specifically for this club
  const scoutedPlayers = mandates.filter(
    m => m.linked_club_key === id && !m.archived
  )

  const status = club.status || 'Not Started'
  const winNotes = club.windowNotes || {}
  const windowsWithContent = WINDOWS.filter(w => winNotes[w]?.trim())

  const chips = [
    club.league              && `🏆 ${club.league}`,
    club.country             && `${club.flag || '🌍'} ${club.country}`,
    clubNeeds.length         && `🎯 ${clubNeeds.length} requirement${clubNeeds.length !== 1 ? 's' : ''}`,
    representedPlayers.length && `⚽ ${representedPlayers.length} mandate${representedPlayers.length !== 1 ? 's' : ''}`,
  ].filter(Boolean) as string[]

  const badges = <StatusPill status={status} size="sm" />

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
      <Card title="Contacts" titleIcon="👤">
        {!club.linkedContacts?.length
          ? <RailEmpty message="No contacts linked" />
          : club.linkedContacts.map((c, i) => (
              <RailItem
                key={i}
                initials={c.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                name={c.name}
                sub={c.role || ''}
              />
            ))
        }
      </Card>

      <Card title="Quick Info" titleIcon="ℹ️">
        {[
            ['League',       club.league  || '—'],
            ['Country',      club.country || '—'],
            ['Status',       status],
            ['Requirements', String(clubNeeds.length)],
            ['Mandates',     String(representedPlayers.length)],
            ['Scouted',      String(scoutedPlayers.length)],
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
      breadcrumbs={[{ label: 'Clubs', to: '/clubs' }, { label: club.name }]}
      avatar={club.flag || club.name.substring(0, 2).toUpperCase()}
      name={club.name}
      sub={[club.league, club.country].filter(Boolean).join(' · ')}
      chips={chips}
      badges={badges}
      actions={actions}
      rail={rail}
    >
      {/* ── Club Info ── */}
      <Card title="Club Info" titleIcon="🏟">
        {editMode ? (
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className={styles.editRow}>
              <label className={styles.editLabel}>Club Name</label>
              <input
                className={styles.editInput}
                value={draft.name ?? club.name}
                onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
              />
            </div>
            <div className={styles.editRow}>
              <label className={styles.editLabel}>League</label>
              <input
                className={styles.editInput}
                value={draft.league ?? club.league ?? ''}
                onChange={e => setDraft(d => ({ ...d, league: e.target.value }))}
                placeholder="e.g. Bundesliga"
              />
            </div>
            <div className={styles.editRow}>
              <label className={styles.editLabel}>Country</label>
              <input
                className={styles.editInput}
                value={draft.country ?? club.country ?? ''}
                onChange={e => setDraft(d => ({ ...d, country: e.target.value }))}
                placeholder="e.g. Germany"
              />
            </div>
            <div className={styles.editRow}>
              <label className={styles.editLabel}>Flag</label>
              <input
                className={styles.editInput}
                value={draft.flag ?? club.flag ?? ''}
                onChange={e => setDraft(d => ({ ...d, flag: e.target.value }))}
                placeholder="🇩🇪"
                style={{ width: 80 }}
              />
            </div>
            <div className={styles.editRow}>
              <label className={styles.editLabel}>Status</label>
              <select
                className={styles.editSelect}
                value={draft.status ?? club.status ?? ''}
                onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}
              >
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className={styles.editRow}>
              <label className={styles.editLabel}>General Notes</label>
              <textarea
                className={styles.editTextarea}
                value={draft.notes ?? club.notes ?? ''}
                onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                rows={3}
                placeholder="General notes about this club…"
              />
            </div>
          </div>
        ) : (
          <FieldGrid>
            <Field label="Club Name"  value={club.name} />
            <Field label="League"     value={club.league  || '—'} />
            <Field label="Country"    value={club.country || '—'} />
            <Field label="Flag"       value={club.flag    || '—'} />
            <Field label="Status"     value={status} />
          </FieldGrid>
        )}
      </Card>

      {/* ── Notes by Window ── */}
      {(windowsWithContent.length > 0 || club.notes) && (
        <Card title="Notes by Window" titleIcon="📝">
          <div className={styles.winTabs}>
            {(windowsWithContent.length > 0 ? windowsWithContent : ['General']).map(w => (
              <button
                key={w}
                onClick={() => setActiveWin(w)}
                className={`${styles.winTab} ${activeWin === w ? styles.winTabActive : ''}`}
              >
                {w} {winNotes[w]?.trim() ? '●' : ''}
              </button>
            ))}
          </div>
          <div style={{ padding: '14px 18px' }}>
            {winNotes[activeWin] || (activeWin === 'General' && club.notes)
              ? <p className={styles.winNotes}>{winNotes[activeWin] || club.notes}</p>
              : <p className={styles.winEmpty}>No notes for {activeWin}.</p>
            }
          </div>
        </Card>
      )}

      {/* ── Requirements (buying / loan needs) ── */}
      <Card
        title={`Requirements${clubNeeds.length ? ` (${clubNeeds.length})` : ''}`}
        titleIcon="🎯"
        headerRight={
          <button className={styles.addBtn} onClick={() => nav('/needs/new')}>+ Add</button>
        }
      >
        {clubNeeds.length === 0 ? (
          <div className={styles.emptySection}>No requirements added yet.</div>
        ) : (
          <>
            {/* Header row */}
            <div className={styles.reqHeader}>
              <span>Position</span>
              <span>Deal Type</span>
              <span>Budget</span>
              <span>Window</span>
              <span>Status</span>
            </div>
            {clubNeeds.map(n => {
              const pos = Array.isArray(n.positions) ? n.positions.join(' / ') : (n.pos || '—')
              return (
                <div
                  key={n.id}
                  className={styles.reqRow}
                  onClick={() => nav(`/needs/${n.id}`)}
                >
                  <span className={styles.reqPos}>{pos}</span>
                  <span className={styles.reqCell}>{n.dealType || '—'}</span>
                  <span className={styles.reqCell}>{n.budget || '—'}</span>
                  <span className={styles.reqCell}>{n.window || '—'}</span>
                  <span className={styles.reqCell}>
                    {n.status ? <StatusPill status={n.status} size="sm" /> : '—'}
                  </span>
                </div>
              )
            })}
          </>
        )}
      </Card>

      {/* ── Players We Represent at this Club ── */}
      <Card
        title={`Players We Represent${representedPlayers.length ? ` (${representedPlayers.length})` : ''}`}
        titleIcon="⚽"
      >
        {representedPlayers.length === 0 ? (
          <div className={styles.emptySection}>No mandates at this club.</div>
        ) : (
          representedPlayers.map(m => {
            const pos = [m.pos, m.pos2].filter(Boolean).join(' / ')
            return (
              <div
                key={m.id}
                className={styles.mandateRow}
                onClick={() => nav(`/mandates/${m.id}`)}
              >
                <div className={styles.mandateAvatar}>
                  {m.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className={styles.mandateInfo}>
                  <span className={styles.mandateName}>{m.name}</span>
                  {pos && <span className={styles.mandateMeta}>{pos}</span>}
                </div>
                <div className={styles.mandateTags}>
                  {m.type && <span className={styles.typeTag}>{m.type}</span>}
                  {m.value && <span className={styles.valueTag}>{m.value}</span>}
                  {m.contract && <span className={styles.contractTag}>Exp: {m.contract}</span>}
                </div>
                {m.statusText && <StatusPill status={m.statusText} size="sm" />}
              </div>
            )
          })
        )}
      </Card>

      {/* ── Scouted Players (from TM Scout) ── */}
      {scoutedPlayers.length > 0 && (
        <Card title={`Scouted via TM Scout (${scoutedPlayers.length})`} titleIcon="🔍">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '14px 18px' }}>
            {scoutedPlayers.map(m => (
              <PlayerChip key={m.id} name={m.name} id={m.id} size="md" />
            ))}
          </div>
        </Card>
      )}

      {/* ── Transfermarkt Data ── */}
      {club.tm_id && (
        <Card title="Transfermarkt Data" titleIcon="🌐">
          <FieldGrid>
            {club.tm_market_value && <Field label="Squad Market Value" value={club.tm_market_value} />}
            {club.tm_squad_size   && <Field label="Squad Size"         value={club.tm_squad_size} />}
            {club.tm_avg_age      && <Field label="Average Age"        value={club.tm_avg_age} />}
            {club.tm_search_pos   && <Field label="Scouted For (Pos)"  value={club.tm_search_pos} />}
            {club.tm_search_age   && <Field label="Target Age Range"   value={club.tm_search_age} />}
            {club.tm_search_mv    && <Field label="Target MV Range"    value={club.tm_search_mv} />}
          </FieldGrid>
          {club.tm_profile_url && (
            <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)' }}>
              <a href={club.tm_profile_url} target="_blank" rel="noopener noreferrer"
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
