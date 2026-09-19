/* ActivitiesView — unified activity feed (coming soon) */
import styles from './StubView.module.css'

export function ActivitiesView() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
        </div>
        <h2 className={styles.title}>Activity Feed</h2>
        <p className={styles.desc}>
          A chronological log of every action across the platform — 
          pitch updates, contact touchpoints, mandate changes and task completions 
          — so nothing slips through the cracks.
        </p>
        <div className={styles.features}>
          <div className={styles.feature}>
            <span className={styles.featureDot} style={{ background: 'var(--brand)' }} />
            Filter by player, club or contact
          </div>
          <div className={styles.feature}>
            <span className={styles.featureDot} style={{ background: 'var(--amber)' }} />
            Sync highlights from Beeper and email
          </div>
          <div className={styles.feature}>
            <span className={styles.featureDot} style={{ background: 'var(--blue)' }} />
            Export activity reports as PDF
          </div>
        </div>
        <span className={styles.badge}>Coming soon</span>
      </div>
    </div>
  )
}
