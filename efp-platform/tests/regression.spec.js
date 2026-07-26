// EFP Platform — Playwright Regression Test
//
// This spec loads index.html with ?test=1, waits for window._regression to run
// all tests, then reads window.__EFP_TEST_RESULTS and fails if any test failed.
//
// To run locally:
//   npm ci && npx playwright install chromium && npm test
//
// CI: runs automatically via .github/workflows/regression.yml on every push to main.

const { test, expect } = require('@playwright/test');
const path = require('path');

// Load the app in test mode (triggers auto-run of window._regression.runAll())
const FILE_URL = 'file://' + path.resolve(__dirname, '../index.html') + '?test=1';

test.describe('EFP Regression Suite', () => {

  test('All regression + workflow + relationship tests pass', async ({ page }) => {
    // Suppress Firebase console noise in CI
    page.on('console', msg => {
      const text = msg.text();
      // Only log EFP test output and errors
      if (text.startsWith('[EFP-') || msg.type() === 'error') {
        process.stdout.write('[BROWSER] ' + text + '\n');
      }
    });

    page.on('pageerror', err => {
      console.error('[PAGE ERROR]', err.message);
    });

    // Navigate to the app in test mode
    await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' });

    // Wait for _regression to finish (sets window.__EFP_TEST_DONE = true)
    // Timeout: 30s — tests are synchronous and should complete in < 500ms
    await page.waitForFunction(
      () => window.__EFP_TEST_DONE === true,
      { timeout: 30_000 }
    );

    // Read results
    const results = await page.evaluate(() => window.__EFP_TEST_RESULTS);

    // Print failure details to CI log before asserting
    if (results && !results.allPass) {
      const failures = (results.results || []).filter(r => !r.ok);
      console.error('\n══════════════════════════════════════════════');
      console.error('EFP REGRESSION FAILURES (' + failures.length + '):');
      failures.forEach(f => {
        console.error('  ❌ ' + f.name + (f.why ? '  —  ' + f.why : ''));
      });
      console.error('══════════════════════════════════════════════\n');
    } else if (results && results.allPass) {
      console.log('✅ ALL PASS — ' + results.passed + '/' + results.total +
                  ' tests (' + results.elapsed + 'ms)');
    }

    // Hard fail if results weren't set
    expect(results).toBeTruthy();
    expect(results.total).toBeGreaterThan(0);

    // This is the deployment gate: if allPass is false, CI fails → deployment blocked
    expect(results.allPass).toBe(true);
  });

  test('Test overlay renders correctly in browser', async ({ page }) => {
    await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__EFP_TEST_DONE === true, { timeout: 30_000 });

    // Overlay should be present in the DOM
    const overlay = page.locator('#_efp-test-overlay');
    await expect(overlay).toBeVisible();

    // Status element should show pass or fail count
    const status = page.locator('#_efp-test-status');
    const statusText = await status.textContent();
    expect(statusText).toBeTruthy();
    expect(statusText.length).toBeGreaterThan(0);
  });

  test('No JavaScript errors on normal page load (without ?test)', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    const normalUrl = 'file://' + path.resolve(__dirname, '../index.html');
    await page.goto(normalUrl, { waitUntil: 'domcontentloaded' });

    // Give the page 2 seconds to settle (Firebase connects, init runs)
    await page.waitForTimeout(2000);

    // Filter out known external-service errors (Firebase, network) that are
    // expected in a sandboxed CI environment with no real credentials
    const appErrors = errors.filter(e =>
      !e.includes('firebase') &&
      !e.includes('Firebase') &&
      !e.includes('XMLHttpRequest') &&
      !e.includes('net::ERR_') &&
      !e.includes('Failed to fetch')
    );

    if (appErrors.length > 0) {
      console.error('Application JS errors:', appErrors);
    }
    expect(appErrors).toHaveLength(0);
  });

  test('Mobile viewport (390px iPhone) — all tests pass, no JS errors', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    const page = await context.newPage();

    const mobileErrors = [];
    page.on('pageerror', err => mobileErrors.push(err.message));

    await page.goto(FILE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__EFP_TEST_DONE === true, { timeout: 30_000 });

    // App JS errors (excluding external services)
    const appErrors = mobileErrors.filter(e =>
      !e.includes('firebase') && !e.includes('Firebase') &&
      !e.includes('XMLHttpRequest') && !e.includes('net::ERR_') && !e.includes('Failed to fetch')
    );
    if (appErrors.length > 0) console.error('Mobile JS errors:', appErrors);
    expect(appErrors).toHaveLength(0);

    // Regression suite must still pass at mobile viewport
    const results = await page.evaluate(() => window.__EFP_TEST_RESULTS);
    expect(results).toBeTruthy();
    if (results && !results.allPass) {
      const failures = (results.results || []).filter(r => !r.ok);
      console.error('Mobile regression failures:', failures.map(f => f.name + (f.why ? ' — ' + f.why : '')));
    }
    expect(results.allPass).toBe(true);

    // Critical UI elements must be visible at 390px
    const nav = page.locator('#bottom-nav, .bottom-nav, nav');
    const hasNav = await nav.count();
    if (hasNav > 0) await expect(nav.first()).toBeVisible();

    await context.close();
  });

  test('Firebase load error — app renders offline state, no crash', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    // Block all Firebase network requests to simulate load failure
    await page.route('**/*firebase*/**', route => route.abort());
    await page.route('**/*.firebaseio.com/**', route => route.abort());

    const normalUrl = 'file://' + path.resolve(__dirname, '../index.html');
    await page.goto(normalUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // App must not crash with unhandled JS errors (Firebase errors OK)
    const appErrors = errors.filter(e =>
      !e.includes('firebase') && !e.includes('Firebase') &&
      !e.includes('XMLHttpRequest') && !e.includes('net::ERR_') &&
      !e.includes('Failed to fetch') && !e.includes('firebaseio')
    );
    if (appErrors.length > 0) console.error('Offline app errors:', appErrors);
    expect(appErrors).toHaveLength(0);

    // Navigation must still be usable
    const navLinks = page.locator('.nav-item, #bottom-nav a, .sidebar-item');
    const navCount = await navLinks.count();
    expect(navCount).toBeGreaterThan(0);
  });

});
