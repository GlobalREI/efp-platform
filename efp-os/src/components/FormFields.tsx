/**
 * FormFields — Shared connected form field components
 *
 * MoneyInput        — auto-formats €4M / €2.5M / €80K on blur
 * ClubSearchField   — autocomplete from Firebase /needs + /contacts org names
 * PlayerSearchField — autocomplete from Firebase /mandates
 * ContactSearchField — autocomplete from Firebase /contacts
 */
import { useState, useRef, useEffect } from 'react'
import { ref, get } from 'firebase/database'
import { db } from '../data/firebase'
import { drawerStyles as s } from './Drawer'

/* ── Shared dropdown styles ─────────────────────────────────── */

const dropStyle: React.CSSProperties = {
  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 99,
  background: 'var(--surface-1)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
  marginTop: 4, maxHeight: 220, overflowY: 'auto',
}

const itemBase: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left',
  padding: '9px 12px', background: 'none', border: 'none',
  borderBottom: '1px solid var(--border)',
  cursor: 'pointer', fontSize: 'var(--text-sm)',
  color: 'var(--text-primary)',
}

/* ══════════════════════════════════════════════════════════════
   MONEY INPUT
══════════════════════════════════════════════════════════════ */

function parseMoney(str: string): number | null {
  const cleaned = str.replace(/[€£$,\s]/g, '').toUpperCase()
  if (!cleaned) return null
  const m = cleaned.match(/^([\d.]+)(M|K)?$/)
  if (!m) return null
  const n = parseFloat(m[1])
  if (isNaN(n)) return null
  if (m[2] === 'M') return n * 1_000_000
  if (m[2] === 'K') return n * 1_000
  return n
}

export function formatMoney(val: number | null | undefined): string {
  if (val == null) return ''
  if (val >= 1_000_000) {
    const m = val / 1_000_000
    return `€${m % 1 === 0 ? m : m.toFixed(1)}M`
  }
  if (val >= 1_000) {
    const k = val / 1_000
    return `€${k % 1 === 0 ? k : k.toFixed(0)}K`
  }
  return `€${val.toLocaleString()}`
}

interface MoneyInputProps {
  label: string
  value: string
  onChange: (val: string) => void
  placeholder?: string
  required?: boolean
  half?: boolean   // wrap in s.field only — caller puts it in s.fieldRow
}

