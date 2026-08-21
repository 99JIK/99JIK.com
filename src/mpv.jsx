// Music playback, shared by everything that touches it: the terminal's `mpv`
// command, the status strip inside the terminal window, and the standalone player
// window on the desktop.
//
// The player itself is a singleton owned by the desktop, not by any window. That is
// deliberate: an iframe cannot be moved between parents without reloading, and
// unmounting one stops the sound, so the node it lives in has to sit somewhere that
// outlives every window that shows it. Closing the player window or clearing the
// terminal leaves the music alone; only quitting stops it.

import * as React from "preact/compat";

// The YouTube Data API caps a page at 50 items, so anything longer than that is
// several round trips. Shared by the m3u file and the player so both see the same
// list. PAGE_CAP stops a malformed nextPageToken from looping forever.
const YT_PAGE_CAP = 8;

function ytPlaylistId() {
  // YouTube Music library links carry a browse id like VLPL..., which is the
  // playlist id with VL glued on the front. The API only knows the bare form.
  const id = String((window.SITE_DATA.site || {}).youtubePlaylistId || "");
  return id.startsWith("VL") ? id.slice(2) : id;
}

async function ytPlaylistItems(signal) {
  const id = ytPlaylistId();
  if (!id) throw new Error("no playlist configured");
  const key = window.SITE_DATA.site.gcalApiKey;
  const out = [];
  let token = "";
  for (let page = 0; page < YT_PAGE_CAP; page++) {
    const url = "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet" +
      "&maxResults=50&playlistId=" + encodeURIComponent(id) +
      "&key=" + encodeURIComponent(key) +
      (token ? "&pageToken=" + encodeURIComponent(token) : "");
    const r = await fetch(url, { signal, cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (j.error) throw new Error(j.error.message || "youtube api error");
    if (!r.ok) throw new Error("HTTP " + r.status);
    for (const it of j.items || []) {
      const sn = it.snippet || {};
      // Removed entries keep their slot in the playlist but have nothing to play,
      // so they are dropped rather than left as gaps in the numbering.
      if (!sn.title || sn.title === "Private video" || sn.title === "Deleted video") continue;
      if (!sn.resourceId || !sn.resourceId.videoId) continue;
      out.push({
        title: sn.title,
        id: sn.resourceId.videoId,
        by: sn.videoOwnerChannelTitle || "",
      });
    }
    token = j.nextPageToken || "";
    if (!token) break;
  }
  if (!out.length) throw new Error("playlist is empty or private");
  return out;
}

// The IFrame Player API, loaded once and shared. The plain `?list=` embed cannot be
// driven from outside, which is why skipping did nothing: changing the src just
// reloaded the whole thing. With the API there is a real player object with
// nextVideo/previousVideo and a state callback, so the track list can follow what is
// actually playing instead of guessing.
let ytApiPromise = null;
function loadYtApi() {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) return resolve(window.YT);
    // onYouTubeIframeAPIReady is a single global hook, so chain rather than clobber.
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") prev();
      resolve(window.YT);
    };
    const el = document.createElement("script");
    el.src = "https://www.youtube.com/iframe_api";
    el.onerror = () => reject(new Error("could not load the YouTube player"));
    document.head.appendChild(el);
  });
  return ytApiPromise;
}

// The player is a singleton owned by the shell, not by the output block that started
// it. That is the whole point: `clear` wipes the scrollback, and if the iframe lived
// there the music would stop with it. The block below is only a status readout, so
// throwing it away costs nothing.

