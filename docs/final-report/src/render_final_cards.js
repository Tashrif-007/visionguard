// Draws the Chen-style ER diagram (tables and relationships only) and the single CRC diagram, as PNG.
const puppeteer = require('puppeteer-core');
const path = require('path');
const OUT = path.join(__dirname, '..', 'assets', 'final');

const ent = (x, y, t) => `<rect x="${x - 80}" y="${y - 26}" width="160" height="52" fill="#d5e8d4" stroke="#82b366" stroke-width="1.5"/><text x="${x}" y="${y + 5}" text-anchor="middle" font-size="17">${t}</text>`;
const rel = (x, y, t) => `<polygon points="${x},${y - 38} ${x + 62},${y} ${x},${y + 38} ${x - 62},${y}" fill="#dae8fc" stroke="#6c8ebf" stroke-width="1.5"/><text x="${x}" y="${y + 5}" text-anchor="middle" font-size="15">${t}</text>`;
const ln = (a, b, c, d) => `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="#555" stroke-width="1.3"/>`;
const lab = (x, y, t) => `<text x="${x}" y="${y}" font-size="16" text-anchor="middle">${t}</text>`;
const erSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" font-family="Arial, Helvetica, sans-serif">
<rect width="960" height="640" fill="#fff"/>
<text x="24" y="38" font-size="22" font-weight="bold" font-family="Times New Roman, serif">ER Diagram</text>
${ln(480, 116, 480, 152)}${ln(480, 228, 480, 304)}
${ln(560, 330, 598, 330)}${ln(722, 330, 760, 330)}
${ln(400, 330, 360, 330)}${ln(236, 330, 200, 330)}
${ln(480, 356, 480, 432)}${ln(480, 508, 480, 544)}
${ent(480, 90, 'User')}${rel(480, 190, 'owns')}${ent(480, 330, 'Camera')}
${rel(660, 330, 'generates')}${ent(840, 330, 'Event')}
${rel(298, 330, 'arms')}${ent(120, 330, 'CameraSchedule')}
${rel(480, 470, 'restricts')}${ent(480, 570, 'CameraZone')}
${lab(496, 142, '1')}${lab(496, 282, 'N')}
${lab(582, 322, '1')}${lab(742, 322, 'N')}
${lab(384, 322, '1')}${lab(218, 322, '1')}
${lab(496, 392, '1')}${lab(496, 538, 'N')}
</svg>`;


// ---- hand-drawn state transition diagram (exact label placement) ----
const st = (x, y, t, w = 168) => `<rect x="${x - w / 2}" y="${y - 25}" width="${w}" height="50" rx="14" fill="#eeeeee" stroke="#666" stroke-width="1.5"/><text x="${x}" y="${y + 6}" text-anchor="middle" font-size="19">${t}</text>`;
const arrow = (d, dash = '') => `<path d="${d}" fill="none" stroke="#444" stroke-width="1.6" marker-end="url(#a)" ${dash}/>`;
const tx = (x, y, t, anchor = 'start') => t.split('|').map((l, i) => `<text x="${x}" y="${y + i * 20}" text-anchor="${anchor}" font-size="16">${l}</text>`).join('');
const stateSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="1000" font-family="Arial, Helvetica, sans-serif">
<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#444"/></marker></defs>
<rect width="960" height="1000" fill="#fff"/>
<circle cx="480" cy="30" r="11" fill="#222"/>
${arrow('M480,41 L480,100')}${tx(494, 76, 'camera started')}
${st(480, 125, 'Idle')}
${st(130, 125, 'Disarmed')}
${arrow('M396,112 L214,112')}${tx(305, 102, 'outside schedule', 'middle')}
${arrow('M214,140 L396,140')}${tx(305, 160, 'window opens', 'middle')}
${st(480, 290, 'MotionSeen')}
${arrow('M452,150 L452,265')}${tx(440, 215, 'motion found|in allowed zones', 'end')}
${arrow('M508,265 L508,150')}${tx(520, 215, 'no motion:|streak reset')}
${arrow('M396,278 C330,278 330,302 396,302')}${tx(330, 296, 'more motion:|streak + 1', 'end')}
${st(480, 450, 'Logging')}
${arrow('M480,315 L480,425')}${tx(494, 365, 'streak reached and|cooldown over')}
${arrow('M564,450 L800,450 L800,125 L564,125')}${tx(812, 290, 'cooldown|restarts')}
${st(480, 600, 'Stored')}
${arrow('M480,475 L480,575')}${tx(494, 520, 'snapshot, row|and clip saved')}
${st(740, 740, 'Reviewed')}
${arrow('M564,600 L740,600 L740,715')}${tx(580, 590, 'operator opens event')}
${st(480, 880, 'Deleted')}
${arrow('M480,625 L480,855')}${tx(466, 745, 'administrator|deletes', 'end')}
${arrow('M740,765 L740,880 L564,880')}${tx(752, 830, 'administrator|deletes')}
<circle cx="480" cy="965" r="14" fill="#fff" stroke="#222" stroke-width="2"/><circle cx="480" cy="965" r="8" fill="#222"/>
${arrow('M480,905 L480,949')}
<circle cx="760" cy="40" r="14" fill="#fff" stroke="#222" stroke-width="2"/><circle cx="760" cy="40" r="8" fill="#222"/>
${arrow('M560,112 L742,48')}${tx(784, 34, 'camera stopped|or file ended')}
</svg>`;

