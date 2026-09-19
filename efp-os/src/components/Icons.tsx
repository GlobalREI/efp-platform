/**
 * Icons — professional stroke-based SVG icons for EFP OS navigation.
 * All icons use stroke="currentColor" fill="none" for easy colour theming.
 */

interface IconProps {
  size?: number
  className?: string
}

const d = (size = 16) => ({ width: size, height: size, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const })

export function IconDashboard({ size = 15, className }: IconProps) {
  return (
    <svg {...d(size)} className={className}>
      <rect x="1" y="1" width="6" height="6" rx="1.5"/>
      <rect x="9" y="1" width="6" height="6" rx="1.5"/>
      <rect x="1" y="9" width="6" height="6" rx="1.5"/>
      <rect x="9" y="9" width="6" height="6" rx="1.5"/>
    </svg>
  )
}

export function IconMandates({ size = 15, className }: IconProps) {
  // Trophy / award
  return (
    <svg {...d(size)} className={className}>
      <path d="M4 2h8v6a4 4 0 0 1-8 0V2z"/>
      <path d="M4 5H2a1 1 0 0 0 0 2h2"/>
      <path d="M12 5h2a1 1 0 0 1 0 2h-2"/>
      <line x1="8" y1="12" x2="8" y2="14"/>
      <line x1="5" y1="14" x2="11" y2="14"/>
    </svg>
  )
}

export function IconClubs({ size = 15, className }: IconProps) {
  // Building / stadium
  return (
    <svg {...d(size)} className={className}>
      <path d="M2 14V7l6-5 6 5v7"/>
      <line x1="2" y1="14" x2="14" y2="14"/>
      <rect x="6" y="9" width="4" height="5"/>
    </svg>
  )
}

export function IconContacts({ size = 15, className }: IconProps) {
  // Person card
  return (
    <svg {...d(size)} className={className}>
      <rect x="3" y="1" width="10" height="14" rx="1.5"/>
      <circle cx="8" cy="6" r="2"/>
      <path d="M5 12c0-1.657 1.343-3 3-3s3 1.343 3 3"/>
    </svg>
  )
}

export function IconNeeds({ size = 15, className }: IconProps) {
  // Checklist / requirements
  return (
    <svg {...d(size)} className={className}>
      <rect x="2" y="1.5" width="12" height="13" rx="1.5"/>
      <line x1="5" y1="5.5" x2="11" y2="5.5"/>
      <line x1="5" y1="8.5" x2="11" y2="8.5"/>
      <line x1="5" y1="11.5" x2="8" y2="11.5"/>
    </svg>
  )
}

export function IconPitches({ size = 15, className }: IconProps) {
  // Send / paper plane
  return (
    <svg {...d(size)} className={className}>
      <path d="M14 2L9.5 14 7.5 9 2 6.5 14 2z"/>
    </svg>
  )
}

export function IconScout({ size = 15, className }: IconProps) {
  // Search / magnifier
  return (
    <svg {...d(size)} className={className}>
      <circle cx="6.5" cy="6.5" r="5"/>
      <path d="M11 11l3 3"/>
    </svg>
  )
}

export function IconActivities({ size = 15, className }: IconProps) {
  // Activity / pulse
  return (
    <svg {...d(size)} className={className}>
      <polyline points="1,8 4,8 6,3 8,13 10,6 12,8 15,8"/>
    </svg>
  )
}

export function IconSettings({ size = 15, className }: IconProps) {
  // Gear
  return (
    <svg {...d(size)} className={className}>
      <circle cx="8" cy="8" r="2.5"/>
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06"/>
    </svg>
  )
}

export function IconBell({ size = 15, className }: IconProps) {
  return (
    <svg {...d(size)} className={className}>
      <path d="M8 2a5 5 0 0 1 5 5v3l1.5 2h-13L3 10V7a5 5 0 0 1 5-5z"/>
      <path d="M6.5 13a1.5 1.5 0 0 0 3 0"/>
    </svg>
  )
}

export function IconSearch({ size = 15, className }: IconProps) {
  return (
    <svg {...d(size)} className={className}>
      <circle cx="6.5" cy="6.5" r="5"/>
      <path d="M11 11l3 3"/>
    </svg>
  )
}

export function IconTasks({ size = 15, className }: IconProps) {
  // Checklist
  return (
    <svg {...d(size)} className={className}>
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  )
}
