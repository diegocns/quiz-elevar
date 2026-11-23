// Interface do Diagnóstico Elevar: rotas, perguntas, contato (CNPJ), análise, resultado, tracking.
(function () {
  "use strict";
  const E = window.EL_ENGINE, CFG = window.EL_CONFIG || {};
  const app = document.getElementById("app");
  const STORE = "el_quiz_v1";
  const STEPS = E.STEPS;
  const LOGO = "assets/logo-elevar.png";

  // ───────── estado ─────────
  const uid = () => "el_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const blank = () => ({ id: uid(), answers: {}, contato: {}, cnpjInfo: null, utm: {}, started: false, leadSent: false });
  const load = () => { try { return JSON.parse(sessionStorage.getItem(STORE)); } catch (e) { return null; } };
  let S = load() || blank();
  const save = () => { try { sessionStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* sem storage */ } };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = id => document.getElementById(id);
  let timer = null, rotTimer = null, lookupP = null;

  // ───────── UTM ─────────
  (function captureUtm() {
    try {
      const p = new URLSearchParams(location.search);
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"].forEach(k => { if (p.get(k)) S.utm[k] = p.get(k); });
      S.utm.referrer = S.utm.referrer || document.referrer || "";
      save();
    } catch (e) { /* ok */ }
  })();

  // ───────── GTM e Pixel (só se configurados) ─────────
  window.dataLayer = window.dataLayer || [];
  (function loadTags() {
    if (CFG.gtmId) {
      window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
      const s = document.createElement("script"); s.async = true; s.src = "https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(CFG.gtmId);
      document.head.appendChild(s);
    }
    if (CFG.metaPixelId) {
      /* eslint-disable */
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      /* eslint-enable */
      window.fbq("init", CFG.metaPixelId); window.fbq("track", "PageView");
    }
  })();
  function track(event, props) {
    const data = Object.assign({ event: "el_" + event, quiz_id: S.id }, props || {});
    window.dataLayer.push(data);
    if (window.fbq) { try { window.fbq("trackCustom", "EL_" + event, props || {}); } catch (e) { /* ok */ } }
  }

  // ───────── helpers de UI ─────────
  const logo = () => `<img class="logo" src="${LOGO}" alt="Elevar Commerce" />`;
  function shell(inner, opts) {
    opts = opts || {};
    const progress = opts.step ? `<div class="progress" aria-hidden="true">${STEPS.map((_, i) => `<i class="${i < opts.step ? "on" : ""}"></i>`).join("")}</div>` : "";
    const back = "";
    app.innerHTML = `<div class="screen ${opts.sticky ? "" : "no-sticky"}"><div class="wrap ${opts.wide ? "wrap-wide" : ""} ${opts.hero ? "wrap-hero" : ""}">
      <header><div class="topbar">${logo()}${back}</div>${progress}</header>${inner}</div></div>`;
    window.scrollTo(0, 0);
  }
  const go = h => { if (location.hash === h) route(); else location.hash = h; };
  const icon = {
    wa: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 3.5A11.9 11.9 0 0 0 12 0 12 12 0 0 0 1.7 17.9L0 24l6.3-1.6A12 12 0 0 0 12 24a12 12 0 0 0 8.5-20.5zM12 22a10 10 0 0 1-5.1-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A10 10 0 1 1 12 22zm5.5-7.5c-.3-.2-1.8-.9-2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7 0a8.2 8.2 0 0 1-4-3.5c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-.9-2.1c-.2-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4A3.7 3.7 0 0 0 6 9.5a6.4 6.4 0 0 0 1.3 3.4 14.7 14.7 0 0 0 5.6 4.9c2 .8 2.4.7 2.9.6a2.5 2.5 0 0 0 1.7-1.2 2 2 0 0 0 .1-1.2c-.1-.1-.3-.2-.6-.4z"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`
  };

  // ───────── rotas ─────────
  function route() {
    clearTimeout(timer); clearInterval(rotTimer);
    const h = location.hash.replace(/^#\/?/, "");
    if (!h) return renderIntro();
    if (h.startsWith("p/")) {
      const q = h.slice(2);
      if (!STEPS.includes(q)) return go("#/");
      const miss = firstMissing(q);
      if (miss) return go("#/p/" + miss);
      return q === "contato" ? renderContato() : renderQuestion(q);
    }
    if (h === "analisando") return S.leadSent ? renderAnalisando() : go("#/p/contato");
    if (h === "resultado") return S.leadSent ? renderResultado() : go("#/p/contato");
    go("#/");
  }
  window.addEventListener("hashchange", route);
  const answered = q => { const v = S.answers[q]; return q === "gaps" ? Array.isArray(v) && v.length > 0 : !!v && (q !== "erp" || v !== "outro" || (S.answers.erpOutro || "").trim().length >= 2); };
  function firstMissing(upTo) {
    for (const q of STEPS) { if (q === upTo) return null; if (!answered(q)) return q; }
    return null;
  }
  const nextOf = q => STEPS[STEPS.indexOf(q) + 1];
  const prevHash = q => (STEPS.indexOf(q) === 0 ? "#/" : "#/p/" + STEPS[STEPS.indexOf(q) - 1]);

  // ───────── intro ─────────
  function renderIntro() {
    track("page_view");
    shell(`<main class="intro fade">
      <span class="eyebrow live"><i class="pulse"></i><span class="rot" id="rot">Diagnóstico gratuito para farmácias</span></span>
      <h1>Descubra onde sua farmácia está <span class="hl">perdendo vendas</span></h1>
      <p class="lead">Em 2 minutos, você vê onde clientes desistem por demora no atendimento, o que falta para vender mais pelo WhatsApp e pelo site e por onde começar a recuperar venda.</p>
      <button class="btn" id="start" type="button">Começar meu diagnóstico</button>
      <div class="stats">
        <div><b>+1.020</b><span>canais digitais implantados</span></div>
        <div><b>+25%</b><span>aumento de faturamento</span></div>
        <div><b>+32%</b><span>aumento de clientes</span></div>
        <div><b>+21%</b><span>aumento de conversão</span></div>
      </div>
      <p class="stats-note">Resultados de clientes Elevar. Variam conforme a operação.</p>
    </main>`, { hero: true });
    startRotator("rot", BANNER);
    $("start").onclick = () => {
      if (!S.started) { S.started = true; save(); track("wizard_start"); }
      go("#/p/faturamento");
    };
  }

  // Faixa dinâmica (intro e resultado): alterna mensagens a cada ~3s (parada se o usuário prefere menos movimento)
  const BANNER = ["Diagnóstico gratuito para farmácias", "Leva menos de 2 minutos", "Integra com os principais ERPs", "Resultado na hora, sem compromisso"];
  function startRotator(id, items) {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0;
    clearInterval(rotTimer);
    rotTimer = setInterval(() => {
      const el = $(id); if (!el) return clearInterval(rotTimer);
      el.classList.add("out");
      setTimeout(() => { i = (i + 1) % items.length; el.innerHTML = items[i]; el.classList.remove("out"); }, 280);
    }, 3200);
  }

  // ───────── perguntas ─────────
  function renderQuestion(qid) {
    const q = E.Q[qid], idx = STEPS.indexOf(qid) + 1;
    const cur = S.answers[qid];
    const opts = q.options.map(o => {
      const sel = q.multi ? (cur || []).includes(o.id) : cur === o.id;
      return `<button type="button" class="opt ${q.multi ? "multi" : ""} ${sel ? "sel" : ""}" data-v="${o.id}" aria-pressed="${sel}"><span class="dot"></span><span>${esc(o.label)}</span></button>`;
    }).join("");
    const outro = qid === "erp" ? `<div class="outro-box" id="outro" ${cur === "outro" ? "" : "hidden"}>
        <label class="small muted" for="erpOutro" style="display:block;margin-bottom:6px">Qual ERP?</label>
        <input class="input" id="erpOutro" maxlength="60" placeholder="Digite o nome do seu ERP" autocomplete="off" value="${esc(S.answers.erpOutro || "")}" /></div>` : "";
    const needBtn = true;
    shell(`<main class="q fade">
      <div class="step">Pergunta ${idx} de 4</div>
      <h2>${esc(q.title)}</h2>${q.helper ? `<p class="helper">${esc(q.helper)}</p>` : ""}
      <div class="opts">${opts}</div>${outro}
    </main>
    <div class="sticky"><div class="wrap"><div class="nav"><button class="btn ghost" id="back" type="button">Voltar</button><button class="btn" id="next" type="button" disabled>Continuar</button></div></div></div>`,
      { step: idx, sticky: true });

    const next = $("next");
    $("back").onclick = () => go(prevHash(qid));
    const refresh = () => { if (next) next.disabled = !answered(qid); };
    const advance = () => { track("step_completed", { step: qid, answer: JSON.stringify(S.answers[qid]) }); go("#/p/" + nextOf(qid)); };
    refresh();

    app.querySelectorAll(".opt").forEach(b => {
      b.onclick = () => {
        const v = b.dataset.v;
        if (q.multi) {
          let arr = (S.answers[qid] || []).slice();
          const ex = q.options.find(o => o.id === v).exclusive;
          if (ex) arr = arr.includes(v) ? [] : [v];
          else { arr = arr.filter(x => x !== "nenhum"); arr = arr.includes(v) ? arr.filter(x => x !== v) : arr.concat(v); }
          S.answers[qid] = arr;
          app.querySelectorAll(".opt").forEach(x => { const s = arr.includes(x.dataset.v); x.classList.toggle("sel", s); x.setAttribute("aria-pressed", s); });
          save(); refresh();
        } else {
          S.answers[qid] = v;
          app.querySelectorAll(".opt").forEach(x => { x.classList.toggle("sel", x === b); x.setAttribute("aria-pressed", x === b); });
          save();
          if (qid === "erp") {
            const box = $("outro");
            if (v === "outro") { box.hidden = false; $("erpOutro").focus(); refresh(); return; }
            box.hidden = true; delete S.answers.erpOutro; save();
          }
          refresh();
        }
      };
    });
    if (qid === "erp") $("erpOutro").oninput = e => { S.answers.erpOutro = e.target.value; save(); refresh(); };
    if (next) next.onclick = advance;
  }

  // ───────── contato ─────────
  function cnpjValido(c) {
    c = (c || "").replace(/\D/g, "");
    if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
    const calc = n => { let s = 0, p = n - 7; for (let i = 0; i < n; i++) { s += +c[i] * p--; if (p < 2) p = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
    return calc(12) === +c[12] && calc(13) === +c[13];
  }
  const maskCnpj = v => v.replace(/\D/g, "").slice(0, 14).replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
  const maskTel = v => { const d = v.replace(/\D/g, "").slice(0, 11); return d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d; };
  const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  const ACENTOS = [[/\bFarmacia(s?)\b/g, "Farmácia$1"], [/\bSaude\b/g, "Saúde"], [/\bSao\b/g, "São"], [/\bJoao\b/g, "João"], [/\bManipulacao\b/g, "Manipulação"],
    [/\bBrasilia\b/g, "Brasília"], [/\bGoiania\b/g, "Goiânia"], [/\bBelem\b/g, "Belém"], [/\bMaceio\b/g, "Maceió"], [/\bVitoria\b/g, "Vitória"],
    [/\bCuiaba\b/g, "Cuiabá"], [/\bUberlandia\b/g, "Uberlândia"], [/\bAguas\b/g, "Águas"]];
  function titleCase(s) {
    const low = ["de", "da", "do", "das", "dos", "e"];
    let out = String(s || "").toLowerCase().replace(/\b(ltda|eireli|s\/a|sa|me|epp|mei)\b\.?/g, "").replace(/\s+/g, " ").trim()
      .split(" ").map((w, i) => (i > 0 && low.includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
    ACENTOS.forEach(([r, t]) => { out = out.replace(r, t); });
    return out;
  }
  const nomeFarmacia = () => {
    const i = S.cnpjInfo;
    return titleCase((i && (i.fantasia || i.razao)) || "") || "minha farmácia";
  };
  function normCnpj(j) {
    return { razao: j.razao_social || "", fantasia: j.nome_fantasia || "", uf: j.uf || "", cidade: j.municipio || "", cnae: j.cnae_fiscal, cnaeDesc: j.cnae_fiscal_descricao || "",
      porte: j.porte || j.descricao_porte || "", situacao: j.descricao_situacao_cadastral || "", capital: j.capital_social, abertura: j.data_inicio_atividade || "" };
  }
  function lookupCnpj(d) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 7000);
    return fetch("https://brasilapi.com.br/api/cnpj/v1/" + d, { signal: ctl.signal })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status))).then(normCnpj).finally(() => clearTimeout(t));
  }

  function renderContato() {
    const c = S.contato;
    shell(`<main class="q fade">
      <div class="step">Último passo</div>
      <h2>Para onde enviamos o seu diagnóstico?</h2>
      <p class="helper">Seu diagnóstico fica pronto logo em seguida.</p>
      <form id="f" novalidate>
        <div class="field"><label for="cnpj">CNPJ da farmácia</label><input class="input" id="cnpj" inputmode="numeric" autocomplete="off" placeholder="00.000.000/0000-00" value="${esc(c.cnpj)}" /><span class="hint" id="h-cnpj"></span></div>
        <div class="field"><label for="nome">Seu nome</label><input class="input" id="nome" autocomplete="name" placeholder="Nome e sobrenome" value="${esc(c.nome)}" /><span class="hint" id="h-nome"></span></div>
        <div class="field"><label for="whatsapp">WhatsApp</label><input class="input" id="whatsapp" type="tel" inputmode="tel" autocomplete="tel" placeholder="(00) 00000-0000" value="${esc(c.whatsapp)}" /><span class="hint" id="h-whatsapp"></span></div>
        <div class="field"><label for="email">E-mail</label><input class="input" id="email" type="email" autocomplete="email" placeholder="voce@farmacia.com.br" value="${esc(c.email)}" /><span class="hint" id="h-email"></span></div>
        <label class="check"><input type="checkbox" id="lgpd" ${c.lgpd ? "checked" : ""} /><span class="box"></span><span>Concordo em receber contato da Elevar e com o uso dos meus dados para gerar o diagnóstico.</span></label>
        <span class="hint bad" id="h-lgpd"></span>
      </form>
    </main>
    <div class="sticky"><div class="wrap"><div class="nav"><button class="btn ghost" id="back" type="button">Voltar</button><button class="btn" id="send" type="button">Ver meu diagnóstico</button></div></div></div>`,
      { step: 5, sticky: true });

    $("back").onclick = () => go("#/p/gaps");
    const hint = (id, msg, cls) => { const h = $("h-" + id); h.textContent = msg || ""; h.className = "hint" + (cls ? " " + cls : ""); };
    let lastCnpj = "";
    const runLookup = () => {
      const d = $("cnpj").value.replace(/\D/g, "");
      if (d.length < 14) { S.cnpjInfo = null; lookupP = null; hint("cnpj", ""); return; }
      if (!cnpjValido(d)) { S.cnpjInfo = null; hint("cnpj", "CNPJ inválido", "bad"); return; }
      if (d === lastCnpj) return;
      lastCnpj = d; hint("cnpj", "Consultando CNPJ…");
      lookupP = lookupCnpj(d).then(info => {
        S.cnpjInfo = info; save();
        const nome = titleCase(info.fantasia || info.razao);
        hint("cnpj", nome ? "✓ " + nome : "CNPJ válido", "ok");
        track("cnpj_lookup", { found: true, uf: info.uf || null });
        return info;
      }).catch(() => { S.cnpjInfo = null; hint("cnpj", "CNPJ válido", "ok"); track("cnpj_lookup", { found: false }); return null; });
    };
    $("cnpj").oninput = e => { e.target.value = maskCnpj(e.target.value); e.target.classList.remove("err"); runLookup(); };
    $("whatsapp").oninput = e => { e.target.value = maskTel(e.target.value); e.target.classList.remove("err"); };
    ["nome", "email"].forEach(id => { $(id).oninput = e => e.target.classList.remove("err"); });
    runLookup();

    $("send").onclick = async () => {
      const v = { cnpj: $("cnpj").value.trim(), nome: $("nome").value.trim(), whatsapp: $("whatsapp").value.trim(), email: $("email").value.trim(), lgpd: $("lgpd").checked };
      const errs = {
        cnpj: !cnpjValido(v.cnpj) ? "Informe um CNPJ válido" : "",
        nome: v.nome.replace(/\s/g, "").length < 3 ? "Informe seu nome" : "",
        whatsapp: v.whatsapp.replace(/\D/g, "").length < 10 ? "Informe um WhatsApp com DDD" : "",
        email: !emailOk(v.email) ? "Informe um e-mail válido" : "",
        lgpd: !v.lgpd ? "É preciso concordar para continuar" : ""
      };
      Object.keys(errs).forEach(k => { hint(k, errs[k], errs[k] ? "bad" : ""); if (k !== "lgpd" && $(k)) $(k).classList.toggle("err", !!errs[k]); });
      if (k0(errs)) { const first = Object.keys(errs).find(k => errs[k]); if ($(first)) $(first).focus(); return; }
      S.contato = v; save();
      const btn = $("send"); btn.disabled = true; btn.textContent = "Gerando diagnóstico…";
      if (lookupP) { try { await Promise.race([lookupP, new Promise(r => setTimeout(r, 3500))]); } catch (e) { /* segue sem consulta */ } }
      S.leadSent = true; save();
      sendLead();
      go("#/analisando");
    };
  }
  const k0 = o => Object.values(o).some(Boolean);

  // ───────── lead (webhook) ─────────
  function buildLead() {
    const a = S.answers, i = S.cnpjInfo || {}, r = E.resultado(a, S.cnpjInfo);
    return {
      lead_id: S.id, timestamp: new Date().toISOString(),
      contato: { nome: S.contato.nome, whatsapp: S.contato.whatsapp, email: S.contato.email, cnpj: S.contato.cnpj, consentimento: !!S.contato.lgpd },
      cnpj: { razao_social: i.razao || "", nome_fantasia: i.fantasia || "", uf: i.uf || "", cidade: i.cidade || "", cnae: i.cnae || "", cnae_descricao: i.cnaeDesc || "", porte: i.porte || "", situacao: i.situacao || "", capital_social: i.capital || "", abertura: i.abertura || "" },
      respostas: { faturamento: a.faturamento, erp: a.erp === "outro" ? "outro: " + (a.erpOutro || "") : a.erp, erp_integrado: E.erpStatus(a.erp), atendimento: a.atendimento, ja_tem: a.gaps },
      diagnostico: { classe: r.classe, indice: r.d.indice, faixa: r.d.banda.id, frentes: r.d.frentes.map(f => f.id), areas: r.d.areas.reduce((o, x) => { o[x.id] = x.valor; return o; }, {}) },
      comercial: { pacote_sugerido: r.d.pacoteTexto, pacote: r.d.pacote, observacoes: r.d.avisos, frentes_prioritarias: r.d.frentes.slice(0, 3).map(f => f.nome) },
      flags: r.flags, utm: S.utm
    };
  }
  function sendLead() {
    const lead = buildLead();
    track("lead_submitted", { classe: lead.diagnostico.classe });
    if (!CFG.webhookUrl) { console.info("[Elevar quiz] webhookUrl vazio. Lead que seria enviado:", lead); return; }
    try { fetch(CFG.webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead), keepalive: true }).catch(() => {}); } catch (e) { /* ok */ }
  }

  // ───────── analisando (~3s) ─────────
  function renderAnalisando() {
    const a = S.answers;
    const fat = E.Q.faturamento.options.find(o => o.id === a.faturamento);
    const erp = a.erp === "outro" ? (a.erpOutro || "Outro") : E.optLabel("erp", a.erp);
    const at = E.Q.atendimento.options.find(o => o.id === a.atendimento);
    const rows = [["Faturamento", fat ? fat.label : "-"], ["Sistema", erp], ["Atendimento", at ? at.label : "-"], ["Diagnóstico", "Montando suas oportunidades"]];
    shell(`<main class="loading2 fade"><span class="eyebrow">Analisando</span><h2>Montando seu diagnóstico</h2>
      <div class="lbar"><i id="lfill"></i></div>
      <ul class="lsteps">${rows.map((r, i) => `<li id="ls${i}"><span class="ls-dot"></span><span class="ls-t"><small>${r[0]}</small><b>${esc(r[1])}</b></span></li>`).join("")}</ul></main>`, { step: 5 });
    let i = 0; const total = rows.length, per = 600;
    const run = () => {
      const li = $("ls" + i); if (!li) return;
      li.classList.add("on");
      $("lfill").style.width = Math.round((i + .5) / total * 100) + "%";
      timer = setTimeout(() => {
        li.classList.remove("on"); li.classList.add("done");
        $("lfill").style.width = Math.round((i + 1) / total * 100) + "%";
        i++;
        if (i < total) run(); else timer = setTimeout(() => go("#/resultado"), 250);
      }, per);
    };
    timer = setTimeout(run, 150);
  }

  // ───────── resultado ─────────
  const ICONS = {
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    box: '<path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"/>',
    zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
    site: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    bot: '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 8V4M9 13h.01M15 13h.01M9 16.5h6"/>',
    repeat: '<path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    truck: '<rect x="1" y="6" width="13" height="10"/><path d="M14 10h4l3 3v3h-7"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>'
  };
  const ic = (k, cls) => `<svg class="ic ${cls || ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ICONS.chat}</svg>`;
  // Medidor em 4 faixas (vermelho, âmbar, azul, verde-limão) com ponteiro, como o da Somos, nas cores da Elevar.
  function gauge(v) {
    const cx = 110, cy = 112, R = 82;
    const pt = ang => [cx + R * Math.cos(ang * Math.PI / 180), cy + R * Math.sin(ang * Math.PI / 180)];
    const zones = [[0, 40, "low"], [40, 60, "mid"], [60, 80, "blue"], [80, 100, "good"]];
    const arcs = zones.map(([a, b, c]) => {
      const p0 = pt(180 + a * 1.8 + 2.5), p1 = pt(180 + b * 1.8 - 2.5);
      const on = v >= a && (v < b || b === 100);
      return `<path class="zone ${c} ${on ? "on" : ""}" d="M${p0[0].toFixed(1)} ${p0[1].toFixed(1)} A${R} ${R} 0 0 1 ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}"/>`;
    }).join("");
    return `<svg viewBox="0 0 220 128" class="gauge" role="img" aria-label="Índice de preparo para vender online">${arcs}<g id="needle"><polygon points="${cx},${cy - 3.5} ${cx + 64},${cy} ${cx},${cy + 3.5}" fill="#fff"/></g><circle cx="${cx}" cy="${cy}" r="7" class="hub"/></svg>`;
  }
  const notaCls = n => (n === "A+" ? "ap" : n === "A" ? "a" : "b");
  const barCls = v => (v >= 70 ? "good" : v >= 40 ? "mid" : "low");
  const waUrl = msg => "https://wa.me/" + (CFG.whatsapp || "") + "?text=" + encodeURIComponent(msg);
  const dly = x => `style="--d:${x}s" data-delay="${Math.round(x * 1000)}"`;

  function renderResultado() {
    const a = S.answers, R = E.resultado(a, S.cnpjInfo), d = R.d;
    track("result_view", { classe: R.classe, indice: d.indice });
    const nome = nomeFarmacia(), info = S.cnpjInfo || {};
    const primeiro = (S.contato.nome || "").split(" ")[0];

    if (R.classe === "DESQ") {
      shell(`<main class="fade"><div class="desq">
        <span class="eyebrow">Diagnóstico${primeiro ? " · " + esc(primeiro) : ""}</span>
        <h1>A Elevar não é a solução ideal para o seu negócio agora.</h1>
        <p>Nossa plataforma é feita para <b>farmácias</b>: ligamos o estoque do sistema ao WhatsApp, à loja online e ao atendimento automático.</p>
        <p>${info.cnaeDesc ? "O CNPJ informado está registrado como “" + esc(info.cnaeDesc) + "”, fora do perfil de farmácia." : "Pelas informações do CNPJ, o negócio está fora do perfil de farmácia."} Por isso, não conseguimos montar um diagnóstico que faça sentido para você.</p>
        <p class="muted small">Se o CNPJ informado não for o da farmácia, volte e refaça o diagnóstico com o CNPJ correto.</p>
        <div style="display:grid;gap:10px;margin-top:18px"><a class="btn ghost" href="${esc(CFG.siteUrl || "#")}" target="_blank" rel="noopener">Conhecer a Elevar</a><button class="btn ghost" id="redo" type="button">Refazer com outro CNPJ</button></div>
      </div></main>`);
      $("redo").onclick = () => { S.leadSent = false; S.cnpjInfo = null; S.contato.cnpj = ""; save(); go("#/p/contato"); };
      return;
    }

    const wa = waUrl(E.mensagemWhatsApp(a, nome, d));
    const ctaLabel = R.cta === "especialista" ? "Falar com um especialista" : "Receber minha análise no WhatsApp";
    const top = d.frentes.slice(0, 3), rest = d.frentes.slice(3);
    const temNome = nome !== "minha farmácia";
    const quem = temNome ? `<span class="who">${esc(nome)}</span>` : `Sua <span class="who">farmácia</span>`;

    // tempos de entrada (s)
    let t = 0.55;
    const areasHtml = d.areas.map(x => { const h = `<div class="area rv" ${dly(t)}><span class="a-ic">${ic(x.icon)}</span><div class="a-main"><div class="a-top"><span>${esc(x.nome)}</span><b data-count="${x.valor}" data-suffix="%" data-delay="${Math.round(t * 1000) + 150}">0%</b></div><div class="bar"><i class="${barCls(x.valor)}" data-w="${x.valor}" data-delay="${Math.round(t * 1000) + 150}"></i></div></div></div>`; t += 0.08; return h; }).join("");
    const resT = t + 0.05, cmpT = resT + 0.3, opT = cmpT + 0.55; const secT = opT; t = opT + 0.2;
    const topHtml = top.map(f => { const h = `<div class="front2 rv" ${dly(t)}><div class="f-head"><span class="f-ic">${ic(f.icon)}</span><span class="nota ${notaCls(f.nota)}">${f.nota}</span></div><h3>${esc(f.nome)}</h3>${f.stat ? `<div class="f-stat"><b>${esc(f.stat.n)}</b><span>${esc(f.stat.t)}</span></div>` : ""}<p>${esc(f.curto)}</p>${f.hoje ? `<div class="f-hoje"><small>Hoje</small><span>${esc(f.hoje)}</span></div>` : ""}<details class="f-aj"><summary><span>O que ajustar</span><i class="chev"></i></summary><ul>${f.ajustes.map(x => `<li>${esc(x)}</li>`).join("")}</ul></details></div>`; t += 0.12; return h; }).join("");
    const ctaT = t + 0.05;

    const cmp = d.comparativo;
    const cmpHtml = cmp.length ? `<section class="sec"><h2 class="rv" ${dly(cmpT)}>O preço de não mudar</h2>
      <div class="vs">
        <div class="vs-card no rv" ${dly(cmpT + 0.1)}><span class="chip2 no">Se nada mudar</span>
          ${cmp.map(r => `<div class="vs-row"><span class="vs-ic">✕</span><div><small>${esc(r.nome)}</small><b>${esc(r.hoje)}</b></div></div>`).join("")}
          <div class="vs-sum"><small>Deixado na mesa</small><div class="vs-big"><b>${cmp.length}</b><span>${cmp.length === 1 ? "ponto em aberto" : "pontos em aberto"}</span></div></div></div>
        <div class="vs-card yes rv" ${dly(cmpT + 0.3)}><span class="chip2 yes">★ Com a Elevar</span>
          ${cmp.map(r => `<div class="vs-row"><span class="vs-ic">✓</span><div><small>${esc(r.nome)}</small><b>${esc(r.com)}</b></div></div>`).join("")}
          <div class="vs-sum"><small>Potencial com a Elevar</small><div class="vs-big"><b>+${cmp.length}</b><span>${cmp.length === 1 ? "ponto atendido" : "pontos atendidos"}</span></div></div></div>
      </div></section>` : "";

    const resumoHtml = `<section class="resumo rv" ${dly(resT)}>
      <span class="eyebrow">Em resumo</span>
      <h2>Identificamos que ${temNome ? `<span class="who">${esc(nome)}</span>` : "sua farmácia"} pode:</h2>
      <ul class="rs-list">${top.map(f => `<li><span class="f-ic">${ic(f.icon)}</span><span><b>${esc(f.resumo.b)}</b> ${esc(f.resumo.r)}</span></li>`).join("")}</ul>
      <p class="rs-note">No WhatsApp, a Elevar mostra como cada ponto funciona na sua farmácia.</p>
    </section>`;

    shell(`<main>
      <section class="r-hero rv" ${dly(0)}>
        <span class="eyebrow live"><i class="pulse"></i><span class="rot" id="rrot">${primeiro ? `Diagnóstico de <b>${esc(primeiro)}</b>` : "Diagnóstico <b>pronto</b>"}</span></span>
        <h1>${quem} está deixando vendas na mesa.</h1>
      </section>

      <section class="gauge-card rv" ${dly(0.15)}><span class="k">Preparo para vender online</span>${gauge(d.indice)}
        <div class="g-num"><span id="gnum" data-count="${d.indice}" data-delay="300">0</span><small>/100</small></div>
        <span class="band ${d.banda.tone}">${esc(d.banda.label)}</span>
        <p class="g-note">Quanto menor o índice, mais vendas a sua farmácia deixa de fazer no WhatsApp e na loja online.</p></section>

      <div class="cta-inline rv" ${dly(0.35)}><a class="btn" href="${wa}" target="_blank" rel="noopener" data-cta="indice">${icon.wa} ${ctaLabel}</a></div>

      <section class="sec"><h2 class="rv" ${dly(0.5)}>Sua farmácia por área</h2><div class="areas">${areasHtml}</div></section>

      ${resumoHtml}

      ${cmpHtml}

      <section class="sec"><h2 class="rv" ${dly(secT)}>Maiores oportunidades</h2>
        ${topHtml}
      </section>

      <section class="cta-card rv" ${dly(ctaT)}><h2>Quer ver isso funcionando na sua farmácia?</h2>
        <a class="btn" href="${wa}" target="_blank" rel="noopener" data-cta="card">${icon.wa} ${ctaLabel}</a></section>

    </main>`,
      { wide: true });

    app.querySelectorAll("[data-cta]").forEach(el => el.addEventListener("click", () => track("cta_click", { where: el.dataset.cta, classe: R.classe })));
    animateResult(d);
  }

  function animateResult(d) {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const countTo = (el, target, dur, suffix) => {
      if (reduce) { el.textContent = target + (suffix || ""); return; }
      const t0 = performance.now();
      const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(target * e) + (suffix || ""); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    };
    app.querySelectorAll("[data-count]").forEach(el => setTimeout(() => countTo(el, +el.dataset.count, 1100, el.dataset.suffix), reduce ? 0 : +el.dataset.delay || 0));
    app.querySelectorAll(".bar i[data-w]").forEach(el => setTimeout(() => { el.style.width = el.dataset.w + "%"; }, reduce ? 0 : +el.dataset.delay || 0));
    const nd = $("needle");
    setTimeout(() => { if (nd) nd.style.transform = "rotate(" + (d.indice * 1.8 - 180) + "deg)"; }, reduce ? 0 : 300);
  }

  route();
})();
