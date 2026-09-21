/**
 * ActivitiesView — Communication Log
 *
 * Reads:  /comms         — all communication entries
 *         /clubs         — for club autocomplete in form
 *         /mandates      — for player autocomplete in form
 *         /contacts      — for contact autocomplete in form
 * Writes: /comms/{push}  — new comm entry
 *         /allTasks      — if follow-up is checked, appends a task
 */
import { useEffect, useState, useMemo } from 'react'
import { ref, onValue, off, push, set, get } from 'firebase/database'
import { db } from '../data/firebase'
import { PageHeader } from '../components/PageHeader'
import styles from './ActivitiesView.module.css'

/* ── Types ──────────────────────────────────────────────────────────────── */
interface Comm {
  id: string
  date: string
  type: string
  agent?: string
  club?: string
  clubId?: string
  contact?: string
  player?: string
  playerId?: string
  interest: string
  purpose: string
  notes: string
  followUp?: boolean
  followUpDate?: string
  createdAt?: number
}

interface FbClub  { id: string; name: string; league?: string }
interface FbMandate { id: string; name: string; pos?: string }
interface FbContact { id: string; name: string; organisation?: string }

/* ── Constants ──────────────────────────────────────────────────────────── */
const COMM_TYPES  = ['Call', 'Email', 'WhatsApp', 'Meeting', 'Video Call']
const INTEREST    = ['Interested', 'Maybe Later', 'Not Interested', 'No Response']
const PURPOSES    = [
  'Player Introduction', 'Service Introduction',
  'Ask for Buy Requirements', 'Ask for Sell Requirements',
  'Ask for Loan Opportunities', 'Market Intelligence', 'Relationship Building',
]
const AGENTS      = ['Timo', 'Jonas', 'Felix', 'Other']

const INTEREST_COLOR: Record<string, string> = {
  'Interested':      '#10B981',
  'Maybe Later':     '#F59E0B',
  'Not Interested':  '#EF4444',
  'No Response':     '#94A3B8',
}
const TYPE_COLOR: Record<string, string> = {
  'Call':       '#3B82F6',
  'Email':      '#8B5CF6',
  'WhatsApp':   '#10B981',
  'Meeting':    '#F97316',
  'Video Call': '#6366F1',
}

function today() { return new Date().toISOString().slice(0, 10) }

/* ── LogForm ────────────────────────────────────────────────────────────── */
interface LogFormProps {
  clubs:    FbClub[]
  mandates: FbMandate[]
  contacts: FbContact[]
  onSaved:  (id: string) => void
  onCancel: () => void
}

