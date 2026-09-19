/* SettingsView — system preferences (coming soon) */
import styles from './StubView.module.css'

export function SettingsView() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </div>
        <h2 className={styles.title}>Settings</h2>
        <p className={styles.desc}>
          Manage your account preferences, Firebase sync settings, 
          default transfer windows, notification rules 
          and export templates.
        </p>
        <div className={styles.features}>
          <div className={styles.feature}>
            <span className={styles.featureDot} style={{ background: 'var(--brand)' }} />
            Firebase database connection
          </div>
          <div className={styles.feature}>
            <span className={styles.featureDot} style={{ background: 'var(--text-muted)' }} />
            Default filters and sort preferences
          </div>
          <div className={styles.feature}>
            <span className={styles.featureDot} style={{ background: 'var(--blue)' }} />
            PDF export headers and branding
          </div>
        </div>
        <span className={styles.badge}>Coming soon</span>
      </div>
    </div>
  )
}