const cards = [
  ['Entity classes (PostgreSQL tables)', '#d5e8d4', '#82b366', [
    ['User', ['Hold account identity, role and active flag', 'Store only a bcrypt password hash'], 'Camera, AuthService'],
    ['Camera', ['Represent one stream, webcam or uploaded file', 'Soft-delete, keeping its event history', 'Belong to exactly one owner'], 'User, Event, CameraZone, CameraSchedule'],
    ['Event', ['Record one motion event: time, ROI box, ROI size ratio', 'Point to its snapshot and clip files'], 'Camera'],
    ['CameraZone', ['Hold one include or exclude polygon in 0..1 coordinates'], 'Camera'],
    ['CameraSchedule', ['Hold the armed weekdays and the daily time window'], 'Camera'],
  ]],
  ['Service classes (business logic)', '#dae8fc', '#6c8ebf', [
    ['AuthService', ['Hash and verify passwords, issue and decode JWT', 'Seed the admin; guard last-admin and self-lockout'], 'User, UserRepository'],
    ['CameraService', ['Register, rename, soft-delete cameras', 'Start, stop and upload sources'], 'CapturePool, CameraRepository, ZoneService'],
    ['ZoneService', ['Validate and save zones and schedule', 'Build CameraConfig, push it to a running camera'], 'ZoneRepository, CapturePool, CameraConfig'],
    ['EventService', ['Save snapshot and event row', 'Serve snapshot and clip, delete event, build statistics'], 'EventRepository, Event'],
    ['NlpSearch', ['Turn a question into ParsedFilters with an LLM', 'Fall back to no filter on any failure'], 'OpenRouter, EventRepository'],
  ]],
  ['Runtime and image-processing classes', '#ffe6cc', '#d79b00', [
    ['CapturePool', ['Own one CaptureManager per camera', 'Start, stop, status, latest preview frame'], 'CaptureManager, CameraConfig'],
    ['CaptureManager', ['Run the capture thread for one camera', 'Apply schedule and zones, find the ROI, dehaze it', 'Count motion streak, apply cooldown, log events'], 'MotionDetector, ClipRecorder, Pipeline, EventService'],
    ['LatestFrameReader', ['Keep only the newest frame of a live stream'], 'CaptureManager'],
    ['MotionDetector', ['Background subtraction, returns a motion mask'], 'CaptureManager'],
    ['ClipRecorder', ['Keep a pre-roll buffer, assemble the WebM clip'], 'CaptureManager'],
    ['CameraConfig', ['Immutable zones and schedule used on every frame'], 'CaptureManager, ZoneService'],
    ['Pipeline', ['Chain DCP, Top-K light, transmission, refine, radiance, gamma on the ROI'], 'TinyTransmissionCNN'],
    ['TinyTransmissionCNN', ['Refine the coarse transmission map; loaded once at startup'], 'Pipeline'],
  ]],
  ['Access classes', '#f5f5f5', '#666666', [
    ['Repositories', ['The only place with SQL: user, camera, event, zone', 'Filter every query by owner'], 'ORM models, PostgreSQL'],
    ['Routers and Controllers', ['Routers: routes and JWT dependency only', 'Controllers: call services, map errors to HTTP'], 'Services, Pydantic schemas'],
  ]],
];
const css = `body{margin:0;background:#fff;font-family:Arial,Helvetica,sans-serif;width:1000px;padding:10px;box-sizing:border-box}
h2{font:bold 18px 'Times New Roman',serif;margin:10px 0 6px}
.g{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.c{border:1.5px solid;display:flex;flex-direction:column;font-size:15px;line-height:1.25}
.n{font-weight:bold;padding:3px 8px;border-bottom:1.5px solid;font-size:16px}
.b{display:grid;grid-template-columns:62% 38%;flex:1}
.b div{padding:4px 8px}.b div+div{border-left:1.5px solid}
.b ul{margin:0;padding-left:14px}.k{font-size:12px;font-weight:bold;text-transform:uppercase;color:#444;margin-bottom:2px}`;
const legend = cards.map(([t, bg, bd]) => `<span style="display:inline-block;margin-right:14px"><span style="display:inline-block;width:14px;height:14px;background:${bg};border:1.5px solid ${bd};vertical-align:-2px"></span> ${t}</span>`).join('');
const all = cards.flatMap(([, bg, bd, list]) => list.map((c) => [bg, bd, ...c]));
const crcHtml = `<html><style>${css}</style><body><h2>CRC diagram of VisionGuard (left: responsibilities, right: collaborators)</h2><div style="font-size:13px;margin-bottom:8px">${legend}</div><div class="g">` +
  all.map(([bg, bd, n, r, c]) =>
    `<div class="c" style="border-color:${bd}"><div class="n" style="background:${bg};border-color:${bd}">${n}</div><div class="b"><div><ul>${r.map((x) => `<li>${x}</li>`).join('')}</ul></div><div style="border-color:${bd}">${c}</div></div></div>`).join('') + '</div></body></html>';

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 1000, height: 900, deviceScaleFactor: 2 } });
  const page = await browser.newPage();
  await page.setContent(`<html><body style="margin:0;background:#fff">${erSvg}</body></html>`);
  await page.screenshot({ path: path.join(OUT, 'final_erd.png'), clip: { x: 0, y: 0, width: 960, height: 640 } });
  await page.setViewport({ width: 960, height: 1000, deviceScaleFactor: 2 });
  await page.setContent(`<html><body style="margin:0;background:#fff">${stateSvg}</body></html>`);
  await page.screenshot({ path: path.join(OUT, 'final_state_event.png'), clip: { x: 0, y: 0, width: 960, height: 1000 } });
  await page.setViewport({ width: 1000, height: 900, deviceScaleFactor: 2 });
  await page.setContent(crcHtml);
  const h = await page.evaluate(() => document.body.scrollHeight);
  await page.screenshot({ path: path.join(OUT, 'final_crc.png'), clip: { x: 0, y: 0, width: 1000, height: h } });
  console.log('crc height', h);
  await browser.close();
})();