// The player is a singleton. Windows come and go around it; this does not.
const MPV = {
  host: null,            // persistent node on the desktop; the iframe lives here
  player: null,
  tracks: null,
  now: null,             // { title, index, total, playing, muted, blocked, t, d }
  error: null,
  loading: false,
  tick: 0,
  // The picture is off by default. It has to stay rendered for playback to run, so
  // hiding it means moving it off-screen rather than removing it: an occluded or
  // off-screen frame keeps playing, a display:none one does not.
  video: false,
  subs: new Set(),

  sub(f) { MPV.subs.add(f); return () => { MPV.subs.delete(f); }; },
  notify() { MPV.subs.forEach((f) => f()); },
  setHost(el) { MPV.host = el; },
  get active() { return !!(MPV.loading || MPV.now || MPV.error); },

  patch(fields) {
    if (!MPV.now) return;
    MPV.now = { ...MPV.now, ...fields };
    MPV.notify();
  },

  // Elapsed time is read from the player rather than counted here, so dragging the
  // seek bar or YouTube's own scrubber moves it too.
  poll() {
    clearInterval(MPV.tick);
    MPV.tick = setInterval(() => {
      const p = MPV.player;
      if (!p || !p.getDuration || !MPV.now || !MPV.now.playing) return;
      try { MPV.patch({ t: p.getCurrentTime() || 0, d: p.getDuration() || 0 }); } catch {}
    }, 500);
  },

  async start(index) {
    const at = Math.max(0, index | 0);
    // Already running: starting again is a jump, not a second player.
    if (MPV.player) { try { MPV.player.playVideoAt(at); } catch {} return; }
    if (MPV.loading) return;

    MPV.loading = true; MPV.error = null; MPV.notify();
    let YT, tracks;
    try {
      [YT, tracks] = await Promise.all([loadYtApi(), ytPlaylistItems()]);
    } catch (e) {
      MPV.loading = false; MPV.error = e.message || String(e); MPV.notify();
      return;
    }
    // The host is revealed by the notify above, so wait a frame rather than reading
    // a ref that has not been filled in yet.
    await new Promise((r) => requestAnimationFrame(r));
    if (!MPV.host) {
      MPV.loading = false; MPV.error = "no place to put the player"; MPV.notify();
      return;
    }

    MPV.tracks = tracks;
    const start = Math.min(at, tracks.length - 1);
    const ids = tracks.map((t) => t.id);
    MPV.now = {
      title: tracks[start].title, index: start, total: tracks.length,
      playing: false, muted: false, blocked: false, t: 0, d: 0,
    };
    MPV.loading = false;
    MPV.notify();

    // YT replaces this node with its iframe, so it is created outside the vdom:
    // Preact must not be tracking an element that something else removes.
    const node = document.createElement("div");
    node.id = "mpv-yt-" + (++ytMountSeq);
    MPV.host.appendChild(node);

    let watchdog = 0, lifted = false;
    MPV.player = new YT.Player(node, {
      width: "160", height: "90",
      videoId: ids[start],
      // Starting muted is the whole trick: browsers refuse to autoplay audio but
      // never refuse a muted start. The sound is lifted below once it is running.
      playerVars: { autoplay: 1, mute: 1, rel: 0, playsinline: 1 },
      events: {
        onReady: (e) => {
          // The video ids come from the Data API, so the queue is ours rather than
          // something YouTube has to resolve from a list id. next/previous then
          // walk this array, which is the same order the m3u prints.
          try { e.target.loadPlaylist(ids, start); } catch {}
          try { e.target.playVideo(); } catch {}
          MPV.poll();
          // Even muted playback can be refused. Say so rather than sitting there.
          watchdog = setTimeout(() => {
            try {
              if (e.target.getPlayerState() !== YT.PlayerState.PLAYING) MPV.patch({ blocked: true });
            } catch {}
          }, 2000);
        },
        onStateChange: (e) => {
          const st = e.data;
          if (st === YT.PlayerState.PLAYING) {
            clearTimeout(watchdog);
            MPV.patch({ blocked: false });
            if (!lifted) {
              lifted = true;
              // Unmuting is judged separately from starting, so this goes through
              // once playback is real. If the browser puts it back, say so.
              try { e.target.unMute(); e.target.setVolume(100); } catch {}
              setTimeout(() => {
                try { MPV.patch({ muted: e.target.isMuted() }); } catch {}
              }, 400);
            }
          }
          const i = e.target.getPlaylistIndex ? e.target.getPlaylistIndex() : -1;
          const track = i >= 0 && MPV.tracks ? MPV.tracks[i] : null;
          MPV.patch({
            playing: st === YT.PlayerState.PLAYING,
            ...(track ? { index: i, title: track.title } : {}),
          });
        },
        // A track that has gone private or region-locked stops the queue dead,
        // so step over it the way a player should.
        onError: (e) => { try { e.target.nextVideo(); } catch {} },
      },
    });
  },

  stop() {
    clearInterval(MPV.tick);
    const p = MPV.player;
    MPV.player = null; MPV.now = null; MPV.tracks = null;
    MPV.error = null; MPV.loading = false;
    if (p) { try { p.destroy(); } catch {} }
    MPV.notify();
  },

  call(fn, ...a) {
    const p = MPV.player;
    if (p && typeof p[fn] === "function") { try { return p[fn](...a); } catch {} }
  },
  showVideo(on) { MPV.video = !!on; MPV.notify(); },
  prev() { MPV.call("previousVideo"); },
  next() { MPV.call("nextVideo"); },
  toggle() { MPV.call(MPV.now && MPV.now.playing ? "pauseVideo" : "playVideo"); },
  unmute() { MPV.call("unMute"); MPV.call("setVolume", 100); MPV.patch({ muted: false }); },
  at(i) { MPV.call("playVideoAt", i); },
  // frac is 0..1 of the current track. Painting the new position straight away stops
  // the bar snapping back for the half second before the player answers.
  seek(frac) {
    const d = MPV.call("getDuration") || 0;
    if (!d) return;
    const t = Math.max(0, Math.min(d, frac * d));
    MPV.patch({ t, d });
    MPV.call("seekTo", t, true);
  },
};

