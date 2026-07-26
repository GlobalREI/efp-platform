# EFP Release Process

Nothing goes to production directly. Every change follows this pipeline.

```
Developer  →  Code Review  →  Automated Tests  →  Manual QA (preview URL)
    →  Approve deploy  →  Production
```

---

## Day-to-day: making a change

1. Create a branch, make your changes, open a pull request to `main`
2. GitHub runs all regression tests automatically — you'll see a green ✅ or red ❌
3. Netlify creates a **deploy preview** for the PR — a temporary URL where you can click around and test the actual change live
4. Someone reviews the PR and approves it
5. Merge to `main` — tests run again on the merged code

At this point **nothing has gone to production yet.**

---

## Deploying to production

When you're ready to ship:

1. Go to your GitHub repo → **Actions** tab
2. Click **"Deploy to Production"** in the left sidebar
3. Click **Run workflow** (top right)
4. Type a one-line description of what's in this release
5. Click **Run workflow**

GitHub will:
- Re-run all tests against the current `main`
- If tests pass → **pause and ask you to approve**
- You'll get a notification — click through, review, click **Approve**
- Netlify deploys — live within ~60 seconds

---

## Rollback

If something goes wrong after a production deploy:

Netlify → your site → **Deploys** tab → find the previous deploy → click **Publish deploy**

Done in 30 seconds, no code changes needed.

---

## One-time GitHub setup (2 minutes)

Go to your GitHub repo → **Settings → Environments → New environment**

- Name it exactly: `production`
- Under **Required reviewers** → add your GitHub username
- Click **Save protection rules**

That's it. No Netlify changes needed — the workflows use your existing `NETLIFY_DEPLOY_HOOK` secret.
