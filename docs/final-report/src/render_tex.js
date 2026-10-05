// LaTeX source generated from the same content model as the DOCX and PDF.
const fs = require('fs');
const path = require('path');
const { build, inline } = require('./model.js');
const M = build();
const { META, FRONT } = M;
const OUT = path.join(M.ROOT, 'out', 'latex');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'figures'), { recursive: true });

const UNI = { '\u00d7': '$\\times$', '\u2192': '$\\rightarrow$', '\u2265': '$\\geq$', '\u00b7': '$\\cdot$', '\u2212': '$-$', '\u2013': '--', '\u2014': '---', '\u2026': '\\ldots{}', '\u2018': '`', '\u2019': "'", '\u201c': '``', '\u201d': "''", '\u00a0': '~', '\u2022': '$\\bullet$', '\u0394': '$\\Delta$', '\u03c9': '$\\omega$', '\u2248': '$\\approx$', '\u2264': '$\\leq$', '\u00b0': '$^\\circ$' };
function esc(s, code = false) {
  let out = '';
  for (const ch of String(s)) {
    if (UNI[ch]) { out += UNI[ch]; continue; }
    switch (ch) {
      case '\\': out += '\\textbackslash{}'; break;
      case '{': out += '\\{'; break; case '}': out += '\\}'; break;
      case '$': out += '\\$'; break; case '&': out += '\\&'; break; case '#': out += '\\#'; break;
      case '^': out += '\\^{}'; break; case '_': out += code ? '\\_\\allowbreak{}' : '\\_'; break;
      case '%': out += '\\%'; break; case '~': out += '\\textasciitilde{}'; break;
      case '/': out += code ? '/\\allowbreak{}' : '/'; break;
      case '<': out += '\\textless{}'; break; case '>': out += '\\textgreater{}'; break;
      case '|': out += '\\textbar{}'; break;
      default: out += ch;
    }
  }
  return out;
}
const refLabel = (key) => key.replace(/[^A-Za-z0-9:]/g, '_');
function inl(text) {
  return inline(text).map((t) => {
    if (t.ref) { const k = t.ref.split(':')[0]; return `${k === 'fig' ? 'Figure' : 'Table'}~\\ref{${refLabel(t.ref)}}`; }
    if (t.c) return `\\code{${esc(t.s, true)}}`;
    if (t.b) return `\\textbf{${esc(t.s)}}`;
    return esc(t.s);
  }).join('');
}

const copied = new Map();
let figIdx = 0;
function figFile(f) {
  if (copied.has(f.abs)) return copied.get(f.abs);
  figIdx += 1;
  const name = `fig${String(figIdx).padStart(2, '0')}_${path.basename(f.abs).replace(/\.png$/i, '').replace(/[^A-Za-z0-9]+/g, '_')}.png`;
  fs.copyFileSync(f.abs, path.join(OUT, 'figures', name));
  copied.set(f.abs, `figures/${name}`);
  return `figures/${name}`;
}

