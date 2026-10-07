// Draws the CRC diagram as a class-relationship diagram (rounded boxes, labelled arrows with method names).
const puppeteer = require('puppeteer-core');
const path = require('path');
const OUT = path.join(__dirname, '..', 'assets', 'final');
const COL = { ent: ['#d5e8d4', '#82b366'], svc: ['#dae8fc', '#6c8ebf'], run: ['#ffe6cc', '#d79b00'], acc: ['#eeeeee', '#666'] };
const box = (k, x, y, t, w = 170) => `<rect x="${x - w / 2}" y="${y - 23}" width="${w}" height="46" rx="9" fill="${COL[k][0]}" stroke="${COL[k][1]}" stroke-width="1.6"/><text x="${x}" y="${y + 6}" text-anchor="middle" font-size="19">${t}</text>`;
const ar = (d) => `<path d="${d}" fill="none" stroke="#333" stroke-width="1.2" marker-end="url(#a)"/>`;
const tx = (x, y, t, anchor = 'start') => t.split('|').map((l, i) => `<text x="${x}" y="${y + i * 19}" text-anchor="${anchor}" font-size="16">${l}</text>`).join('');
const W = 1480, H = 990;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Arial, Helvetica, sans-serif">
<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#333"/></marker></defs>
<rect width="${W}" height="${H}" fill="#fff"/>
${box('acc', 740, 45, 'Routers and Controllers', 250)}
${ar('M740,68 L740,125')}${ar('M110,125 L110,167')}${ar('M380,125 L380,167')}${ar('M760,125 L760,167')}${ar('M1100,125 L1100,167')}${ar('M1370,125 L1370,167')}
<path d="M110,125 L1370,125" stroke="#333" stroke-width="1.2" fill="none"/>
${tx(752, 100, 'call service functions')}
${box('svc', 110, 190, 'AuthService')}${box('svc', 380, 190, 'CameraService', 230)}${box('svc', 760, 190, 'ZoneService')}${box('svc', 1100, 190, 'EventService')}${box('svc', 1370, 190, 'NlpSearch')}
${ar('M1285,190 L1185,190')}${tx(1235, 180, 'listEvents()', 'middle')}${tx(1370, 232, 'parseQuery()', 'middle')}
${box('ent', 90, 370, 'User', 150)}${box('ent', 290, 370, 'Camera', 150)}${box('ent', 640, 370, 'CameraZone', 150)}${box('ent', 880, 370, 'CameraSchedule', 170)}${box('ent', 1100, 370, 'Event', 150)}
${ar('M100,213 L100,347')}${tx(108, 262, 'authenticate()|createUser()|changePassword()')}
${ar('M340,213 L300,347')}${tx(335, 262, 'registerCamera()|updateCamera()|deleteCamera()')}
${ar('M165,370 L215,370')}${tx(190, 360, 'owns', 'middle')}
${ar('M730,213 L660,347')}${tx(690, 262, 'saveZones()', 'end')}
${ar('M790,213 L860,347')}${tx(842, 262, 'saveSchedule()', 'start')}
${ar('M1100,213 L1100,347')}${tx(1108, 262, 'listEvents()|deleteEvent()|getEventStats()')}
${ar('M365,382 L395,382 L395,455 L1100,455 L1100,393')}${tx(1112, 440, 'generates')}
${box('run', 600, 600, 'CapturePool', 380)}
${ar('M480,213 L480,577')}${tx(488, 500, 'startCamera()|stopCamera()')}
${ar('M760,213 L760,577')}${tx(768, 500, 'updateConfig()')}
${box('run', 600, 730, 'CaptureManager', 380)}
${ar('M600,623 L600,707')}${tx(612, 660, 'start(), stop(), status()')}
${box('run', 180, 880, 'MotionDetector')}${box('run', 420, 880, 'ClipRecorder')}${box('run', 680, 880, 'Pipeline')}${box('run', 970, 880, 'TinyTransmissionCNN', 210)}${box('run', 1250, 880, 'CameraConfig')}
${ar('M500,753 L200,857')}${tx(300, 800, 'apply()', 'middle')}
${ar('M540,753 L430,857')}${tx(470, 832, 'addFrame()')}
${ar('M640,753 L670,857')}${tx(690, 810, 'dehazeRoi()')}
${ar('M765,880 L865,880')}${tx(815, 866, 'forward()', 'middle')}
${ar('M770,753 L1180,857')}${tx(1010, 770, 'reads zones and schedule', 'middle')}
${ar('M790,715 L1250,715 L1250,213 L1185,213')}${tx(900, 706, 'logMotionEvent()')}
<g font-size="17"><rect x="20" y="925" width="14" height="14" rx="3" fill="${COL.acc[0]}" stroke="${COL.acc[1]}"/><text x="40" y="937">Access layer</text>
<rect x="170" y="925" width="14" height="14" rx="3" fill="${COL.svc[0]}" stroke="${COL.svc[1]}"/><text x="190" y="937">Service classes</text>
<rect x="350" y="925" width="14" height="14" rx="3" fill="${COL.ent[0]}" stroke="${COL.ent[1]}"/><text x="370" y="937">Entity classes (tables)</text>
<rect x="590" y="925" width="14" height="14" rx="3" fill="${COL.run[0]}" stroke="${COL.run[1]}"/><text x="610" y="937">Runtime and image-processing classes</text>
<text x="20" y="967">Every service reaches PostgreSQL only through the repositories (not drawn).</text></g>
</svg>`;
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: W, height: H, deviceScaleFactor: 1.5 } });
  const p = await b.newPage();
  await p.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  await p.screenshot({ path: path.join(OUT, 'final_crc.png'), clip: { x: 0, y: 0, width: W, height: H } });
  await b.close();
})();
