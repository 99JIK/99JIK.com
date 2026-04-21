// Option C — Editorial / Modern
// Bold grid, oversized display type, subtle dark motif.

function OptionCEditorial({ width = 1200, height = 780 }) {
  const display = '"Fraunces", "Source Serif 4", Georgia, serif';
  const sans    = '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  const mono    = '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace';
  const bg      = '#0f0e0d';
  const panel   = '#171614';
  const fg      = '#f2ece1';
  const faint   = 'rgba(242,236,225,0.52)';
  const line    = 'rgba(242,236,225,0.14)';
  const accent  = '#e4dcc6'; // bone
  const hot     = '#d84b1a'; // burnt orange

  return (
    <div style={{
      width, height, background: bg, color: fg, fontFamily: sans,
      display: 'grid',
      gridTemplateRows: '56px 1fr 44px',
      overflow: 'hidden',
    }}>
      {/* top nav */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center', padding: '0 28px',
        borderBottom: `1px solid ${line}`, fontFamily: mono, fontSize: 11,
        letterSpacing: 1.4, textTransform: 'uppercase',
      }}>
        <div style={{ color: accent, letterSpacing: 2 }}>99jik.com</div>
        <div style={{ display: 'flex', gap: 28, color: faint }}>
          <span style={{ color: fg }}>Index</span>
          <span>Work</span>
          <span>Writing</span>
          <span>About</span>
          <span>Contact</span>
        </div>
        <div style={{ textAlign: 'right', color: faint, display: 'flex', gap: 14, justifyContent: 'flex-end' }}>
          <span>◐ dark</span>
          <span style={{ color: hot }}>TIL ↗</span>
        </div>
      </div>

      {/* main grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        gridTemplateRows: '1fr auto',
        borderBottom: `1px solid ${line}`,
      }}>
        {/* hero — left */}
        <div style={{
          padding: '40px 40px 28px', borderRight: `1px solid ${line}`,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            fontFamily: mono, fontSize: 10, letterSpacing: 2, color: faint,
            textTransform: 'uppercase',
          }}>
            [ 01 ] — Masters · Software Testing Lab · KNU
          </div>

          <div>
            <div style={{
              fontFamily: display, fontSize: 120, lineHeight: 0.88,
              fontWeight: 500, letterSpacing: -4,
            }}>
              Jeongin<br/>
              <span style={{ fontStyle: 'italic', color: accent, fontWeight: 400 }}>Kim</span>
              <span style={{ color: hot }}>.</span>
            </div>
            <div style={{
              marginTop: 18, maxWidth: 480, fontSize: 15, lineHeight: 1.55, color: 'rgba(242,236,225,0.85)',
            }}>
              김정인 — I teach software and small language models how to test each other.
              Currently at Kyungpook National University, researching
              <span style={{ color: accent }}> Software-in-the-Loop</span> and
              <span style={{ color: accent }}> LLM/SLM-based testing</span>.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 18, fontFamily: mono, fontSize: 11, color: faint }}>
            <span>↳ 7+ projects</span>
            <span>·</span>
            <span>daily TIL</span>
            <span>·</span>
            <span>open to collab</span>
          </div>

          {/* big number mark */}
          <div style={{
            position: 'absolute', right: -20, top: 20,
            fontFamily: display, fontSize: 180, lineHeight: 1,
            color: 'rgba(242,236,225,0.04)', fontWeight: 500, letterSpacing: -8,
            pointerEvents: 'none',
          }}>99</div>
        </div>

        {/* right — now + featured project stack */}
        <div style={{ display: 'grid', gridTemplateRows: '220px 1fr', borderBottom: `1px solid ${line}` }}>
          {/* NOW card */}
          <div style={{
            padding: '24px 28px', borderBottom: `1px solid ${line}`,
            background: panel,
          }}>
            <div style={{
              fontFamily: mono, fontSize: 10, letterSpacing: 2, color: hot,
              textTransform: 'uppercase', marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 6, background: hot, animation: 'pulse 1.4s infinite' }} />
              Now — Apr 2026
            </div>
            <div style={{ fontFamily: display, fontSize: 22, lineHeight: 1.25, fontWeight: 400, letterSpacing: -0.3 }}>
              Drafting a paper on using a <em>small</em> LM as a differential oracle. Re-reading
              <span style={{ color: accent }}> Zeller</span> &amp; running coverage deltas on weekends.
            </div>
          </div>

          {/* featured project */}
          <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 2, color: faint, textTransform: 'uppercase' }}>
              Featured — Project 04 / 07+
            </div>
            <div style={{
              height: 170, borderRadius: 2, border: `1px solid ${line}`,
              background: 'linear-gradient(135deg, #1c1a17 0%, #262320 100%)',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: 'repeating-linear-gradient(90deg, rgba(216,75,26,0.08) 0 1px, transparent 1px 40px)',
              }} />
              <div style={{
                position: 'absolute', left: 18, bottom: 14, fontFamily: mono, fontSize: 10, color: faint,
              }}>[ figure — SIL harness coverage map ]</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontFamily: display, fontSize: 22, fontWeight: 500 }}>
                SIL-Harness <span style={{ color: faint, fontStyle: 'italic', fontSize: 14 }}> — 2025</span>
              </div>
              <div style={{ fontFamily: mono, fontSize: 11, color: hot }}>read →</div>
            </div>
          </div>
        </div>

        {/* bottom strip — project ticker */}
        <div style={{
          gridColumn: '1 / -1',
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
          borderTop: `1px solid ${line}`,
          fontFamily: mono, fontSize: 11,
        }}>
          {['01 sil', '02 slm-fuzz', '03 oracle', '04 mutagen', '05 spec-ex', '06 cov-Δ', '07 til↗'].map((p, i) => (
            <div key={i} style={{
              padding: '14px 16px',
              borderRight: i < 6 ? `1px solid ${line}` : 'none',
              color: i === 0 ? fg : faint,
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span>{p}</span>
              <span>↗</span>
            </div>
          ))}
        </div>
      </div>

      {/* footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px', fontFamily: mono, fontSize: 10, color: faint,
        letterSpacing: 1.4, textTransform: 'uppercase',
      }}>
        <span>99jik@99jik.com</span>
        <span>github/99jik  ·  linkedin/in/jeongin-kim  ·  scholar (soon)</span>
        <span>© 2026 — made in daegu</span>
      </div>

      <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.25 } }`}</style>
    </div>
  );
}

window.OptionCEditorial = OptionCEditorial;