function table(b) {
  const tot = b.widths.reduce((a, c) => a + c, 0);
  const cols = b.widths.map((w) => `>{\\raggedright\\arraybackslash}p{\\dimexpr ${(w / tot).toFixed(4)}\\linewidth-2\\tabcolsep\\relax}`).join('|');
  const size = b.small ? '\\footnotesize' : '\\small';
  const head = b.cols.map((c) => `\\textbf{${esc(c)}}`).join(' & ');
  const rows = b.rows.map((r) => r.map((c) => inl(String(c))).join(' & ') + ' \\\\ \\hline').join('\n');
  return `{${size}\\setlength{\\tabcolsep}{3pt}\\renewcommand{\\arraystretch}{1.15}
\\begin{longtable}{|${cols}|}
\\caption{${esc(b.caption)}}\\label{${refLabel(b.key)}}\\\\
\\hline \\rowcolor{headgray} ${head} \\\\ \\hline \\endfirsthead
\\hline \\rowcolor{headgray} ${head} \\\\ \\hline \\endhead
${rows}
\\end{longtable}}
`;
}
const figure = (b) => `\\begin{figure}[H]\\centering
\\includegraphics[width=${(b.width / 100).toFixed(2)}\\linewidth,height=0.72\\textheight,keepaspectratio]{${figFile(b)}}
\\caption{${esc(b.caption)}}\\label{${refLabel(b.key)}}
\\end{figure}
`;
function figrow(b) {
  const w = b.items.length === 1 ? 0.48 : 0.485;
  const cells = b.items.map((f) => `\\begin{minipage}[t]{${w}\\linewidth}\\centering
\\includegraphics[width=\\linewidth,height=0.34\\textheight,keepaspectratio]{${figFile(f)}}
\\captionof{figure}{${esc(f.caption)}}\\label{${refLabel(f.key)}}
\\end{minipage}`);
  return `\\begin{figure}[H]\\centering
${cells.join('\\hfill\n')}
\\end{figure}
`;
}

const body = [];
for (const b of M.blocks) {
  if (b.t === 'h1') body.push(b.num === '' ? `\\chapter*{${esc(b.text)}}\\addcontentsline{toc}{chapter}{${esc(b.text)}}` : `\\chapter{${esc(b.text)}}`);
  else if (b.t === 'h2') body.push(b.num === '' ? `\\section*{${esc(b.text)}}` : `\\section{${esc(b.text)}}`);
  else if (b.t === 'h3') body.push(b.num === '' ? `\\subsection*{${esc(b.text)}}` : `\\subsection{${esc(b.text)}}`);
  else if (b.t === 'p') body.push(inl(b.text) + '\n');
  else if (b.t === 'ul') body.push(`\\begin{itemize}\n${b.items.map((i) => `\\item ${inl(i)}`).join('\n')}\n\\end{itemize}`);
  else if (b.t === 'ol') body.push(`\\begin{enumerate}\n${b.items.map((i) => `\\item ${inl(i)}`).join('\n')}\n\\end{enumerate}`);
  else if (b.t === 'code') body.push(`\\begin{lstlisting}\n${b.text}\n\\end{lstlisting}`);
  else if (b.t === 'note') body.push(`\\begin{notebox}\\textbf{Note:} ${inl(b.text)}\\end{notebox}`);
  else if (b.t === 'table') body.push(table(b));
  else if (b.t === 'fig') body.push(figure(b));
  else if (b.t === 'figrow') body.push(figrow(b));
}

