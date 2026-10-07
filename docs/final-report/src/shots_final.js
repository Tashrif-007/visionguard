// Screenshots of the current UI for the user manual. Needs backend :8000, frontend :5173, demo videos in logs/.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..', '..');
const OUT = path.join(ROOT, 'assets', 'manual');
fs.mkdirSync(OUT, { recursive: true });
const API = 'http://localhost:8000', WEB = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const env = {};
for (const l of fs.readFileSync(path.join(REPO, '.env'), 'utf8').split('\n')) { const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }
let token;
async function api(method, url, body) {
  const res = await fetch(API + url, { method, headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok && res.status !== 409) throw new Error(`${method} ${url} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}
(async () => {
  const login = await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }) });
  token = (await login.json()).access_token;
  let cams = await api('GET', '/cameras');
  const ensure = async (name, file) => {
    const uri = `docs/final-report/logs/${file}`;
    let c = cams.find((x) => x.name === name);
    if (!c) c = await api('POST', '/cameras', { name, source_uri: uri });
    else if (c.source_uri !== uri) { await api('POST', `/cameras/${c.id}/stop`); c = await api('PATCH', `/cameras/${c.id}`, { name, source_uri: uri }); }
    await api('POST', `/cameras/${c.id}/start`).catch(() => {});
    return c;
  };
  const gate = await ensure('Street gate', 'tyumen_loop.mp4');
  const park = await ensure('Parking lot', 'long.mp4');
  await api('PUT', `/cameras/${gate.id}/zones`, [
    { name: 'Sky and buildings', mode: 'exclude', points: [[0, 0], [1, 0], [1, 0.3], [0, 0.3]] },
    { name: 'Road and crossing', mode: 'include', points: [[0.05, 0.35], [0.95, 0.35], [0.95, 0.98], [0.05, 0.98]] },
  ]);
  console.log('cameras', gate.id, park.id, '- waiting for events');
  await sleep(+process.env.WAIT || 80000);

  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 1440, height: 900 } });
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  const shot = async (n) => { await page.screenshot({ path: path.join(OUT, `${n}.png`) }); console.log('shot', n); };
  const goto = async (u, w = 1500) => { await page.goto(WEB + u, { waitUntil: 'networkidle2' }); await sleep(w); };
  const click = async (t) => { await page.locator(`::-p-text(${t})`).click(); await sleep(900); };

  await goto('/', 900); await shot('m_landing');
  await goto('/login', 500); await shot('m_login');
  await page.evaluate((t) => { localStorage.setItem('visionguard_token', t); localStorage.setItem('theme', 'light'); }, token);
  await goto('/dashboard', 4000); await shot('m_dashboard');
  await click('Start camera'); await shot('m_add_dialog'); await page.keyboard.press('Escape'); await sleep(400);
  await goto('/cameras', 2000); await shot('m_cameras');
  await page.locator(`button[aria-label="Configure ${gate.name}"]`).click(); await sleep(2500); await shot('m_zones');
  await click('Schedule'); await sleep(600); await shot('m_schedule'); await page.keyboard.press('Escape'); await sleep(400);
  await api('POST', `/cameras/${gate.id}/stop`); await api('POST', `/cameras/${park.id}/stop`); await sleep(25000);  // let queued events and clips finish
  await goto('/events', 2000); await shot('m_events');
  const picked = await page.evaluate(() => { const c = [...document.querySelectorAll('main button')].filter((b) => /camera #1/i.test(b.textContent)); if (c.length < 4) return c.length; c[3].click(); return 'ok'; });
  console.log('event pick', picked); await sleep(5000); await shot('m_event_clip');
  await page.locator('::-p-text(Snapshot)').click().catch(() => {}); await sleep(1500); await shot('m_event_snapshot');
  await goto('/events', 1500);
  await page.type('input[type=search], input[placeholder]', 'any motion in the last day?'); await page.keyboard.press('Enter'); await sleep(5000); await shot('m_search');
  await goto('/analytics', 2000); await shot('m_analytics');
  await goto('/profile', 1200); await shot('m_profile');
  await goto('/admin', 1800); await shot('m_admin');
  await page.evaluate(() => [...document.querySelectorAll('main button, main [role=tab]')].find((b) => b.textContent.trim() === 'Events').click()); await sleep(2000); await shot('m_admin_events');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
