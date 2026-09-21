import React from 'react'
/**
 * ContactList — all contacts
 *
 * Reads: /contacts  →  { [id]: { name, role, club, email, phone, wa, notes, status, stage } }
 */
import { useEffect, useState, useMemo } from 'react'
import { useNavigate }  from 'react-router-dom'
import { ref, onValue, off, remove } from 'firebase/database'
import { db }           from '../data/firebase'
import { PageHeader }   from '../components/PageHeader'
import { AddContactForm } from './AddContactForm'
import styles from './ContactList.module.css'

interface Contact {
  id: string
  name: string
  role?: string
  club?: string
  email?: string
  phone?: string
  wa?: string
  notes?: string
  status?: string
  stage?: string
}

const ROLE_ICON: Record<string, string> = {
  'CEO':        '👑',
  'GM':         '👔',
  'Sporting Director': '🎯',
  'Scout':      '🔍',
  'Agent':      '🤝',
  'Coach':      '📋',
  'Player':     '⚽',
}

export function ContactList() {
  const nav = useNavigate()

  async function deleteContact(e: React.MouseEvent, id: string, name: string) {
    e.stopPropagation()
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    await remove(ref(db, `contacts/${id}`))
  }

  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [role,     setRole]     = useState('all')
  const [addOpen,  setAddOpen]  = useState(false)

  useEffect(() => {
    const r = ref(db, 'contacts')
    const handler = (snap: any) => {
      if (!snap.exists()) { setContacts([]); setLoading(false); return }
      const rows: Contact[] = Object.entries(snap.val()).map(([id, v]: [string, any]) => ({ id, ...v }))
      rows.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      setContacts(rows)
      setLoading(false)
    }
    onValue(r, handler)
    return () => off(r, 'value', handler)
  }, [])

  const roles = useMemo(() => {
    const s = new Set<string>()
    contacts.forEach(c => { if (c.role) s.add(c.role) })
    return Array.from(s).sort()
  }, [contacts])

  const rows = useMemo(() => contacts.filter(c => {
    if (role !== 'all' && c.role !== role) return false
    if (search) {
      const q = search.toLowerCase()
      return [c.name, c.role, c.club, c.email].some(s => s?.toLowerCase().includes(q))
    }
    return true
  }), [contacts, role, search])

  const filters = (
    <div className={styles.filters}>
      <select className={styles.sel} value={role} onChange={e => setRole(e.target.value)}>
        <option value="all">All Roles</option>
        {roles.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
    </div>
  )

  if (loading) {
    return (
      <div className={styles.page}>
        <PageHeader title="Contacts" sub="Loading…" />
        <div className={styles.skeletonWrap}>
          {[...Array(8)].map((_, i) => <div key={i} className={styles.skeleton} />)}
        </div>
      </div>
    )
  }

  return (
    <>
    <div className={styles.page}>
      <PageHeader
        title="Contacts"
        sub={`${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`}
        search={{ value: search, onChange: setSearch, placeholder: 'Search contacts, clubs…' }}
        actions={<button onClick={() => setAddOpen(true)} style={{padding:'7px 14px',background:'var(--brand)',color:'#fff',border:'none',borderRadius:'var(--radius-md)',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>+ New contact</button>}
        filters={filters}
      />

      {rows.length === 0 ? (
        <div className={styles.empty}>
          {search || role !== 'all' ? 'No contacts match the current filters.' : 'No contacts yet.'}
        </div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thName}>Name</th>
              <th className={styles.thRole}>Role</th>
              <th className={styles.thClub}>Club</th>
              <th className={styles.thContact}>Contact</th>
              <th className={styles.thStage}>Stage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(c => {
              const icon = ROLE_ICON[c.role || ''] || '👤'
              const initial = (c.name || '?')[0].toUpperCase()
              return (
                <tr key={c.id} className={styles.row} onClick={() => nav(`/contacts/${c.id}`)}>
                  <td className={styles.tdName}>
                    <div className={styles.nameCell}>
                      <div className={styles.av} style={{ background: '#7C3AED18', color: '#7C3AED', border: '1px solid #DDD6FE' }}>
                        {initial}
                      </div>
                      <span className={styles.name}>{c.name}</span>
                    </div>
                  </td>
                  <td className={styles.tdRole}>
                    <span className={styles.roleChip}>
                      {icon} {c.role || '—'}
                    </span>
                  </td>
                  <td className={styles.tdClub}>{c.club || '—'}</td>
                  <td className={styles.tdContact}>
                    {c.email && <span className={styles.contactItem}>✉ {c.email}</span>}
                    {c.phone && <span className={styles.contactItem}>📞 {c.phone}</span>}
                    {c.wa    && !c.phone && <span className={styles.contactItem}>💬 {c.wa}</span>}
                  </td>
                  <td className={styles.tdStage}>
                    {c.stage && <span className={styles.stagePill}>{c.stage}</span>}
                  </td>
                  <td className={styles.tdDel}>
                    <button className={styles.deleteBtn} onClick={e => deleteContact(e, c.id, c.name)} title="Delete contact">×</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
    <AddContactForm open={addOpen} onClose={() => setAddOpen(false)} />
  </>
  )
}
