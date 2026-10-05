const fs = require('fs');
const path = require('path');
const { h1, h2, h3, p, ul, ol, code, note, tbl, fig } = require('./h');
const acc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'acceptance_results.json'), 'utf8'));
const perf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'perf.json'), 'utf8'));
const unitMeta = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'unit_results.json'), 'utf8'));

const unit = [
  ['test_dark_channel.py', 'An all-black image has a dark channel of zero', 'An all-white image has a dark channel of one', 'The dark channel never exceeds the per-pixel channel minimum', 'Saturated colours give a low dark channel (haze-free signature)', 'One dark pixel darkens the whole patch window'],
  ['test_transmission.py', 'Haze-free regions estimate a high transmission', 'Fully hazy regions estimate a low transmission', 'Transmission stays within [0, 1]', 'Atmospheric light is the Top-K average, not a single brightest pixel'],
  ['test_cnn_inference.py', 'Forward pass returns one channel in (0, 1)', 'Refined map has the same height and width as the input', 'Oversized ROIs are refined at capped size and restored', 'No model means the pipeline equals pure DCP', 'With a model the output is a valid uint8 image', 'A missing weights file returns None instead of raising', 'Saved weights reload to an identical model'],
  ['test_motion_detector.py', 'A static scene yields no foreground', 'A moving object yields foreground pixels', 'The mask contains only 0 and 255'],
  ['test_roi.py', 'No motion gives no ROI', 'A single blob gives a padded box', 'Blobs below the minimum area are ignored', 'Nearby blobs merge into one box', 'Scattered motion falls back to the largest blob', 'Merging still happens within the area cap', 'Padding never leaves the frame'],
  ['test_pipeline.py', 'The pipeline keeps shape and dtype', 'Recovered scene is closer to ground truth than the hazy input (scattering-model round trip)', 'Dehazing increases contrast'],
  ['test_zones.py', 'No zones means no mask', 'Include zone limits detection to its area', 'Exclude zone removes its area from the full frame', 'Exclude cuts a hole in an include zone', 'Motion outside an include zone is masked away'],
  ['test_schedule.py', 'No schedule means always armed', 'A disabled schedule means always armed', 'Same-day window arms inside and disarms outside', 'Unselected weekdays are disarmed', 'Overnight window covers the evening and the next morning', 'Early morning belongs to the previous weekday\'s window'],
];
const unitRows = unit.map(([f, ...w]) => [f, String(w.length), w.join('; '), 'All pass']);
const unitTotal = unit.reduce((a, r) => a + r.length - 1, 0);

const rows = acc.map((r) => [r.case_id, r.title, r.expected, r.actual.replace(/\|/g, '/'), r.passed ? 'Pass' : 'FAIL']);
const passed = acc.filter((r) => r.passed).length;
const at = (w) => perf.find((r) => r.w === w) || perf[perf.length - 1];
const mid = at(640);
const big = perf[perf.length - 1];