function LogForm({ clubs, mandates, contacts, onSaved, onCancel }: LogFormProps) {
  const [form, setForm] = useState({
    date:         today(),
    type:         'Call',
    agent:        '',
    clubId:       '',
    clubName:     '',
    contactId:    '',
    contactName:  '',
    playerId:     '',
    playerName:   '',
    interest:     'No Response',
    purpose:      'Player Introduction',
    notes:        '',
    followUp:     false,
    followUpDate: '',
    dependency:   '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }))

  // When club dropdown changes, also set name
  function setClub(id: string) {
    const c = clubs.find(c => c.id === id)
    f('clubId', id)
    f('clubName', c?.name ?? '')
  }
  function setContact(id: string) {
    const c = contacts.find(c => c.id === id)
    f('contactId', id)
    f('contactName', c?.name ?? '')
  }
  function setPlayer(id: string) {
    const m = mandates.find(m => m.id === id)
    f('playerId', id)
    f('playerName', m?.name ?? '')
  }

  async function save() {
    if (!form.clubName.trim() || !form.notes.trim()) {
      setErr('Club and Notes are required.')
      return
    }
    setSaving(true); setErr('')
    try {
      const entry: Omit<Comm, 'id'> = {
        date:      form.date,
        type:      form.type,
        agent:     form.agent || 'Timo',
        club:      form.clubName,
        clubId:    form.clubId || undefined,
        contact:   form.contactName || undefined,
        player:    form.playerName  || undefined,
        playerId:  form.playerId    || undefined,
        interest:  form.interest,
        purpose:   form.purpose,
        notes:     form.notes,
        followUp:  form.followUp,
        followUpDate: form.followUp ? form.followUpDate : undefined,
        createdAt: Date.now(),
      }
      const newRef = push(ref(db, 'comms'))
      await set(newRef, entry)

      // Auto-create follow-up task
      if (form.followUp && form.followUpDate) {
        const taskSnap = await get(ref(db, 'allTasks'))
        const existing: any[] = taskSnap.exists()
          ? (Array.isArray(taskSnap.val()) ? taskSnap.val() : Object.values(taskSnap.val()))
          : []
        existing.push({
          id:   Date.now(),
          text: `Follow up with ${form.clubName}${form.contactName ? ' / ' + form.contactName : ''}${form.playerName ? ' re: ' + form.playerName : ''}`,
          meta: form.purpose,
          prio: 'm',
          bucket: 'week',
          done: false,
          dueDate: form.followUpDate,
        })
        await set(ref(db, 'allTasks'), existing)
      }

      onSaved(newRef.key ?? '')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
      setSaving(false)
    }
  }

  return (
    <div className={styles.logForm}>
      <div className={styles.logFormHeader}>
        <span className={styles.logFormTitle}>Log Communication</span>
        <button className={styles.closeBtn} onClick={onCancel}>✕</button>
      </div>

      {err && <div className={styles.formErr}>{err}</div>}

      <div className={styles.formGrid}>
        {/* Row 1 */}
        <div className={styles.formField}>
          <label className={styles.formLabel}>Date</label>
          <input className={styles.formInput} type="date" value={form.date}
            onChange={e => f('date', e.target.value)} />
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Agent</label>
          <select className={styles.formSel} value={form.agent} onChange={e => f('agent', e.target.value)}>
            <option value="">— Select —</option>
            {AGENTS.map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Type</label>
          <select className={styles.formSel} value={form.type} onChange={e => f('type', e.target.value)}>
            {COMM_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Interest Level</label>
          <select className={styles.formSel} value={form.interest} onChange={e => f('interest', e.target.value)}>
            {INTEREST.map(i => <option key={i}>{i}</option>)}
          </select>
        </div>

        {/* Row 2 */}
        <div className={`${styles.formField} ${styles.span2}`}>
          <label className={styles.formLabel}>Club <span className={styles.req}>*</span></label>
          <select className={styles.formSel} value={form.clubId} onChange={e => setClub(e.target.value)}>
            <option value="">— Select Club —</option>
            {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Contact (opt.)</label>
          <select className={styles.formSel} value={form.contactId} onChange={e => setContact(e.target.value)}>
            <option value="">— None —</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.organisation ? ` (${c.organisation})` : ''}</option>)}
          </select>
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Player (opt.)</label>
          <select className={styles.formSel} value={form.playerId} onChange={e => setPlayer(e.target.value)}>
            <option value="">— None —</option>
            {mandates.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        {/* Row 3 */}
        <div className={`${styles.formField} ${styles.span4}`}>
          <label className={styles.formLabel}>Purpose</label>
          <select className={styles.formSel} value={form.purpose} onChange={e => f('purpose', e.target.value)}>
            {PURPOSES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>

        {/* Notes */}
        <div className={`${styles.formField} ${styles.span4}`}>
          <label className={styles.formLabel}>Notes <span className={styles.req}>*</span></label>
          <textarea className={styles.formTextarea} rows={3}
            placeholder="Key points from the conversation…"
            value={form.notes}
            onChange={e => f('notes', e.target.value)} />
        </div>

        {/* Dependency */}
        <div className={`${styles.formField} ${styles.span4}`}>
          <label className={styles.formLabel}>Dependency (opt.)</label>
          <input className={styles.formInput} placeholder="e.g. Must sell striker first"
            value={form.dependency} onChange={e => f('dependency', e.target.value)} />
        </div>

        {/* Follow-up */}
        <div className={`${styles.formField} ${styles.span2} ${styles.checkRow}`}>
          <input type="checkbox" id="fu" className={styles.checkbox}
            checked={form.followUp} onChange={e => f('followUp', e.target.checked)} />
          <label htmlFor="fu" className={styles.checkLabel}>Follow-Up Required (auto-creates task)</label>
        </div>
        {form.followUp && (
          <div className={styles.formField}>
            <label className={styles.formLabel}>Follow-Up Date</label>
            <input className={styles.formInput} type="date" value={form.followUpDate}
              onChange={e => f('followUpDate', e.target.value)} />
          </div>
        )}
      </div>

      <div className={styles.formActions}>
        <button className={styles.saveBtn} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : '✓ Log Communication'}
        </button>
        <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

/* ── CommRow ────────────────────────────────────────────────────────────── */
function CommRow({ c }: { c: Comm }) {
  const [expanded, setExpanded] = useState(false)
  const dot = INTEREST_COLOR[c.interest] ?? '#94A3B8'
  const typeDot = TYPE_COLOR[c.type] ?? '#94A3B8'

  return (
    <div className={`${styles.commRow} ${expanded ? styles.commRowOpen : ''}`}
         onClick={() => setExpanded(x => !x)}>
      <span className={styles.dot} style={{ background: dot }} />

      <span className={styles.commDate}>{c.date}</span>

      <span className={styles.typePill} style={{ background: typeDot + '22', color: typeDot }}>
        {c.type}
      </span>

      {c.agent && <span className={styles.agent}>{c.agent}</span>}

      <span className={styles.commClub}>{c.club}</span>

      {c.contact && <span className={styles.commSub}> / {c.contact}</span>}
      {c.player  && <span className={styles.playerTag}>{c.player}</span>}

      <span className={styles.spacer} />

      <span className={styles.purposeTag}>{c.purpose}</span>

      <span className={styles.interestPill} style={{ background: dot + '22', color: dot }}>
        {c.interest}
      </span>

      <span className={styles.chevron}>{expanded ? '▲' : '▼'}</span>

      {expanded && (
        <div className={styles.commDetail} onClick={e => e.stopPropagation()}>
          <p className={styles.notesText}>{c.notes}</p>
          {c.followUp && c.followUpDate && (
            <div className={styles.followUpChip}>
              📅 Follow-up: {c.followUpDate}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── ActivitiesView ─────────────────────────────────────────────────────── */
export function ActivitiesView() {
  const [comms,    setComms]    = useState<Comm[]>([])
  const [clubs,    setClubs]    = useState<FbClub[]>([])
  const [mandates, setMandates] = useState<FbMandate[]>([])
  const [contacts, setContacts] = useState<FbContact[]>([])
  const [loading,  setLoading]  = useState(true)
  const [logOpen,  setLogOpen]  = useState(false)
  const [search,   setSearch]   = useState('')
  const [typeF,    setTypeF]    = useState('all')
  const [intF,     setIntF]     = useState('all')

  /* Firebase subscriptions */
  useEffect(() => {
    const commsRef = ref(db, 'comms')
    const h = (snap: any) => {
      if (!snap.exists()) { setComms([]); setLoading(false); return }
      const raw = snap.val()
      const rows: Comm[] = Object.entries(raw)
        .map(([id, v]: [string, any]) => ({ id, ...v }))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      setComms(rows)
      setLoading(false)
    }
    onValue(commsRef, h)
    return () => off(commsRef, 'value', h)
  }, [])

  useEffect(() => {
    const load = async () => {
      const [cs, ms, cts] = await Promise.all([
        get(ref(db, 'clubs')),
        get(ref(db, 'mandates')),
        get(ref(db, 'contacts')),
      ])
      if (cs.exists())  setClubs(Object.entries(cs.val()).map(([id, v]: [string, any]) => ({ id, ...v })).sort((a,b)=>a.name.localeCompare(b.name)))
      if (ms.exists())  setMandates(Object.entries(ms.val()).map(([id, v]: [string, any]) => ({ id, ...v })).sort((a,b)=>a.name.localeCompare(b.name)))
      if (cts.exists()) setContacts(Object.entries(cts.val()).map(([id, v]: [string, any]) => ({ id, ...v })).sort((a,b)=>a.name.localeCompare(b.name)))
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    return comms.filter(c => {
      if (typeF !== 'all' && c.type !== typeF) return false
      if (intF  !== 'all' && c.interest !== intF) return false
      if (search) {
        const q = search.toLowerCase()
        if (![c.club, c.contact, c.player, c.notes, c.agent].some(s => s?.toLowerCase().includes(q))) return false
      }
      return true
    })
  }, [comms, typeF, intF, search])

  function handleSaved() {
    setLogOpen(false)
  }

  const filters = (
    <div className={styles.filterRow}>
      <select className={styles.filterSel} value={typeF} onChange={e => setTypeF(e.target.value)}>
        <option value="all">All Types</option>
        {COMM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <select className={styles.filterSel} value={intF} onChange={e => setIntF(e.target.value)}>
        <option value="all">All Interest</option>
        {INTEREST.map(i => <option key={i} value={i}>{i}</option>)}
      </select>
    </div>
  )

  return (
    <div className={styles.page}>
      <PageHeader
        title="Comm Log"
        sub={`${filtered.length} entries${typeF !== 'all' || intF !== 'all' || search ? ' (filtered)' : ''}`}
        search={{ value: search, onChange: setSearch, placeholder: 'Search club, player, notes…' }}
        filters={filters}
      />

      {/* Log form */}
      {logOpen ? (
        <LogForm
          clubs={clubs}
          mandates={mandates}
          contacts={contacts}
          onSaved={handleSaved}
          onCancel={() => setLogOpen(false)}
        />
      ) : (
        <button className={styles.logBtn} onClick={() => setLogOpen(true)}>
          + Log Communication
        </button>
      )}

      {/* List */}
      {loading ? (
        <div className={styles.empty}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          {comms.length === 0 ? 'No communications logged yet. Log your first one above.' : 'No entries match.'}
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map(c => <CommRow key={c.id} c={c} />)}
        </div>
      )}
    </div>
  )
}
