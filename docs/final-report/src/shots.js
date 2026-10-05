// Starts two demo sources through the API, then captures the UI screenshots used in the report.
// Needs: backend on :8000, frontend on :5173, `python src/make_demo_videos.py` already run.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..', '..');
const OUT = path.join(ROOT, 'assets', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const API = 'http://localhost:8000';
const WEB = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readEnv() {
  const env = {};
  for (const line of fs.readFileSync(path.join(REPO, '.env'), 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0 && !line.trim().startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return env;
}

async function api(token, method, url, body) {
  const res = await fetch(API + url, { method, headers: { Authorization: `Bearer ${token}`, ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}) }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}
async function upload(token, file) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)], { type: 'video/mp4' }), path.basename(file));
  return api(token, 'POST', '/upload-video', form);
}

(async () => {
  const env = readEnv();
  const login = await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }) });
  const { access_token: token } = await login.json();

  const hazy = await upload(token, path.join(ROOT, 'logs', 'tyumen_loop.mp4'));
  const synth = await upload(token, path.join(ROOT, 'logs', 'long.mp4'));
  await api(token, 'PUT', `/cameras/${hazy.id}/zones`, [
    { name: 'Sky and buildings', mode: 'exclude', points: [[0, 0], [1, 0], [1, 0.3], [0, 0.3]] },
    { name: 'Road and crossing', mode: 'include', points: [[0.05, 0.35], [0.95, 0.35], [0.95, 0.98], [0.05, 0.98]] },
  ]);
  console.log('sources', hazy.id, synth.id, '- waiting for events');
  await sleep(75000);

  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 1440, height: 900 } });
  const page = await browser.newPage();
  const shot = async (name) => { await page.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log('shot', name); };
  const goto = async (url, wait = 1200) => { await page.goto(WEB + url, { waitUntil: 'networkidle2' }); await sleep(wait); };

  // public pages and the login error state
  await goto('/', 800); await shot('ui_landing');
  await goto('/login', 500); await shot('ui_login');
  await page.type('input[type=email]', env.ADMIN_EMAIL);
  await page.type('input[type=password]', 'wrong-password-123');
  await page.keyboard.press('Enter'); await sleep(1500); await shot('ui_login_error');

  await page.evaluate((t) => localStorage.setItem('visionguard_token', t), token);
  await goto('/dashboard', 4000); await shot('ui_dashboard');
  await page.locator('::-p-text(Add camera)').click(); await sleep(700); await shot('ui_add_camera');
  await page.keyboard.press('Escape'); await sleep(400);

  // zones dialog on the hazy camera (first tile)
  const configure = async () => { const b = await page.$$('button[aria-label="Configure camera"]'); await b[0].click(); await sleep(2500); };
  await configure(); await shot('ui_zones'); await page.keyboard.press('Escape'); await sleep(400);

  // schedule dialog with a realistic weeknight schedule, then restore "always armed"
  await api(token, 'PUT', `/cameras/${hazy.id}/schedule`, { enabled: true, weekdays: [0, 1, 2, 3, 4], start_time: '18:00:00', end_time: '07:00:00' });
  await goto('/dashboard', 3000); await configure();
  await page.locator('::-p-text(Schedule)').click(); await sleep(1000); await shot('ui_schedule');
  await page.keyboard.press('Escape'); await sleep(300);
  await api(token, 'PUT', `/cameras/${hazy.id}/schedule`, { enabled: false, weekdays: [0, 1, 2, 3, 4], start_time: '18:00:00', end_time: '07:00:00' });

  // events: pick an older event of the hazy camera so its clip is ready
  await goto('/events', 1500);
  const picked = await page.evaluate((id) => { const cards = [...document.querySelectorAll('main button')].filter((b) => b.textContent.includes(`Source #${id}`)); if (cards.length < 5) return cards.length; cards[4].click(); return 'ok'; }, hazy.id);
  console.log('event card', picked); await sleep(5000); await shot('ui_events_clip');
  await page.locator('::-p-text(Snapshot)').click(); await sleep(1500); await shot('ui_events_snapshot');

  await goto('/analytics', 1500); await shot('ui_analytics');
  await goto('/profile', 1000); await shot('ui_profile');
  await goto('/admin', 1500); await shot('ui_admin');
  await browser.close();

  await api(token, 'POST', `/stop-camera/${hazy.id}`);
  await api(token, 'POST', `/stop-camera/${synth.id}`);
})().catch((e) => { console.error(e); process.exit(1); });