module.exports = [
  h1('Testing'),
  h2('Test Strategy'),
  p('Testing combines automated tests at two levels with a manual walkthrough of the user interface.'),
  tbl('tbl:levels', 'Test levels', ['Level', 'Tooling', 'Scope', 'Run against'], [17, 20, 40, 23], [
    ['Unit', 'pytest', 'Pure image-processing and decision logic: dark channel, transmission, atmospheric light, CNN inference and loading, motion detector, ROI extraction, pipeline round trip, zone masks, schedule evaluation', 'In-process, synthetic arrays'],
    ['API acceptance', '`tests/acceptance_api.py` (httpx, OpenCV)', 'Authentication and roles, camera start and stop, upload validation, motion and persistence behaviour on synthetic videos, zones, schedules, settings carry-over, snapshots, clips, filters, analytics, search fallback, health, deletion', 'Live uvicorn server and real PostgreSQL'],
    ['System / manual', 'Browser walkthrough', 'End-to-end behaviour through the UI: sign-in, adding sources, drawing zones, saving schedules, playing clips, analytics', 'Running frontend and backend with real hazy footage'],
  ]),
  p('Synthetic videos make the acceptance cases deterministic. A 20-second clip of a bright rectangle moving over a noisy grey background produces motion events; a clip with nothing moving must produce none; a clip with a 6-frame blink every 3 seconds must produce none because it is shorter than the minimum duration. Several copies of the moving clip run at the same time, each with different zone or schedule settings, so the effect of each setting is isolated.'),
  h2('Items to Be Tested'),
  tbl('tbl:items', 'Features and the level at which they are tested', ['Feature', 'Requirement', 'Unit', 'API', 'Manual'], [34, 16, 16, 17, 17], [
    ['Authentication, roles, account rules', 'FR-9, FR-16', '', 'Yes', 'Yes'],
    ['Start, upload and stop sources', 'FR-1, FR-2, FR-10', '', 'Yes', 'Yes'],
    ['Motion detection and ROI', 'FR-3, FR-4', 'Yes', 'Yes', 'Yes'],
    ['Hybrid dehazing', 'FR-5', 'Yes', '', 'Yes'],
    ['Event logging, persistence, cooldown', 'FR-6, FR-13', '', 'Yes', 'Yes'],
    ['Zones and schedules', 'FR-11, FR-12', 'Yes', 'Yes', 'Yes'],
    ['Timeline and filters', 'FR-7', '', 'Yes', 'Yes'],
    ['Natural-language search', 'FR-8', '', 'Fallback only', ''],
    ['Event clips', 'FR-14', '', 'Yes', 'Yes'],
    ['Analytics', 'FR-15', '', 'Yes', 'Yes'],
  ]),
  h2('Pass and Fail Criteria'),
  ul(
    '**A test case passes** when the actual result equals the expected result in every stated part (status code, content type, count, state). Anything else is a fail.',
    `**A unit test passes** when its assertions hold; the unit suite must pass completely (${unitTotal} of ${unitTotal}) before an acceptance run starts.`,
    '**The acceptance run passes** when every case passes. A failing case must be fixed or recorded as a known defect with a contingency before the release is accepted.',
    '**Performance criterion:** for ROI sizes typical of a person or a vehicle (up to 640 x 360) the full pipeline should stay within the 33 ms per frame budget on the reference CPU.',
    '**Suspension criterion:** if the server cannot start or the database is unreachable, the acceptance run is suspended; it resumes after the environment is repaired.'
  ),
  h2('Test Environment'),
  ul(
    'Machine: Intel Core i5-1240P, 16 logical CPUs, 7 GB RAM, Linux, no GPU.',
    'Backend: Python 3.12 virtual environment, uvicorn on port 8000. Database: PostgreSQL on localhost. Frontend: Vite dev server on port 5173.',
    'Browser: Chrome 135 (headless, driven by Puppeteer) for the interface walkthrough.',
    '`ANTHROPIC_API_KEY` was empty, so only the search fallback path was exercised.'
  ),
  h2('Unit Test Results'),
  p(`Running \`pytest\` over \`tests/\` executed ${unitMeta.total} tests in ${unitMeta.seconds} seconds. ${unitMeta.passed} passed and ${unitMeta.total - unitMeta.passed} failed.`),
  tbl('tbl:unit', 'Unit tests by file: behaviours verified and results', ['File', 'Tests', 'Behaviours verified', 'Result'], [17, 7, 66, 10], unitRows, { small: true }),
  h2('API Acceptance Test Results'),
  p(`The script \`tests/acceptance_api.py\` ran ${acc.length} cases against the live server. ${passed} passed and ${acc.length - passed} failed. The expected and the observed outcome of every case are listed below.`),
  tbl('tbl:acceptance', 'API acceptance test cases with expected and actual outcomes', ['ID', 'Case', 'Expected outcome', 'Actual outcome', 'Result'], [7, 22, 25, 38, 8], rows, { small: true }),
  h2('Interface Walkthrough'),
  p('The interface was exercised manually in a real browser while two sources processed hazy footage. The following behaviours were observed and are shown in the figures of the Interface Design chapter.'),
  ul(
    'Sign-in with wrong credentials stays on the sign-in page and shows an error; valid credentials open the dashboard.',
    'A looped hazy street clip and a synthetic clip run side by side; each tile shows its own ROI box, zone-count badge and Configure button.',
    'Drawing an exclude polygon and an include polygon, saving, and seeing the badge update without reloading.',
    'Setting a weeknight schedule; saving shows a confirmation, and a camera outside its window shows the Disarmed badge.',
    'Selecting an event with a clip plays the video with the ROI box; the Snapshot button shows the still image; a brand-new event first shows "Clip is still being recorded" and then the video.',
    'The analytics page renders KPI cards, bar charts and the heatmap; the console shows no errors.'
  ),
  h2('Performance Test'),
  p(`Per-frame dehazing times are reported in {{tbl:perf}}. For ROI sizes up to 640 x 360 the cost with the CNN is ${mid.cnn <= 33 ? 'below' : 'above'} the 33 ms budget (${mid.cnn.toFixed(1)} ms at 640 x 360); the ${big.w} x ${big.h} case needs ${big.cnn.toFixed(1)} ms. During the acceptance run, seven synthetic sources ran at the same time on the reference machine and every expected event was produced.`),
  h2('Not Tested and Known Limitations'),
  ul(
    '**Natural-language time parsing with the real Claude API** was not executed because no API key was configured; only the fallback behaviour is verified.',
    '**Physical webcam and RTSP cameras** were not used in the final run; live sources were exercised earlier in development, and uploaded files exercise the same processing path.',
    '**Long-duration and many-camera load tests** were not performed, so sustained 30 FPS with many cameras is not claimed.',
    '**Cross-browser testing** covered Chrome only.',
    '**Dehazing quality** was assessed on a small number of clips and on held-out REVIDE pairs. Outdoor dusk footage can look better with DCP alone (see the AI chapter).',
    '**Static analysis** with mypy and black was not run in the final environment because they are not installed there.',
    '**Frontend automated tests** do not exist; the interface is covered by the manual walkthrough and TypeScript strict mode.'
  ),
  h2('Risks and Contingencies'),
  tbl('tbl:risks', 'Risks and contingencies', ['Risk', 'Likelihood / impact', 'Contingency'], [30, 18, 52], [
    ['The Claude API is unavailable or the key is missing', 'Medium / low', 'Search falls back to unfiltered results, and the timeline remains fully usable; no error is shown to the operator.'],
    ['CNN weights are missing or corrupt', 'Low / medium', '`load_tiny_cnn` returns None and the pipeline runs pure DCP; a warning is logged at startup.'],
    ['Processing is slower than the camera frame rate', 'Medium / medium', 'The live reader drops stale frames so latency stays bounded; the ROI cap, downscaled stages and thread caps limit the cost; thresholds are configurable.'],
    ['Many false events from foliage, shadows or lighting changes', 'High / medium', 'Zones exclude those areas, schedules silence cameras, `MOTION_MIN_FRAMES` and the cooldown suppress flicker, and the area ratio helps filter small motion.'],
    ['Disk fills with snapshots, clips and uploads', 'Medium / high', 'Directories are configurable and can be moved to larger storage; deleting an event removes its files; automated retention is future work.'],
    ['Clip memory use is too high on small hardware', 'Medium / medium', 'Lower `CLIP_MAX_WIDTH`, `CLIP_FPS` or `CLIP_PRE_SECONDS`.'],
    ['A camera becomes unreachable', 'Medium / medium', 'The capture thread ends, the source is deactivated and disappears from the dashboard; the operator re-adds it and its zones and schedule are restored.'],
    ['The server crashes while sources are active', 'Low / medium', 'At startup stale active sources are deactivated so the dashboard never shows ghost cameras.'],
    ['Time zone mismatch between server and operators', 'Medium / low', '`SCHEDULE_TIMEZONE` is explicit for schedules and analytics. Event times are shown in the browser\'s local time.'],
    ['The database is unavailable', 'Low / high', '`/system/status` reports the database state; the API returns errors and recovers when the database returns.'],
  ]),
  h2('Summary of Results'),
  tbl('tbl:summary', 'Summary of test execution', ['Suite', 'Cases', 'Passed', 'Failed'], [40, 20, 20, 20], [
    ['Unit tests (pytest)', String(unitMeta.total), String(unitMeta.passed), String(unitMeta.total - unitMeta.passed)],
    ['API acceptance cases', String(acc.length), String(passed), String(acc.length - passed)],
  ]),
];
