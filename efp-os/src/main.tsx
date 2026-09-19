import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'

import './styles/tokens.css'
import './styles/global.css'

// Lazy-load every route so the initial bundle stays small
const Dashboard     = lazy(() => import('./views/Dashboard').then(m => ({ default: m.Dashboard })))
const MandateList   = lazy(() => import('./views/PlayerList').then(m => ({ default: m.PlayerList })))
const PlayerDetail  = lazy(() => import('./views/PlayerDetail').then(m => ({ default: m.PlayerDetail })))
const ClubList      = lazy(() => import('./views/ClubList').then(m => ({ default: m.ClubList })))
const ClubDetail    = lazy(() => import('./views/ClubDetail').then(m => ({ default: m.ClubDetail })))
const ContactList   = lazy(() => import('./views/ContactList').then(m => ({ default: m.ContactList })))
const ContactDetail = lazy(() => import('./views/ContactDetail').then(m => ({ default: m.ContactDetail })))
const NeedList      = lazy(() => import('./views/NeedList').then(m => ({ default: m.NeedList })))
const NeedDetail    = lazy(() => import('./views/NeedDetail').then(m => ({ default: m.NeedDetail })))
const PitchList     = lazy(() => import('./views/PitchList').then(m => ({ default: m.PitchList })))
const PitchDetail   = lazy(() => import('./views/PitchDetail').then(m => ({ default: m.PitchDetail })))
const TaskList      = lazy(() => import('./views/TaskList').then(m => ({ default: m.TaskList })))
const SearchResults = lazy(() => import('./views/SearchResults').then(m => ({ default: m.SearchResults })))
const ScoutView      = lazy(() => import('./views/ScoutView').then(m => ({ default: m.ScoutView })))
const ActivitiesView = lazy(() => import('./views/ActivitiesView').then(m => ({ default: m.ActivitiesView })))
const SettingsView   = lazy(() => import('./views/SettingsView').then(m => ({ default: m.SettingsView })))

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-3)', fontSize: '13px' }}>
      Loading…
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index               element={<Dashboard />} />
            <Route path="mandates"     element={<MandateList />} />
            <Route path="mandates/:id" element={<PlayerDetail />} />
            <Route path="scout"        element={<ScoutView />} />
            <Route path="activities"   element={<ActivitiesView />} />
            <Route path="settings"     element={<SettingsView />} />
            <Route path="clubs"        element={<ClubList />} />
            <Route path="clubs/:id"    element={<ClubDetail />} />
            <Route path="contacts"     element={<ContactList />} />
            <Route path="contacts/:id" element={<ContactDetail />} />
            <Route path="needs"        element={<NeedList />} />
            <Route path="needs/:id"    element={<NeedDetail />} />
            <Route path="pitches"      element={<PitchList />} />
            <Route path="pitches/:id"  element={<PitchDetail />} />
            <Route path="tasks"        element={<TaskList />} />
            <Route path="search"       element={<SearchResults />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>
)