const tex = String.raw`\documentclass[a4paper,11pt]{report}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{mathptmx}
\usepackage[a4paper,margin=2.5cm]{geometry}
\usepackage{graphicx}
\usepackage{float}
\usepackage{longtable}
\usepackage{array}
\usepackage[table]{xcolor}
\usepackage{caption}
\usepackage{listings}
\usepackage{fancyhdr}
\usepackage{setspace}
\usepackage{titlesec}
\usepackage{enumitem}
\usepackage[colorlinks=true,linkcolor=blue!50!black,urlcolor=blue!50!black,citecolor=blue!50!black]{hyperref}
\definecolor{headgray}{HTML}{DCE3EC}
\definecolor{navy}{HTML}{1F3864}
\definecolor{codebg}{HTML}{F3F4F6}
\setstretch{1.12}
\setlength{\parskip}{0.4em}
\setlength{\parindent}{0pt}
\setlist{itemsep=2pt,topsep=3pt}
\captionsetup{font=small,labelfont=bf}
\titleformat{\chapter}[hang]{\Huge\bfseries\color{navy}}{\thechapter.}{0.5em}{}
\titleformat{\section}{\Large\bfseries\color{navy}}{\thesection}{0.6em}{}
\titleformat{\subsection}{\large\bfseries\color{navy}}{\thesubsection}{0.6em}{}
\pagestyle{fancy}
\fancyhf{}
\fancyhead[R]{\small\itshape ${esc(META.short)}}
\fancyfoot[C]{\thepage}
\renewcommand{\headrulewidth}{0.3pt}
\fancypagestyle{plain}{\fancyhf{}\fancyfoot[C]{\thepage}\renewcommand{\headrulewidth}{0pt}}
\newcommand{\code}[1]{{\small\texttt{#1}}}
\lstset{basicstyle=\ttfamily\footnotesize,backgroundcolor=\color{codebg},frame=single,rulecolor=\color{gray!50},breaklines=true,columns=fullflexible,keepspaces=true,showstringspaces=false,xleftmargin=2pt,xrightmargin=2pt,aboveskip=6pt,belowskip=6pt}
\newenvironment{notebox}{\par\medskip\noindent\begin{tabular}{|>{\columncolor{yellow!15}}p{\dimexpr\linewidth-2\tabcolsep-2\arrayrulewidth\relax}|}\hline\small}{\\\hline\end{tabular}\par\medskip}
\hypersetup{pdftitle={${esc(META.title)}},pdfauthor={${esc(META.author)}}}

\begin{document}
\begin{titlepage}
\centering
{\large\bfseries ${esc(META.institute)}\\ ${esc(META.university)}\par}
\vspace{2.4cm}
{\Huge\bfseries\color{navy} ${esc(META.title)}\par}
\vspace{1cm}
{\Large\bfseries Final Report\par}
\vspace{0.3cm}
{\large ${esc(META.course)}\par}
\vspace{1.6cm}
{\bfseries Submitted By\par}
{\large ${esc(META.author)} $|$ ${esc(META.roll)}\par}
\vspace{1cm}
{\bfseries Supervised By\par}
{\large ${esc(META.supervisor)}, ${esc(META.supervisorTitle)}\par}
${esc(META.institute)}, ${esc(META.university)}\par
\vspace{1cm}
{\bfseries Submitted On: ${esc(META.date)}\par}
\vspace{0.6cm}
{\itshape Repository: \url{${META.repo}}\par}
\end{titlepage}

\pagenumbering{roman}
\chapter*{Letter of Transmittal}
${esc(FRONT.letterDate)}\par
${FRONT.letterTo.map(esc).join('\\\\\n')}\par
\textbf{Subject:} ${esc(FRONT.letterSubject)}\par
Sir,\par
${FRONT.letterBody.map(esc).join('\n\n')}

\vspace{0.6cm}
Sincerely,\par
\vspace{1cm}
${esc(META.author)}\\
BSSE ${esc(META.roll.replace('BSSE-', ''))}\\
${esc(META.institute)}, ${esc(META.university)}

\vspace{1.4cm}
Supervisor's Signature

\chapter*{Acknowledgement}
${esc(FRONT.acknowledgement)}

\chapter*{Abstract}
${FRONT.abstract.map(esc).join('\n\n')}

\tableofcontents
\listoffigures
\listoftables

\cleardoublepage
\pagenumbering{arabic}
\setcounter{page}{1}

${body.join('\n\n')}

\end{document}
`;
fs.writeFileSync(path.join(OUT, 'main.tex'), tex);
fs.writeFileSync(path.join(OUT, 'README.txt'), 'Build with:\n  pdflatex main.tex && pdflatex main.tex && pdflatex main.tex\n(three passes resolve the table of contents, the lists of figures and tables, and the longtable column widths).\nRequires a standard TeX Live installation (packages: mathptmx, geometry, graphicx, float, longtable, array, xcolor, caption, listings, fancyhdr, setspace, titlesec, enumitem, hyperref).\nIt can also be built with Tectonic: tectonic -X compile main.tex\n');
console.log('wrote', path.join(OUT, 'main.tex'), (tex.length / 1000).toFixed(0), 'KB; figures', copied.size);