export { MPV, ytPlaylistItems, ytPlaylistId };

export function useMpv() {
  const [, bump] = React.useState(0);
  React.useEffect(() => MPV.sub(() => bump((n) => n + 1)), []);
  return MPV;
}

let ytMountSeq = 0;

export const clock = (sec) => {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const body = String(Math.floor(s / 60) % 60).padStart(2, "0") + ":" +
               String(s % 60).padStart(2, "0");
  return h ? h + ":" + body : body;
};

// Where the iframe lives, for the whole life of the desktop. Rendered once, never
// conditionally, never moved: any of those reloads the frame and stops the sound.
// It shows in a corner while something is playing because a hidden YouTube player is
// against their terms and browsers will not start one.
export function MpvHost() {
  const mpv = useMpv();
  const ref = React.useRef(null);
  React.useEffect(() => {
    MPV.setHost(ref.current);
    return () => { MPV.setHost(null); MPV.stop(); };
  }, []);
  // `off` parks it off-screen; it is never unmounted and never re-parented.
  const shown = mpv.active && mpv.video;
  return (
    <div className={"mpv-host" + (shown ? "" : " off")} aria-hidden={shown ? undefined : "true"}>
      <div className="mpv-host-frame" ref={ref} />
    </div>
  );
}

// Click or drag anywhere on the bar to seek. This exists because the picture is only
// a thumbnail, which makes YouTube's own scrubber almost unusable.
export function MpvSeek({ t, d, lang }) {
  const ref = React.useRef(null);
  const pct = d ? Math.max(0, Math.min(100, (t / d) * 100)) : 0;

  const fracAt = (clientX) => {
    const box = ref.current;
    if (!box) return 0;
    const r = box.getBoundingClientRect();
    return r.width ? Math.max(0, Math.min(1, (clientX - r.left) / r.width)) : 0;
  };
  const down = (e) => {
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    MPV.seek(fracAt(e.clientX));
    const move = (ev) => MPV.seek(fracAt(ev.clientX));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const key = (e) => {
    if (!d) return;
    // mpv's own bindings: arrows are +/- 5 seconds.
    if (e.key === "ArrowRight") { e.preventDefault(); MPV.seek(Math.min(1, (t + 5) / d)); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); MPV.seek(Math.max(0, (t - 5) / d)); }
  };

  return (
    <div className="mpv-seek" ref={ref} onPointerDown={down} onKeyDown={key}
         tabIndex={0} role="slider"
         aria-label={lang === "en" ? "seek" : "탐색"}
         aria-valuemin={0} aria-valuemax={Math.round(d)} aria-valuenow={Math.round(t)}
         aria-valuetext={clock(t) + " / " + clock(d)}>
      <div className="mpv-seek-fill" style={{ width: pct + "%" }} />
      <div className="mpv-seek-head" style={{ left: pct + "%" }} />
    </div>
  );
}

