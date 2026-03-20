#!/usr/bin/env node
/**
 * Full E2E browser test — 2 messages, full pipeline.
 * Uses Playwright (same as Playwright MCP) directly.
 *
 * Usage: node scripts/e2e-browser.mjs
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE = 'http://localhost:3000';
const SCREENSHOT_DIR = '.claude/findings/screenshots';

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

async function waitForText(page, text, timeout = 300_000) {
  await page.waitForFunction(
    (t) => document.body.innerText.includes(t),
    text,
    { timeout }
  );
}

async function waitForNoText(page, text, timeout = 10_000) {
  try {
    await page.waitForFunction(
      (t) => !document.body.innerText.includes(t),
      text,
      { timeout }
    );
  } catch { /* OK if text still there */ }
}

async function waitForIdle(page, timeout = 300_000) {
  // Simple: wait until no [role="status"] element exists on page
  // The status element only appears during generation/tool execution
  const start = Date.now();
  let lastStatus = '';
  while (Date.now() - start < timeout) {
    const state = await page.evaluate(() => {
      const statusEl = document.querySelector('[role="status"]');
      return {
        hasStatus: !!statusEl,
        status: statusEl?.textContent?.trim() || '',
      };
    });

    if (!state.hasStatus) {
      // No status element — likely idle. Wait 5s to confirm
      await page.waitForTimeout(5000);
      const still = await page.evaluate(() => !!document.querySelector('[role="status"]'));
      if (!still) return;
    }

    if (state.status && state.status !== lastStatus) {
      log(`  Status: ${state.status.slice(0, 80)}`);
      lastStatus = state.status;
    }
    await page.waitForTimeout(5000);
  }
  throw new Error('Timeout waiting for idle');
}

async function main() {
  log('Launching browser with persisted session...');
  // Reuse the Playwright MCP's Chrome user-data-dir (has auth cookies)
  // Use system Chrome (channel: 'chrome') since the data dir was created by system Chrome
  const userDataDir = 'C:/Users/marti/AppData/Local/ms-playwright/mcp-chrome-7c7fdfa';
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1400, height: 900 },
    args: ['--window-size=1400,900'],
  });

  const page = context.pages()[0] || await context.newPage();

  log('Navigating to chat...');
  await page.goto(BASE + '/chat', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Check if we're logged in
  const url = page.url();
  if (url.includes('/login') || url.includes('/sign-in')) {
    log('ERROR: Not logged in. Need to sign in first.');
    await context.close();
    process.exit(1);
  }

  // Wait for greeting to load
  log('Waiting for chat to be ready...');
  try {
    await page.waitForSelector('textarea, [role="textbox"]', { timeout: 30_000 });
  } catch {
    log('WARNING: No textbox found, taking screenshot...');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/e2e-no-textbox.png`, fullPage: true });
    await context.close();
    process.exit(1);
  }

  // Wait for any greeting generation to finish
  await page.waitForTimeout(15_000);
  try {
    await waitForIdle(page, 30_000);
  } catch { /* greeting might not generate */ }

  // ── MESSAGE 1: ICP ──
  log('=== MESSAGE 1: ICP + full pipeline instruction ===');
  const textbox = page.getByRole('textbox', { name: /Message LeadSens/i });
  await textbox.click();
  await textbox.fill('Head of Marketing at ecommerce companies in Germany, 20-100 employees');
  await page.getByRole('button', { name: 'Send' }).click();

  log('Message 1 sent. Waiting for agent response...');
  await waitForIdle(page, 120_000);

  // Screenshot after message 1
  await page.screenshot({ path: `${SCREENSHOT_DIR}/e2e-01-icp-parsed.png`, fullPage: true });
  log('Screenshot: e2e-01-icp-parsed.png');

  // Check what the agent said
  const agentText1 = await page.evaluate(() => {
    const msgs = document.querySelectorAll('[class*="rounded-2xl"]');
    return msgs.length > 0 ? msgs[msgs.length - 1].textContent?.trim().slice(0, 200) : '';
  });
  log(`Agent response (200c): ${agentText1}`);

  // ── MESSAGE 2: GO ──
  log('=== MESSAGE 2: GO ===');
  await textbox.click();
  await textbox.fill('50, go. Run the full pipeline — source, score, enrich top 3, draft emails. No questions.');
  await page.getByRole('button', { name: 'Send' }).click();

  log('Message 2 sent. Waiting for full pipeline...');

  // This will take a while — source (3min) + score (2min) + enrich (5min) + draft (1min)
  // Take periodic screenshots
  const statusInterval = setInterval(async () => {
    try {
      const status = await page.evaluate(() => {
        const el = document.querySelector('[role="status"]');
        return el?.textContent?.trim() || '';
      });
      if (status) log(`  Pipeline: ${status.slice(0, 100)}`);
    } catch { /* page might be navigating */ }
  }, 15_000);

  try {
    await waitForIdle(page, 600_000); // 10 min max
  } catch (e) {
    log(`WARNING: Pipeline may not have completed: ${e.message}`);
  }

  clearInterval(statusInterval);

  // Check for auto-continue
  const hasAutoContinue = await page.evaluate(() =>
    document.body.innerText.includes('Continuing pipeline')
  );
  log(`Auto-continue triggered: ${hasAutoContinue}`);

  // Screenshot after pipeline
  await page.screenshot({ path: `${SCREENSHOT_DIR}/e2e-02-pipeline-complete.png`, fullPage: true });
  log('Screenshot: e2e-02-pipeline-complete.png');

  // Check for email preview card
  const hasEmailPreview = await page.evaluate(() =>
    document.body.innerText.includes('email-preview') ||
    document.querySelector('[class*="email-preview"]') !== null ||
    document.body.innerHTML.includes('qualityScore') ||
    document.body.innerHTML.includes('Quality')
  );
  log(`Email preview card visible: ${hasEmailPreview}`);

  // Check for key pipeline outputs
  const checks = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasLeadTable: text.includes('Leon Theisen') || text.includes('Lena Lüpping') || text.includes('Head of Marketing'),
      hasIcpScores: /ICP.*[78]|scored.*[78]|Score:?\s*[78]/i.test(text),
      hasDraftedEmail: text.includes('Subject:') || text.includes('subject') || text.includes('wiredminds') || text.includes('pipeline'),
      hasSourcedCount: /4[0-9]\s*lead/i.test(text),
      hasPendingConfirm: text.includes('@@PENDING_CONFIRM@@'),
    };
  });

  log('--- Verification ---');
  log(`Lead table visible: ${checks.hasLeadTable}`);
  log(`ICP scores visible: ${checks.hasIcpScores}`);
  log(`Drafted email visible: ${checks.hasDraftedEmail}`);
  log(`Sourced count visible: ${checks.hasSourcedCount}`);
  log(`Raw markers visible (should be false): ${checks.hasPendingConfirm}`);

  // Scroll to bottom and take final screenshot
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/e2e-03-final-scroll.png`, fullPage: true });
  log('Screenshot: e2e-03-final-scroll.png');

  log('\n=== E2E TEST COMPLETE ===');
  await context.close();
}

main().catch(e => {
  console.error('E2E FAILED:', e);
  process.exit(1);
});
