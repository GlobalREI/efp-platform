import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ref, onValue, off, set, push, remove } from 'firebase/database'
import { db } from '../data/firebase'
import { PageHeader } from '../components/PageHeader'
import styles from './WatchlistDetail.module.css'

interface WatchlistEntry {
  id: string
  name: string
  pos?: string
  age?: string
  nationality?: string
  club?: string
  marketValue?: string
  tmId?: string
  tmProfileUrl?: string
  tmImageUrl?: string
  addedAt?: number
  notes?: string
}

export function WatchlistDetail() {
  const { id }  = useParams<{ id: string }>()
  const nav     = useNavigate()
  const [entry,   setEntry]   = useState<WatchlistEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [editNotes, setEditNotes] = useState(false)
  const [draftNotes, setDraftNotes] = useState('')
  const [promoting, setPromoting] = useState(false)

  useEffect(() => {
    if (!id) return
    const r = ref(db, `watchlist/${id}`)
    const handler = (snap: any) => {
      if (snap.exists()) {
        const data = { id, ...snap.val() } as WatchlistEntry
        setEntry(data)
        setDraftNotes(data.notes || '')
      }
      setLoading(false)
    }
    onValue(r, handler)
    return () => off(r, 'value', handler)
  }, [id])

  async function saveNotes() {
    if (!id || !entry) return
    await set(ref(db, `watchlist/${id}/notes`), draftNotes || null)
    setEditNotes(false)
  }

  async function promoteToMandate() {
    if (!entry) return
    setPromoting(true)
    try {
      const newRef = push(ref(db, 'mandates'))
      const mandate = {
        name:          entry.name,
        pos:           entry.pos  || '',
        age:           entry.age  || '',
        nationality:   entry.nationality || '',
        club:          entry.club || '',
        value:         entry.marketValue || '',
        tm_id:         entry.tmId || '',
        tm_profile_url: entry.tmProfileUrl || '',
        tm_image_url:  entry.tmImageUrl || '',
        source:        'Watchlist',
        statusText:    'New',
        dotClass:      'blue',
        savedAt:       Date.now(),
      }
      await set(newRef, mandate)
      // Remove from watchlist after promoting
      await remove(ref(db, `watchlist/${id}`))
      nav(`/mandates/${newRef.key}`)
    } catch (err) {
      console.error('Promote error:', err)
      setPromoting(false)
    }
  }

  async function removeFromWatchlist() {
    if (!id || !entry) return
    if (!confirm(`Remove "${entry.name}" from watchlist?`)) return
    await remove(ref(db, `watchlist/${id}`))
    nav('/watchlist')
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <PageHeader title="Watchlist" sub="Loading…" />
      </div>
    )
  }

  if (!entry) {
    return (
      <div className={styles.page}>
        <PageHeader title="Watchlist" sub="Player not found" back={() => nav('/watchlist')} />
        <div className={styles.empty}>This player was not found on your watchlist.</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader title="Watchlist" sub={entry.name} back={() => nav('/watchlist')} />

      <div className={styles.body}>
        {/* Hero */}
        <div className={styles.hero}>
          <div className={styles.avatar}>
            {entry.tmImageUrl
              ? <img src={entry.tmImageUrl} alt={entry.name} className={styles.avatarImg} onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
              : <span className={styles.avatarInitials}>{entry.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</span>
            }
          </div>
          <div className={styles.heroInfo}>
            <h1 className={styles.heroName}>{entry.name}</h1>
            <div className={styles.heroMeta}>
              {entry.pos && <span className={styles.posBadge}>{entry.pos}</span>}
              {entry.age && <span className={styles.metaItem}>{entry.age} yrs</span>}
              {entry.nationality && <span className={styles.metaItem}>{entry.nationality}</span>}
              {entry.club && <span className={styles.metaItem}>{entry.club}</span>}
              {entry.marketValue && <span className={styles.metaItem}>{entry.marketValue}</span>}
            </div>
          </div>
          <div className={styles.heroActions}>
            {entry.tmProfileUrl && (
              <a href={entry.tmProfileUrl} target="_blank" rel="noopener noreferrer" className={styles.btnGhost}>
                TM ↗
              </a>
            )}
            <button className={styles.btnDanger} onClick={removeFromWatchlist}>Remove</button>
            <button
              className={styles.btnPromote}
              onClick={promoteToMandate}
              disabled={promoting}
            >
              {promoting ? 'Creating…' : '→ Create Mandate'}
            </button>
          </div>
        </div>

        {/* Fields */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Player Info</div>
          <div className={styles.fieldGrid}>
            <div className={styles.field}><span className={styles.fieldLabel}>Position</span><span className={styles.fieldValue}>{entry.pos || '—'}</span></div>
            <div className={styles.field}><span className={styles.fieldLabel}>Age</span><span className={styles.fieldValue}>{entry.age || '—'}</span></div>
            <div className={styles.field}><span className={styles.fieldLabel}>Nationality</span><span className={styles.fieldValue}>{entry.nationality || '—'}</span></div>
            <div className={styles.field}><span className={styles.fieldLabel}>Current Club</span><span className={styles.fieldValue}>{entry.club || '—'}</span></div>
            <div className={styles.field}><span className={styles.fieldLabel}>Market Value</span><span className={styles.fieldValue}>{entry.marketValue || '—'}</span></div>
            <div className={styles.field}><span className={styles.fieldLabel}>Added</span><span className={styles.fieldValue}>{entry.addedAt ? new Date(entry.addedAt).toLocaleDateString('en-GB', { day:'numeric',month:'short',year:'numeric' }) : '—'}</span></div>
          </div>
        </div>

        {/* Scout Notes */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>Scout Notes</div>
            {!editNotes && (
              <button className={styles.btnEdit} onClick={() => { setDraftNotes(entry.notes || ''); setEditNotes(true) }}>Edit</button>
            )}
          </div>
          {editNotes ? (
            <div className={styles.notesEdit}>
              <textarea
                className={styles.notesTextarea}
                value={draftNotes}
                onChange={e => setDraftNotes(e.target.value)}
                rows={4}
                placeholder="Add your scouting notes…"
                autoFocus
              />
              <div className={styles.notesBtns}>
                <button className={styles.btnSave} onClick={saveNotes}>Save</button>
                <button className={styles.btnCancel} onClick={() => setEditNotes(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <p className={styles.notesText}>{entry.notes || <span className={styles.notesEmpty}>No notes yet.</span>}</p>
          )}
        </div>
      </div>
    </div>
  )
}
