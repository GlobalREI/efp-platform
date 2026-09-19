/* ScoutView — AI-powered scouting hub (coming soon) */
import styles from './StubView.module.css'

export function ScoutView() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
            <path d="M11 8v6M8 11h6"/>
          </svg>
        </div>
        <h2 className={styles.title}>AI Scout</h2>
        <p className={styles.desc}>
          Discover players across global databases using AI-powered search. 
          Filter by position, age, league, contract status and more — 
          then add them directly to your mandate list.
        </p>
        <div className={styles.features}>
          <div className={styles.feature}>
            <span className={styles.featureDot} style={{ background: 'var(--brand)' }} />
            AI-match players to open club needs
          </div>
          <div className={styles.feature}>
            <span className={styles.featureDot} style={{ background: 'var(--blue)' }} />
            Cross-reference with existing mandates
          </div>
          <div className={styles.feature}>
            <span className={styles.featureDot} style={{ background: 'var(--purple)' }} />
            One-click shortlist and pitch creation
          </div>
        </div>
        <span className={styles.badge}>Coming soon</span>
      </div>
    </div>
  )
}
