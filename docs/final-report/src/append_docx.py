"""Append the final-defence chapters to the original SPL3 technical report, in place.

Nothing that already exists in the report is rewritten. The script
  * adds a section break after the Timeline page,
  * appends the new chapters (built from build/blocks.json) in the report's own
    styles (Times New Roman, 16 pt headings, 14 pt body, 11 pt tables),
  * adds one TOC line per new chapter after the existing TOC lines,
  * adds the new images, relationships and numbering definitions.

usage: python3 append_docx.py <original.docx> <output.docx>
"""
import copy
import json
import math
import re
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

from lxml import etree

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS = {'w': W}
ROOT = Path(__file__).resolve().parent.parent
BLOCKS = json.loads((ROOT / 'build' / 'blocks.json').read_text())

TEXT_W = 9867          # twips between the report's 1020 / 1033 indents
TABLE_W = 9840         # same width as the report's existing tables
EMU_PER_TWIP = 635
MAX_FIG_H_IN = 8.0

# ---------------------------------------------------------------- ids
_bm = [100]
_dp = [100]
media = []             # (png path, media name, rId)
bullet_num = 3         # the report's existing round-bullet list definition
extra_nums = []        # (numId, abstractId) for added decimal lists


def next_bm():
    _bm[0] += 1
    return _bm[0]


# ---------------------------------------------------------------- runs
def run(r, size=28, bold=False):
    props = ''
    b = bold or r.get('b')
    if b:
        props += '<w:b/>'
    if r.get('c'):
        props += '<w:i/>'
    props += f'<w:sz w:val="{size}"/>'
    return f'<w:r><w:rPr>{props}</w:rPr><w:t xml:space="preserve">{escape(r["s"])}</w:t></w:r>'


def runs(rs, size=28, bold=False):
    return ''.join(run(r, size, bold) for r in rs)


def plain(text, size=28, bold=False):
    return runs([{'s': text}], size, bold)


# ---------------------------------------------------------------- paragraphs
def body(rs, before=160, keep=False):
    kn = '<w:keepNext/>' if keep else ''
    return (f'<w:p><w:pPr><w:pStyle w:val="BodyText"/>{kn}'
            f'<w:spacing w:line="276" w:lineRule="auto" w:before="{before}"/>'
            f'<w:ind w:left="1020" w:right="1033"/><w:jc w:val="both"/></w:pPr>{runs(rs)}</w:p>')


def empty_body():
    return '<w:p><w:pPr><w:pStyle w:val="BodyText"/></w:pPr></w:p>'


def list_item(rs, num_id, first):
    before = 160 if first else 60
    return (f'<w:p><w:pPr><w:pStyle w:val="ListParagraph"/>'
            f'<w:numPr><w:ilvl w:val="0"/><w:numId w:val="{num_id}"/></w:numPr>'
            f'<w:spacing w:line="276" w:lineRule="auto" w:before="{before}" w:after="0"/>'
            f'<w:ind w:left="1380" w:right="1033" w:hanging="360"/><w:jc w:val="both"/>'
            f'<w:rPr><w:sz w:val="28"/></w:rPr></w:pPr>{runs(rs)}</w:p>')


def heading(b):
    level = {'h1': (0, 'Heading1', 1338, 318, 67), 'h2': (1, 'Heading2', 1437, 417, 240),
             'h3': (2, 'Heading2', 1645, 625, 200)}[b['t']]
    ilvl, style, left, hang, before = level
    bid = next_bm()
    pb = '<w:pageBreakBefore/>' if b['t'] == 'h1' and not b.get('first') else ''
    return (f'<w:p><w:pPr><w:pStyle w:val="{style}"/><w:keepNext/>{pb}'
            f'<w:numPr><w:ilvl w:val="{ilvl}"/><w:numId w:val="2"/></w:numPr>'
            f'<w:tabs><w:tab w:pos="{left}" w:val="left" w:leader="none"/></w:tabs>'
            f'<w:spacing w:line="240" w:lineRule="auto" w:before="{before}" w:after="0"/>'
            f'<w:ind w:left="{left}" w:right="0" w:hanging="{hang}"/><w:jc w:val="left"/></w:pPr>'
            f'<w:bookmarkStart w:name="{b["bookmark"]}" w:id="{bid}"/><w:bookmarkEnd w:id="{bid}"/>'
            f'<w:r><w:t xml:space="preserve">{escape(b["text"])}</w:t></w:r></w:p>')


