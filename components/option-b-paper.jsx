// Option B — Academic Paper
// Serif-driven two-column layout, footnotes, figure placeholders.

function OptionBPaper({ width = 1200, height = 780 }) {
  const serif = '"Source Serif 4", "Source Serif Pro", "Iowan Old Style", Georgia, serif';
  const sans  = '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  const mono  = '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace';
  const ink   = '#1a1917';
  const paper = '#f7f4ec';
  const rule  = '#bfb8a6';
  const faint = '#6d665a';
  const accent= '#7a1f1f';

  return (
    <div style={{
      width, height, background: paper, color: ink, fontFamily: serif,
      overflow: 'hidden', position: 'relative',
    }}>
      {/* masthead */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'baseline', gap: 24,
        padding: '34px 56px 14px',
        borderBottom: `2px solid ${ink}`,
      }}>
        <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: faint }}>
          Vol. I · No. 03 · Spring 2026
        </div>
        <div style={{ fontFamily: serif, fontSize: 28, fontWeight: 600, letterSpacing: -0.5 }}>
          Jeongin Kim
          <span style={{ color: faint, fontStyle: 'italic', fontWeight: 400, marginLeft: 10, fontSize: 18 }}>김정인</span>
        </div>
        <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: faint, textAlign: 'right' }}>
          99jik.com · Daegu, KR
        </div>
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        padding: '6px 56px 0',
        fontFamily: mono, fontSize: 10, letterSpacing: 1.4, color: faint,
        textTransform: 'uppercase',
      }}>
        <span>About  ·  Research  ·  Projects  ·  Publications  ·  CV  ·  Now</span>
        <span>TIL ↗</span>
      </div>

      {/* hero title */}
      <div style={{ padding: '30px 56px 18px', textAlign: 'center', borderBottom: `1px solid ${rule}` }}>
        <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: accent, marginBottom: 10 }}>
          — An essay in progress —
        </div>
        <div style={{ fontSize: 44, fontWeight: 500, lineHeight: 1.08, letterSpacing: -1, maxWidth: 780, margin: '0 auto' }}>
          On teaching small models<br/>
          <span style={{ fontStyle: 'italic', color: faint }}>to read software as a tester would.</span>
        </div>
        <div style={{ marginTop: 12, fontFamily: sans, fontSize: 13, color: faint, letterSpacing: 0.2 }}>
          MS candidate, Software Testing Lab, Kyungpook National University
        </div>
      </div>

      {/* two-column abstract */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40,
        padding: '22px 56px', fontSize: 13.5, lineHeight: 1.68, textAlign: 'justify',
        hyphens: 'auto',
      }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 2, color: accent, textTransform: 'uppercase', marginBottom: 6 }}>§1 · Abstract</div>
          <p style={{ margin: 0 }}>
            I am a Master&apos;s student at the Software Testing Lab, Kyungpook National University. My work lives at the
            intersection of <em>software-in-the-loop</em> simulation and the use of <em>large and small language models</em> as
            first-class participants in the testing process <span style={{ color: accent }}>¹</span>.
          </p>
        </div>
        <div>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 2, color: accent, textTransform: 'uppercase', marginBottom: 6 }}>§2 · Currently</div>
          <p style={{ margin: 0 }}>
            Reading papers on oracle problem &amp; differential testing. Building a small LM harness that proposes test
            inputs for C APIs. Running TIL daily at <span style={{ fontFamily: mono }}>til.99jik.com</span> — a field journal
            rather than a blog.
          </p>
        </div>
      </div>

      {/* figure row — project plates */}
      <div style={{ padding: '6px 56px 0' }}>
        <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 2, color: accent, textTransform: 'uppercase', marginBottom: 10 }}>
          Figure 1.  Selected works, 2024–2026
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
          {[
            ['Plate i',   'SIL harness', '2025'],
            ['Plate ii',  'SLM fuzzer',  '2025'],
            ['Plate iii', 'LLM oracle',  '2026'],
            ['Plate iv',  'Mutagen-KR',  '2024'],
          ].map(([n, t, y], i) => (
            <div key={i}>
              <div style={{
                aspectRatio: '4/3',
                backgroundImage: 'repeating-linear-gradient(135deg, rgba(26,25,23,0.08) 0 6px, transparent 6px 12px)',
                border: `1px solid ${rule}`,
              }} />
              <div style={{ fontFamily: mono, fontSize: 10, color: faint, marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>{n}. {t}</span><span>{y}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* footnote rule */}
      <div style={{
        position: 'absolute', bottom: 18, left: 56, right: 56,
        borderTop: `1px solid ${rule}`, paddingTop: 8,
        display: 'flex', justifyContent: 'space-between',
        fontFamily: mono, fontSize: 10, color: faint,
      }}>
        <span><span style={{ color: accent }}>¹</span> See also: TIL — til.99jik.com.</span>
        <span>99jik@99jik.com  ·  github/99jik  ·  linkedin/in/jeongin-kim</span>
        <span>— p. 01 —</span>
      </div>
    </div>
  );
}

window.OptionBPaper = OptionBPaper;