export function MpvButtons({ n, lang, extra }) {
  const mpv = useMpv();
  const T = lang === "en"
    ? { prev: "previous", play: "play", pause: "pause", next: "next", quit: "quit",
        mute: "unmute", video: mpv.video ? "hide the picture" : "show the picture" }
    : { prev: "이전", play: "재생", pause: "일시정지", next: "다음", quit: "종료",
        mute: "음소거 해제", video: mpv.video ? "화면 숨기기" : "화면 보기" };
  return (
    <div className="mpv-bar">
      <button type="button" onClick={() => MPV.prev()} title={T.prev} aria-label={T.prev}>{"|<"}</button>
      <button type="button" onClick={() => MPV.toggle()}
              title={n.playing ? T.pause : T.play} aria-label={n.playing ? T.pause : T.play}>
        {n.playing ? "||" : ">"}
      </button>
      <button type="button" onClick={() => MPV.next()} title={T.next} aria-label={T.next}>{">|"}</button>
      {n.muted && (
        <button type="button" className="hot" onClick={() => MPV.unmute()}
                title={T.mute} aria-label={T.mute}>mute</button>
      )}
      <button type="button" className={mpv.video ? "on" : ""} title={T.video} aria-label={T.video}
              aria-pressed={mpv.video} onClick={() => MPV.showVideo(!mpv.video)}>▣</button>
      {extra}
      <button type="button" onClick={() => MPV.stop()} title={T.quit} aria-label={T.quit}>q</button>
    </div>
  );
}

