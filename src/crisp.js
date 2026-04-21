// Live chat via Crisp. The default chatbox UI is hidden — messages flow through
// the terminal's own chat mode via custom events.
//
// Docs: https://help.crisp.chat/en/article/how-to-use-javascript-sdk-actions-triggers-events-1qegzb9/
//
// Visitor identity (prompt name) is synced to Crisp as `user:nickname`.
(function () {
  const WEBSITE_ID = "ad733172-a6e8-4c76-accb-78e3b5748820";

  window.$crisp = [];
  window.CRISP_WEBSITE_ID = WEBSITE_ID;
  window.CRISP_RUNTIME_CONFIG = {
    locale: document.documentElement.lang === "en" ? "en" : "ko",
  };

  // Hide the default chatbox — we render messages inside the terminal.
  window.$crisp.push(["do", "chat:hide"]);
  // Mute notification sounds — our UI already surfaces new messages visually.
  window.$crisp.push(["config", "sound:mute", [true]]);

  // Prevent Crisp from mutating <title> with unread counts like "💬 7 - ...".
  // We run our own chat UI, so the tab title should stay clean.
  (function lockDocumentTitle() {
    const originalTitle = document.title;
    const titleEl = document.querySelector("title");
    if (!titleEl) return;
    let guard = false;
    const enforce = () => {
      if (guard) return;
      if (document.title !== originalTitle) {
        guard = true;
        document.title = originalTitle;
        guard = false;
      }
    };
    new MutationObserver(enforce).observe(titleEl, {
      childList: true, characterData: true, subtree: true,
    });
  })();

  // ── identity sync ──
  const applyName = () => {
    const name = window.getPromptName && window.getPromptName();
    if (!name || name === "anonymous") return;
    window.$crisp.push(["set", "user:nickname", [name]]);
  };
  applyName();
  window.addEventListener("promptname", applyName);

  // ── agent → visitor: forward operator messages (text + attachments) ──
  window.$crisp.push(["on", "message:received", (data) => {
    if (!data) return;
    if (data.from && data.from !== "operator") return;
    if (data.type === "note") return; // internal agent note, hide

    const detail = { kind: "text", timestamp: data.timestamp || Date.now() };

    if (!data.type || data.type === "text") {
      const text = typeof data === "string" ? data : data.content;
      if (!text) return;
      detail.text = typeof text === "string" ? text : "";
    } else if ((data.type === "file" || data.type === "animation" || data.type === "audio") && data.content) {
      const mime = (data.content.type || "").toLowerCase();
      detail.kind = mime.startsWith("image/") || data.type === "animation" ? "image"
                   : mime.startsWith("audio/") || data.type === "audio"    ? "audio"
                   : "file";
      detail.fileName = data.content.name || "";
      detail.fileType = mime;
      detail.fileUrl  = data.content.url || "";
      if (!detail.fileUrl) return;
    } else {
      return; // unsupported type (picker, field, etc.)
    }

    window.dispatchEvent(new CustomEvent("livechat-agent-message", { detail }));
  }]);

  // Operator typing indicator → show a pending line in the terminal.
  window.$crisp.push(["on", "message:compose:received", (data) => {
    const isTyping = data && (data.type === "start" || data.type === "compose");
    window.dispatchEvent(new CustomEvent("livechat-agent-typing", {
      detail: { isTyping: !!isTyping },
    }));
  }]);

  // Defensive: if anything tries to open Crisp's default UI, re-hide immediately.
  // Our site has its own themed chat UIs (terminal + EasyChat panel).
  window.$crisp.push(["on", "chat:opened", () => window.$crisp.push(["do", "chat:hide"])]);
  window.$crisp.push(["on", "chat:closed", () => window.$crisp.push(["do", "chat:hide"])]);

  // ── load SDK ──
  const s = document.createElement("script");
  s.src = "https://client.crisp.chat/l.js";
  s.async = true;
  document.head.appendChild(s);

  window.LIVE_CHAT = {
    enabled: true,
    mode: "inline",
    send(text) {
      if (!text) return;
      window.$crisp.push(["do", "message:send", ["text", text]]);
    },
    setName(n) {
      if (!n) return;
      window.$crisp.push(["set", "user:nickname", [n]]);
    },
  };
})();
