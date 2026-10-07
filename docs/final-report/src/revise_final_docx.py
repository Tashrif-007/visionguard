"""Revise the user's SPL-3 final report in place (new file out).

Changes only: dataset description (synthetic removed, RESIDE-HSTS and BeDDE added),
functional requirements (revised / added), and NEW chapters appended at the end
(Testing, Conclusion, References) with the report's existing paragraph, heading and
table formatting cloned from existing elements.

usage: python3 revise_final_docx.py <in.docx> <out.docx>
"""
import copy
import json
import re
import sys
import zipfile
from pathlib import Path

from lxml import etree

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
W14 = 'http://schemas.microsoft.com/office/word/2010/wordml'
NS = {'w': W}
q = lambda t: f'{{{W}}}{t}'
ROOT = Path(__file__).resolve().parent
ACC = json.loads((ROOT / 'acceptance_results.json').read_text())


def paras(body):
    return list(body.iter(q('p')))


def ptext(p):
    return ''.join(t.text or '' for t in p.iter(q('t')))


def strip_ids(el):
    for e in el.iter():
        for a in list(e.attrib):
            if a.startswith(f'{{{W14}}}'):
                del e.attrib[a]
    return el


def set_text(p, text):
    """Put text in the first text run; remove the text of the other runs."""
    runs = [r for r in p.iter(q('r')) if r.find(q('t')) is not None]
    first = runs[0]
    first.find(q('t')).text = text
    first.find(q('t')).set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    for r in runs[1:]:
        r.getparent().remove(r)


def set_rich(p, text):
    """Like set_text, but **bold** segments become bold runs."""
    runs = [r for r in p.iter(q('r')) if r.find(q('t')) is not None]
    first = runs[0]
    parent = first.getparent()
    pos = list(parent).index(first)
    for r in runs:
        parent.remove(r)
    for i, seg in enumerate(re.split(r'\*\*(.+?)\*\*', text)):
        if not seg:
            continue
        r = copy.deepcopy(first)
        r.find(q('t')).text = seg
        r.find(q('t')).set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
        if i % 2:
            rpr = r.find(q('rPr'))
            for tag in ('b', 'bCs'):
                rpr.find(q(tag)).set(q('val'), '1')
        parent.insert(pos, r)
        pos += 1


