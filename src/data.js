// Site content, hand-authored. Every view (terminal, Easy Mode, virtual FS) reads from here,
// so adding a project or changing a label only touches this file.

window.SITE_DATA = {
  // Central site-level constants — edit here, no other file needs to change.
  // (index.html <title>/<meta> is static and must be updated separately.)
  site: {
    handle: "99jik",                                 // shell prompt host, storage key prefix
    domain: "99jik.com",                             // user-facing canonical domain
    github: "99jik",                                 // github.com/<this> for project repos
    til: "til.99jik.com",                            // short TIL label
    tilUrl: "https://til.99jik.com",                 // full TIL URL
    cvKo: "https://github.com/99JIK/cv/blob/main/cv-ko.pdf",  // CV (ko), hosted in the cv repo
    cvEn: "https://github.com/99JIK/cv/blob/main/cv-en.pdf",  // CV (en), hosted in the cv repo
    // Footer (c) year and the "updated" date come from __BUILD_DATE__, injected by
    // scripts/build.mjs. Hand-written dates rot: the old updatedLabel sat 4 months stale.
    gaTagId: "G-4MY31MY2XZ",                          // GA4 measurement ID (empty string disables)
  },

  profile: {
    name_en: "Jeongin Kim",
    name_ko: "김정인",
    role_en: "MS Candidate · Software Testing Lab",
    role_ko: "석사과정 · 소프트웨어 테스팅 연구실",
    affiliation_en: "Kyungpook National University",
    affiliation_ko: "경북대학교 컴퓨터학부",
    location_ko: "대구광역시, 대한민국",
    location_en: "Daegu, Republic of Korea",
    email: "99jik@99jik.com",
    github: "99jik",
    linkedin: "jeongin-kim-74ba69384",
    scholar: null,
    til: "https://til.99jik.com",
  },

  research: [
    { tag: "SIL",  title_en: "Software-in-the-Loop",        title_ko: "소프트웨어 인 더 루프",
      blurb_ko: "HW 없이 제어/임베디드 로직을 루프에서 검증",
      blurb_en: "Exercising control and embedded logic in the loop, without the hardware." },
    { tag: "LLM",  title_en: "LLM-based Testing",           title_ko: "LLM 기반 테스팅",
      blurb_ko: "대규모 언어모델을 테스트 오라클/생성자로 활용",
      blurb_en: "Using large language models as test oracles and generators." },
    { tag: "SLM",  title_en: "Small-LM Testing",            title_ko: "소형 언어모델 테스팅",
      blurb_ko: "온디바이스 SLM을 이용한 경량 퍼저/오라클",
      blurb_en: "Lightweight fuzzers and oracles built on on-device SLMs." },
  ],

  // Each entry also becomes <slug>.md in the virtual FS (see fs.js).
  // `url` is where the Easy Mode card links; defaults to the GitHub repo when omitted.
  projects: [
    { slug: "til",      title_en: "TIL(Today I Learned)",title_ko: "오늘 배운 것",       year: 2025, featured: false, stack: ["Docusaurus","MDX"], url: "https://til.99jik.com", summary_en: "Daily research/learning notes, deployed separately at til.99jik.com.",                       summary_ko: "쌓아가는 연구/학습 노트. til.99jik.com 에서 별도 운영." },
  ],

  publications: [
    { year: 2025, venue: "(draft)",  title: "Small Language Models as Differential Oracles for Underspecified Library APIs", role: "first author" },
  ],

  experience: [
    { when: "2024.09 –",  what_en: "MS candidate, Software Testing Lab",  what_ko: "석사과정, 소프트웨어 테스팅 연구실", where_ko: "경북대", where_en: "KNU" },
    { when: "2020 – 2024", what_en: "BS in Computer Science & Eng.",       what_ko: "컴퓨터학부 학사",                 where_ko: "경북대", where_en: "KNU" },
  ],

  skills: {
    languages: ["C", "Python", "Rust", "TypeScript"],
    tools: ["LLVM", "tree-sitter", "pytest", "GitHub Actions"],
    research: ["Fuzzing", "Oracle Problem", "LLM/SLM Integration", "SIL"],
  },

  // Free-form "what I'm on lately" bullets. Empty array hides the section entirely
  // (Easy Mode) and prints "(empty)" in ~/now.log. Don't leave placeholder text here.
  now: [],

  // ── Text shown in intros (Easy mode callout + terminal `about` command) ──
  intro: {
    about: {  // Easy mode callout box (under the title)
      ko: {
        primary: "안녕하세요. 경북대학교 컴퓨터학부에서 소프트웨어 테스팅을 공부하고 있어요.",
        secondary: "Software in the Loop(SIL), LLM/SLM 기반 테스팅에 관심이 많습니다.",
      },
      en: {
        primary: "Hi — I study software testing at Kyungpook National University.",
        secondary: "My work lives at the intersection of software testing and language models, currently focused on SIL and LLM/SLM-based testing.",
      },
    },
    tagline: {
      ko: {
        primary: "LLM을 활용한 소프트웨어 테스트 자동화와 신뢰성 검증을 연구합니다.",
        secondary: "AI와 소프트웨어가 상호 보완적으로 작동하는 방법을 고민합니다.",
      },
      en: {
        primary: "My research focuses on software test automation and reliability verification using LLMs.",
        secondary: "Exploring ways AI and software can complement each other.",
      },
    },
  },

  // ── `fortune` easter-egg pool ──
  fortunes: {
    ko: [
      "테스트 없는 코드는 레거시다. — Michael Feathers",
      "버그는 특성이 아니다. 특성이 버그일 뿐.",
      "커버리지 100%는 방어선이지 승리선이 아니다.",
      "오라클이 약하면 테스트는 그냥 실행기다.",
      "LLM 은 답을 아는 친구가 아니라, 자신만만한 인턴이다.",
      "느린 테스트는 결국 안 돌리는 테스트가 된다.",
      "플레이크는 잡는 게 아니라 제거하는 것이다.",
      "가장 좋은 회귀 테스트는, 회귀를 재현하는 테스트이다.",
    ],
    en: [
      "Code without tests is legacy. -- Michael Feathers",
      "A bug is not a feature. A feature is a bug with marketing.",
      "100% coverage is a floor, not a ceiling.",
      "A weak oracle turns tests into runners.",
      "LLMs aren't the friend who knows -- they're the confident intern.",
      "A slow test is a test that never runs.",
      "You don't catch flakes. You eliminate them.",
      "The best regression test is one that reproduces the regression.",
    ],
  },
};