def code_block(text):
    out = []
    for line in text.split('\n'):
        out.append('<w:p><w:pPr><w:spacing w:line="240" w:lineRule="auto" w:before="0" w:after="0"/>'
                   '<w:ind w:left="1100" w:right="1033"/></w:pPr>'
                   '<w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>'
                   f'<w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">{escape(line)}</w:t></w:r></w:p>')
    return ''.join(out)


# ---------------------------------------------------------------- images
def drawing(f, max_w_tw, max_h_in):
    w_in = max_w_tw / 1440 * f.get('width', 100) / 100
    h_in = w_in * f['h'] / f['w']
    if h_in > max_h_in:
        w_in, h_in = w_in * max_h_in / h_in, max_h_in
    cx, cy = int(w_in * 914400), int(h_in * 914400)
    n = len(media) + 21
    rid = f'rId{100 + len(media)}'
    name = f'image{n}.png'
    media.append((f['abs'], name, rid))
    _dp[0] += 1
    return (f'<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">'
            f'<wp:extent cx="{cx}" cy="{cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>'
            f'<wp:docPr id="{_dp[0]}" name="Image {_dp[0]}" descr="{escape(f["caption"], {chr(34): "&quot;"})}"/>'
            f'<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>'
            f'<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
            f'<pic:pic><pic:nvPicPr><pic:cNvPr id="{_dp[0]}" name="{name}"/><pic:cNvPicPr/></pic:nvPicPr>'
            f'<pic:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
            f'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
            f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>'
            f'</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>')


def fig(b):
    img = (f'<w:p><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="60"/>'
           f'<w:ind w:left="1020" w:right="1033"/><w:jc w:val="center"/></w:pPr>'
           f'{drawing(b, TEXT_W, MAX_FIG_H_IN)}</w:p>')
    cap = (f'<w:p><w:pPr><w:pStyle w:val="BodyText"/><w:spacing w:before="40" w:after="160"/>'
           f'<w:ind w:left="1020" w:right="1033"/><w:jc w:val="center"/></w:pPr>'
           f'{plain(f"Fig {b["n"]}: {b["caption"]}")}</w:p>')
    return img + cap


