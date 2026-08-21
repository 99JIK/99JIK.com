// App icons, drawn rather than typed.
//
// They used to be characters (`▶_`, `▤`, `◇`, `✉`) picked for being in the font.
// Half of them read as the same grey lozenge at 20px, and which ones depended on
// what the visitor's system substituted. These are paths, so every machine gets the
// same shape, they take the surrounding colour, and they line up with each other.
//
// One 24x24 grid, 1.6 stroke, round caps. Anything that needs a filled area uses
// currentColor at low opacity rather than a second colour.

import * as React from "preact/compat";

const P = {
  // A prompt: chevron and a caret line.
  terminal: <><path d="M5 8l4 4-4 4" /><path d="M12.5 16h6.5" /></>,

  // A folder, one flap.
  files: <path d="M3.5 7.5a1.5 1.5 0 0 1 1.5-1.5h3.6a1.5 1.5 0 0 1 1.2.6l1 1.4H19a1.5 1.5 0 0 1 1.5 1.5v7.5A1.5 1.5 0 0 1 19 18.5H5a1.5 1.5 0 0 1-1.5-1.5z" />,

  // A globe: circle, equator, meridian.
  browser: <><circle cx="12" cy="12" r="8.2" /><path d="M3.8 12h16.4" /><path d="M12 3.8c2.2 2.3 3.3 5.1 3.3 8.2s-1.1 5.9-3.3 8.2c-2.2-2.3-3.3-5.1-3.3-8.2S9.8 6.1 12 3.8z" /></>,

  // A speech bubble with a tail.
  chat: <path d="M20 12.4c0 3.4-3.4 6.2-7.6 6.2a9.4 9.4 0 0 1-2.4-.3L5.2 20l1.1-3.2A5.9 5.9 0 0 1 4.8 12.4c0-3.4 3.4-6.2 7.6-6.2s7.6 2.8 7.6 6.2z" />,

  // A quaver: two note heads on a beam.
  music: <><circle cx="7" cy="17" r="2.4" /><circle cx="17" cy="15" r="2.4" /><path d="M9.4 17V7.6l10-2v9.4" /><path d="M9.4 10.4l10-2" /></>,

  // A month grid with the hanger bar.
  calendar: <><rect x="3.6" y="5.4" width="16.8" height="14.2" rx="1.6" /><path d="M3.6 10h16.8" /><path d="M8 3.4v3.4M16 3.4v3.4" /><path d="M7.6 13.4h2.2M11 13.4h2.2M14.4 13.4h2.2M7.6 16.6h2.2M11 16.6h2.2" /></>,

  // A page with a folded corner.
  document: <><path d="M6 3.6h7.2L18.4 9v11.4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.6a1 1 0 0 1 1-1z" /><path d="M13.2 3.6V9h5.2" /></>,

  // The same page, with lines on it.
  viewer: <><path d="M6 3.6h7.2L18.4 9v11.4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.6a1 1 0 0 1 1-1z" /><path d="M13.2 3.6V9h5.2" /><path d="M8 12.4h7M8 15.4h7M8 18.4h4.5" /></>,

  // A gear, drawn as a ring and six teeth so it stays legible small.
  settings: <><circle cx="12" cy="12" r="3.1" /><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3L5.5 5.5" /></>,
};

// `size` is the box; the stroke is scaled with it so a 16px icon does not look
// hairline next to a 42px one.
export function Icon({ name, size = 20, className }) {
  const d = P[name];
  if (!d) return null;
  return (
    <svg className={"icn" + (className ? " " + className : "")}
         width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
         fill="none" stroke="currentColor" strokeWidth={size >= 32 ? 1.5 : 1.7}
         strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  );
}

export const ICON_NAMES = Object.keys(P);