// The track list. Used by the strip's dropdown and by the player window, so the
// follow-the-current-track behaviour is written once.
export function MpvList({ tracks, at, lang }) {
  const boxRef = React.useRef(null);
  const touched = React.useRef(0);

  // Follow the playing track, but not while the reader is looking through the list:
  // being yanked back to the current song mid-browse is worse than losing the mark.
  // Only wheel and pointer count as touching it, because a programmatic scroll fires
  // `scroll` too and would silence the follow forever.
  React.useEffect(() => {
    const box = boxRef.current;
    if (!box || Date.now() - touched.current < 6000) return;
    const row = box.children[at];
    if (!row) return;
    const top = row.offsetTop - box.offsetTop;
    if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - row.offsetHeight) {
      box.scrollTop = top - box.clientHeight / 2 + row.offsetHeight;
    }
  }, [at]);

  const mark = () => { touched.current = Date.now(); };
  const width = String(tracks.length).length;

  return (
    <ol className="mpv-list" ref={boxRef} onWheel={mark} onPointerDown={mark}
        aria-label={lang === "en" ? "playlist" : "재생목록"}>
      {tracks.map((t, i) => (
        <li key={t.id + i} className={i === at ? "on" : ""}>
          <button type="button" onClick={() => { mark(); MPV.at(i); }}>
            <span className="mpv-n">{String(i + 1).padStart(width)}</span>
            <span className="mpv-t">{t.title}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

// What `mpv` prints in the terminal. Deliberately just text: the controls live in
// the strip and the player lives on the desktop, so this can be cleared away.
export function PlayerBlock({ start, lang }) {
  const mpv = useMpv();
  React.useEffect(() => { MPV.start(start); }, []);

  if (mpv.error) return <div className="t-line warn">mpv: {mpv.error}</div>;
  if (!mpv.now) return <div className="t-line dim">mpv: resolving playlist...</div>;

  const n = mpv.now;
  const width = String(n.total).length;
  return (
    <div className="mpv" role="group" aria-label="mpv">
      <div className="t-line">{`Playing: ${n.title}`}</div>
      <div className="t-line dim">
        {`AV: ${clock(n.t)} / ${clock(n.d)}   [${String(n.index + 1).padStart(width)}/${n.total}]`}
      </div>
      <div className={"t-line " + (n.blocked || n.muted ? "warn" : "dim")}>
        {n.blocked
          ? (lang === "en" ? "the browser blocked playback: press > in the bar above"
                           : "브라우저가 재생을 막았습니다. 위 바의 > 를 누르세요")
          : n.muted
          ? (lang === "en" ? "started muted: press [mute] in the bar above for sound"
                           : "음소거로 시작했습니다. 위 바의 [mute] 를 누르면 소리가 켜집니다")
          : (lang === "en" ? "controls are in the bar above, or open the Music window"
                           : "컨트롤은 위쪽 바에 있습니다. 음악 창을 열어도 됩니다")}
      </div>
    </div>
  );
}

// A tmux-style status line inside the terminal window, carrying enough to drive
// playback without leaving the terminal.
export function MpvStrip({ lang }) {
  const mpv = useMpv();
  const [open, setOpen] = React.useState(false);
  const n = mpv.now;

  // Always rendered, even empty: .term-shell is a three-row grid and returning null
  // would leave two children, which drops the scrollback into the strip's auto row
  // and stops it filling the window.
  if (!n) return <div className="mpv-strip off" aria-hidden="true" />;

  const list = lang === "en" ? "playlist" : "재생목록";
  return (
    <div className="mpv-strip" role="group" aria-label="mpv">
      <div className="mpv-strip-row">
        <span className="mpv-strip-tag">mpv</span>
        <button type="button" className="mpv-strip-pos" onClick={() => setOpen((v) => !v)}
                title={list} aria-expanded={open}>
          {`[${n.index + 1}/${n.total}]`}
        </button>
        <span className="mpv-strip-title">{n.title}</span>
        <span className="mpv-strip-clock">{clock(n.t)}</span>
        <MpvSeek t={n.t} d={n.d} lang={lang} />
        <span className="mpv-strip-clock">{clock(n.d)}</span>
        <MpvButtons n={n} lang={lang} extra={
          <button type="button" className={open ? "on" : ""} onClick={() => setOpen((v) => !v)}
                  title={list} aria-label={list} aria-expanded={open}>≡</button>
        } />
      </div>
      {open && mpv.tracks && (
        <div className="mpv-panel">
          <MpvList tracks={mpv.tracks} at={n.index} lang={lang} />
        </div>
      )}
    </div>
  );
}

// The desktop music player: the same session the terminal drives, with the whole
// playlist visible instead of tucked into a dropdown.
export function MusicPlayer({ lang, wm }) {
  const mpv = useMpv();
  React.useEffect(() => { if (!mpv.active) MPV.start(0); }, []);

  const n = mpv.now;
  const T = lang === "en"
    ? { title: "Music", loading: "resolving playlist...", empty: "nothing playing",
        play: "play the playlist" }
    : { title: "음악", loading: "재생목록 읽는 중...", empty: "재생 중인 곡 없음",
        play: "재생목록 틀기" };

  return (
    <div className="mus">
      <div className="brw-title"
           onPointerDown={wm && wm.state === "windowed" ? wm.onDragStart : undefined}
           onDblClick={wm ? wm.onToggleMax : undefined}>
        <div className="term-dots">
          {wm ? (
            <>
              <button type="button" className="term-dot r" aria-label="close"
                      onPointerDown={(e) => e.stopPropagation()} onClick={wm.onClose} />
              <button type="button" className="term-dot y" aria-label="minimise"
                      onPointerDown={(e) => e.stopPropagation()} onClick={wm.onMinimise} />
              <button type="button" className="term-dot g" aria-label="maximise"
                      onPointerDown={(e) => e.stopPropagation()} onClick={wm.onToggleMax} />
            </>
          ) : (
            <><span className="term-dot r" /><span className="term-dot y" /><span className="term-dot g" /></>
          )}
        </div>
        <div className="term-title-name">
          {T.title}{n ? ` - ${n.index + 1}/${n.total}` : ""}
        </div>
        <div className="term-title-actions" />
      </div>

      {mpv.error ? (
        <div className="mus-empty warn">mpv: {mpv.error}</div>
      ) : mpv.loading ? (
        <div className="mus-empty">{T.loading}</div>
      ) : !n ? (
        <div className="mus-empty">
          <div>{T.empty}</div>
          <button type="button" className="mus-start" onClick={() => MPV.start(0)}>{T.play}</button>
        </div>
      ) : (
        <div className="mus-now" onPointerDown={(e) => e.stopPropagation()}>
          <div className="mus-title">{n.title}</div>
          <div className="mus-times">
            <span>{clock(n.t)}</span>
            <MpvSeek t={n.t} d={n.d} lang={lang} />
            <span>{clock(n.d)}</span>
          </div>
          <MpvButtons n={n} lang={lang} />
        </div>
      )}

      <div className="mus-list" onPointerDown={(e) => e.stopPropagation()}>
        {mpv.tracks && n && <MpvList tracks={mpv.tracks} at={n.index} lang={lang} />}
      </div>
    </div>
  );
}
