// A small Markdown renderer, for the file manager's preview pane.
//
// It builds Preact nodes rather than an HTML string: no innerHTML anywhere, so a
// note that happens to contain a tag renders as that tag's text and nothing else.
// The subset is what the notes in this filesystem actually use, plus the inline
// marks anyone would reach for. Anything it does not understand comes out as the
// literal text it was, which for a preview is the correct failure.

import * as React from "preact/compat";

const BULLET = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED = /^(\s*)(\d+)[.)]\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const FENCE = /^\s*```(.*)$/;

// Inline marks, longest-first so `**` is never read as two `*`. Each entry is a
// pattern with one capture group and the node it becomes.
const INLINE = [
  { re: /`([^`]+)`/, node: (t, k) => <code key={k}>{t}</code> },
  { re: /\*\*([^*]+)\*\*/, node: (t, k) => <strong key={k}>{t}</strong> },
  { re: /__([^_]+)__/, node: (t, k) => <strong key={k}>{t}</strong> },
  { re: /\*([^*]+)\*/, node: (t, k) => <em key={k}>{t}</em> },
];

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/;
const BARE = /(https?:\/\/[^\s<>()]+)/;

// One line of text into nodes. Links first, because their label can contain marks
// but their URL must not be touched.
function inline(text, key = "i") {
  if (!text) return null;
  let out = [], rest = String(text), n = 0;

  while (rest) {
    const link = LINK.exec(rest);
    const bare = link ? null : BARE.exec(rest);
    const hit = link || bare;
    if (!hit) { out.push(...marks(rest, key + n++)); break; }
    out.push(...marks(rest.slice(0, hit.index), key + n++));
    const href = link ? hit[2] : hit[1];
    const label = link ? hit[1] : hit[1];
    out.push(
      <a key={key + n++} href={href} target="_blank" rel="noreferrer">{label}</a>
    );
    rest = rest.slice(hit.index + hit[0].length);
  }
  return out;
}

function marks(text, key) {
  if (!text) return [];
  for (const { re, node } of INLINE) {
    const m = re.exec(text);
    if (!m) continue;
    return [
      ...marks(text.slice(0, m.index), key + "a"),
      node(m[1], key + "b"),
      ...marks(text.slice(m.index + m[0].length), key + "c"),
    ];
  }
  return [text];
}

// Lines to blocks. Deliberately a single pass with no lookahead beyond the current
// run: this is a preview, not a spec-complete parser.
export function Markdown({ lines, className }) {
  const src = Array.isArray(lines) ? lines : String(lines || "").split(String.fromCharCode(10));
  const out = [];
  let para = [], list = null, quote = null, fence = null, key = 0;

  const flushPara = () => {
    if (!para.length) return;
    out.push(<p key={"p" + key++}>{inline(para.join(" "), "p" + key)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    out.push(<Tag key={"l" + key++}>
      {list.items.map((it, i) => <li key={i}>{inline(it, "l" + key + i)}</li>)}
    </Tag>);
    list = null;
  };
  const flushQuote = () => {
    if (!quote) return;
    out.push(<blockquote key={"q" + key++}>{inline(quote.join(" "), "q" + key)}</blockquote>);
    quote = null;
  };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };

  for (const raw of src) {
    const line = raw === undefined ? "" : String(raw);

    // A fence swallows everything until it closes, marks and all.
    if (fence) {
      const end = FENCE.exec(line);
      if (end) {
        out.push(<pre key={"c" + key++} className="md-code"><code>{fence.body.join(String.fromCharCode(10))}</code></pre>);
        fence = null;
      } else fence.body.push(line);
      continue;
    }
    const open = FENCE.exec(line);
    if (open) { flushAll(); fence = { body: [] }; continue; }

    if (!line.trim()) { flushAll(); continue; }

    if (RULE.test(line)) { flushAll(); out.push(<hr key={"h" + key++} />); continue; }

    const h = HEADING.exec(line);
    if (h) {
      flushAll();
      const Tag = "h" + Math.min(6, h[1].length);
      out.push(<Tag key={"t" + key++}>{inline(h[2], "t" + key)}</Tag>);
      continue;
    }

    const q = QUOTE.exec(line);
    if (q) { flushPara(); flushList(); (quote = quote || []).push(q[1]); continue; }

    const b = BULLET.exec(line);
    const o = !b && ORDERED.exec(line);
    if (b || o) {
      flushPara(); flushQuote();
      const ordered = !!o;
      if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] }; }
      list.items.push(b ? b[2] : o[3]);
      continue;
    }

    flushList(); flushQuote();
    para.push(line.trim());
  }
  if (fence) out.push(<pre key={"c" + key++} className="md-code"><code>{fence.body.join(String.fromCharCode(10))}</code></pre>);
  flushAll();

  return <div className={className || "md"}>{out}</div>;
}