def figrow(b):
    items = b['items']
    col = 4900
    nob = ''.join(f'<w:{s} w:val="nil"/>' for s in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'))
    cells = ''
    for f in items + [None] * (2 - len(items)):
        if f is None:
            inner = '<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>'
        else:
            inner = (f'<w:p><w:pPr><w:keepNext/><w:spacing w:before="40" w:after="40"/><w:jc w:val="center"/></w:pPr>'
                     f'{drawing(f, col - 160, 3.6)}</w:p>'
                     f'<w:p><w:pPr><w:spacing w:before="0" w:after="120"/><w:jc w:val="center"/></w:pPr>'
                     f'{plain(f"Fig {f["n"]}: {f["caption"]}", 24)}</w:p>')
        cells += f'<w:tc><w:tcPr><w:tcW w:w="{col}" w:type="dxa"/></w:tcPr>{inner}</w:tc>'
    return (f'<w:tbl><w:tblPr><w:tblW w:w="{col * 2}" w:type="dxa"/><w:tblInd w:w="1020" w:type="dxa"/>'
            f'<w:tblBorders>{nob}</w:tblBorders><w:tblLayout w:type="fixed"/>'
            f'<w:tblCellMar><w:left w:w="60" w:type="dxa"/><w:right w:w="60" w:type="dxa"/></w:tblCellMar></w:tblPr>'
            f'<w:tblGrid><w:gridCol w:w="{col}"/><w:gridCol w:w="{col}"/></w:tblGrid>'
            f'<w:tr><w:trPr><w:cantSplit/></w:trPr>{cells}</w:tr></w:tbl>'
            f'<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>')


# ---------------------------------------------------------------- tables
def table(b):
    total = sum(b['widths'])
    cw = [round(w / total * TABLE_W) for w in b['widths']]
    cw[-1] += TABLE_W - sum(cw)
    bd = ''.join(f'<w:{s} w:val="single" w:sz="8" w:space="0" w:color="000000"/>'
                 for s in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'))

    def cell(rs, i, header):
        content = runs(rs, 22, header)
        return (f'<w:tc><w:tcPr><w:tcW w:w="{cw[i]}" w:type="dxa"/></w:tcPr><w:p><w:pPr>'
                f'<w:pStyle w:val="TableParagraph"/><w:spacing w:before="30" w:after="30" w:line="240" w:lineRule="auto"/>'
                f'<w:ind w:left="94" w:right="60"/><w:rPr><w:sz w:val="22"/></w:rPr></w:pPr>{content}</w:p></w:tc>')

    head = ('<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>'
            + ''.join(cell(c, i, True) for i, c in enumerate(b['cols'])) + '</w:tr>')
    rows = ''.join('<w:tr><w:trPr><w:cantSplit/></w:trPr>' + ''.join(cell(c, i, False) for i, c in enumerate(r)) + '</w:tr>'
                   for r in b['rows'])
    caption = (f'<w:p><w:pPr><w:pStyle w:val="Heading2"/><w:keepNext/><w:spacing w:before="200"/>'
               f'<w:ind w:left="1020"/></w:pPr>{plain(f"Table {b["n"]}: {b["caption"]}", 28, True)}</w:p>')
    tbl = (f'<w:tbl><w:tblPr><w:tblW w:w="{TABLE_W}" w:type="dxa"/><w:jc w:val="left"/><w:tblInd w:w="1040" w:type="dxa"/>'
           f'<w:tblBorders>{bd}</w:tblBorders><w:tblLayout w:type="fixed"/>'
           f'<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/>'
           f'<w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>'
           f'<w:tblLook w:val="01E0"/></w:tblPr><w:tblGrid>'
           + ''.join(f'<w:gridCol w:w="{c}"/>' for c in cw) + f'</w:tblGrid>{head}{rows}</w:tbl>')
    return caption + tbl + empty_body()


# ---------------------------------------------------------------- page estimate (for the TOC)
PAGE_PT = (16840 - 1180 - 1313) / 20


def estimate_height(b):
    pt_w = TEXT_W / 20
    t = b['t']
    if t in ('h1',):
        return 40
    if t in ('h2', 'h3'):
        return 34
    if t == 'p':
        n = sum(len(r['s']) for r in b['runs'])
        return math.ceil(n / (pt_w / 6.4)) * 18.5 + 8
    if t in ('ul', 'ol'):
        return sum(math.ceil(sum(len(r['s']) for r in it) / ((pt_w - 18) / 6.4)) * 18.5 + 3 for it in b['itemRuns'])
    if t == 'code':
        return len(b['text'].split('\n')) * 11.5
    if t == 'fig':
        w_in = TEXT_W / 1440 * b['width'] / 100
        h_in = min(MAX_FIG_H_IN, w_in * b['h'] / b['w'])
        return h_in * 72 + 40
    if t == 'figrow':
        hs = []
        for f in b['items']:
            w_in = (4900 - 160) / 1440 * f['width'] / 100
            hs.append(min(3.6, w_in * f['h'] / f['w']) * 72 + 40)
        return max(hs)
    if t == 'table':
        total = sum(b['widths'])
        h = 40
        for row in [b['cols']] + b['rows']:
            lines = 1
            for i, c in enumerate(row):
                cwpt = b['widths'][i] / total * TABLE_W / 20 - 8
                lines = max(lines, math.ceil(sum(len(r['s']) for r in c) / (cwpt / 5.0)))
            h += lines * 13.2 + 3
        return h
    return 0


def estimate_pages(blocks, first_page):
    pages, y, page = {}, 0, first_page
    for b in blocks:
        h = estimate_height(b)
        if b['t'] == 'h1':
            if y > 0:
                page += 1
            y = 0
            pages[b['bookmark']] = page
        if b['t'] == 'table':
            # tables split across pages row by row, so only count the overflow
            y += h
            while y > PAGE_PT:
                y -= PAGE_PT
                page += 1
            continue
        if y + h > PAGE_PT and y > 0:
            page += 1
            y = 0
        y += h
        while y > PAGE_PT:
            y -= PAGE_PT
            page += 1
    return pages, page


# ---------------------------------------------------------------- build body
def build_body():
    out, numid = [], [16]
    prev = None
    first_h1 = True
    for b in BLOCKS:
        t = b['t']
        if t == 'h1':
            b['first'] = first_h1
            first_h1 = False
            out.append(heading(b))
        elif t in ('h2', 'h3'):
            out.append(heading(b))
        elif t == 'p':
            b['runs'] = b['runs']
            out.append(body(b['runs'], keep=False))
        elif t == 'ul':
            out.extend(list_item(it, bullet_num, i == 0) for i, it in enumerate(b['itemRuns']))
        elif t == 'ol':
            nid = numid[0]
            numid[0] += 1
            extra_nums.append(nid)
            out.extend(list_item(it, nid, i == 0) for i, it in enumerate(b['itemRuns']))
        elif t == 'code':
            out.append(code_block(b['text']))
        elif t == 'fig':
            out.append(fig(b))
        elif t == 'figrow':
            out.append(figrow(b))
        elif t == 'table':
            out.append(table(b))
        else:
            raise ValueError(f'unknown block {t}')
        prev = t
    return ''.join(out)


# ---------------------------------------------------------------- main
def main(src, dst):
    tmp = Path(tempfile.mkdtemp())
    with zipfile.ZipFile(src) as z:
        z.extractall(tmp)
        original_names = z.namelist()

    doc_path = tmp / 'word' / 'document.xml'
    tree = etree.parse(str(doc_path))
    root = tree.getroot()
    bodyel = root.find('w:body', NS)
    final_sect = bodyel.find('w:sectPr', NS)
    last_para = [c for c in bodyel if c.tag == f'{{{W}}}p'][-1]
    assert 'Fig 18' in ''.join(last_para.itertext()), 'report layout changed: Fig 18 caption not last'

    # existing page count: the Timeline TOC line tells us where the Gantt page is
    toc_pages = [int(re.sub(r'\D', '', ''.join(p.itertext())[-3:]) or 0)
                 for p in bodyel.find('w:sdt', NS).findall('.//w:p', NS)]
    first_new_page = max(toc_pages) + 1
    pages, last_page = estimate_pages_wrapper(first_new_page)

    body_xml = build_body()
    ns_decl = ' '.join(f'xmlns:{k}="{v}"' for k, v in root.nsmap.items() if k)

    # 1. section break after the Timeline page (keeps that page's own section settings)
    brk = etree.fromstring(f'<w:p xmlns:w="{W}"><w:pPr/></w:p>')
    brk.find('w:pPr', NS).append(copy.deepcopy(final_sect))
    last_para.addnext(brk)

    # 2. new content, then new section properties for it
    frag = etree.fromstring(f'<root {ns_decl}>{body_xml}</root>')
    anchor = brk
    for el in list(frag):
        anchor.addnext(el)
        anchor = el
    pg = final_sect.find('w:pgMar', NS)
    pg.set(f'{{{W}}}bottom', '1313')

    # 3. TOC lines for the new chapters
    sdt_content = bodyel.find('w:sdt/w:sdtContent', NS)
    toc_paras = sdt_content.findall('w:p', NS)
    template = next(p for p in toc_paras if ''.join(p.itertext()).startswith('Preliminary'))
    insert_after = toc_paras[-1]
    for b in BLOCKS:
        if b['t'] != 'h1':
            continue
        p = copy.deepcopy(template)
        for el in list(p):
            if el.tag != f'{{{W}}}pPr':
                p.remove(el)
        pPr = p.find('w:pPr', NS)
        numpr = pPr.find('w:numPr', NS)
        if numpr is not None:
            pPr.remove(numpr)
        ind = pPr.find('w:ind', NS)
        ind.set(f'{{{W}}}left', '1298')
        ind.set(f'{{{W}}}hanging', '278')
        pg_no = pages[b['bookmark']]
        label = f'{b["num"]}. {b["text"]}'
        link = etree.fromstring(
            f'<w:hyperlink xmlns:w="{W}" w:history="1" w:anchor="{b["bookmark"]}">'
            f'<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">{escape(label)}</w:t></w:r>'
            f'<w:r><w:rPr><w:b w:val="0"/></w:rPr><w:tab/></w:r>'
            f'<w:r><w:rPr><w:b w:val="0"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>'
            f'<w:r><w:rPr><w:b w:val="0"/></w:rPr><w:instrText xml:space="preserve"> PAGEREF {b["bookmark"]} \\h </w:instrText></w:r>'
            f'<w:r><w:rPr><w:b w:val="0"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r>'
            f'<w:r><w:rPr><w:b w:val="0"/></w:rPr><w:t>{pg_no}</w:t></w:r>'
            f'<w:r><w:rPr><w:b w:val="0"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r></w:hyperlink>')
        p.append(link)
        insert_after.addnext(p)
        insert_after = p

    tree.write(str(doc_path), xml_declaration=True, encoding='UTF-8', standalone=True)

    # 4. images, relationships
    rels_path = tmp / 'word' / '_rels' / 'document.xml.rels'
    rels = rels_path.read_text()
    add = ''
    for abs_path, name, rid in media:
        shutil.copy(abs_path, tmp / 'word' / 'media' / name)
        add += (f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" '
                f'Target="media/{name}"/>')
    rels_path.write_text(rels.replace('</Relationships>', add + '</Relationships>'))

    # 5. numbering: one decimal list definition, one num per numbered list
    num_path = tmp / 'word' / 'numbering.xml'
    num = num_path.read_text()
    abstract = ('<w:abstractNum w:abstractNumId="15"><w:multiLevelType w:val="hybridMultilevel"/>'
                '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/>'
                '<w:lvlJc w:val="left"/><w:pPr><w:ind w:left="1380" w:hanging="360"/></w:pPr>'
                '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>'
                '<w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:lvl></w:abstractNum>')
    first_num = num.index('<w:num ')
    num = num[:first_num] + abstract + num[first_num:]
    nums = ''.join(f'<w:num w:numId="{n}"><w:abstractNumId w:val="15"/>'
                   f'<w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>' for n in extra_nums)
    num_path.write_text(num.replace('</w:numbering>', nums + '</w:numbering>'))

    # 6. zip: keep original part order, then the new media
    with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as z:
        for name in original_names:
            z.write(tmp / name, name)
        for _, name, _ in media:
            z.write(tmp / 'word' / 'media' / name, f'word/media/{name}')
    print(f'wrote {dst}: {len(BLOCKS)} blocks, {len(media)} images, last page ~{last_page}')
    for b in BLOCKS:
        if b['t'] == 'h1':
            print(f'  {b["num"]:>2} {b["text"]:<50} p.{pages[b["bookmark"]]}')


def estimate_pages_wrapper(first_page):
    return estimate_pages(BLOCKS, first_page)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
