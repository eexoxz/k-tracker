import { chromium } from "file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    window.isTauri = true;
    window.openerCalls = [];
    window.__TAURI_INTERNALS__ = { invoke: async (command, args) => { window.openerCalls.push({ command, args }); } };
    localStorage.setItem("k-tracker:preferences", JSON.stringify({ scene: "kpop", selectedArtist: "iu", activeView: "sources" }));
    localStorage.setItem("k-tracker:artistProfiles", JSON.stringify({ iu: {
      id: "iu", name: "IU", scene: "kpop", artistType: "Person", membersComplete: true,
      fetchedAt: new Date().toISOString(), sources: [{ id: "instagram", label: "Instagram", kind: "official", url: "https://www.instagram.com/dlwlrma/" }]
    } }));
  });
  await page.goto("http://localhost:5174");
  await page.locator('.source-strip a[href*="instagram.com"]').click();
  const calls = await page.evaluate(() => window.openerCalls);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, "plugin:opener|open_url");
  assert.equal(calls[0].args.url, "https://www.instagram.com/dlwlrma/");
  assert.equal(page.url(), "http://localhost:5174/");
  console.log("PASS: desktop source link invokes Tauri's opener once and keeps the app page open.");
} finally {
  await browser.close();
}
