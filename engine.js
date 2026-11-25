// Motor do Diagnóstico Elevar — perguntas, classe do lead, frentes, índice e mensagem do WhatsApp.
// Sem interface; roda no navegador e no Node (para teste).
(function (root) {
  "use strict";

  // ───────────────────────── Perguntas ─────────────────────────
  const Q = {
    faturamento: {
      id: "faturamento", step: 1,
      title: "Qual o faturamento mensal da farmácia?",
      options: [
        { id: "ate50", label: "Até R$ 50 mil por mês", msg: "até R$ 50 mil/mês" },
        { id: "50a100", label: "R$ 50 a 100 mil por mês", msg: "R$ 50 a 100 mil/mês" },
        { id: "100a200", label: "R$ 100 a 200 mil por mês", msg: "R$ 100 a 200 mil/mês" },
        { id: "200a500", label: "R$ 200 a 500 mil por mês", msg: "R$ 200 a 500 mil/mês" },
        { id: "acima500", label: "Mais de R$ 500 mil por mês", msg: "mais de R$ 500 mil/mês" }
      ]
    },
    erp: {
      id: "erp", step: 2,
      title: "Qual sistema a farmácia usa?",
      options: [
        { id: "alpha7", label: "Alpha7" },
        { id: "inova", label: "Inova Farma" },
        { id: "trier", label: "Trier" },
        { id: "digifarma", label: "Digifarma" },
        { id: "linxbig", label: "Linx Big" },
        { id: "outro", label: "Outro" }
      ]
    },
    sistema: {
      id: "sistema",
      title: "Já usou algum sistema para organizar o WhatsApp?",
      options: [
        { id: "unico_contato", label: "Único Contato" },
        { id: "suri", label: "Suri" },
        { id: "pedbot", label: "Pedbot" },
        { id: "nunca", label: "Nunca utilizei" },
        { id: "outro", label: "Outro" }
      ]
    },
    atendimento: {
      id: "atendimento", step: 3,
      title: "Como é o atendimento no WhatsApp hoje?",
      options: [
        { id: "nao_vende", label: "Não vendo pelo WhatsApp", msg: "ainda não vende pelo WhatsApp" },
        { id: "balcao", label: "Tenho atendente, mas ele atende o balcão e o WhatsApp", msg: "tem atendente, mas ele atende o balcão e o WhatsApp" },
        { id: "equipe", label: "Tenho vários atendentes no balcão e no WhatsApp, e todos os orçamentos são manuais", msg: "tem vários atendentes no balcão e no WhatsApp, com orçamentos manuais" },
        { id: "atendente", label: "Tenho atendente, mas o volume de orçamentos é alto e às vezes o cliente fica sem resposta", msg: "tem atendente, mas o volume de orçamentos é alto e às vezes o cliente fica sem resposta" },
        { id: "equipe_wa", label: "Tenho uma equipe só para o WhatsApp, com vários atendentes", msg: "tem equipe só para o WhatsApp, com vários atendentes" },
        { id: "atendente_ok", label: "Tenho atendente só para o WhatsApp e as mensagens são respondidas a tempo", msg: "tem atendente só para o WhatsApp e responde a tempo" }
      ]
    },
    gaps: {
      id: "gaps", step: 4, multi: true,
      title: "O que a farmácia já tem hoje?",
      helper: "Marque todos que se aplicam.",
      options: [
        { id: "site", label: "Site onde o cliente compra" },
        { id: "recompra", label: "Mensagem para o cliente voltar a comprar" },
        { id: "metricas", label: "Saber quanto cada atendente vende" },
        { id: "status", label: "Cliente acompanha a entrega pelo WhatsApp" },
        { id: "nenhum", label: "Nenhum desses", exclusive: true }
      ]
    }
  };

  const STEPS = ["erp", "atendimento", "sistema", "gaps", "faturamento", "contato"];

  // ERPs com integração (proposta e calls). Linx Big: via banco de dados, API em desenvolvimento.
  const ERP_INTEGRADOS = ["alpha7", "inova", "trier", "digifarma"];
  const ERP_PARCIAL = ["linxbig"];
  // CNAE de farmácia: 4771-7/01, /02, /03. Qualquer outro (incl. veterinário /04) é desqualificado.
  const CNAE_FARMACIA = [4771701, 4771702, 4771703];

  const optLabel = (qid, v) => { const o = Q[qid].options.find(x => x.id === v); return o ? o.label : v; };

  function erpStatus(erp) {
    if (ERP_INTEGRADOS.includes(erp)) return "integrado";
    if (ERP_PARCIAL.includes(erp)) return "parcial";
    return "nao_integrado";
  }

  // ───────────────────────── Classe do lead ─────────────────────────
  // farmacia: true | false | null (CNPJ não consultado → não desqualifica)
  function classe(fat, farmacia) {
    if (farmacia === false) return "DESQ";
    return { acima500: "A", "200a500": "B", "100a200": "C", "50a100": "D", ate50: "E" }[fat] || "E";
  }

  function isFarmacia(info) {
    if (!info || info.cnae == null) return null;
    return CNAE_FARMACIA.includes(Number(info.cnae));
  }

  // Porte do CNPJ x faturamento declarado (ME até ~R$ 30 mil/mês; EPP até ~R$ 400 mil/mês)
  function divergePorte(info, fat) {
    if (!info || !info.porte) return false;
    const p = String(info.porte).toUpperCase();
    if (/MICRO/.test(p)) return ["50a100", "100a200", "200a500", "acima500"].includes(fat);
    if (/PEQUENO/.test(p)) return fat === "acima500";
    return false;
  }

  // ───────────────────────── Frentes ─────────────────────────
  const NOTA_RANK = { "A+": 0, A: 1, B: 2 };
  const manual = a => ["balcao", "atendente_ok", "atendente", "equipe", "equipe_wa"].includes(a.atendimento);
  // item "não marcado" = lacuna (se marcou "nenhum", todos são lacuna)
  const lacuna = (a, item) => !(a.gaps || []).includes(item);

  // Fontes: todas as estatísticas e casos vêm da proposta comercial da Elevar (2026). Os casos não trazem o nome do cliente.
  const SRC_DADOS = "Fonte: proposta comercial da Elevar (2026)";
  const SRC_CASO = "Caso real de cliente Elevar (proposta comercial 2026)";
  const CASOS = {
    chat: { n: "1 → 5 vendas por dia", t: "com um único vendedor no WhatsApp: de 12 para 20 atendimentos por dia e de 8% para 25% de conversão.", src: SRC_CASO },
    site: { n: "1,5 → 22 vendas por dia", t: "no site, com campanhas e loja ligada ao estoque: os carrinhos foram de 0,95% para 4,45% dos acessos.", src: SRC_CASO }
  };

  // Dado exibido logo abaixo das alternativas, conforme o que o lead marca (não muda o diagnóstico)
  // Destaque exibido ao marcar a alternativa: seta + número (↑ ganho, ↓ perda) e uma frase curta. Não muda o diagnóstico.
  // Fontes: proposta comercial da Elevar (+32% clientes e +25% faturamento são os números gerais da Elevar;
  // 22%, 30% e 73% são as estatísticas da página "causas de perda de vendas"; +67% e 5x vêm do caso do Chat Commerce: 12→20 atendimentos e 1→5 vendas por dia).
  function insight(qid, a) {
    const v = a[qid];
    if (qid === "atendimento") return ({
      nao_vende: { tone: "up", n: "↑ 32%", t: "mais clientes, em média, para quem vende com a Elevar. Abrir o WhatsApp é o primeiro passo." },
      balcao: { tone: "down", n: "↓ 22%", t: "na conversão quando o atendimento demora. Separando o WhatsApp do balcão com a Elevar, você evita essa perda." },
      equipe: { tone: "down", n: "↓ 30%", t: "do custo vai embora com tarefas manuais. Automatizando orçamento e pedido com a Elevar, você reduz esse desperdício." },
      atendente: { tone: "down", n: "↓ 73%", t: "dos clientes desistem quando a resposta demora. Respondendo na hora com a Elevar, você segura essas vendas." },
      equipe_wa: { tone: "up", n: "↑ 67%", t: "mais atendimentos por vendedor num caso real com a Elevar, com a fila organizada." },
      atendente_ok: { tone: "up", n: "↑ 5x", t: "mais vendas por dia com o mesmo vendedor, num caso real com a Elevar." }
    })[v] || null;
    if (qid === "gaps") {
      const g = v || [];
      if (g.includes("nenhum")) return { tone: "up", n: "↑ 25%", t: "de faturamento, em média, para quem vende com a Elevar. Loja online e WhatsApp abrem mais portas de venda." };
      return null;
    }
    return null;
  }

  const FRENTES = [
    { id: "resposta", icon: "clock", nome: "Resposta rápida",
      curto: "Fila e distribuição para ninguém ficar sem resposta.",
      stat: { n: "73%", t: "dos clientes desistem da compra quando o atendimento demora", src: SRC_DADOS },
      on: a => manual(a), nota: a => ({ atendente: "A+", equipe_wa: "A+", equipe: "A", balcao: "A" }[a.atendimento] || "B") },
    { id: "chat_erp", icon: "chat", nome: "Venda no WhatsApp",
      curto: "Preço, foto e estoque do seu sistema direto na conversa.",
      stat: { n: "8% → 25%", t: "dos atendimentos no WhatsApp viraram venda, com o mesmo vendedor", src: SRC_CASO, caso: true },
      on: () => true, nota: () => "A+" },
    { id: "estoque", icon: "box", nome: "Estoque real na venda",
      curto: "O atendente vê o que a loja tem, sem sair da conversa.",
      stat: { n: "40%", t: "das vendas perdidas acontecem por falta do produto em estoque", src: SRC_DADOS },
      on: () => true, nota: () => "A" },
    { id: "manual", icon: "zap", nome: "Menos trabalho manual",
      curto: "Pedido, pagamento e entrega sem digitar tudo de novo.",
      stat: { n: "30%", t: "do custo é invisível: tempo da equipe gasto com tarefas manuais", src: SRC_DADOS },
      on: a => manual(a), nota: a => (a.atendimento === "equipe" ? "A+" : a.atendimento === "atendente_ok" ? "B" : "A") },
    { id: "site", icon: "site", nome: "Loja online",
      curto: "Cliente compra sozinho, a qualquer hora.",
      stat: { n: "6% → 10,1%", t: "dos carrinhos abertos no site viraram compra", src: SRC_CASO, caso: true },
      on: a => lacuna(a, "site"), nota: () => "A+" },
    { id: "ia", icon: "bot", nome: "Atendimento automático",
      curto: "Responde na hora, de dia, de noite e quando a fila enche.",
      on: a => a.atendimento === "atendente" || a.atendimento === "equipe_wa", nota: a => (a.atendimento === "equipe_wa" ? "A+" : "A") },
    { id: "recompra", icon: "repeat", nome: "Cliente que volta",
      curto: "Lembra quem toma remédio de uso contínuo e quem largou a compra.",
      on: a => lacuna(a, "recompra"), nota: () => "A" },
    { id: "metricas", icon: "chart", nome: "Vendas por atendente",
      curto: "Ranking de vendas e tempo de resposta, sem planilha.",
      on: a => lacuna(a, "metricas"), nota: () => "B" },
    { id: "status", icon: "truck", nome: "Pedido acompanhado",
      curto: "Avisos no WhatsApp, no estilo iFood.",
      on: a => lacuna(a, "status"), nota: () => "B" },
    { id: "onboarding", icon: "chat", nome: "WhatsApp que vende",
      curto: "Começar a vender pelo WhatsApp já ligado ao estoque.",
      on: a => a.atendimento === "nao_vende", nota: () => "A+" }
  ];

  // Detalhe de cada oportunidade: "hoje" vem só do que o lead respondeu; "ajustes" vêm da proposta e das calls (sem números novos).
  const DETALHE = {
    resposta: { hoje: a => ({ balcao: "O mesmo atendente cuida do balcão e do WhatsApp.", equipe: "Vários atendentes e todos os orçamentos são manuais.", atendente: "O volume de orçamentos é alto e às vezes o cliente fica sem resposta.", equipe_wa: "A equipe do WhatsApp trabalha sem fila automática.", atendente_ok: "O atendente dá conta do volume hoje." }[a.atendimento] || null),
      ajustes: ["Vários atendentes no mesmo número do WhatsApp", "Fila com distribuição automática entre a equipe", "Tela de supervisão: quem espera e há quanto tempo"] },
    chat_erp: { hoje: a => (a.atendimento === "nao_vende" ? "A farmácia ainda não vende pelo WhatsApp." : null),
      ajustes: ["Catálogo com foto e preço na própria conversa", "Carrinho e pagamento sem sair do WhatsApp", "Histórico de compras do cliente à mão"] },
    estoque: { hoje: () => null,
      ajustes: ["Produto, preço e quantidade na hora do atendimento", "Estoque mínimo: o produto sai da venda antes de acabar", "Mais de uma loja do mesmo dono: estoque somado"] },
    manual: { hoje: a => (a.atendimento === "equipe" ? "Todos os orçamentos são feitos à mão." : null),
      ajustes: ["Cupom e promoção aplicados na hora", "Resumo do pedido enviado para o cliente confirmar", "Pedido pronto para imprimir e separar"] },
    site: { hoje: () => "A farmácia não tem loja online onde o cliente compra sozinho.",
      ajustes: ["Loja com a sua marca, montada pela equipe da Elevar", "Cliente compra sozinho ou chama no WhatsApp", "Carrinho abandonado: lembra quem largou a compra"] },
    ia: { hoje: a => ({ atendente: "O volume de orçamentos é alto e às vezes o cliente fica sem resposta." }[a.atendimento] || null),
      ajustes: ["Entende áudio, texto e imagem", "Passa para o atendente quando precisa", "Você define horários e jeito de falar"] },
    recompra: { hoje: () => "Não há lembrete para o cliente voltar a comprar.",
      ajustes: ["Lembrete automático de uso contínuo, no prazo que você escolher", "Lista de quem largou o carrinho, para o time chamar", "Cupom ou oferta junto do lembrete"] },
    metricas: { hoje: () => "Não dá para ver quanto cada atendente vende.",
      ajustes: ["Ranking de vendas por atendente", "Tempo de resposta e de atendimento de cada um", "Horários de pico e produtos mais pedidos"] },
    status: { hoje: () => "O cliente não recebe aviso do andamento do pedido.",
      ajustes: ["Aviso automático: aprovado, separado, a caminho, entregue", "Entregador atualiza o status pelo celular", "Cliente acompanha sem precisar perguntar"] },
    onboarding: { hoje: () => "A farmácia ainda não vende pelo WhatsApp.",
      ajustes: ["Número de WhatsApp na plataforma, com vários atendentes", "Treinamento da equipe de atendimento", "Implantação guiada, em média 30 dias"] }
  };

  // "Em resumo": frases com verbo, uma por oportunidade. "Preço de não mudar": só estatísticas da proposta (sem R$ inventado).
  const RESUMO = {
    resposta: { b: "responder mais rápido no WhatsApp", r: "com fila e distribuição entre os atendentes." },
    chat_erp: { b: "fechar a venda dentro da conversa", r: "com catálogo, carrinho e pagamento no WhatsApp." },
    estoque: { b: "mostrar o estoque certo na hora da venda", r: "e evitar vender o que não tem." },
    manual: { b: "tirar trabalho repetido do atendimento", r: "com cupom, resumo do pedido e impressão prontos." },
    site: { b: "vender também por uma loja online", r: "ligada ao estoque e aberta a qualquer hora." },
    ia: { b: "atender nos picos e fora do expediente", r: "com atendimento automático que chama o atendente quando precisa." },
    recompra: { b: "trazer o cliente de volta", r: "com lembrete de uso contínuo e carrinho abandonado." },
    metricas: { b: "enxergar quanto cada atendente vende", r: "com ranking e tempo de resposta." },
    status: { b: "avisar o cliente do andamento do pedido", r: "no WhatsApp, do aprovado até a entrega." },
    onboarding: { b: "começar a vender pelo WhatsApp", r: "com a equipe treinada e a plataforma implantada." }
  };
  const INERCIA = {
    resposta: "73% dos clientes desistem quando a resposta demora.",
    estoque: "40% das vendas perdidas vêm de falta de estoque.",
    manual: "Cerca de 30% de custo escondido em tarefas manuais.",
    site: "Menos de 1,5% de conversão para quem não oferece mais de um canal."
  };

  // Notas por área (0-100). Item que a farmácia já tem = alto; item que falta = baixo.
  // Índice = média ponderada das áreas. Pesos são julgamento comercial (atendimento pesa mais), não estatística.
  function areas(a) {
    const mk = item => ((a.gaps || []).includes(item) ? 100 : 20);
    const atend = { nao_vende: 10, balcao: 30, equipe: 35, atendente: 40, equipe_wa: 55, atendente_ok: 90 }[a.atendimento];
    return [
      { id: "atendimento", nome: "Atendimento", icon: "chat", peso: 0.30, valor: atend == null ? 30 : atend },
      { id: "loja", nome: "Loja online", icon: "site", peso: 0.25, valor: mk("site") },
      { id: "volta", nome: "Cliente que volta", icon: "repeat", peso: 0.15, valor: mk("recompra") },
      { id: "gestao", nome: "Gestão da equipe", icon: "chart", peso: 0.15, valor: mk("metricas") },
      { id: "entrega", nome: "Entrega acompanhada", icon: "truck", peso: 0.15, valor: mk("status") }
    ];
  }

  // Comparativo "hoje x com a Elevar": só pontos que o lead respondeu e que a plataforma resolve (proposta e calls). Sem R$ nem promessa de resultado.
  function comparativo(a) {
    const out = [];
    const at = {
      nao_vende: ["Ainda não vende pelo WhatsApp", "O WhatsApp vira canal de venda, ligado ao estoque"],
      balcao: ["O mesmo atendente cuida do balcão e do WhatsApp", "Fila com vários atendentes e catálogo na conversa"],
      equipe: ["Vários atendentes e todos os orçamentos feitos à mão", "Distribuição automática, pedido e pagamento na conversa"],
      atendente: ["Volume alto de orçamentos e cliente sem resposta", "Fila distribuída e atendimento automático nos picos"],
      equipe_wa: ["Equipe do WhatsApp sem fila automática nem supervisão", "Fila distribuída e tela de supervisão em tempo real"]
    }[a.atendimento];
    if (at) out.push({ id: "atendimento", nome: "Atendimento", hoje: at[0], com: at[1] });
    if (lacuna(a, "site")) out.push({ id: "loja", nome: "Loja online", hoje: "Sem loja onde o cliente compra sozinho", com: "Loja online ligada ao estoque, com carrinho e pagamento" });
    if (lacuna(a, "recompra")) out.push({ id: "volta", nome: "Cliente que volta", hoje: "Sem lembrete para quem toma remédio de uso contínuo", com: "Lembrete automático e recuperação de carrinho" });
    if (lacuna(a, "metricas")) out.push({ id: "gestao", nome: "Gestão da equipe", hoje: "Sem ver quanto cada atendente vende", com: "Ranking de vendas e tempo de resposta" });
    if (lacuna(a, "status")) out.push({ id: "entrega", nome: "Entrega", hoje: "Cliente sem aviso do andamento do pedido", com: "Avisos no WhatsApp: aprovado, separado, a caminho" });
    return out;
  }

  // ───────────────────────── Diagnóstico ─────────────────────────
  function diagnosticar(a) {
    const frentes = FRENTES.filter(f => f.on(a)).map((f, i) => ({ id: f.id, icon: f.icon, nome: f.nome, curto: f.curto, stat: f.stat || null, nota: f.nota(a), hoje: DETALHE[f.id].hoje(a), ajustes: DETALHE[f.id].ajustes, resumo: RESUMO[f.id], inercia: INERCIA[f.id] || null, _i: i }))
      .sort((x, y) => NOTA_RANK[x.nota] - NOTA_RANK[y.nota] || x._i - y._i)
      .map(({ _i, ...rest }) => rest);

    // Índice (0-100) = média ponderada das áreas
    const ar = areas(a);
    const indice = Math.max(10, Math.min(97, Math.round(ar.reduce((s, x) => s + x.valor * x.peso, 0))));
    const banda = indice < 40 ? { id: "critica", label: "Preparo baixo", tone: "bad" }
      : indice < 60 ? { id: "relevante", label: "Preparo médio", tone: "warn" }
      : indice < 80 ? { id: "parcial", label: "Preparo bom", tone: "info" }
      : { id: "madura", label: "Preparo alto", tone: "ok" };

    // Pacote sugerido: só para o time comercial (não aparece para o lead)
    const pacote = {
      chat: true,
      digital: lacuna(a, "site"),
      ia: a.atendimento === "atendente" || a.atendimento === "equipe_wa"
    };
    const pacoteTexto = ["Chat Commerce", pacote.digital ? "Digital Store" : null, pacote.ia ? "Sales AI" : null].filter(Boolean).join(" + ") + (a.atendimento === "equipe" ? " · IA a avaliar" : "");

    const avisos = [];
    const st = erpStatus(a.erp);
    if (st === "parcial") avisos.push("Linx Big: a integração é por banco de dados. Validar os detalhes na conversa.");
    if (st === "nao_integrado") avisos.push("ERP fora da lista integrada" + (a.erp === "outro" && a.erpOutro ? " (" + a.erpOutro + ")" : "") + ": verificar integração.");
    if (st === "integrado") avisos.push("ERP com integração nativa.");
    if (a.sistema && a.sistema !== "nunca") {
      const nomes = { unico_contato: "Único Contato", suri: "Suri", pedbot: "Pedbot", outro: a.sistemaOutro || "outro sistema" };
      avisos.push("Já usou " + nomes[a.sistema] + (a.sistema === "pedbot" ? " (operação encerrada em 30/09)" : "") + ": entender o que faltou e por que quer trocar.");
    }

    return { frentes, inercia: frentes.map(f => f.inercia).filter(Boolean).slice(0, 2), areas: ar, comparativo: comparativo(a), indice, banda, pacote, pacoteTexto, avisos, totalFrentes: frentes.length };
  }

  function resultado(a, info) {
    const farmacia = isFarmacia(info);
    const c = classe(a.faturamento, farmacia);
    return {
      d: diagnosticar(a), classe: c, farmacia,
      cta: c === "A" || c === "B" ? "especialista" : "analise",
      flags: {
        cnpj_validado: !!info,
        cnae_verificado: farmacia !== null,
        diverge_porte: divergePorte(info, a.faturamento)
      }
    };
  }

  // ───────────────────────── Mensagem do WhatsApp ─────────────────────────
  function mensagemWhatsApp(a, nomeFarmacia, d) {
    const erp = a.erp === "outro" && a.erpOutro ? a.erpOutro : optLabel("erp", a.erp);
    const top = d.frentes.slice(0, 3).map(f => f.nome).join(", ");
    const fat = Q.faturamento.options.find(o => o.id === a.faturamento);
    const at = Q.atendimento.options.find(o => o.id === a.atendimento);
    return [
      "Olá! Fiz o diagnóstico da Elevar para a " + nomeFarmacia + ".",
      "Faturamento: " + (fat ? fat.msg : "-"),
      "ERP: " + erp,
      "Atendimento: " + (at ? at.msg : "-"),
      "Principais frentes: " + top,
      "Quero entender como a Elevar pode me ajudar."
    ].join("\n");
  }

  const api = { CASOS, insight, Q, STEPS, ERP_INTEGRADOS, CNAE_FARMACIA, optLabel, erpStatus, classe, isFarmacia, divergePorte, diagnosticar, resultado, mensagemWhatsApp };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.EL_ENGINE = api;
})(typeof window !== "undefined" ? window : globalThis);
