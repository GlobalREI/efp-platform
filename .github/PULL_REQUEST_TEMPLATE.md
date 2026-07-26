## What changed
<!-- One sentence. What does this PR do? -->


## Type
- [ ] Bug fix
- [ ] Feature / enhancement
- [ ] Refactor / cleanup
- [ ] Tests only
- [ ] Release prep

---

## Pre-merge checklist

### Self-review
- [ ] I reviewed my own diff before opening this PR
- [ ] No debug logs, `console.log`, or commented-out code left in
- [ ] No hardcoded test data or placeholder values

### Tests
- [ ] Ran `npm test` locally — all passing
- [ ] Added or updated regression tests for any new behaviour
- [ ] No existing tests broken

### UX / Product
- [ ] Tested on desktop (1280px+)
- [ ] Tested on mobile (390px — iPhone viewport)
- [ ] All affected forms: required field validation works
- [ ] All affected forms: loading state shown on submit
- [ ] All affected forms: success snack fires on save
- [ ] All affected forms: data persists after page refresh

### Database
- [ ] Any new mutation calls `fbSave()`
- [ ] Any delete cascades to linked records
- [ ] No orphan records created

---

## Screenshots / notes
<!-- Optional: before/after screenshots, edge cases, anything the reviewer should know -->
