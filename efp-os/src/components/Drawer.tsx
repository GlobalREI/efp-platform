/**
 * Drawer — slide-in right panel
 *
 * Usage:
 *   <Drawer open={open} onClose={() => setOpen(false)} title="New Player" sub="Add to active mandates">
 *     <form>…</form>
 *     <DrawerFoot>
 *       <Button variant="primary">Save</Button>
 *       <Button onClick={onClose}>Cancel</Button>
 *     </DrawerFoot>
 *   </Drawer>
 */
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import styles from './Drawer.module.css'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  sub?: string
  wide?: boolean
  children: ReactNode
}

export function Drawer({ open, onClose, title, sub, wide, children }: DrawerProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      <div
        className={`${styles.overlay} ${open ? styles.overlayOpen : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`${styles.drawer} ${open ? styles.drawerOpen : ''} ${wide ? styles.drawerWide : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className={styles.head}>
          <div className={styles.headText}>
            <div className={styles.title}>{title}</div>
            {sub && <div className={styles.sub}>{sub}</div>}
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close drawer">✕</button>
        </div>
        {children}
      </div>
    </>
  )
}

/** Sticky footer inside a Drawer */
export function DrawerBody({ children }: { children: ReactNode }) {
  return <div className={styles.body}>{children}</div>
}

export function DrawerFoot({ children }: { children: ReactNode }) {
  return <div className={styles.foot}>{children}</div>
}

/** Re-export form field class names so forms can use them without importing CSS separately */
export { styles as drawerStyles }
