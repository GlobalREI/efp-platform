/**
 * ClubDetail — full club profile page
 *
 * Reads: /clubs/<id>     — club data (name, league, country, flag, status, windowNotes, linkedContacts)
 *        /mandates        — to find linked mandates (players at this club)
 *        /needs           — to find needs at this club
 *
 * Layout: PageShell (hero · main col · sticky rail)
 *  Main:  Club Info · Notes by Window · Club Needs
 *  Rail:  Linked Contacts · Quick Stats
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
}

interface Mandate {
  id: string; name: string; pos?: string; club?: string
  statusText?: string; archived?: boolean
}

interface Need {
  id: string; club: string; positions?: string[]; pos?: string
  budget?: string; status?: string
}

const WINDOWS = ['Summer 2025','Winter 2026','Summer 2026','Winter 2027','Summer 2027','General']

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

    // Load mandates at this club
    const mRef = ref(db, 'mandates')
    const mHandler = (snap: any) => {
      if (!snap.exists()) return setMandates([])
      const all: Mandate[] = Object.entries(snap.val()).map(([mid, v]: [string, any]) => ({ id: mid, ...v }))
      // Will filter once club name is known
      setMandates(all)
    }
    onValue(mRef, mHandler)

    // Load club needs
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
      <div style={{ padding: '40px 28px', color: 'var(--text-3)', fontSize: '13px' }}>
        Loading…
      </div>
    )
  }

  if (!club) {
    return (
      <div style={{ padding: '40px 28px' }}>
        <p style={{ color: 'var(--text-2)' }}>Club not found.</p>
        <Button variant="ghost" size="sm" onClick={() => nav('/clubs')} style={{ marginTop: 12 }}>
          ← Back to Clubs
        </Button>
      </div>
    )
  }

  const linkedMandates = mandates.filter(m => m.club?.toLowerCase() === club.name?.toLowerCase() && !m.archived)
  const linkedNeeds    = needs.filter(n => n.club?.toLowerCase() === club.name?.toLowerCase())
  const status = club.status || 'Not Started'

  // Window notes: find windows that have content
  const winNotes = club.windowNotes || {}
  const windowsWithContent = WINDOWS.filter(w => winNotes[w]?.trim())

  const chips = [
    club.league              && `🏆 ${club.league}`,
    club.country             && `${club.flag || '🌍'} ${club.country}`,
    linkedMandates.length    && `⚽ ${linkedMandates.length} mandate${linkedMandates.length !== 1 ? 's' : ''}`,
    linkedNeeds.length       && `🎯 ${linkedNeeds.length} need${linkedNeeds.length !== 1 ? 's' : ''}`,
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
      {/* Linked Contacts */}
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

      {/* Quick Stats */}
      <Card title="Quick Info" titleIcon="ℹ️">
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            ['League',   club.league  || '—'],
            ['Country',  club.country || '—'],
            ['Status',   status],
            ['Mandates', String(linkedMandates.length)],
            ['Needs',    String(linkedNeeds.length)],
          ].map(([label, val]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>{label}</span>
              <span style={{ fontSize: 13, color: 'var(--text)', textAlign: 'right' }}>{val}</span>
            </div>
          ))}
        </div>
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
        <FieldGrid>
          <Field label="Club Name"  value={club.name} />
          <Field label="League"     value={club.league  || '—'} />
          <Field label="Country"    value={club.country || '—'} />
          <Field label="Flag"       value={club.flag    || '—'} />
          <Field label="Status"     value={status} />
        </FieldGrid>
      </Card>

      {/* ── Window Notes ── */}
      {(windowsWithContent.length > 0 || club.notes) && (
        <Card title="Notes by Window" titleIcon="📝">
          <div style={{ borderBottom: '1px solid var(--border)', display: 'flex', gap: 0, flexWrap: 'wrap' }}>
            {(windowsWithContent.length > 0 ? windowsWithContent : ['General']).map(w => (
              <button
                key={w}
                onClick={() => setActiveWin(w)}
                style={{
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: activeWin === w ? 600 : 400,
                  color: activeWin === w ? 'var(--text)' : 'var(--text-3)',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeWin === w ? '2px solid var(--accent)' : '2px solid transparent',
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                  whiteSpace: 'nowrap',
                }}
              >
                {w} {winNotes[w]?.trim() ? '●' : ''}
              </button>
            ))}
          </div>
          <div style={{ padding: '14px 18px', fontSize: 13, color: 'var(--text)', lineHeight: 1.65, whiteSpace: 'pre-wrap', minHeight: 60 }}>
            {winNotes[activeWin] || (activeWin === 'General' && club.notes) || (
              <span style={{ color: 'var(--text-3)' }}>No notes for {activeWin}.</span>
            )}
          </div>
        </Card>
      )}

      {/* ── Active Mandates at this Club ── */}
      {linkedMandates.length > 0 && (
        <Card title="Mandates" titleIcon="⚽">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '14px 18px' }}>
            {linkedMandates.map(m => (
              <PlayerChip key={m.id} name={m.name} id={m.id} size="md" />
            ))}
          </div>
        </Card>
      )}

      {/* ── Club Needs ── */}
      {linkedNeeds.length > 0 && (
        <Card title="Club Needs" titleIcon="🎯">
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {linkedNeeds.map(n => {
              const pos = Array.isArray(n.positions) ? n.positions.join(', ') : (n.pos || '—')
              return (
                <div
                  key={n.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => nav(`/needs/${n.id}`)}
                >
                  <span style={{ fontSize: 20 }}>🎯</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{pos}</div>
                    {n.budget && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Budget: {n.budget}</div>}
                  </div>
                  {n.status && (
                    <div style={{ marginLeft: 'auto' }}>
                      <StatusPill status={n.status} size="sm" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </PageShell>
  )
}