export function MoneyInput({ label, value, onChange, placeholder, required }: MoneyInputProps) {
  const [display, setDisplay] = useState(value)
  useEffect(() => { setDisplay(value) }, [value])

  const handleBlur = () => {
    const n = parseMoney(display)
    if (n !== null) {
      const fmt = formatMoney(n)
      setDisplay(fmt)
      onChange(fmt)
    } else if (!display.trim()) {
      setDisplay('')
      onChange('')
    }
  }

  return (
    <div className={s.field}>
      <label className={s.fieldLabel}>
        {label}{required && <span className={s.req}> *</span>}
      </label>
      <input
        className={s.fieldInput}
        value={display}
        onChange={e => { setDisplay(e.target.value); onChange(e.target.value) }}
        onBlur={handleBlur}
        placeholder={placeholder ?? '€4M'}
      />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   CLUB SEARCH FIELD
   Autocomplete: Firebase /needs clubs + /contacts org names
══════════════════════════════════════════════════════════════ */

export interface ClubResult { id?: string; name: string; league?: string }

interface ClubSearchFieldProps {
  label?: string
  value: string
  onSelect: (c: ClubResult) => void
  onChange: (val: string) => void
  placeholder?: string
  required?: boolean
}

export function ClubSearchField({
  label = 'Club',
  value,
  onSelect,
  onChange,
  placeholder,
  required,
}: ClubSearchFieldProps) {
  const [results, setResults] = useState<ClubResult[]>([])
  const debounce = useRef<ReturnType<typeof setTimeout>>()

  const search = (q: string) => {
    onChange(q)
    clearTimeout(debounce.current)
    if (q.length < 2) { setResults([]); return }
    debounce.current = setTimeout(async () => {
      try {
        const seen = new Set<string>()
        const clubs: ClubResult[] = []
        const ql = q.toLowerCase()

        // 1) clubs from /needs
        const needsSnap = await get(ref(db, 'needs'))
        if (needsSnap.exists()) {
          needsSnap.forEach(child => {
            const n = child.val()
            const name: string = n.club || ''
            if (name && name.toLowerCase().includes(ql) && !seen.has(name.toLowerCase())) {
              seen.add(name.toLowerCase())
              clubs.push({ name, league: n.league || undefined })
            }
          })
        }

        // 2) org names from /contacts
        const ctSnap = await get(ref(db, 'contacts'))
        if (ctSnap.exists()) {
          ctSnap.forEach(child => {
            const c = child.val()
            const org: string = c.organisation || c.club || c.org || ''
            if (org && org.toLowerCase().includes(ql) && !seen.has(org.toLowerCase())) {
              seen.add(org.toLowerCase())
              clubs.push({ name: org })
            }
          })
        }

        setResults(clubs.slice(0, 8))
      } catch { /* ignore */ }
    }, 280)
  }

  const select = (c: ClubResult) => {
    onSelect(c)
    onChange(c.name)
    setResults([])
  }

  return (
    <div className={s.field} style={{ position: 'relative' }}>
      <label className={s.fieldLabel}>
        {label}{required && <span className={s.req}> *</span>}
      </label>
      <input
        className={s.fieldInput}
        value={value}
        onChange={e => search(e.target.value)}
        placeholder={placeholder ?? 'Type to search clubs…'}
        autoComplete="off"
      />
      {results.length > 0 && (
        <div style={dropStyle}>
          {results.map((c, i) => (
            <button
              key={i}
              type="button"
              style={itemBase}
              onClick={() => select(c)}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-0)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ fontWeight: 600 }}>{c.name}</span>
              {c.league && (
                <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 'var(--text-xs)' }}>
                  {c.league}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   PLAYER SEARCH FIELD
   Autocomplete from Firebase /mandates
══════════════════════════════════════════════════════════════ */

export interface PlayerResult { id: string; name: string; club?: string; pos?: string }

interface PlayerSearchFieldProps {
  label?: string
  value: string
  onSelect: (p: PlayerResult) => void
  onChange: (val: string) => void
  placeholder?: string
  required?: boolean
}

export function PlayerSearchField({
  label = 'Player',
  value,
  onSelect,
  onChange,
  placeholder,
  required,
}: PlayerSearchFieldProps) {
  const [results, setResults] = useState<PlayerResult[]>([])
  const debounce = useRef<ReturnType<typeof setTimeout>>()

  const search = (q: string) => {
    onChange(q)
    clearTimeout(debounce.current)
    if (q.length < 2) { setResults([]); return }
    debounce.current = setTimeout(async () => {
      try {
        const snap = await get(ref(db, 'mandates'))
        if (!snap.exists()) { setResults([]); return }
        const ql = q.toLowerCase()
        const hits: PlayerResult[] = []
        snap.forEach(child => {
          const m = child.val()
          if ((m.name || '').toLowerCase().includes(ql)) {
            hits.push({ id: child.key!, name: m.name, club: m.club || undefined, pos: m.pos || undefined })
          }
        })
        setResults(hits.slice(0, 8))
      } catch { /* ignore */ }
    }, 280)
  }

  const select = (p: PlayerResult) => {
    onSelect(p)
    onChange(p.name)
    setResults([])
  }

  return (
    <div className={s.field} style={{ position: 'relative' }}>
      <label className={s.fieldLabel}>
        {label}{required && <span className={s.req}> *</span>}
      </label>
      <input
        className={s.fieldInput}
        value={value}
        onChange={e => search(e.target.value)}
        placeholder={placeholder ?? 'Type to search players…'}
        autoComplete="off"
      />
      {results.length > 0 && (
        <div style={dropStyle}>
          {results.map(p => (
            <button
              key={p.id}
              type="button"
              style={itemBase}
              onClick={() => select(p)}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-0)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ fontWeight: 600 }}>{p.name}</span>
              {p.pos && (
                <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 'var(--text-xs)' }}>
                  {p.pos}
                </span>
              )}
              {p.club && (
                <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 'var(--text-xs)' }}>
                  {p.club}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   CONTACT SEARCH FIELD
   Autocomplete from Firebase /contacts
══════════════════════════════════════════════════════════════ */

export interface ContactResult { id: string; name: string; org?: string; role?: string }

interface ContactSearchFieldProps {
  label?: string
  value: string
  onSelect: (c: ContactResult) => void
  onChange: (val: string) => void
  placeholder?: string
  required?: boolean
}

export function ContactSearchField({
  label = 'Contact person',
  value,
  onSelect,
  onChange,
  placeholder,
  required,
}: ContactSearchFieldProps) {
  const [results, setResults] = useState<ContactResult[]>([])
  const debounce = useRef<ReturnType<typeof setTimeout>>()

  const search = (q: string) => {
    onChange(q)
    clearTimeout(debounce.current)
    if (q.length < 2) { setResults([]); return }
    debounce.current = setTimeout(async () => {
      try {
        const snap = await get(ref(db, 'contacts'))
        if (!snap.exists()) { setResults([]); return }
        const ql = q.toLowerCase()
        const hits: ContactResult[] = []
        snap.forEach(child => {
          const c = child.val()
          if ((c.name || '').toLowerCase().includes(ql)) {
            hits.push({
              id: child.key!,
              name: c.name,
              org: c.organisation || c.club || c.org || undefined,
              role: c.role || undefined,
            })
          }
        })
        setResults(hits.slice(0, 8))
      } catch { /* ignore */ }
    }, 280)
  }

  const select = (c: ContactResult) => {
    onSelect(c)
    onChange(c.name)
    setResults([])
  }

  return (
    <div className={s.field} style={{ position: 'relative' }}>
      <label className={s.fieldLabel}>
        {label}{required && <span className={s.req}> *</span>}
      </label>
      <input
        className={s.fieldInput}
        value={value}
        onChange={e => search(e.target.value)}
        placeholder={placeholder ?? 'Type to search contacts…'}
        autoComplete="off"
      />
      {results.length > 0 && (
        <div style={dropStyle}>
          {results.map(c => (
            <button
              key={c.id}
              type="button"
              style={itemBase}
              onClick={() => select(c)}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-0)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ fontWeight: 600 }}>{c.name}</span>
              {c.role && (
                <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 'var(--text-xs)' }}>
                  {c.role}
                </span>
              )}
              {c.org && (
                <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 'var(--text-xs)' }}>
                  {c.org}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