def main(src, dst):
    zin = zipfile.ZipFile(src)
    files = {n: zin.read(n) for n in zin.namelist()}
    doc = etree.fromstring(files['word/document.xml'])
    body = doc.find(q('body'))
    P = paras(body)
    by = lambda start: next(p for p in P if ptext(p).startswith(start))

    # ---------------- templates (cloned before anything changes) ----------------
    t_body = copy.deepcopy(by('The only data used to train'))
    t_bullet = copy.deepcopy(by('Label: there is no class label'))
    t_h1 = copy.deepcopy([p for p in P if ptext(p) == 'User Manual' and p.find('.//w:pStyle', NS) is not None][0])
    t_h2 = copy.deepcopy(by('Sequence Diagram: From Frame'))
    t_cap = copy.deepcopy(by('Table 8: Common problems'))
    t_ol = copy.deepcopy(by('Sign in: the backend checks'))
    t_empty = copy.deepcopy(P[-1])
    t8 = next(t for t in body.iter(q('tbl')) if 'Common problems' in ''.join(t.itertext()) or 'Cannot open video source' in ''.join(t.itertext()))
    t_table = copy.deepcopy(t8)
    t_toc = copy.deepcopy(by('10. User Manual'))
    toc_last = by('10. User Manual')

    # ---------------- 1. dataset description ----------------
    set_text(by('The only data used to train'),
             'The only data used to train a model is the data of the Tiny CNN that refines the transmission map. The CNN only has to correct the errors of the Dark Channel Prior, so it is trained and checked on real paired haze data instead of a generated one. REVIDE provides the training and validation pairs. The outdoor datasets RESIDE-HSTS and BeDDE are real-world outdoor haze benchmarks that cover the scenes of a campus, a parking lot or a street, which the indoor REVIDE scenes do not. The surveillance events are produced by the running system and are not used for training.')
    set_text(by('Label: there is no class label'),
             'Label: there is no class label. The target is a refined transmission map. The datasets have no true transmission map, so the coarse DCP map is used as an anchor and the clean image of each pair is the reference.')
    set_text(by('Loss: the main loss'),
             'Loss: the main loss is the L1 distance between the image recovered with the predicted transmission and the clean image. A small term keeps the predicted transmission close to the coarse DCP map.')

    tbl2 = next(t for t in body.iter(q('tbl')) if 'Synthetic haze' in ''.join(t.itertext()))
    rows = tbl2.findall(q('tr'))
    syn = next(r for r in rows if 'Synthetic haze' in ''.join(r.itertext()))
    revide_test = next(r for r in rows if ''.join(r.itertext()).startswith('REVIDE (test)'))

    def make_row(model, vals):
        r = copy.deepcopy(model)
        for tc, v in zip(r.findall(q('tc')), vals):
            set_text(tc.find(q('p')), v)
        return strip_ids(r)

    hsts = make_row(revide_test, [
        'RESIDE-HSTS',
        'Hybrid Subjective Testing Set of the public RESIDE benchmark (IEEE TIP, 2019): outdoor scenes, real-world and synthetic haze',
        '20 hazy images (10 real-world, 10 synthetic)',
        'Outdoor validation and testing, never trained on'])
    bedde = make_row(revide_test, [
        'BeDDE',
        'Benchmark Dataset for Dehazing Evaluation (IEEE TIP, 2020): real outdoor hazy photographs with matching clear images of the same places',
        '208 hazy and clear image pairs from 23 cities',
        'Outdoor validation and testing on real haze, never trained on'])
    revide_test.addnext(hsts)
    hsts.addnext(bedde)
    tbl2.remove(syn)

    # ---------------- 2. functional requirements ----------------
    set_text(by('FR-1:'), 'FR-1: The system will allow an operator to start a live feed from a saved webcam or IP camera, or to upload a recorded video file for processing. Several cameras can run at the same time and are started and stopped independently of each other.')
    set_text(by('FR-2:'), 'FR-2: The system will allow an operator to stop an active feed at any time and to view the latest processed frame (with the detected region marked) while a feed is running.')
    set_text(by('FR-6:'), 'FR-6: The system will automatically log every detected motion event with its timestamp, a snapshot image, the event type (motion), the ROI coordinates and the share of the frame that the ROI covers.')
    set_text(by('FR-7:'), 'FR-7: The system will allow an operator to browse logged events in chronological order on an Events page, grouped by day, showing each event\'s snapshot and details and allowing filtering by camera and time range.')
    fr_new = [
        'FR-10: The system will keep a registry of cameras (name and source address) per user. An operator can add, rename, edit (the source only while the camera is stopped) and delete a camera. A deleted camera is only hidden so that its events are kept, and adding the same address again restores it. Each camera shows its status (running, stopped, ended, offline or error).',
        'FR-11: The system will allow an operator to draw include and exclude detection zones (polygons) on a camera. Motion outside the include zones or inside an exclude zone is ignored. Saved zones apply to a running camera from the next frame, without a restart.',
        'FR-12: The system will allow an operator to set a weekly arming schedule for each camera. Outside its schedule a camera keeps streaming but is disarmed and logs no events.',
        'FR-13: The system will log an event only when motion lasts for a minimum number of consecutive frames, and will leave a cooldown between two events of the same camera, so that short flicker and continuing movement do not create a flood of events.',
        'FR-14: The system will record a short video clip (WebM) around each event, available to the operator a few seconds after the event, together with the snapshot.',
        'FR-15: The system will show event analytics for a chosen time range and camera: totals, events per day and per camera, a weekday by hour heatmap and motion-size buckets.',
        'FR-16: The system will allow the administrator to create, list, activate and deactivate operator accounts. Every user can change their own name, email and password, and a deactivated account cannot sign in.',
        'FR-17: The system will treat every user as a separate tenant: a camera and everything under it (events, snapshots, clips, zones, schedules, live frames, statistics and search results) is visible only to its owner. Another user\'s camera or event is reported as not found.',
        'FR-18: The system will allow only the administrator to delete an event, and deleting an event also removes its snapshot and clip files.',
        'FR-19: The system will report its health (database and pipeline status) on a status endpoint.',
    ]
    prev = by('FR-9:')
    for text in fr_new:
        el = strip_ids(copy.deepcopy(prev))
        set_text(el, text)
        prev.addnext(el)
        prev = el

    # ---------------- builders for the new chapters ----------------
    new = []
    bm = [900]

    def add(el):
        new.append(strip_ids(el))
        return el

    def body_p(text):
        e = copy.deepcopy(t_body); set_rich(e, text); add(e)

    def bullet(text):
        e = copy.deepcopy(t_bullet); set_rich(e, text); add(e)

    def num_item(text, num_id):
        e = copy.deepcopy(t_ol); set_rich(e, text)
        e.find('.//w:numPr/w:numId', NS).set(q('val'), str(num_id)); add(e)

    def h2(text):
        e = copy.deepcopy(t_h2); set_text(e, text); add(e)

    def h1(text, anchor):
        e = copy.deepcopy(t_h1); set_text(e, text)
        bm[0] += 1
        s = etree.Element(q('bookmarkStart')); s.set(q('id'), str(bm[0])); s.set(q('name'), anchor)
        en = etree.Element(q('bookmarkEnd')); en.set(q('id'), str(bm[0]))
        ppr = e.find(q('pPr')); ppr.addnext(s); s.addnext(en)
        add(e)

    def table(num, caption, cols, widths, data):
        c = copy.deepcopy(t_cap); set_text(c, f'Table {num}: {caption}'); add(c)
        t = copy.deepcopy(t_table)
        tot = 9840
        ws = [round(tot * w / sum(widths)) for w in widths]; ws[-1] += tot - sum(ws)
        grid = t.find(q('tblGrid'))
        for g in list(grid):
            grid.remove(g)
        for w in ws:
            g = etree.SubElement(grid, q('gridCol')); g.set(q('w'), str(w))
        trs = t.findall(q('tr'))
        hdr_tr, body_tr = trs[0], trs[1]
        for tr in trs:
            t.remove(tr)

        def build(model, vals):
            r = copy.deepcopy(model)
            tcs = r.findall(q('tc'))
            for tc in tcs:
                r.remove(tc)
            for v, w in zip(vals, ws):
                tc = copy.deepcopy(tcs[0])
                set_rich(tc.find(q('p')), v) if '**' in v else set_text(tc.find(q('p')), v)
                tcpr = tc.find(q('tcPr'))
                for x in list(tcpr):
                    tcpr.remove(x)
                tcw = etree.SubElement(tcpr, q('tcW')); tcw.set(q('w'), str(w)); tcw.set(q('type'), 'dxa')
                r.append(tc)
            return r
        t.append(build(hdr_tr, cols))
        for row in data:
            t.append(build(body_tr, row))
        add(t)
        add(copy.deepcopy(t_empty))

    # ---------------- 3. Chapter 11: Testing ----------------
    h1('Testing', 'h.vg_testing')
    body_p('This chapter is the test plan and the test report of the final system. It describes how VisionGuard is tested, when an item passes or fails, which risks were identified with their contingencies, and the test cases with their detailed outcomes.')
    h2('Testing Approach and Strategy')
    body_p('Testing combines automated tests at two levels with a manual walkthrough of the user interface. The unit level checks the image-processing and decision logic in isolation, the API level checks the running system through its HTTP interface, and the manual level checks the pages that an operator uses.')
    table(9, 'Test levels', ['Level', 'Tooling', 'Scope', 'Run against'], [14, 20, 44, 22], [
        ['Unit', 'pytest', 'Dark channel, transmission and atmospheric light, CNN inference and loading, motion detector, ROI extraction, pipeline round trip, zone masks, schedule evaluation, natural-language query parsing', 'In-process, synthetic arrays and mocked HTTP'],
        ['API acceptance', 'tests/acceptance_api.py (httpx, OpenCV)', 'Authentication and roles, camera start and stop, upload validation, motion and persistence behaviour on synthetic videos, zones, schedules, settings carry-over, snapshots, clips, filters, analytics, search fallback, health, deletion', 'Live uvicorn server and real PostgreSQL'],
        ['System / manual', 'Browser walkthrough', 'End-to-end behaviour through the interface: sign-in, adding cameras, drawing zones, saving schedules, playing clips, analytics', 'Running frontend and backend with real hazy footage'],
    ])
    body_p('Synthetic videos make the acceptance cases deterministic. A 20-second clip of a bright rectangle moving over a noisy grey background must produce motion events. A clip with nothing moving must produce none, and a clip with a 6-frame blink every 3 seconds must produce none because it is shorter than the minimum duration. Several copies of the moving clip run at the same time, each with different zone or schedule settings, so that the effect of each setting is isolated.')
    body_p('Test environment:')
    bullet('Machine: Intel Core i5-1240P, 16 logical CPUs, 7 GB RAM, Linux, no GPU.')
    bullet('Backend: Python virtual environment, uvicorn on port 8000, PostgreSQL on localhost. Frontend: Vite dev server on port 5173.')
    bullet('Browser: Chrome, driven by Puppeteer, for the interface walkthrough.')
    bullet('No OpenRouter key was configured in the acceptance run, so only the search fallback was exercised there. The query parsing itself is covered by the unit tests with mocked responses.')

    h2('Item Pass and Fail Criteria')
    bullet('**A test case passes** when the actual result equals the expected result in every stated part (status code, content type, count, state). Anything else is a fail.')
    bullet('**The unit suite** must pass completely (50 of 50) before an acceptance run starts.')
    bullet('**The acceptance run passes** when every case passes. A failing case must be fixed, or recorded as a known defect with a contingency, before the release is accepted.')
    bullet('**Suspension criterion:** if the server cannot start or the database is unreachable, the run is suspended and resumes after the environment is repaired.')
    table(10, 'Items under test with their pass and fail criteria', ['Item', 'Requirement', 'Passes when', 'Fails when'], [22, 11, 35, 32], [
        ['Authentication and roles', 'FR-9, FR-16', 'A valid login returns a token, every other route rejects a missing token, an operator cannot manage accounts or delete events', 'A protected route answers without a token or an operator action is allowed'],
        ['Start, upload and stop cameras', 'FR-1, FR-2, FR-10', 'A reachable source starts, an unreachable or non-video source returns 400, stopping an inactive camera returns 404', 'An unclear error, a crash, or a source left active after a failed start'],
        ['Motion detection and ROI', 'FR-3, FR-4', 'A static scene gives no event, a moving object gives an ROI with a positive size inside the frame', 'An event from a static scene or a missing or oversized ROI'],
        ['Hybrid dehazing', 'FR-5', 'Output keeps shape and type, recovered scene is closer to the clean image than the hazy input, contrast increases', 'Wrong shape, no improvement, or an exception on a valid ROI'],
        ['Event logging, persistence and cooldown', 'FR-6, FR-13', 'Motion shorter than the minimum is ignored, events carry ROI and area ratio, the gap between events is at least the cooldown', 'A short blink creates an event or events are logged faster than the cooldown'],
        ['Zones and schedules', 'FR-11, FR-12', 'Excluded or outside-include motion logs nothing, invalid zones and schedules are rejected, a disarmed camera logs nothing', 'An event from an ignored area or an invalid zone is accepted'],
        ['Timeline and filters', 'FR-7', 'Pagination and time filters return the right events and totals', 'Wrong counts or events outside the filter'],
        ['Natural-language search', 'FR-8', 'Filters are parsed from the reply, and any failure returns all events without an error', 'A failure of the language model breaks the search'],
        ['Event snapshots and clips', 'FR-14', 'The snapshot is a JPEG and the clip a non-empty WebM, an unknown event gives 404', 'A missing, empty or wrongly typed file'],
        ['Analytics', 'FR-15', 'Totals equal the sums per day, per camera and in the heatmap', 'Inconsistent totals'],
        ['Data isolation and deletion', 'FR-17, FR-18', 'An administrator delete returns 204 and removes the snapshot, other users\' data stays hidden', 'A file remains after delete or another user\'s data is visible'],
        ['System status', 'FR-19', 'Status 200 with the database reported as ok', 'No answer or a wrong database state'],
    ])

    h2('Risks and Contingencies')
    table(11, 'Risks and contingencies', ['Risk', 'Likelihood / impact', 'Contingency'], [30, 16, 54], [
        ['The language model service is unavailable or the key is missing', 'Medium / low', 'Search falls back to unfiltered results and the timeline stays fully usable. No error is shown to the operator.'],
        ['CNN weights are missing or corrupt', 'Low / medium', 'The loader returns nothing and the pipeline runs pure DCP. A warning is logged at startup.'],
        ['Processing is slower than the camera frame rate', 'Medium / medium', 'The live reader drops stale frames so latency stays bounded. The ROI size cap, the downscaled stages and the thread caps limit the cost, and the thresholds are configurable.'],
        ['Many false events from foliage, shadows or lighting changes', 'High / medium', 'Exclude zones remove those areas, schedules silence cameras, the minimum duration and the cooldown suppress flicker, and the area ratio helps filter small motion.'],
        ['Disk fills with snapshots, clips and uploads', 'Medium / high', 'The directories are configurable and can move to larger storage. Deleting an event removes its files. Automatic retention is future work.'],
        ['Clip memory use is too high on small hardware', 'Medium / medium', 'Lower the clip width, the clip frame rate or the seconds kept before an event.'],
        ['A camera becomes unreachable', 'Medium / medium', 'The capture thread ends and the camera shows as offline or ended. The operator starts it again and its zones and schedule are still saved.'],
        ['The server stops while cameras are running', 'Low / medium', 'Running state is held in memory only, so after a restart every camera shows as stopped and no ghost camera remains.'],
        ['Server and operators are in different time zones', 'Medium / low', 'The schedule time zone is an explicit setting, and event times are shown in the browser\'s local time.'],
        ['The database is unavailable', 'Low / high', 'The status endpoint reports the database state, the API returns errors and it recovers when the database returns.'],
    ])
    body_p('Some areas were not tested and remain open risks:')
    bullet('**Query parsing with a live language model** was only tested with mocked responses and the fallback path, because no real key was used in the final run.')
    bullet('**Physical webcams and RTSP cameras** were not used in the final run. Uploaded files exercise the same processing path.')
    bullet('**Long-duration and many-camera load tests** were not performed, so sustained 30 FPS with many cameras is not claimed.')
    bullet('**Cross-browser testing** covered Chrome only, and there are no automated frontend tests. The interface is covered by the manual walkthrough and by strict TypeScript.')

    h2('Test Cases with Detailed Outcomes')
    body_p('The unit suite ran with pytest over the tests folder: 50 tests in about two seconds, 50 passed and none failed. The behaviours checked in every file are listed in Table 12.')
    unit = [
        ['test_dark_channel.py', '5', 'An all-black image has a dark channel of zero; an all-white image has one; the dark channel never exceeds the per-pixel channel minimum; saturated colours give a low dark channel; one dark pixel darkens the whole patch window', 'All pass'],
        ['test_transmission.py', '4', 'Haze-free regions estimate a high transmission; fully hazy regions estimate a low one; transmission stays within 0 and 1; atmospheric light is the Top-K average, not a single brightest pixel', 'All pass'],
        ['test_cnn_inference.py', '7', 'Forward pass returns one channel in (0, 1); the refined map keeps the input size; oversized ROIs are refined at a capped size and restored; no model means pure DCP; the output is a valid uint8 image; a missing weights file returns None; saved weights reload to an identical model', 'All pass'],
        ['test_motion_detector.py', '3', 'A static scene yields no foreground; a moving object yields foreground pixels; the mask contains only 0 and 255', 'All pass'],
        ['test_roi.py', '7', 'No motion gives no ROI; a single blob gives a padded box; small blobs are ignored; nearby blobs merge into one box; scattered motion falls back to the largest blob; merging respects the area cap; padding never leaves the frame', 'All pass'],
        ['test_pipeline.py', '3', 'The pipeline keeps shape and type; the recovered scene is closer to the ground truth than the hazy input; dehazing increases contrast', 'All pass'],
        ['test_zones.py', '5', 'No zones means no mask; an include zone limits detection to its area; an exclude zone removes its area; exclude cuts a hole in an include zone; motion outside an include zone is masked away', 'All pass'],
        ['test_schedule.py', '6', 'No or disabled schedule means always armed; a same-day window arms inside and disarms outside; unselected weekdays are disarmed; an overnight window covers the evening and the next morning; early morning belongs to the previous weekday\'s window', 'All pass'],
        ['test_nlp_search.py', '10', 'A missing key gives no filters; a structured reply is parsed into filters; unknown event types and bad timestamps are dropped; errors, bad replies and empty replies degrade to no filters; time zones are converted; a rate-limited request is retried and the retries are bounded', 'All pass'],
    ]
    table(12, 'Unit tests by file: behaviours verified and results', ['File', 'Tests', 'Behaviours verified', 'Result'], [20, 7, 62, 11], unit)
    passed = sum(1 for r in ACC if r['passed'])
    body_p(f'The script tests/acceptance_api.py ran {len(ACC)} cases against the live server, {passed} passed and {len(ACC) - passed} failed. {{{{T13}}}} lists the expected and the observed outcome of every case.'.replace('{{T13}}', 'Table 13'))
    rows = [[r['case_id'], r['title'], r['expected'], r['actual'].replace('|', '/'), 'Pass' if r['passed'] else 'FAIL'] for r in ACC]
    table(13, 'API acceptance test cases with expected and actual outcomes', ['ID', 'Case', 'Expected outcome', 'Actual outcome', 'Result'], [10, 19, 24, 37, 10], rows)
    table(14, 'Summary of test execution', ['Suite', 'Cases', 'Passed', 'Failed'], [40, 20, 20, 20], [
        ['Unit tests (pytest)', '50', '50', '0'],
        ['API acceptance cases', str(len(ACC)), str(passed), str(len(ACC) - passed)],
    ])
    body_p('The interface was also exercised manually in a real browser while two cameras processed hazy footage: a wrong password stays on the sign-in page with an error, zones and schedules can be saved and the badges update without a reload, an event with a clip plays the video with the ROI box, a brand-new event first shows that the clip is still being recorded and then plays it, and the analytics page renders without console errors.')

    # ---------------- 4. Chapter 12: Conclusion ----------------
    h1('Conclusion', 'h.vg_conclusion')
    body_p('VisionGuard shows that useful visibility enhancement and incident retrieval are possible on ordinary CPU hardware, by combining a physical haze model with a tiny learned correction and by spending computation only where motion occurs. The final system supports several concurrent cameras, a saved camera registry, per-camera detection zones and weekly schedules, event snapshots and video clips, a timeline with natural-language search, an analytics dashboard, and a role-based account system in which every user sees only their own cameras. All of it sits behind a layered code base that is covered by 50 unit tests and 37 API acceptance cases, and every one of them passed.')
    body_p('The design stays honest about what it knows. Events are labelled motion, because frame differencing cannot tell a person from a shadow, and the system does not claim to recognise intruders. The Tiny CNN only refines the transmission map, and the system falls back to pure Dark Channel Prior if the weights are absent. The language model is used only to parse a search question into filters, and the search still works without it.')
    h2('Limitations')
    bullet('The CNN was trained on indoor paired data (REVIDE), so it can over-darken the sky or glow around lights in outdoor dusk scenes. The outdoor datasets RESIDE-HSTS and BeDDE are used to check this.')
    bullet('There is no object classification, so lighting changes and foliage can still create events inside active zones.')
    bullet('Throughput with many cameras under sustained load was not benchmarked, and query parsing with a live language model was not exercised in the final test run.')
    bullet('There is no automatic retention policy for snapshots, clips and uploads.')
    h2('Future Work')
    bullet('Alert rules and notifications by email, webhook or messaging when events match a rule.')
    bullet('An event review workflow (new, reviewed, flagged, notes) and CSV or PDF export.')
    bullet('A haze analytics module: a visibility score per camera over time, a raw versus dehazed comparison, and dehazing only when haze is present.')
    bullet('Outdoor training data, residual transmission prediction and temporal smoothing of the transmission map.')
    bullet('Object detection and intrusion classification, ONNX Runtime inference and FFmpeg-based streaming, once the CPU budget allows.')
    bullet('Camera health monitoring (frame rate, latency, offline detection), an audit log and retention policies.')

    # ---------------- 5. Chapter 13: References ----------------
    h1('References', 'h.vg_references')
    refs = [
        'K. He, J. Sun and X. Tang, "Single image haze removal using dark channel prior," IEEE Transactions on Pattern Analysis and Machine Intelligence, vol. 33, no. 12, pp. 2341-2353, 2011.',
        'S. G. Narasimhan and S. K. Nayar, "Vision and the atmosphere," International Journal of Computer Vision, vol. 48, no. 3, pp. 233-254, 2002.',
        'K. He, J. Sun and X. Tang, "Guided image filtering," IEEE Transactions on Pattern Analysis and Machine Intelligence, vol. 35, no. 6, pp. 1397-1409, 2013.',
        'Z. Zivkovic, "Improved adaptive Gaussian mixture model for background subtraction," in Proc. International Conference on Pattern Recognition (ICPR), vol. 2, pp. 28-31, 2004.',
        'X. Zhang et al., "Learning to restore hazy video: A new real-world dataset and a new method," in Proc. IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR), 2021 (the REVIDE dataset).',
        'B. Li et al., "Benchmarking single-image dehazing and beyond," IEEE Transactions on Image Processing, vol. 28, no. 1, pp. 492-505, 2019 (the RESIDE benchmark, including HSTS).',
        'S. Zhao, L. Zhang, S. Huang, Y. Shen and S. Zhao, "Dehazing evaluation: Real-world benchmark datasets, criteria, and baselines," IEEE Transactions on Image Processing, vol. 29, pp. 6947-6962, 2020 (the BeDDE dataset).',
        'M. Jones, J. Bradley and N. Sakimura, "JSON Web Token (JWT)," RFC 7519, IETF, 2015.',
        'N. Provos and D. Mazieres, "A future-adaptable password scheme," in Proc. USENIX Annual Technical Conference, 1999.',
        'A. Paszke et al., "PyTorch: An imperative style, high-performance deep learning library," in Advances in Neural Information Processing Systems 32 (NeurIPS), 2019.',
        'G. Bradski, "The OpenCV Library," Dr. Dobb\'s Journal of Software Tools, 2000.',
        'FastAPI, SQLAlchemy, React, Vite, TanStack Query and OpenRouter API documentation (official project websites).',
    ]
    REF_NUM = 20
    for r in refs:
        num_item(r, REF_NUM)

    # ---------------- insert at the end (before sectPr) ----------------
    sect = body.find(q('sectPr'))
    for el in new:
        sect.addprevious(el)

    # ---------------- TOC entries (the last TOC paragraph carries the section break) ----------------
    ppr_sect = toc_last.find(q('pPr')).find(q('sectPr'))
    toc_last.find(q('pPr')).remove(ppr_sect)
    prev = toc_last
    entries = [('11. Testing', 'h.vg_testing'), ('12. Conclusion', 'h.vg_conclusion'), ('13. References', 'h.vg_references')]
    for i, (text, anchor) in enumerate(entries):
        e = strip_ids(copy.deepcopy(t_toc))
        sp = e.find(q('pPr')).find(q('sectPr'))
        if sp is not None:
            e.find(q('pPr')).remove(sp)
        for h in e.findall(q('hyperlink')):
            h.set(q('anchor'), anchor)
        set_text(e, text)
        if i == len(entries) - 1:
            e.find(q('pPr')).append(copy.deepcopy(ppr_sect))
        prev.addnext(e)
        prev = e

    files['word/document.xml'] = etree.tostring(doc, xml_declaration=True, encoding='UTF-8', standalone=True)

    # ---------------- numbering for the reference list ----------------
    num = etree.fromstring(files['word/numbering.xml'])
    absn = [a for a in num.findall(q('abstractNum'))]
    template_abs = copy.deepcopy(absn[5])  # a decimal list
    new_abs_id = str(max(int(a.get(q('abstractNumId'))) for a in absn) + 1)
    template_abs.set(q('abstractNumId'), new_abs_id)
    for nsid in template_abs.findall(q('nsid')):
        nsid.set(q('val'), 'ABCDEF01')
    absn[-1].addnext(template_abs)
    n_el = etree.Element(q('num')); n_el.set(q('numId'), str(REF_NUM))
    a_el = etree.SubElement(n_el, q('abstractNumId')); a_el.set(q('val'), new_abs_id)
    num.append(n_el)
    files['word/numbering.xml'] = etree.tostring(num, xml_declaration=True, encoding='UTF-8', standalone=True)

    with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zo:
        for n in zin.namelist():
            zo.writestr(n, files[n])
    print('wrote', dst, len(new), 'new elements')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
