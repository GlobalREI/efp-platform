# EFP Manual QA Checklist

Complete this on **staging** before approving a production deploy.
Check every item. If anything fails, reject the deploy and open a bug.

---

## Setup
- [ ] Opened staging URL in a fresh private/incognito window
- [ ] Firebase connected (no "offline" banner visible)
- [ ] Seed data loaded (contacts, clubs, mandates visible in tables)

---

## Core flows — create

| Flow | Steps | Pass? |
|------|-------|-------|
| Add Contact | Fill all fields → Add Contact → snack fires → row appears in table | ☐ |
| Add Club | Fill name / country / league → Add Club → snack fires → appears in dropdowns | ☐ |
| Add Mandate | Fill all fields → Save → snack fires → row appears | ☐ |
| Add Club Need | Fill club / position / budget → Save → snack fires → row appears | ☐ |
| Add Relationship | Fill name → Save → card appears in correct Kanban column | ☐ |
| Add Task | Fill text → Add Task → snack fires → task appears in correct bucket | ☐ |
| Add Pitch | Select player / club / contact → Send Pitch → navigates to Pitches → card appears | ☐ |

## Core flows — edit & delete

| Flow | Steps | Pass? |
|------|-------|-------|
| Edit Contact | Click row → Edit Contact → change name → save → row updates | ☐ |
| Delete Contact | Open drawer → delete → confirm → row disappears | ☐ |
| Edit Club | Click row → change league → save → table updates | ☐ |
| Delete Club | Open edit drawer → delete → confirm → cascades to linked data | ☐ |
| Move Pitch | Open pitch card → move stage → card moves to correct column | ☐ |
| Complete Task | Tick task done → moves to Done section | ☐ |

---

## Reliability checks

- [ ] **Loading state:** submit button shows spinner / disabled state during save
- [ ] **Error state:** submit with empty required fields → red border + snack, no save
- [ ] **Success snack:** every save fires a green snack (not an error snack)
- [ ] **Refresh persistence:** add a contact → hard refresh (Ctrl+Shift+R) → contact still there
- [ ] **Duplicate guard:** add a contact with same name + club as an existing one → blocked with warning

---

## Mobile (390px)

Open staging on a real phone or Chrome DevTools → iPhone 12 (390×844).

- [ ] Bottom navigation visible and tappable
- [ ] Contacts page: rows readable, click opens drawer
- [ ] Add Contact drawer: all fields reachable, keyboard doesn't overlap submit button
- [ ] Kanban (Pitches / Relationships): cards scroll horizontally
- [ ] No horizontal overflow / broken layout on any page

---

## Activity Feed

- [ ] Feed loads and shows recent entries
- [ ] Adding a contact creates an entry in the feed within 5 seconds
- [ ] Feed is full-width (no max-width cap)

---

## Search

- [ ] Contacts search: type a name → table filters → clear → all contacts back
- [ ] Needs search: type a club name → table filters
- [ ] If a new contact is added while a search is active → re-filter applied correctly

---

## Sign-off

| | |
|---|---|
| QA'd by | |
| Date | |
| Staging URL | |
| Commit SHA | |
| Verdict | ☐ APPROVE deploy &nbsp;&nbsp; ☐ REJECT — open bug first |
| Notes | |
