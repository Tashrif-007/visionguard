// Tiny content DSL shared by all chapters. Inline markup: **bold**, `code`.
// Cross references: {{fig:key}} / {{tbl:key}} are resolved to "Figure N" / "Table N".
const h1 = (text, o = {}) => ({ t: 'h1', text, ...o });
const h2 = (text) => ({ t: 'h2', text });
const h3 = (text) => ({ t: 'h3', text });
const p = (text) => ({ t: 'p', text });
const ul = (...items) => ({ t: 'ul', items });
const ol = (...items) => ({ t: 'ol', items });
const code = (text) => ({ t: 'code', text });
const note = (text) => ({ t: 'note', text });
const tbl = (key, caption, cols, widths, rows, o = {}) => ({ t: 'table', key, caption, cols, widths, rows, ...o });
const fig = (key, src, caption, width = 100) => ({ t: 'fig', key, src, caption, width });
const figrow = (...items) => ({ t: 'figrow', items });
module.exports = { h1, h2, h3, p, ul, ol, code, note, tbl, fig, figrow };
