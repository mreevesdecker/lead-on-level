/* Lead on Level · System & Soul — assessment app (no framework, no build step).
   Adapted from the Lead on Level client edition; adds an on-screen results report. */
(function () {
  "use strict";

  var C = window.LOL_CONTENT;
  var CFG = window.LOL_CONFIG || {};
  var MODE = window.LOL_MODE === "ceo" ? "ceo" : "general";
  var STORE_KEY = "lol-ss-" + MODE + "-v1";
  var CEO_LEVEL = 7;
  var CEO_BELOW_LEVEL = 4; // Levels 5/6 are not in this edition yet, so the CEO's "level below" check uses Level 4.
  var GENERAL_LEVELS = [1, 2, 3, 4];

  var stage = document.getElementById("stage");
  var bar = document.getElementById("bar");
  var saveEl = document.getElementById("saveState");

  /* ---------------- scales ---------------- */
  var RATE_OPTS = C.scale.map(function (s) {
    var i = s.meaning.indexOf(".");
    return { v: s.symbol, word: s.word, label: s.meaning.slice(0, i + 1), sub: s.meaning.slice(i + 1).trim(), meaning: s.meaning };
  });
  var BELOW_OPTS = [
    { v: "Often", glyph: "●", label: "Often", sub: "It still claims a meaningful share of my week." },
    { v: "Sometimes", glyph: "◐", label: "Sometimes", sub: "It pulls me in now and then." },
    { v: "Rarely", glyph: "○", label: "Rarely", sub: "I have largely handed this work to others." }
  ];

  /* ---------------- level-finding questions ---------------- */
  var Q = {
    reports: {
      prompt: "Does anyone report directly to you?",
      opts: [
        { v: "no", t: "No", d: "I contribute through my own work; no one reports to me." },
        { v: "yes", t: "Yes", d: "One or more people report directly to me." }
      ]
    },
    manage: {
      prompt: "Do any of your direct reports manage people of their own?",
      opts: [
        { v: "none", t: "No — none of them manage people", d: "Everyone who reports to me is an individual contributor." },
        { v: "some", t: "Some do, some don’t", d: "I lead a mix of managers and individual contributors." },
        { v: "all", t: "Yes — all, or nearly all, of them do", d: "I lead people who lead people." }
      ]
    },
    attention: {
      prompt: "Which group is your role primarily accountable for leading?",
      sub: "Your team is a mix. Choose where the weight of your leadership responsibility sits.",
      opts: [
        { v: "ics", t: "The individual contributors who report to me" },
        { v: "managers", t: "The managers who report to me", d: "And, through them, the people on their teams." }
      ]
    },
    scope: {
      prompt: "Which best describes the scope of your role?",
      opts: [
        { v: "part", t: "I lead managers within part of a function", d: "For example, a team of teams, a region, an office, or a practice area." },
        { v: "function", t: "I am accountable for an entire function across the organization", d: "Its strategy, resources, and leadership pipeline — for example, Operations, Compliance, Marketing, Finance, or Technology." }
      ]
    },
    week: {
      prompt: "In a typical week, where does most of your time actually go?",
      sub: "There is no right answer. This shows the shape of your role as you live it.",
      opts: [
        { v: 1, t: "Doing the work myself" },
        { v: 2, t: "Directing and coaching the individual contributors on my team" },
        { v: 3, t: "Developing and holding accountable the managers who report to me" },
        { v: 4, t: "Setting functional strategy and aligning with leaders across the organization" }
      ]
    }
  };

  /* ---------------- state ---------------- */
  function uuid() {
    try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return "s-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }
  function fresh() {
    return {
      v: 1, sessionId: uuid(), mode: MODE, name: "", email: "", company: "",
      startedAt: null, completedAt: null, at: "welcome",
      r: {}, suggested: null, mixed: false, confirmed: MODE === "ceo" ? CEO_LEVEL : null, override: false,
      below: {}, answers: {}, rev: 0, synced: 0
    };
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) { var s = JSON.parse(raw); if (s && s.v === 1 && s.sessionId) return s; }
    } catch (e) {}
    return null;
  }
  function persist() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {} }

  var S = load() || fresh();
  var resumed = !!(S.startedAt && S.at !== "welcome" && !S.completedAt);
  var resumeAt = resumed ? S.at : null;
  if (S.completedAt) { S.at = "done"; }   // a finished session reopens on its results; "Start a new assessment" resets it
  if (resumed) S.at = "welcome";

  /* ---------------- level logic ---------------- */
  function suggest(r) {
    if (r.reports === "no") return { level: 1, mixed: false };
    if (r.reports !== "yes") return null;
    if (r.manage === "none") return { level: 2, mixed: false };
    if (r.manage === "some" && r.attention === "ics") return { level: 2, mixed: true };
    var viaManagers = r.manage === "all" || (r.manage === "some" && r.attention === "managers");
    if (viaManagers && r.scope === "part") return { level: 3, mixed: r.manage === "some" };
    if (viaManagers && r.scope === "function") return { level: 4, mixed: r.manage === "some" };
    return null;
  }
  function belowLevelOf(L) {
    if (L === CEO_LEVEL) return C.levels[CEO_BELOW_LEVEL];
    return L > 1 ? C.levels[L - 1] : null;
  }
  function lv() { return S.confirmed ? C.levels[S.confirmed] : null; }

  /* ---------------- flow ---------------- */
  function flow() {
    var f = [{ k: "welcome" }];
    if (MODE === "general") {
      f.push({ k: "q:reports" });
      if (S.r.reports === "yes") {
        f.push({ k: "q:manage" });
        if (S.r.manage === "some") f.push({ k: "q:attention" });
        if (S.r.manage === "all" || (S.r.manage === "some" && S.r.attention === "managers")) f.push({ k: "q:scope" });
        f.push({ k: "q:week" });
      }
      f.push({ k: "confirm" });
    } else {
      f.push({ k: "ceo" });
    }
    var L = lv();
    if (!L) return f;
    f.push({ k: "scale" });
    var B = belowLevelOf(L.level);
    if (B) {
      f.push({ k: "below-intro" });
      B.responsibilities.forEach(function (r, i) {
        f.push({ k: "below:" + B.level + "-" + r.n, below: B, resp: r, idx: i, total: B.responsibilities.length });
      });
    }
    var all = itemList(L), n = 0;
    f.push({ k: "part:C" });
    all.forEach(function (it) {
      if (it.part === "B" && it.first) f.push({ k: "part:B" });
      n++;
      f.push({ k: "item:" + it.id, item: it, n: n, total: all.length });
    });
    f.push({ k: "done" });
    return f;
  }
  function itemList(L) {
    var out = [];
    [["C", L.responsibilities], ["B", L.breakdowns]].forEach(function (pair) {
      pair[1].forEach(function (area, ai) {
        area.items.forEach(function (it, ii) {
          out.push({
            id: it.id, text: it.text, part: pair[0], area: area, areaIdx: ai, areaTotal: pair[1].length,
            first: ai === 0 && ii === 0
          });
        });
      });
    });
    return out;
  }
  function idx(f, k) { for (var i = 0; i < f.length; i++) if (f[i].k === k) return i; return 0; }

  /* ---------------- helpers ---------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function md(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"); }
  function audience(L) { return L.compHeading.replace(/^Responsibilities & Competencies for /, ""); }
  function firstName() { return (S.name || "").trim().split(/\s+/)[0] || ""; }
  function arrow() { return '<span class="arrow" aria-hidden="true">→</span>'; }
  function now() { return new Date().toISOString(); }

  /* ---------------- render ---------------- */
  var current = null, advancing = false;

  function go(k, opts) {
    S.at = k; persist();
    render(opts && opts.instant);
  }
  function next() {
    var f = flow(), i = idx(f, S.at);
    if (i < f.length - 1) go(f[i + 1].k); else advancing = false;
  }
  function back() {
    var f = flow(), i = idx(f, S.at);
    if (i > 0) go(f[i - 1].k);
  }

  function render(instant) {
    var f = flow(), i = idx(f, S.at), scr = f[i];
    if (S.at !== scr.k) S.at = scr.k;
    current = scr;
    var night = scr.k === "welcome" || scr.k === "ceo";
    document.body.classList.toggle("theme-night", night);
    bar.style.width = (S.confirmed ? Math.round((i / (f.length - 1)) * 100) : Math.min(12, i * 3)) + "%";
    var html = view(scr);
    var paint = function () {
      stage.innerHTML = '<section class="screen">' + html + "</section>";
      advancing = false;
      var fEl = stage.querySelector("[data-autofocus]");
      if (fEl) setTimeout(function () { try { fEl.focus({ preventScroll: true }); } catch (e) {} }, 60);
      window.scrollTo(0, 0);
      if (scr.k === "done") onDone();
    };
    var old = stage.querySelector(".screen");
    if (old && !instant) { advancing = true; old.classList.add("leaving"); setTimeout(paint, 200); } else paint();
  }

  function view(scr) {
    var k = scr.k;
    if (k === "welcome") return vWelcome();
    if (k === "ceo") return vCeo();
    if (k.indexOf("q:") === 0) return vQuestion(k.slice(2));
    if (k === "confirm") return vConfirm();
    if (k === "scale") return vScale();
    if (k === "below-intro") return vBelowIntro();
    if (k.indexOf("below:") === 0) return vBelow(scr);
    if (k === "part:C" || k === "part:B") return vPart(k.slice(5));
    if (k.indexOf("item:") === 0) return vItem(scr);
    if (k === "done") return vDone();
    return "";
  }

  function vWelcome() {
    var isCeo = MODE === "ceo";
    var lede = isCeo
      ? "This edition is prepared for the leader of the enterprise. It helps you see how fully you — and your executive team — are leading at the level the enterprise requires."
      : "Every level of leadership asks something different of you. This assessment first identifies the level your role is designed to lead at, then helps you see how fully you are leading there.";
    var resumeBlock = "";
    if (resumed && S.name && S.company && !S.completedAt) {
      resumeBlock =
        '<hr class="rule"><p class="lede" style="margin-top:0">Welcome back, ' + esc(firstName()) + ". Your answers have been kept.</p>" +
        '<div class="actions"><button class="btn" data-act="resume" data-autofocus>Continue where you left off ' + arrow() + "</button>" +
        '<button class="link" data-act="restart">Start over</button></div>';
    }
    return (
      '<p class="kicker">System &amp; Soul · Leadership Assessment</p>' +
      "<h1>Lead on <em>Level</em></h1>" +
      '<p class="lede">' + lede + "</p>" +
      '<div class="meta-row"><div>Time<strong>About 20 minutes</strong></div><div>Format<strong>One statement at a time</strong></div><div>Results<strong>Right away</strong></div></div>' +
      (resumeBlock ||
        '<form id="who" novalidate>' +
        '<div class="fields">' +
        '<div class="field"><label for="nm">Full name <span class="req" aria-hidden="true">*</span></label><input id="nm" name="name" autocomplete="name" placeholder="Your name" required aria-required="true" aria-describedby="nmErr" value="' + esc(S.name) + '" data-autofocus><div class="err" id="nmErr" role="alert"></div></div>' +
        '<div class="field"><label for="co">Company <span class="req" aria-hidden="true">*</span></label><input id="co" name="organization" autocomplete="organization" placeholder="Your company" required aria-required="true" aria-describedby="coErr" value="' + esc(S.company) + '"><div class="err" id="coErr" role="alert"></div></div>' +
        '<div class="field wide"><label for="em">Work email <span class="req" aria-hidden="true">*</span></label><input id="em" name="email" type="email" inputmode="email" autocomplete="email" placeholder="you@company.com" required aria-required="true" aria-describedby="emErr" value="' + esc(S.email) + '"><div class="err" id="emErr" role="alert"></div></div>' +
        "</div>" +
        '<p class="small privacy"><strong>Your privacy.</strong> All fields are required. Your information will never be shared publicly. Your individual answers are seen only by you and the System &amp; Soul team. Results may be shared in aggregate with your company’s leaders, never as individual responses.</p>' +
        '<div class="actions"><button class="btn" type="submit">Begin ' + arrow() + "</button></div>" +
        "</form>")
    );
  }

  function vCeo() {
    var L = C.levels[CEO_LEVEL];
    return (
      '<p class="kicker">Your level</p>' +
      "<h2>This edition assesses leadership at</h2>" +
      seal(L) +
      (L.note ? '<div class="note-card" style="color:var(--champagne-lt)">' + esc(L.note) + "</div>" : "") +
      '<div class="actions"><button class="btn" data-act="next" data-autofocus>Continue ' + arrow() + "</button>" +
      '<button class="link" data-act="back">Back</button></div>'
    );
  }

  function seal(L, extra) {
    return (
      '<div class="level-seal"><div class="num">' + L.level + '</div><div class="nm"><small>For ' + esc(audience(L)) + "</small>" + esc(L.name) + "</div></div>" +
      (extra || "")
    );
  }

  function vQuestion(id) {
    var q = Q[id], key = { reports: "reports", manage: "manage", attention: "attention", scope: "scope", week: "week" }[id];
    var cur = S.r[key];
    var stepNo = ["reports", "manage", "attention", "scope", "week"].filter(function (x) {
      return x === "reports" || flow().some(function (s) { return s.k === "q:" + x; });
    });
    var pos = stepNo.indexOf(id) + 1;
    return (
      '<p class="kicker">Finding your level · ' + pos + " of " + stepNo.length + "</p>" +
      "<h2>" + esc(q.prompt) + "</h2>" +
      (q.sub ? '<p class="lede">' + esc(q.sub) + "</p>" : "") +
      '<div class="opts" role="radiogroup">' +
      q.opts.map(function (o, i) {
        var sel = String(cur) === String(o.v);
        return (
          '<button class="opt' + (sel ? " sel" : "") + '" role="radio" aria-checked="' + sel + '" data-act="route" data-q="' + key + '" data-v="' + esc(o.v) + '"' + (i === 0 ? " data-autofocus" : "") + ">" +
          '<span class="k">' + (i + 1) + '</span><span class="t">' + esc(o.t) + "</span>" + (o.d ? '<span class="d">' + esc(o.d) + "</span>" : "") +
          "</button>"
        );
      }).join("") +
      "</div>" +
      '<div class="item-foot"><button class="link" data-act="back">← Back</button><span class="small">Press <kbd>1</kbd>–<kbd>' + q.opts.length + "</kbd> to choose</span></div>"
    );
  }

  function vConfirm() {
    var sg = suggest(S.r);
    if (!sg) return '<h2>Let’s go back a step.</h2><div class="actions"><button class="btn" data-act="back">Back</button></div>';
    var L = C.levels[sg.level];
    var mixedNote = sg.mixed ? '<p class="small" style="margin-top:14px">Your team spans two levels, so we have placed you at the level your role is primarily accountable for.</p>' : "";
    var list = GENERAL_LEVELS.map(function (n) {
      var X = C.levels[n], sel = S.confirmed === n;
      return (
        '<button class="opt' + (sel ? " sel" : "") + '" data-act="pick" data-v="' + n + '"><span class="k">' + n + '</span><span class="t">' + esc(X.name) + '</span><span class="d">For ' + esc(audience(X)) + "</span></button>"
      );
    }).join("");
    var showList = S._showList;
    return (
      '<p class="kicker">Your level</p>' +
      "<h2>Based on your answers, your role is designed to lead at</h2>" +
      seal(L, mixedNote) +
      '<div class="note-card">' + md(L.culture) + "</div>" +
      '<div class="actions"><button class="btn" data-act="accept" data-v="' + sg.level + '" data-autofocus>Yes, this is my role ' + arrow() + "</button>" +
      '<button class="link" data-act="toggle-list">' + (showList ? "Hide levels" : "Choose a different level") + "</button></div>" +
      (showList ? '<div class="level-list">' + list + "</div>" : "") +
      '<div class="item-foot"><button class="link" data-act="back">← Back</button></div>'
    );
  }

  function vScale() {
    var L = lv();
    return (
      '<p class="kicker">Level ' + L.level + " · " + esc(L.name) + "</p>" +
      "<h2>How to rate yourself</h2>" +
      '<ul class="instructions"><li>Read each <strong>responsibility</strong> and its <strong>competencies</strong> carefully.</li><li>Rate each statement a +, /, or − based on how well you are leading on level:</li></ul>' +
      '<div class="scale">' +
      RATE_OPTS.map(function (o) {
        return '<div class="scale-row"><div class="glyph">' + esc(o.v) + "</div><div><b>" + esc(o.label) + "</b><span>" + esc(o.sub) + "</span></div></div>";
      }).join("") +
      "</div>" +
      (L.note ? '<div class="note-card">' + esc(L.note) + "</div>" : "") +
      '<p class="small" style="margin-top:22px">Use <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> to answer and <kbd>←</kbd> to go back. Your answers save as you go.</p>' +
      '<div class="actions"><button class="btn" data-act="next" data-autofocus>Begin ' + arrow() + '</button><button class="link" data-act="back">Back</button></div>'
    );
  }

  function vBelowIntro() {
    var B = belowLevelOf(S.confirmed);
    return (
      '<p class="kicker">Before you begin</p>' +
      "<h2>The pull of the <em>level below</em></h2>" +
      '<p class="lede">Leaders are often drawn back into the work that made them successful at their previous level. Here are the ' + B.responsibilities.length + " core responsibilities of Level " + B.level + " — " + esc(B.name) + ". For each, tell us how often it still claims your personal time and attention.</p>" +
      '<div class="actions"><button class="btn" data-act="next" data-autofocus>Continue ' + arrow() + '</button><button class="link" data-act="back">Back</button></div>'
    );
  }

  function vBelow(scr) {
    var id = "L" + scr.below.level + "-R" + scr.resp.n;
    var cur = S.below[id] && S.below[id].r;
    return (
      '<div class="item-head"><div class="area"><div class="part">The level below · Level ' + scr.below.level + "</div>" +
      '<div class="title">' + esc(scr.below.name) + '</div><div class="desc">How often does this still claim your personal time and attention?</div></div>' +
      '<div class="count"><b>' + (scr.idx + 1) + "</b> / " + scr.total + "</div></div>" +
      '<p class="statement">' + esc(scr.resp.title) + "</p>" +
      rates(BELOW_OPTS.map(function (o) { return { v: o.v, glyph: o.glyph, label: o.label, sub: o.sub }; }), cur, "below", id) +
      foot()
    );
  }

  function vPart(p) {
    var L = lv();
    var areas = p === "C" ? L.responsibilities : L.breakdowns;
    var count = areas.reduce(function (a, r) { return a + r.items.length; }, 0);
    if (p === "C") {
      return (
        '<p class="kicker">Part one</p>' +
        "<h2>" + esc(L.compHeading) + "</h2>" +
        '<p class="lede">' + areas.length + " responsibilities · " + count + " statements. Rate each based on how well you are leading on level.</p>" +
        '<div class="actions"><button class="btn" data-act="next" data-autofocus>Begin part one ' + arrow() + '</button><button class="link" data-act="back">Back</button></div>'
      );
    }
    return (
      '<p class="kicker">Part two</p>' +
      "<h2>" + esc(L.breakdownHeading) + "</h2>" +
      '<p class="lede">' + esc(L.breakdownIntro || "") + "</p>" +
      '<ul class="instructions"><li>Read each <strong>breakdown</strong> and its <strong>descriptors</strong> carefully.</li><li>The same scale applies: <strong>+</strong> means “I’m on level. This is not a breakdown for me.”</li></ul>' +
      '<p class="small" style="margin-top:18px">' + areas.length + " breakdowns · " + count + " statements.</p>" +
      '<div class="actions"><button class="btn" data-act="next" data-autofocus>Begin part two ' + arrow() + '</button><button class="link" data-act="back">Back</button></div>'
    );
  }

  function vItem(scr) {
    var it = scr.item;
    var cur = S.answers[it.id] && S.answers[it.id].r;
    var partLbl = it.part === "C" ? "Part one · Responsibility " : "Part two · Breakdown ";
    return (
      '<div class="item-head"><div class="area"><div class="part">' + partLbl + it.area.n + " of " + it.areaTotal + "</div>" +
      '<div class="title">' + esc(it.area.title) + "</div>" + (it.area.desc ? '<div class="desc">' + esc(it.area.desc) + "</div>" : "") + "</div>" +
      '<div class="count"><b>' + scr.n + "</b> / " + scr.total + "</div></div>" +
      '<p class="statement">' + esc(it.text) + "</p>" +
      rates(RATE_OPTS.map(function (o) { return { v: o.v, glyph: o.v, label: o.label, sub: o.sub }; }), cur, "item", it.id) +
      foot()
    );
  }

  function rates(opts, cur, kind, id) {
    return (
      '<div class="rates" role="radiogroup">' +
      opts.map(function (o, i) {
        var sel = cur === o.v;
        return (
          '<button class="rate' + (sel ? " sel" : "") + '" role="radio" aria-checked="' + sel + '" data-act="' + kind + '" data-id="' + esc(id) + '" data-v="' + esc(o.v) + '"' + (i === 0 ? " data-autofocus" : "") + ">" +
          '<span class="glyph">' + esc(o.glyph) + '</span><span><span class="lbl">' + esc(o.label) + '</span><span class="sub">' + esc(o.sub) + '</span></span><span class="key">' + (i + 1) + "</span></button>"
        );
      }).join("") +
      "</div>"
    );
  }
  function foot() {
    return '<div class="item-foot"><button class="link" data-act="back">← Back</button><span class="small">Press <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></span></div>';
  }

  /* ---------------- results ---------------- */
  var SYM = { plus: "+", slash: "/", minus: "−" };
  var PTS = {}; PTS[SYM.plus] = 2; PTS[SYM.slash] = 1; PTS[SYM.minus] = 0;
  var CLS = {}; CLS[SYM.plus] = "p"; CLS[SYM.slash] = "s"; CLS[SYM.minus] = "m";

  function tally(list) {
    var t = { p: 0, s: 0, m: 0, n: 0, pts: 0, rated: 0 };
    list.forEach(function (r) {
      if (r && CLS[r]) { t[CLS[r]]++; t.pts += PTS[r]; t.rated++; } else t.n++;
    });
    t.pct = t.rated ? Math.round((t.pts / (t.rated * 2)) * 100) : 0;
    return t;
  }
  function distBar(t) {
    var tot = t.p + t.s + t.m || 1;
    var w = function (x) { return (x / tot * 100).toFixed(2) + "%"; };
    return '<div class="dist" role="img" aria-label="' + t.p + " on level, " + t.s + " sometimes below, " + t.m + ' below level">' +
      '<span class="p" style="width:' + w(t.p) + '"></span><span class="s" style="width:' + w(t.s) + '"></span><span class="m" style="width:' + w(t.m) + '"></span></div>';
  }
  function legend() {
    return '<div class="legend"><span><i class="p"></i>+ On level</span><span><i class="s"></i>/ Sometimes below</span><span><i class="m"></i>− Below level</span></div>';
  }
  function areaStats(L) {
    var out = [];
    [["C", L.responsibilities], ["B", L.breakdowns]].forEach(function (pair) {
      pair[1].forEach(function (area) {
        var rs = area.items.map(function (it) { return S.answers[it.id] && S.answers[it.id].r; });
        out.push({ part: pair[0], area: area, t: tally(rs), rs: rs });
      });
    });
    return out;
  }
  function areaRow(a) {
    var lbl = a.part === "C" ? "Responsibility " + a.area.n : "Breakdown " + a.area.n;
    var items = a.area.items.map(function (it, i) {
      var r = a.rs[i], c = CLS[r] || "n";
      return '<li><span class="chip ' + c + '" aria-label="' + esc(r ? "Rated " + r : "Not rated") + '">' + esc(r || "·") + "</span><span>" + esc(it.text) + "</span></li>";
    }).join("");
    return '<details class="area-row"><summary><span class="at"><small>' + lbl + "</small>" + esc(a.area.title) + "</span>" + distBar(a.t) + "</summary>" +
      '<div class="body"><ul>' + items + "</ul></div></details>";
  }

  function vDone() {
    var L = lv();
    if (!L) return '<h2>Something went wrong.</h2><div class="actions"><button class="btn" data-act="restart">Start again</button></div>';
    var stats = areaStats(L);
    var partC = stats.filter(function (a) { return a.part === "C"; });
    var partB = stats.filter(function (a) { return a.part === "B"; });
    var all = function (arr) { return tally([].concat.apply([], arr.map(function (a) { return a.rs; }))); };
    var tC = all(partC), tB = all(partB);
    var B = belowLevelOf(L.level);
    var often = [], belowT = { Often: 0, Sometimes: 0, Rarely: 0 };
    if (B) B.responsibilities.forEach(function (r) {
      var a = S.below["L" + B.level + "-R" + r.n];
      if (a) { belowT[a.r] = (belowT[a.r] || 0) + 1; if (a.r === "Often") often.push(r.title); }
    });

    var strengths = partC.filter(function (a) { return a.t.rated && a.t.pct >= 75; })
      .sort(function (x, y) { return y.t.pct - x.t.pct; }).slice(0, 3);
    var focus = stats.filter(function (a) { return a.t.rated && a.t.pct < 100; })
      .sort(function (x, y) { return x.t.pct - y.t.pct || y.t.m - x.t.m; }).slice(0, 3);
    var li = function (a) { return "<li>" + esc(a.area.title) + "</li>"; };

    var signal = "";
    var ts = Number(S.r.week || 0);
    if (ts && L.level !== CEO_LEVEL && ts < L.level) {
      signal += '<div class="signal">You said most of your week goes to <strong>' + esc(Q.week.opts[ts - 1].t.toLowerCase()) +
        "</strong> — that is Level " + ts + " work. Your role is designed to lead at Level " + L.level + ".</div>";
    }
    if (B && often.length) {
      signal += '<div class="signal">Level ' + B.level + " work that still <strong>often</strong> claims your time: " +
        often.map(esc).join("; ") + ".</div>";
    }

    return (
      '<div class="results">' +
      '<div class="res-head"><p class="kicker">Your results</p>' +
      "<h1>" + (firstName() ? esc(firstName()) + ", here is how you <em>lead on level.</em>" : "How you <em>lead on level.</em>") + "</h1>" +
      seal(L) +
      '<p class="lede">These results reflect your own ratings. Use them as a starting point for reflection and for conversations with your coach or team.</p></div>' +

      '<div class="res-cards">' +
      '<div class="res-card"><div class="lbl">Competencies on level</div><div class="big">' + tC.p + "<small> of " + (tC.rated || tC.p) + "</small></div>" + distBar(tC) + "<p>Overall score " + tC.pct + "%</p></div>" +
      '<div class="res-card"><div class="lbl">Breakdowns to watch</div><div class="big">' + (tB.s + tB.m) + "<small> of " + (tB.rated || 0) + "</small></div>" + distBar(tB) + "<p>" + tB.m + " rated below level</p></div>" +
      (B ? '<div class="res-card"><div class="lbl">Pull of Level ' + B.level + '</div><div class="big">' + belowT.Often + "<small> often</small></div><p>" + belowT.Sometimes + " sometimes · " + belowT.Rarely + " rarely, of " + B.responsibilities.length + " responsibilities</p></div>" : "") +
      "</div>" + legend() +

      (signal ? '<div class="res-section"><h3>What to notice</h3>' + signal + "</div>" : "") +

      '<div class="res-section"><div class="callouts">' +
      '<div class="callout good"><h4>Where you are strongest</h4>' + (strengths.length ? "<ul>" + strengths.map(li).join("") + "</ul>" : '<p class="small">No responsibility reached 75% yet. That is useful to know.</p>') + "</div>" +
      '<div class="callout focus"><h4>Where to focus first</h4>' + (focus.length ? "<ul>" + focus.map(li).join("") + "</ul>" : '<p class="small">You rated every statement on level.</p>') + "</div>" +
      "</div></div>" +

      '<div class="res-section"><h3>Part one · ' + esc(L.compHeading.replace(/^Responsibilities & Competencies for /, "Responsibilities for ")) + "</h3>" +
      '<p class="small">Open any responsibility to see how you rated each competency.</p>' +
      '<div class="area-list">' + partC.map(areaRow).join("") + "</div></div>" +

      '<div class="res-section"><h3>Part two · ' + esc(L.breakdownHeading) + "</h3>" +
      '<p class="small">A + here means this is not a breakdown for you.</p>' +
      '<div class="area-list">' + partB.map(areaRow).join("") + "</div></div>" +

      '<div class="actions res-actions"><button class="btn" data-act="print">Save as PDF ' + arrow() + "</button>" +
      '<button class="link" data-act="new">Start a new assessment</button></div>' +
      '<div id="retry"></div>' +
      "</div>"
    );
  }

  /* ---------------- interactions ---------------- */
  stage.addEventListener("submit", function (e) {
    if (e.target.id !== "who") return;
    e.preventDefault();
    // Ignore a second submit (double-click, Enter + click, password managers) so it can't skip a question.
    if (advancing || S.at !== "welcome") return;
    var nm = document.getElementById("nm").value.trim();
    var em = document.getElementById("em").value.trim();
    var co = document.getElementById("co").value.trim();
    var firstBad = null;
    var fail = function (id, msg) {
      document.getElementById(id + "Err").textContent = msg;
      document.getElementById(id).setAttribute("aria-invalid", "true");
      if (!firstBad) firstBad = document.getElementById(id);
    };
    ["nm", "co", "em"].forEach(function (id) {
      document.getElementById(id + "Err").textContent = "";
      document.getElementById(id).removeAttribute("aria-invalid");
    });
    if (nm.length < 2) fail("nm", "Please enter your name.");
    if (co.length < 2) fail("co", "Please enter your company.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) fail("em", "Please enter a valid email address.");
    if (firstBad) { firstBad.focus(); return; }
    S.name = nm; S.email = em; S.company = co;
    if (!S.startedAt) S.startedAt = now();
    touch();
    saveNow("start");
    next();
  });

  stage.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b || advancing) return;
    var act = b.dataset.act;
    if (act === "next") return next();
    if (act === "back") return back();
    if (act === "resume") { resumed = false; return go(resumeAt || "welcome"); }
    if (act === "print") { openAll(); return window.print(); }
    if (act === "new") {
      if (!window.confirm("Start a new assessment? Your results will be cleared from this device.")) return;
      S = fresh(); resumed = false; persist(); return render();
    }
    if (act === "restart") {
      S = fresh(); resumed = false; persist(); return render();
    }
    if (act === "route") {
      var q = b.dataset.q, v = b.dataset.v;
      if (q === "week") v = Number(v);
      if (S.r[q] !== v) {
        S.r[q] = v;
        // Clear answers further down the routing path that no longer apply.
        if (q === "reports") { delete S.r.manage; delete S.r.attention; delete S.r.scope; if (v === "no") delete S.r.week; }
        if (q === "manage") { delete S.r.attention; if (v === "none") delete S.r.scope; }
        if (q === "attention" && v === "ics") delete S.r.scope;
        var sg = suggest(S.r);
        S.suggested = sg ? sg.level : null;
        S.mixed = sg ? sg.mixed : false;
        if (MODE === "general") { S.confirmed = null; S.override = false; }
      }
      touch();
      return select(b, next);
    }
    if (act === "toggle-list") { S._showList = !S._showList; return render(true); }
    if (act === "accept" || act === "pick") {
      var n = Number(b.dataset.v), sg2 = suggest(S.r);
      S.suggested = sg2 ? sg2.level : null;
      S.mixed = sg2 ? sg2.mixed : false;
      S.confirmed = n;
      S.override = S.suggested !== n;
      S.levelConfirmedAt = now();
      S._showList = false;
      touch();
      saveNow("level");
      return select(b, next);
    }
    if (act === "item" || act === "below") {
      var id = b.dataset.id, val = b.dataset.v;
      var bucket = act === "item" ? S.answers : S.below;
      bucket[id] = { r: val, at: now() };
      touch();
      return select(b, function () { maybeSave(); next(); });
    }
  });

  function select(btn, cb) {
    advancing = true;
    var group = btn.parentElement;
    Array.prototype.forEach.call(group.children, function (c) { c.classList.remove("sel"); c.setAttribute("aria-checked", "false"); });
    btn.classList.add("sel"); btn.setAttribute("aria-checked", "true");
    // Stay locked until the next screen has painted (paint() releases the lock), so a double-tap
    // during the transition can't re-answer the previous item and skip the next one.
    setTimeout(cb, 260);
  }

  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if (/^[1-9]$/.test(e.key)) {
      var btns = stage.querySelectorAll(".rates .rate, .opts .opt");
      var b = btns[Number(e.key) - 1];
      if (b) { e.preventDefault(); b.click(); }
    } else if (e.key === "ArrowLeft") {
      if (current && current.k !== "welcome" && current.k !== "done") { e.preventDefault(); back(); }
    }
  });

  /* ---------------- saving ---------------- */
  var idleTimer = null, inflight = false, queued = null, failures = 0;

  function touch() { S.rev = (S.rev || 0) + 1; S.updatedAt = now(); persist(); setSave(); }

  function maybeSave() {
    // Save at each change of responsibility/breakdown area, plus an idle save so nothing is lost mid-area.
    var f = flow(), i = idx(f, S.at), a = f[i], b = f[i + 1];
    var area = function (s) { return s && s.item ? s.item.part + s.item.area.n : s && s.below ? "below" : s && s.k; };
    clearTimeout(idleTimer);
    if (!b || area(a) !== area(b)) saveNow("progress");
    else idleTimer = setTimeout(function () { saveNow("idle"); }, 15000);
  }

  function setSave(state) {
    if (!saveEl) return;
    if (!CFG.ENDPOINT) { saveEl.dataset.s = "pending"; saveEl.textContent = S.rev ? "Saved on this device" : ""; return; }
    var s = state || (S.synced >= S.rev ? "ok" : "local");
    saveEl.dataset.s = s === "local" ? "ok" : s;
    saveEl.textContent = !S.rev ? "" : s === "ok" ? "Saved" : s === "local" ? "Progress saved" : s === "error" ? "Reconnecting…" : "Saving…";
  }

  function saveNow(reason) {
    clearTimeout(idleTimer);
    if (!CFG.ENDPOINT) { setSave(); return Promise.resolve(false); }
    if (!S.email) return Promise.resolve(false);
    if (inflight) { queued = reason; return inflight; }
    var rev = S.rev;
    var body = JSON.stringify(payload(reason));
    setSave("pending");
    inflight = fetch(CFG.ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: body,
      redirect: "follow"
    }).then(function (res) { return res.json(); }).then(function (j) {
      if (!j || !j.ok) throw new Error((j && j.error) || "save failed");
      failures = 0;
      S.synced = Math.max(S.synced || 0, rev); persist(); setSave();
      return true;
    }).catch(function () {
      failures++;
      setSave("error");
      var delay = Math.min(30000, 2000 * Math.pow(2, failures - 1));
      setTimeout(function () { if (S.synced < S.rev) saveNow("retry"); }, delay);
      return false;
    }).then(function (ok) {
      inflight = false;
      if (queued) { var q = queued; queued = null; if (S.synced < S.rev) return saveNow(q); }
      return ok;
    });
    return inflight;
  }

  window.addEventListener("pagehide", function () {
    if (!CFG.ENDPOINT || !S.email || S.synced >= S.rev) return;
    try { navigator.sendBeacon(CFG.ENDPOINT, new Blob([JSON.stringify(payload("pagehide"))], { type: "text/plain;charset=utf-8" })); } catch (e) {}
  });

  function openAll() { Array.prototype.forEach.call(document.querySelectorAll("details.area-row"), function (d) { d.open = true; }); }
  window.addEventListener("beforeprint", openAll);

  function onDone() {
    if (!S.completedAt) { S.completedAt = now(); touch(); }
    var p = S.synced >= S.rev ? Promise.resolve(true) : saveNow("complete");
    var box = document.getElementById("retry");
    if (!CFG.ENDPOINT || !box) return;
    Promise.resolve(p).then(function (ok) {
      if (ok || S.synced >= S.rev) return;
      box.innerHTML = '<p class="retry">We could not confirm your responses were sent. Please keep this window open while we retry.</p>' +
        '<div class="actions"><button class="btn" data-act="retry-save">Try again ' + arrow() + "</button></div>";
      var b = box.querySelector("[data-act=retry-save]");
      b.addEventListener("click", function () {
        b.disabled = true;
        saveNow("complete-retry").then(function (ok2) { if (ok2) box.innerHTML = '<p class="small" style="margin-top:20px">Received. Thank you.</p>'; else b.disabled = false; });
      });
    });
  }

  /* ---------------- payload (one row per person + one row per rated item) ---------------- */
  function payload(reason) {
    var L = lv(), B = L ? belowLevelOf(L.level) : null;
    var items = [], cnt = { C: { "+": 0, "/": 0, "−": 0 }, B: { "+": 0, "/": 0, "−": 0 } };
    var belowCnt = { Often: 0, Sometimes: 0, Rarely: 0 };
    var base = { session_id: S.sessionId, name: S.name, company: S.company || "", email: S.email, link_type: MODE, assessed_level: L ? L.level : "", level_name: L ? L.name : "" };
    var meaning = {}; RATE_OPTS.forEach(function (o) { meaning[o.v] = o.meaning; });
    if (B) {
      B.responsibilities.forEach(function (r) {
        var id = "L" + B.level + "-R" + r.n, a = S.below[id];
        if (a) belowCnt[a.r] = (belowCnt[a.r] || 0) + 1;
        items.push(Object.assign({}, base, {
          part: "Level below (Level " + B.level + " — " + B.name + ")", area_no: r.n, area_title: r.title,
          item_id: id, item_text: r.title, rating: a ? a.r : "", rating_meaning: a ? "Still claims my time: " + a.r : "", answered_at: a ? a.at : ""
        }));
      });
    }
    if (L) {
      itemList(L).forEach(function (it) {
        var a = S.answers[it.id];
        if (a && cnt[it.part][a.r] != null) cnt[it.part][a.r]++;
        items.push(Object.assign({}, base, {
          part: it.part === "C" ? "Competency" : "Breakdown", area_no: it.area.n, area_title: it.area.title,
          item_id: it.id, item_text: it.text, rating: a ? a.r : "", rating_meaning: a ? meaning[a.r] : "", answered_at: a ? a.at : ""
        }));
      });
    }
    var answered = items.filter(function (x) { return x.rating; }).length;
    var mins = S.completedAt && S.startedAt ? Math.round(((new Date(S.completedAt) - new Date(S.startedAt)) / 60000) * 10) / 10 : "";
    var ts = S.r.week || "";
    var response = {
      session_id: S.sessionId,
      status: S.completedAt ? "complete" : "in progress",
      link_type: MODE,
      name: S.name, company: S.company || "", email: S.email,
      started_at: S.startedAt || "", last_saved_at: now(), completed_at: S.completedAt || "", minutes_to_complete: mins,
      suggested_level: MODE === "ceo" ? "" : (S.suggested || ""),
      confirmed_level: S.confirmed || "",
      confirmed_level_name: L ? L.name : "",
      overrode_suggestion: MODE === "ceo" ? "" : (S.confirmed ? (S.override ? "yes" : "no") : ""),
      mixed_structure: S.mixed ? "yes" : (MODE === "ceo" ? "" : "no"),
      q_direct_reports: S.r.reports || "", q_reports_manage: S.r.manage || "", q_primary_accountability: S.r.attention || "", q_scope: S.r.scope || "",
      q_time_signal: ts ? Q.week.opts[ts - 1].t : "",
      time_signal_level: ts,
      time_below_role_level: ts && S.confirmed && S.confirmed !== CEO_LEVEL ? (ts < S.confirmed ? "yes" : "no") : "",
      below_level_checked: B ? B.level : "",
      below_often: B ? belowCnt.Often : "", below_sometimes: B ? belowCnt.Sometimes : "", below_rarely: B ? belowCnt.Rarely : "",
      competency_plus: L ? cnt.C["+"] : "", competency_slash: L ? cnt.C["/"] : "", competency_minus: L ? cnt.C["−"] : "",
      breakdown_plus: L ? cnt.B["+"] : "", breakdown_slash: L ? cnt.B["/"] : "", breakdown_minus: L ? cnt.B["−"] : "",
      items_answered: answered, items_total: items.length,
      last_screen: S.at, user_agent: navigator.userAgent, app_version: CFG.APP_VERSION || ""
    };
    var state = JSON.parse(JSON.stringify(S)); delete state._showList;
    return { token: CFG.TOKEN, reason: reason, response: response, items: items, state: state };
  }

  setSave();
  render(true);
})();
