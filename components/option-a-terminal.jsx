// Option A — Terminal / Monospace
// Full-bleed terminal-style portfolio with typed command interactions.

function OptionATerminal({ width = 1200, height = 780 }) {
  const [lines, setLines] = React.useState([
    { type: 'sys', text: "Last login: Apr 20 2026 on ttys001" },
    { type: 'sys', text: "Welcome to 99jik.com — type 'help' to get started." },
    { type: 'prompt', cmd: 'whoami' },
    { type: 'out', text: 'Jeongin Kim (김정인)' },
    { type: 'out', text: 'MS candidate · Kyungpook Nat\u2019l University · Software Testing Lab' },
    { type: 'out', text: 'research ─ Software-in-the-Loop · LLM/SLM-based testing' },
    { type: 'prompt', cmd: 'ls ~/projects | head -7' },
  ]);
  const [typed, setTyped] = React.useState('');
  const [caretOn, setCaretOn] = React.useState(true);

  React.useEffect(() => {
    const id = setInterval(() => setCaretOn(c => !c), 550);
    return () => clearInterval(id);
  }, []);

  // auto-type a rotating command into the visible prompt
  React.useEffect(() => {
    const commands = ['cat about.md', 'open projects/', 'mail --to 99jik@99jik.com'];
    let ci = 0, i = 0, dir = 1;
    const step = () => {
      const cmd = commands[ci];
      if (dir === 1) {
        i += 1;
        if (i > cmd.length) { dir = -1; setTimeout(step, 1400); return; }
      } else {
        i -= 1;
        if (i <= 0) { dir = 1; ci = (ci + 1) % commands.length; setTimeout(step, 400); return; }
      }
      setTyped(cmd.slice(0, i));
      setTimeout(step, dir === 1 ? 85 : 35);
    };
    const t = setTimeout(step, 900);
    return () => clearTimeout(t);
  }, []);

  const green = '#6ee7a8';
  const cyan = '#7dd3fc';
  const muted = '#6b7280';
  const fg = '#e6e6e3';
  const bg = '#0c0c0d';
  const mono = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

  const projects = [
    ['sil-harness',       'Software-in-the-Loop test harness for embedded'],
    ['slm-fuzzer',        'Small LM guided fuzzer for C APIs'],
    ['llm-oracle',        'LLM as test oracle, differential'],
    ['mutagen-kr',        'Mutation testing toolchain, Korean docs'],
    ['spec-extract',      'Spec → test from natural language'],
    ['cov-delta',         'Coverage delta visualizer'],
    ['til.99jik.com',     'Today I Learned site (docusaurus)'],
  ];

  return (
    <div style={{
      width, height, background: bg, color: fg, fontFamily: mono,
      fontSize: 13, lineHeight: 1.65,
      display: 'grid', gridTemplateRows: '28px 1fr', overflow: 'hidden',
    }}>
      {/* title bar */}
      <div style={{
        background: '#1a1a1c', borderBottom: '1px solid #222',
        display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8,
      }}>
        <span style={{ width: 11, height: 11, borderRadius: 11, background: '#ff5f57' }} />
        <span style={{ width: 11, height: 11, borderRadius: 11, background: '#febc2e' }} />
        <span style={{ width: 11, height: 11, borderRadius: 11, background: '#28c840' }} />
        <div style={{ flex: 1, textAlign: 'center', color: '#8a8a8a', fontSize: 11 }}>
          jeongin@99jik — ~/ — zsh
        </div>
        <div style={{ color: muted, fontSize: 11 }}>til  ·  github  ·  linkedin</div>
      </div>

      <div style={{ padding: '22px 28px', overflow: 'hidden', position: 'relative' }}>
        {/* bilingual masthead */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ color: muted, fontSize: 11, letterSpacing: 1.2 }}>
            # 99jik.com — personal site of Jeongin Kim
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 4 }}>
            <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1, color: '#fff' }}>
              김정인
            </span>
            <span style={{ fontSize: 18, color: cyan }}>Jeongin Kim</span>
            <span style={{ color: muted, fontSize: 12, marginLeft: 'auto' }}>
              ● online · KST {new Date().toLocaleTimeString('en-GB').slice(0,5)}
            </span>
          </div>
        </div>

        {lines.map((l, i) => {
          if (l.type === 'sys') return (
            <div key={i} style={{ color: muted }}>{l.text}</div>
          );
          if (l.type === 'prompt') return (
            <div key={i}>
              <span style={{ color: green }}>jeongin@99jik</span>
              <span style={{ color: muted }}> in </span>
              <span style={{ color: cyan }}>~</span>
              <span style={{ color: muted }}> ❯ </span>
              <span>{l.cmd}</span>
            </div>
          );
          // out: used for whoami block
          return <div key={i} style={{ color: fg, paddingLeft: 2 }}>{l.text}</div>;
        })}

        {/* projects table */}
        <div style={{ marginTop: 4, marginBottom: 14 }}>
          {projects.map(([n, d], i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 80px', columnGap: 16 }}>
              <span style={{ color: cyan }}>{n}</span>
              <span style={{ color: fg }}>{d}</span>
              <span style={{ color: muted, textAlign: 'right' }}>→ read</span>
            </div>
          ))}
        </div>

        {/* active prompt with typing caret */}
        <div>
          <span style={{ color: green }}>jeongin@99jik</span>
          <span style={{ color: muted }}> in </span>
          <span style={{ color: cyan }}>~</span>
          <span style={{ color: muted }}> ❯ </span>
          <span>{typed}</span>
          <span style={{
            display: 'inline-block', width: 8, height: 15,
            background: caretOn ? fg : 'transparent', verticalAlign: -2, marginLeft: 1,
          }} />
        </div>

        {/* footer strip */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          borderTop: '1px solid #1a1a1c',
          background: '#101012',
          padding: '8px 28px', fontSize: 11, color: muted,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>esc ⎋  clear ⌃L  help ?  ·  TIL↗ · projects · publications · now · contact</span>
          <span>daegu, kr — 36.52°N 128.72°E</span>
        </div>
      </div>
    </div>
  );
}

window.OptionATerminal = OptionATerminal;
