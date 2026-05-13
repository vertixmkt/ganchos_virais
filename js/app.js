(function () {
  "use strict";

  var ITEMS_PER_PAGE = 24;

  var INTENTS = [
    { id: "todos", label: "Todos", terms: [] },
    { id: "atrair", label: "Atrair atenção", terms: ["segredo", "surpresa", "chocado", "ninguém", "descobri", "verdade", "oculta"] },
    { id: "engajar", label: "Gerar comentários", terms: ["pergunta", "comenta", "você sabia", "qual", "acha", "identificar", "desafio"] },
    { id: "vender", label: "Vender", terms: ["resultado", "oferta", "agora", "comprar", "produto", "cliente", "solução", "dor"] },
    { id: "educar", label: "Ensinar", terms: ["como", "dicas", "passos", "tutorial", "maneiras", "fórmula", "aprendi"] },
    { id: "polemica", label: "Polêmica", terms: ["errado", "mito", "cancelar", "ódio", "opinião", "contrário", "verdade"] },
  ];

  var state = {
    query: "",
    topic: "",
    category: "todas",
    intent: "todos",
    page: 1,
  };

  var els = {};
  var categories = [];
  var hooks = [];
  var sessionUser = null;
  var activePlan = null;
  var dataLoaded = false;
  var authInitialized = false;
  var supabaseClient = window.supabaseClient || null;

  var QUERY_ALIASES = {
    choque: ["choque", "surpresa", "chocado", "surpreso", "inacreditável", "louca", "louco"],
    surpresa: ["surpresa", "choque", "chocado", "surpreso", "inacreditável"],
    polemica: ["polêmica", "polêmica", "contrariação", "contrario", "mito", "errado", "cancelar"],
    polêmica: ["polêmica", "contrariação", "contrario", "mito", "errado", "cancelar"],
    segredo: ["segredo", "oculta", "ninguém", "verdade", "interno"],
    dor: ["dor", "problema", "erro", "travado", "falhando", "dificuldade"],
    pergunta: ["pergunta", "curiosidade", "você sabia", "qual", "por que"],
    perguntas: ["pergunta", "curiosidade", "você sabia", "qual", "por que"],
    lista: ["lista", "listas", "número", "numerados", "coisas", "maneiras", "dicas"],
    listas: ["lista", "listas", "número", "numerados", "coisas", "maneiras", "dicas"],
    tutorial: ["tutorial", "passo", "como", "solução", "maneira", "fórmula"],
    narrativa: ["narrativa", "história", "storytelling", "aconteceu", "começou"],
    storytelling: ["narrativa", "história", "storytelling", "aconteceu", "começou"],
    resultado: ["resultado", "transformação", "de ___ para", "consegui", "mudou"],
    transformacao: ["resultado", "transformação", "consegui", "mudou"],
    transformação: ["resultado", "transformação", "consegui", "mudou"],
    urgencia: ["urgência", "agora", "rápido", "hoje", "última chance"],
    urgência: ["urgência", "agora", "rápido", "hoje", "última chance"],
    vender: ["vender", "venda", "comprar", "produto", "oferta", "cliente"],
    venda: ["vender", "venda", "comprar", "produto", "oferta", "cliente"],
    reels: ["reels", "vídeo", "assista", "continue assistindo", "final deste vídeo"],
    tiktok: ["tiktok", "vídeo", "assista", "continue assistindo", "final deste vídeo"],
  };

  var CATEGORY_QUERY_MAP = {
    segredo: ["1-segredo-informao-oculta"],
    oculto: ["1-segredo-informao-oculta"],
    oculta: ["1-segredo-informao-oculta"],
    choque: ["2-choque-surpresa"],
    surpresa: ["2-choque-surpresa"],
    polemica: ["3-polmica-contrariao"],
    polêmica: ["3-polmica-contrariao"],
    contrario: ["3-polmica-contrariao"],
    contrariao: ["3-polmica-contrariao"],
    contrariação: ["3-polmica-contrariao"],
    lista: ["4-listas-numerados"],
    listas: ["4-listas-numerados"],
    numerado: ["4-listas-numerados"],
    numerados: ["4-listas-numerados"],
    curiosidade: ["5-perguntas-curiosidade"],
    pergunta: ["5-perguntas-curiosidade"],
    perguntas: ["5-perguntas-curiosidade"],
    historia: ["6-storytelling-histria-pessoal"],
    história: ["6-storytelling-histria-pessoal"],
    narrativa: ["6-storytelling-histria-pessoal"],
    storytelling: ["6-storytelling-histria-pessoal"],
    teste: ["7-teste-experimento-review"],
    experimento: ["7-teste-experimento-review"],
    review: ["7-teste-experimento-review"],
    analise: ["7-teste-experimento-review"],
    análise: ["7-teste-experimento-review"],
    urgencia: ["8-urgncia-cta-direto"],
    urgência: ["8-urgncia-cta-direto"],
    cta: ["8-urgncia-cta-direto"],
    problema: ["9-problema-dor"],
    problemas: ["9-problema-dor"],
    dor: ["9-problema-dor"],
    dores: ["9-problema-dor"],
    tutorial: ["10-tutorial-howto-soluo"],
    como: ["10-tutorial-howto-soluo"],
    solução: ["10-tutorial-howto-soluo"],
    solucao: ["10-tutorial-howto-soluo"],
    imaginacao: ["11-what-if-imaginao"],
    imaginação: ["11-what-if-imaginao"],
    desafio: ["12-desafio-engajamento-interativo"],
    engajamento: ["12-desafio-engajamento-interativo"],
    resultado: ["13-resultado-transformao"],
    resultados: ["13-resultado-transformao"],
    transformacao: ["13-resultado-transformao"],
    transformação: ["13-resultado-transformao"],
    venda: ["8-urgncia-cta-direto", "9-problema-dor", "13-resultado-transformao"],
    vender: ["8-urgncia-cta-direto", "9-problema-dor", "13-resultado-transformao"],
  };

  function $(id) {
    return document.getElementById(id);
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function getQueryTerms(query) {
    var normalized = normalize(query).trim();
    if (!normalized) return [];

    var terms = [normalized];
    Object.keys(QUERY_ALIASES).forEach(function (key) {
      if (normalize(key) === normalized) {
        QUERY_ALIASES[key].forEach(function (alias) {
          var normalizedAlias = normalize(alias);
          if (terms.indexOf(normalizedAlias) === -1) terms.push(normalizedAlias);
        });
      }
    });

    return terms;
  }

  function getCategoryQueryIds(query) {
    var normalized = normalize(query).trim();
    if (!normalized) return [];
    return CATEGORY_QUERY_MAP[normalized] || [];
  }

  function cleanCategoryName(name) {
    return String(name || "")
      .replace(/^\d+\s*[—-]\s*/g, "")
      .replace(/Hooks/g, "Ganchos")
      .replace(/hooks/g, "ganchos")
      .replace(/What if/g, "E se")
      .replace(/How-to/g, "Passo a passo")
      .replace(/Review/g, "Análise")
      .trim();
  }

  function cleanHook(text) {
    return String(text || "")
      .replace(/^\s*\d{1,4}\.\s*/g, "")
      .replace(/^["“”]+|["“”]+$/g, "")
      .replace(/\bhack\b/gi, "atalho")
      .replace(/\bhooks\b/gi, "ganchos")
      .replace(/\bhook\b/gi, "gancho")
      .replace(/\bsmth\b/gi, "algo")
      .replace(/\bthread\b/gi, "sequência")
      .replace(/\btweet\b/gi, "post")
      .replace(/\bsubject\b/gi, "assunto")
      .replace(/\bkeyword\b/gi, "palavra-chave")
      .replace(/_+/g, "___")
      .replace(/\s+/g, " ")
      .trim();
  }

  function startsWithArticle(value) {
    return /^(o|a|os|as|um|uma)\s+/i.test(String(value || "").trim());
  }

  function isInfinitiveTopic(topic) {
    var value = normalize(topic).trim().split(/\s+/).pop() || "";
    return /(?:ar|er|ir)$/.test(value);
  }

  function guessArticle(topic) {
    var value = normalize(topic).trim();
    if (!value) return "";
    if (startsWithArticle(topic)) return "";
    if (isInfinitiveTopic(topic)) return "";
    if (value.match(/(cao|sao|dade|gem|ice|ez|ura|ia|esa|a)$/)) return "a";
    return "o";
  }

  function withArticle(topic) {
    var clean = String(topic || "").trim();
    var article = guessArticle(clean);
    if (!clean) return "";
    return article ? article + " " + clean.toLowerCase() : clean.toLowerCase();
  }

  function withPreposition(topic) {
    var clean = String(topic || "").trim();
    var article = guessArticle(clean);
    if (!clean) return "";
    if (isInfinitiveTopic(clean)) return "ao " + clean.toLowerCase();
    if (!article) return "em " + clean.toLowerCase();
    return (article === "a" ? "na " : "no ") + clean.toLowerCase();
  }

  function withDePreposition(topic) {
    var clean = String(topic || "").trim();
    var article = guessArticle(clean);
    if (!clean) return "";
    if (isInfinitiveTopic(clean)) return "de " + clean.toLowerCase();
    if (!article) return "de " + clean.toLowerCase();
    return (article === "a" ? "da " : "do ") + clean.toLowerCase();
  }

  function withComPreposition(topic) {
    var clean = String(topic || "").trim();
    var article = guessArticle(clean);
    if (!clean) return "";
    if (isInfinitiveTopic(clean)) return "com " + clean.toLowerCase();
    if (!article) return "com " + clean.toLowerCase();
    return "com " + article + " " + clean.toLowerCase();
  }

  function getContext() {
    var angle = state.query.trim();
    var topic = state.topic.trim();
    var mainTopic = topic;
    var topicLower = mainTopic.toLowerCase();
    var articleTopic = withArticle(mainTopic);
    var prepTopic = withPreposition(mainTopic);
    var deTopic = withDePreposition(mainTopic);
    var comTopic = withComPreposition(mainTopic);
    var hasTopic = Boolean(topicLower);
    var audience = hasTopic ? "pessoas interessadas em " + articleTopic : "seu público";

    return {
      angle: angle || "curiosidade",
      topic: mainTopic,
      topicLower: topicLower,
      hasTopic: hasTopic,
      articleTopic: articleTopic,
      prepTopic: prepTopic,
      deTopic: deTopic,
      comTopic: comTopic,
      audience: audience,
      problem: hasTopic ? "não conseguir resultado " + comTopic : "não conseguir resultado",
      mistake: hasTopic ? "tratar " + articleTopic + " do jeito errado" : "fazer isso do jeito errado",
      result: hasTopic ? "ter mais resultado " + comTopic : "ter mais resultado",
      benefit: "ganhar clareza e consistência",
      situation: hasTopic ? "você está tentando melhorar " + prepTopic : "você está tentando melhorar",
      action: hasTopic ? "aplicar isso " + prepTopic : "aplicar isso na prática",
      fact: hasTopic ? "a maioria das pessoas complica " + articleTopic + " mais do que precisa" : "a maioria das pessoas complica mais do que precisa",
      idea: hasTopic ? articleTopic + " depende mais de consistência do que de perfeição" : "consistência costuma vencer perfeição",
      number: "3",
      percent: "80%",
      time: "30 dias",
      value: "500",
      year: new Date().getFullYear(),
    };
  }

  function hashString(value) {
    var hash = 0;
    var str = String(value || "");
    for (var i = 0; i < str.length; i += 1) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function pickVariant(list, seed) {
    return list[hashString(seed) % list.length];
  }

  function generateNaturalHook(hook, ctx) {
    var t = ctx.hasTopic ? ctx.articleTopic : "esse tema";
    var bare = ctx.hasTopic ? ctx.topicLower : "esse tema";
    var prep = ctx.hasTopic ? ctx.prepTopic : "nesse tema";
    var strategy = ctx.hasTopic ? "sua estratégia de " + ctx.topicLower : "sua estratégia";
    var categoryId = hook && hook.categoryId ? hook.categoryId : "";
    var seed = hook && hook.id ? hook.id : hook && hook.raw ? hook.raw : t;

    if (categoryId.indexOf("segredo") !== -1) {
      return pickVariant([
        "O que quase ninguém te conta sobre " + t + ".",
        "Existe uma parte " + ctx.deTopic + " que muda tudo quando você entende.",
        "O segredo por trás " + ctx.deTopic + " não é o que a maioria das pessoas imagina.",
        "Ninguém fala sobre isso " + prep + ", mas deveria.",
      ], seed);
    }

    if (categoryId.indexOf("choque") !== -1) {
      return pickVariant([
        "Eu fiquei chocado quando entendi isso sobre " + t + ".",
        "Você não vai olhar para " + t + " do mesmo jeito depois disso.",
        "A parte mais surpreendente sobre " + t + " é essa aqui.",
        "Isso sobre " + t + " parece simples, mas muda tudo.",
      ], seed);
    }

    if (categoryId.indexOf("polmica") !== -1 || categoryId.indexOf("polemica") !== -1) {
      return pickVariant([
        "Opinião impopular: " + t + " não funciona do jeito que te ensinaram.",
        "Todo mundo fala sobre " + t + " do jeito errado.",
        "O conselho mais repetido sobre " + t + " pode estar te atrapalhando.",
        "Se você ainda acredita nisso sobre " + t + ", precisa ouvir isso.",
      ], seed);
    }

    if (categoryId.indexOf("listas") !== -1) {
      return pickVariant([
        "3 coisas sobre " + t + " que eu gostaria de ter entendido antes.",
        "5 erros " + prep + " que quase ninguém percebe.",
        "3 sinais de que " + strategy + " precisa mudar.",
        "7 detalhes sobre " + t + " que fazem diferença no resultado.",
      ], seed);
    }

    if (categoryId.indexOf("perguntas") !== -1) {
      return pickVariant([
        "Você já parou para pensar por que " + t + " parece tão difícil?",
        "E se o problema " + prep + " não fosse falta de esforço?",
        "Você sabia que a maioria das pessoas complica " + bare + " sem perceber?",
        "Qual é o maior erro que você já cometeu tentando melhorar " + prep + "?",
      ], seed);
    }

    if (categoryId.indexOf("storytelling") !== -1 || categoryId.indexOf("histria") !== -1 || categoryId.indexOf("historia") !== -1) {
      return pickVariant([
        "Eu demorei para entender isso sobre " + t + ", mas mudou minha forma de agir.",
        "A primeira vez que levei " + t + " a sério, percebi uma coisa importante.",
        "Eu estava travado " + prep + " até perceber este detalhe.",
        "Uma experiência " + ctx.comTopic + " me ensinou uma lição que eu não esqueci.",
      ], seed);
    }

    if (categoryId.indexOf("teste") !== -1) {
      return pickVariant([
        "Testei uma abordagem diferente para " + t + " e o resultado me surpreendeu.",
        "Passei 30 dias observando " + t + " e encontrei este padrão.",
        "Comparei o jeito comum de lidar " + ctx.comTopic + " com um método mais simples.",
        "Fiz um teste " + ctx.comTopic + " para descobrir o que realmente funciona.",
      ], seed);
    }

    if (categoryId.indexOf("urgncia") !== -1 || categoryId.indexOf("urgencia") !== -1) {
      return pickVariant([
        "Se você quer melhorar " + prep + ", pare de adiar isso.",
        "Quanto mais você ignora isso " + prep + ", mais difícil fica corrigir depois.",
        "Esse é o ajuste " + prep + " que você deveria fazer ainda hoje.",
        "Antes de tentar mais uma vez " + prep + ", veja isso.",
      ], seed);
    }

    if (categoryId.indexOf("problema") !== -1) {
      return pickVariant([
        "O problema " + prep + " não é falta de informação. É falta de direção.",
        "Se " + t + " não está funcionando para você, talvez o erro esteja aqui.",
        "Esse detalhe pode estar travando seu resultado " + ctx.comTopic + ".",
        "A maioria das pessoas erra " + prep + " antes mesmo de começar.",
      ], seed);
    }

    if (categoryId.indexOf("tutorial") !== -1) {
      return pickVariant([
        "Como melhorar " + prep + " sem complicar o processo.",
        "Um passo simples para ter mais resultado " + ctx.comTopic + ".",
        "Faça isso antes de tentar qualquer estratégia " + ctx.deTopic + ".",
        "A forma mais simples de começar " + prep + " com mais clareza.",
      ], seed);
    }

    if (categoryId.indexOf("what-if") !== -1 || categoryId.indexOf("imaginao") !== -1) {
      return pickVariant([
        "E se tudo que você aprendeu sobre " + t + " estivesse incompleto?",
        "Imagine se " + t + " fosse mais simples do que parece.",
        "E se o caminho para melhorar " + prep + " fosse o oposto do que todo mundo faz?",
        "O que aconteceria se você mudasse apenas uma coisa " + prep + "?",
      ], seed);
    }

    if (categoryId.indexOf("desafio") !== -1) {
      return pickVariant([
        "Comenta aqui: qual é sua maior dificuldade " + ctx.comTopic + "?",
        "Você consegue identificar esse erro " + prep + "?",
        "Escolha um lado: " + prep + ", você prefere fazer rápido ou fazer certo?",
        "Se você já tentou melhorar " + prep + ", esse desafio é para você.",
      ], seed);
    }

    if (categoryId.indexOf("resultado") !== -1) {
      return pickVariant([
        "De travado " + prep + " a finalmente entendendo o que fazer.",
        "O que mudou meu resultado " + ctx.comTopic + " foi mais simples do que eu esperava.",
        "Como sair do zero " + prep + " com uma mudança prática.",
        "A única mudança que melhorou meu resultado " + ctx.comTopic + ".",
      ], seed);
    }

    return pickVariant([
      "Uma coisa sobre " + t + " que você precisa entender.",
      "Se você quer melhorar " + prep + ", comece por isso.",
      "Isso pode mudar sua forma de olhar para " + t + ".",
      "O detalhe sobre " + t + " que muita gente ignora.",
    ], seed);
  }

  function smartBlankReplacement(text, ctx) {
    return text.replace(/_{3,}/g, function (_match, offset, fullText) {
      var before = fullText.slice(Math.max(0, offset - 28), offset).toLowerCase();
      var after = fullText.slice(offset, offset + 28).toLowerCase();

      if (before.match(/sobre\s*$/)) return ctx.topicLower;
      if (before.match(/para\s*$/)) return ctx.result;
      if (before.match(/de\s*$/)) return ctx.topicLower;
      if (before.match(/com\s*$/)) return ctx.topicLower;
      if (before.match(/em\s*$/)) return ctx.topicLower;
      if (before.match(/fazer\s*$/)) return ctx.action;
      if (before.match(/obter\s*$/)) return ctx.result;
      if (before.match(/resolver\s*$/)) return ctx.problem;
      if (after.match(/funciona|est[aá]|mudou|aconteceu/)) return "isso sobre " + ctx.topicLower;

      return ctx.topicLower;
    });
  }

  function replaceTemplateTokens(text, ctx) {
    var replacements = [
      [/\[porcentagem\]/gi, ctx.percent],
      [/\[grupo de interesse\]/gi, ctx.audience],
      [/\[ideia\]/gi, ctx.idea],
      [/\[fato\]/gi, ctx.fact],
      [/\[tópico específico do setor\]/gi, ctx.topicLower],
      [/\[tópico complexo\]/gi, ctx.topicLower],
      [/\[tópico relacionado à indústria\]/gi, ctx.topicLower],
      [/\[tópico\]/gi, ctx.topicLower],
      [/\[nicho\]/gi, ctx.topicLower],
      [/\(nicho\)/gi, ctx.topicLower],
      [/\[indústria\]/gi, ctx.topicLower],
      [/\(assunto\)/gi, ctx.topicLower],
      [/\(tópico\)/gi, ctx.topicLower],
      [/\[área específica\]/gi, ctx.topicLower],
      [/\[relacionado ao nicho\]/gi, ctx.topicLower],
      [/\[público-alvo\]/gi, ctx.audience],
      [/\[público\/objetivo\]/gi, ctx.audience],
      [/\[público-alvo relacionado à indústria\]/gi, ctx.audience],
      [/\[objetivo\]/gi, ctx.result],
      [/\[resultado desejado\]/gi, ctx.result],
      [/\[resultado\]/gi, ctx.result],
      [/\(resultado desejado\)/gi, ctx.result],
      [/\[alcançar resultado\]/gi, ctx.result],
      [/\[atingir o objetivo\]/gi, ctx.result],
      [/\[atingir objetivo\]/gi, ctx.result],
      [/\[benefício\]/gi, ctx.benefit],
      [/\[problema\]/gi, ctx.problem],
      [/\(problema\)/gi, ctx.problem],
      [/\[ponto de dor\]/gi, ctx.problem],
      [/\(ponto problemático\)/gi, ctx.problem],
      [/\{insira um ponto problemático\}/gi, ctx.problem],
      [/\[erro comum\]/gi, ctx.mistake],
      [/\[conselho comum\]/gi, "seguir dicas genéricas sobre " + ctx.topicLower],
      [/\[prática comum\]/gi, "copiar o que todo mundo faz em " + ctx.topicLower],
      [/\[opinião popular\]/gi, ctx.topicLower + " é só força de vontade"],
      [/\[ação\]/gi, ctx.action],
      [/\(ação\)/gi, ctx.action],
      [/\[atividade\]/gi, ctx.topicLower],
      [/\[situação\]/gi, ctx.situation],
      [/\[situação difícil\]/gi, "travado em " + ctx.topicLower],
      [/\[cenário inesperado\]/gi, "testar " + ctx.topicLower + " na prática"],
      [/\[habilidade\]/gi, ctx.topicLower],
      [/\[trabalho, ferramenta, evento, etc\]/gi, ctx.topicLower],
      [/\[ferramenta\]/gi, "uma ferramenta de " + ctx.topicLower],
      [/\[produto\/serviço\]/gi, "solução de " + ctx.topicLower],
      [/\[produto\]/gi, "solução de " + ctx.topicLower],
      [/\[produto\/tendência\]/gi, ctx.topicLower],
      [/\[conceito\]/gi, ctx.topicLower],
      [/\[conhecimento interno\]/gi, ctx.topicLower],
      [/\[celebridade\/influenciador\]/gi, "os especialistas"],
      [/\[comunidade\/indústria específica\]/gi, "mercado de " + ctx.topicLower],
      [/\[pessoa ou grupo de pessoas\]/gi, "os especialistas"],
      [/\{insira uma meta\}/gi, ctx.result],
      [/\{inserir meta\}/gi, ctx.result],
      [/\{insira uma opinião polarizadora\}/gi, ctx.topicLower + " não funciona do jeito que te ensinaram"],
      [/\{insira uma declaração polarizadora\}/gi, ctx.topicLower + " não é sobre fazer mais, é sobre fazer melhor"],
      [/\{insira algo que seu público deveria começar a fazer\}/gi, "rever sua estratégia de " + ctx.topicLower],
      [/\[número\]/gi, ctx.number],
      [/\(número\)/gi, ctx.number],
      [/\[NÚMERO\]/g, ctx.number],
      [/\(quantidade\)/gi, ctx.time],
      [/\[prazo\]/gi, ctx.time],
      [/\[ritmo\]/gi, ctx.time],
      [/\[valor\]/gi, ctx.value],
      [/\[ano\]/gi, ctx.year],
      [/\$?\[preço\]/gi, "R$" + ctx.value],
      [/\(preço exorbitante\)/gi, "R$" + ctx.value],
      [/\[estatística\]/gi, ctx.percent],
      [/\[estatística chocante\]/gi, ctx.percent + " das pessoas erram isso"],
      [/\[itens\]/gi, "estratégias de " + ctx.topicLower],
      [/\[categoria\]/gi, ctx.topicLower],
      [/\[opção a\]/gi, "continuar fazendo do jeito antigo"],
      [/\[opção b\]/gi, "testar um caminho mais simples"],
      [/\[recurso\]/gi, "tempo"],
      [/\[descrição\]/gi, "travado em " + ctx.topicLower],
    ];

    return replacements.reduce(function (acc, pair) {
      return acc.replace(pair[0], pair[1]);
    }, text);
  }

  function polishGeneratedText(text, ctx) {
    return text
      .replace(/\bX\b/g, ctx.topic)
      .replace(/\bY\b/g, ctx.result)
      .replace(/\bx\b/g, ctx.topicLower)
      .replace(/\by\b/g, ctx.result)
      .replace(/\(\s*\)/g, "")
      .replace(/\[\s*\]/g, "")
      .replace(/\s+([?.!,…])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .replace(/isso\s+sobre\s+sobre/gi, "isso sobre")
      .trim();
  }

  function humanizeTemplate(text) {
    return String(text || "")
      .replace(/\[porcentagem\]/gi, "80%")
      .replace(/\[grupo de interesse\]/gi, "seu público")
      .replace(/\[ideia\]/gi, "uma ideia comum")
      .replace(/\[fato\]/gi, "um detalhe importante")
      .replace(/\[tópico específico do setor\]|\[tópico complexo\]|\[tópico relacionado à indústria\]|\[tópico\]|\(tópico\)|\(assunto\)|\[área específica\]|\[relacionado ao nicho\]/gi, "esse tema")
      .replace(/\[nicho\]|\(nicho\)/gi, "seu nicho")
      .replace(/\[indústria\]/gi, "seu mercado")
      .replace(/\[público-alvo\]|\[público\/objetivo\]|\[público-alvo relacionado à indústria\]/gi, "seu público")
      .replace(/\[objetivo\]|\[resultado desejado\]|\[resultado\]|\(resultado desejado\)|\[alcançar resultado\]|\[atingir o objetivo\]|\[atingir objetivo\]/gi, "ter mais resultado")
      .replace(/\[benefício\]/gi, "ganhar clareza")
      .replace(/\[problema\]|\(problema\)|\[ponto de dor\]|\(ponto problemático\)|\{insira um ponto problemático\}/gi, "um problema comum")
      .replace(/\[erro comum\]/gi, "um erro comum")
      .replace(/\[conselho comum\]/gi, "um conselho genérico")
      .replace(/\[prática comum\]/gi, "uma prática comum")
      .replace(/\[opinião popular\]/gi, "uma opinião popular")
      .replace(/\[ação\]|\(ação\)|\[atividade\]/gi, "fazer isso")
      .replace(/\[situação\]|\[situação difícil\]/gi, "uma situação difícil")
      .replace(/\[cenário inesperado\]/gi, "um cenário inesperado")
      .replace(/\[habilidade\]/gi, "essa habilidade")
      .replace(/\[trabalho, ferramenta, evento, etc\]/gi, "uma ferramenta")
      .replace(/\[ferramenta\]/gi, "uma ferramenta")
      .replace(/\[produto\/serviço\]|\[produto\]/gi, "esse produto")
      .replace(/\[produto\/tendência\]/gi, "essa tendência")
      .replace(/\[conceito\]/gi, "esse conceito")
      .replace(/\[conhecimento interno\]/gi, "um conhecimento interno")
      .replace(/\[celebridade\/influenciador\]/gi, "os especialistas")
      .replace(/\[comunidade\/indústria específica\]/gi, "sua comunidade")
      .replace(/\[pessoa ou grupo de pessoas\]/gi, "algumas pessoas")
      .replace(/\{insira uma meta\}|\{inserir meta\}/gi, "ter mais resultado")
      .replace(/\{insira uma opinião polarizadora\}/gi, "isso não funciona como dizem")
      .replace(/\{insira uma declaração polarizadora\}/gi, "isso não funciona como dizem")
      .replace(/\{insira algo que seu público deveria começar a fazer\}/gi, "fazer essa mudança")
      .replace(/\[número\]|\(número\)|\[NÚMERO\]/g, "3")
      .replace(/\(quantidade\)|\[prazo\]|\[ritmo\]/gi, "30 dias")
      .replace(/\[valor\]/gi, "500")
      .replace(/\[ano\]/gi, new Date().getFullYear())
      .replace(/\$?\[preço\]|\(preço exorbitante\)/gi, "R$500")
      .replace(/\[estatística\]/gi, "80%")
      .replace(/\[estatística chocante\]/gi, "80% das pessoas erram isso")
      .replace(/\[itens\]/gi, "estratégias")
      .replace(/\[categoria\]/gi, "categoria")
      .replace(/\[opção a\]/gi, "opção A")
      .replace(/\[opção b\]/gi, "opção B")
      .replace(/\[recurso\]/gi, "tempo")
      .replace(/\[descrição\]/gi, "travado")
      .replace(/_{3,}/g, "isso")
      .replace(/\s+([?.!,…])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function applyTopic(text, hook) {
    var categoryQueryIds = getCategoryQueryIds(state.query);
    if (!state.topic.trim() && !categoryQueryIds.length) return humanizeTemplate(text);

    var ctx = getContext();
    if (hook) return generateNaturalHook(hook, ctx);

    var filled = replaceTemplateTokens(text, ctx);
    filled = smartBlankReplacement(filled, ctx);
    return polishGeneratedText(filled, ctx);
  }

  function formatHook(text, hook) {
    return applyTopic(cleanHook(text), hook);
  }

  function buildData() {
    categories = (window.CONTENT_HOOKS_DATA || []).map(function (category) {
      var name = cleanCategoryName(category.name);
      var iconMatch = name.match(/^[^\wÀ-ÿ]+/);
      return {
        id: category.id,
        name: name,
        icon: iconMatch ? iconMatch[0].trim() : "✦",
        hooks: (category.hooks || []).map(cleanHook).filter(Boolean),
      };
    });

    hooks = categories.flatMap(function (category) {
      return category.hooks.map(function (text, index) {
        return {
          id: category.id + "-" + index,
          raw: text,
          categoryId: category.id,
          categoryName: category.name,
        };
      });
    });
  }

  function matchesIntent(hook) {
    if (state.intent === "todos") return true;
    var intent = INTENTS.find(function (item) { return item.id === state.intent; });
    if (!intent) return true;
    var text = normalize(hook.raw + " " + hook.categoryName);
    return intent.terms.some(function (term) {
      return text.indexOf(normalize(term)) !== -1;
    });
  }

  function getFilteredHooks() {
    var queryTerms = getQueryTerms(state.query);
    var categoryQueryIds = getCategoryQueryIds(state.query);

    return hooks.filter(function (hook) {
      var inCategory = state.category === "todas" || hook.categoryId === state.category;
      if (!inCategory) return false;
      if (!matchesIntent(hook)) return false;
      if (!queryTerms.length) return true;

      if (categoryQueryIds.length) {
        return categoryQueryIds.indexOf(hook.categoryId) !== -1;
      }

      var haystack = normalize([
        hook.raw,
        hook.categoryName,
        hook.categoryId,
      ].join(" "));

      return queryTerms.some(function (term) {
        return haystack.indexOf(term) !== -1;
      });
    });
  }

  function categoryCount(categoryId) {
    return hooks.filter(function (hook) {
      return hook.categoryId === categoryId && matchesIntent(hook);
    }).length;
  }

  function renderStats() {
    var totalHooksEl = $("totalHooks");
    var totalCategoriesEl = $("totalCategories");
    if (totalHooksEl) totalHooksEl.textContent = hooks.length.toLocaleString("pt-BR");
    if (totalCategoriesEl) totalCategoriesEl.textContent = categories.length.toLocaleString("pt-BR");
  }

  function renderIntents() {
    els.intentChips.innerHTML = INTENTS.map(function (intent) {
      return '<button class="chip ' + (state.intent === intent.id ? "active" : "") + '" data-intent="' + intent.id + '" type="button">' + intent.label + '</button>';
    }).join("");
  }

  function renderCategories() {
    var allCount = hooks.filter(matchesIntent).length;
    var html = [
      '<button class="category-btn ' + (state.category === "todas" ? "active" : "") + '" data-category="todas" type="button">',
      '<span class="category-label">Todas as categorias</span>',
      '<span class="count">' + allCount + '</span>',
      '</button>',
    ].join("");

    html += categories.map(function (category) {
      var count = categoryCount(category.id);
      return [
        '<button class="category-btn ' + (state.category === category.id ? "active" : "") + '" data-category="' + category.id + '" type="button">',
        '<span class="category-label">' + category.name + '</span>',
        '<span class="count">' + count + '</span>',
        '</button>',
      ].join("");
    }).join("");

    els.categories.innerHTML = html;
  }

  function renderResults() {
    var filtered = getFilteredHooks();
    var pages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    if (state.page > pages) state.page = pages;

    var start = (state.page - 1) * ITEMS_PER_PAGE;
    var visible = filtered.slice(start, start + ITEMS_PER_PAGE);

    els.resultSummary.textContent = filtered.length.toLocaleString("pt-BR") + " ganchos encontrados";
    els.emptyState.hidden = filtered.length !== 0;
    els.results.innerHTML = visible.map(function (hook) {
      var text = formatHook(hook.raw, hook);
      return [
        '<article class="card">',
        '<div class="card-top">',
        '<span class="tag">' + hook.categoryName + '</span>',
        '</div>',
        '<p class="hook-text">' + escapeHtml(text) + '</p>',
        '<div class="card-actions">',
        '<button class="small-btn" type="button" data-copy="' + hook.id + '"><i data-lucide="copy"></i> Copiar</button>',
        '</div>',
        '</article>',
      ].join("");
    }).join("");

    els.prevBtn.disabled = state.page <= 1;
    els.nextBtn.disabled = state.page >= pages;
    els.pageLabel.textContent = state.page + "/" + pages;

    if (window.lucide) window.lucide.createIcons();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render() {
    renderIntents();
    renderCategories();
    renderResults();
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(function () {
      els.toast.classList.remove("visible");
    }, 1800);
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    document.body.removeChild(area);
  }

  function findHook(id) {
    return hooks.find(function (hook) {
      return hook.id === id;
    });
  }

  function getInitials(user) {
    var source = (user && user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || (user && user.email) || "gpt";
    var parts = String(source).split(/[@\s._-]+/).filter(Boolean);
    if (!parts.length) return "GT";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }

  function getDisplayName(user) {
    if (!user) return "Usuário";
    var metadata = user.user_metadata || {};
    return metadata.full_name || metadata.name || metadata.display_name || user.email || "Usuário";
  }

  function setAuthCookie(enabled) {
    if (enabled) {
      var token = (window.crypto && window.crypto.randomUUID)
        ? window.crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      document.cookie = "tg_auth=" + token + "; path=/; SameSite=Lax; max-age=604800";
    } else {
      document.cookie = "tg_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    }
  }

  function setAuthMessage(message, type) {
    if (!els.authMessage) return;
    els.authMessage.textContent = message || "";
    els.authMessage.className = "auth-message" + (message && type ? " " + type : "");
  }

  function showLoginModal() {
    if (!els.loginModal) return;
    setAuthMessage("", "");
    els.loginModal.hidden = false;
    window.setTimeout(function () {
      if (els.emailInput) els.emailInput.focus();
    }, 0);
    if (window.lucide) window.lucide.createIcons();
  }

  function hideLoginModal() {
    if (els.loginModal) els.loginModal.hidden = true;
  }

  function setTopbarUser(user) {
    var loggedIn = Boolean(user);
    if (els.loginBtn) els.loginBtn.hidden = loggedIn;
    if (els.accountMenu) els.accountMenu.hidden = !loggedIn;
    if (!loggedIn) return;
    if (els.accountAvatar) els.accountAvatar.textContent = getInitials(user);
    if (els.accountEmail) els.accountEmail.textContent = user.email || getDisplayName(user);
    if (els.menuName) els.menuName.textContent = getDisplayName(user);
    if (els.menuEmail) els.menuEmail.textContent = user.email || "";
  }

  function setShellVisibility(mode) {
    if (els.loginGate) els.loginGate.hidden = mode !== "login";
    if (els.accessGate) els.accessGate.hidden = mode !== "access";
    if (els.appShell) els.appShell.hidden = mode !== "app";
    if (window.lucide) window.lucide.createIcons();
  }

  function loadHooksData() {
    return new Promise(function (resolve, reject) {
      if (window.CONTENT_HOOKS_DATA && window.CONTENT_HOOKS_DATA.length) {
        resolve();
        return;
      }

      var existing = document.querySelector('script[src="./content-hooks-data.js"]');
      if (existing) {
        existing.addEventListener("load", function () { resolve(); });
        existing.addEventListener("error", reject);
        return;
      }

      var script = document.createElement("script");
      script.src = "./content-hooks-data.js";
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error("Falha ao carregar ganchos.")); };
      document.head.appendChild(script);
    });
  }

  async function checkActivePlan(user) {
    if (!supabaseClient || !user || !user.email) return null;
    try {
      var result = await supabaseClient
        .from("purchase_records")
        .select("plan, status")
        .eq("email", user.email.toLowerCase().trim())
        .eq("status", "active")
        .limit(1);

      if (result && result.error) return null;
      return result && result.data && result.data.length ? result.data[0] : null;
    } catch (_err) {
      return null;
    }
  }

  async function loadAppForUser(user) {
    setTopbarUser(user);
    setAuthCookie(true);
    activePlan = await checkActivePlan(user);

    if (!activePlan) {
      dataLoaded = false;
      setShellVisibility("access");
      return;
    }

    try {
      await loadHooksData();
      buildData();
      renderStats();
      render();
      dataLoaded = true;
      setShellVisibility("app");
    } catch (_err) {
      showToast("Não foi possível carregar a biblioteca.");
      setShellVisibility("access");
    }
  }

  async function handleSession(user) {
    sessionUser = user || null;
    if (!sessionUser) {
      activePlan = null;
      dataLoaded = false;
      setAuthCookie(false);
      setTopbarUser(null);
      setShellVisibility("login");
      return;
    }

    await loadAppForUser(sessionUser);
  }

  async function initializeAuth() {
    if (!supabaseClient || !supabaseClient.auth) {
      setShellVisibility("login");
      showToast("Supabase não carregou.");
      return;
    }

    try {
      var result = await supabaseClient.auth.getSession();
      var session = result && result.data && result.data.session;
      await handleSession(session ? session.user : null);
    } catch (_err) {
      await handleSession(null);
    }

    if (!authInitialized) {
      authInitialized = true;
      supabaseClient.auth.onAuthStateChange(function (event, session) {
        if (event === "SIGNED_IN") hideLoginModal();
        handleSession(session ? session.user : null);
      });
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    if (!supabaseClient || !supabaseClient.auth) {
      setAuthMessage("Supabase não carregou. Recarregue a página.", "error");
      return;
    }

    var email = els.emailInput.value.trim();
    var password = els.passwordInput.value;
    if (!email || !password) return;

    els.submitLoginBtn.disabled = true;
    els.submitLoginBtn.innerHTML = '<i data-lucide="loader-circle"></i> Entrando...';
    setAuthMessage("", "");
    if (window.lucide) window.lucide.createIcons();

    try {
      var result = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
      if (result.error) {
        setAuthMessage("Email ou senha incorretos.", "error");
      }
    } catch (_err) {
      setAuthMessage("Erro ao conectar. Tente novamente.", "error");
    }

    els.submitLoginBtn.disabled = false;
    els.submitLoginBtn.innerHTML = '<i data-lucide="log-in"></i> Entrar';
    if (window.lucide) window.lucide.createIcons();
  }

  async function handleForgotPassword() {
    if (!supabaseClient || !supabaseClient.auth) return;
    var email = els.emailInput.value.trim();
    if (!email) {
      setAuthMessage("Digite seu email para receber o link de recuperação.", "error");
      return;
    }

    try {
      var cfg = window.APP_CONFIG || {};
      var result = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: cfg.AUTH_REDIRECT_URL || window.location.href,
      });
      if (result.error) setAuthMessage("Não foi possível enviar o email de recuperação.", "error");
      else setAuthMessage("Email enviado. Verifique sua caixa de entrada.", "success");
    } catch (_err) {
      setAuthMessage("Erro ao enviar recuperação de senha.", "error");
    }
  }

  async function handleLogout() {
    if (els.menuPopover) els.menuPopover.hidden = true;
    setAuthCookie(false);
    try {
      if (supabaseClient && supabaseClient.auth) await supabaseClient.auth.signOut({ scope: "local" });
    } catch (_err) {}
    window.CONTENT_HOOKS_DATA = null;
    categories = [];
    hooks = [];
    await handleSession(null);
  }

  function bindEvents() {
    if (els.loginBtn) els.loginBtn.addEventListener("click", showLoginModal);
    document.querySelectorAll("[data-open-login]").forEach(function (button) {
      button.addEventListener("click", showLoginModal);
    });
    if (els.closeLoginBtn) els.closeLoginBtn.addEventListener("click", hideLoginModal);
    if (els.loginModal) {
      els.loginModal.addEventListener("click", function (event) {
        if (event.target === els.loginModal) hideLoginModal();
      });
    }
    if (els.loginForm) els.loginForm.addEventListener("submit", handleLogin);
    if (els.forgotPasswordBtn) els.forgotPasswordBtn.addEventListener("click", handleForgotPassword);
    if (els.accountButton) {
      els.accountButton.addEventListener("click", function () {
        els.menuPopover.hidden = !els.menuPopover.hidden;
      });
    }
    if (els.logoutBtn) els.logoutBtn.addEventListener("click", handleLogout);

    els.searchInput.addEventListener("input", function (event) {
      state.query = event.target.value;
      state.page = 1;
      render();
    });

    els.topicInput.addEventListener("input", function (event) {
      state.topic = event.target.value;
      renderResults();
    });

    els.clearBtn.addEventListener("click", function () {
      state.query = "";
      state.topic = "";
      state.category = "todas";
      state.intent = "todos";
      state.page = 1;
      els.searchInput.value = "";
      els.topicInput.value = "";
      render();
    });

    els.randomBtn.addEventListener("click", async function () {
      var filtered = getFilteredHooks();
      if (!filtered.length) return;
      var hook = filtered[Math.floor(Math.random() * filtered.length)];
      await copyText(formatHook(hook.raw, hook));
      showToast("Gancho aleatório copiado.");
    });

    els.intentChips.addEventListener("click", function (event) {
      var button = event.target.closest("[data-intent]");
      if (!button) return;
      state.intent = button.getAttribute("data-intent");
      state.page = 1;
      render();
    });

    els.categories.addEventListener("click", function (event) {
      var button = event.target.closest("[data-category]");
      if (!button) return;
      state.category = button.getAttribute("data-category");
      state.page = 1;
      render();
    });

    els.results.addEventListener("click", async function (event) {
      var copyButton = event.target.closest("[data-copy]");
      var id = copyButton ? copyButton.getAttribute("data-copy") : "";
      var hook = findHook(id);
      if (!hook) return;

      await copyText(formatHook(hook.raw, hook));
      showToast("Gancho copiado.");
    });

    els.prevBtn.addEventListener("click", function () {
      state.page = Math.max(1, state.page - 1);
      renderResults();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    els.nextBtn.addEventListener("click", function () {
      state.page += 1;
      renderResults();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function init() {
    els = {
      appShell: $("appShell"),
      loginGate: $("loginGate"),
      accessGate: $("accessGate"),
      loginBtn: $("loginBtn"),
      accountMenu: $("accountMenu"),
      accountButton: $("accountButton"),
      accountAvatar: $("accountAvatar"),
      accountEmail: $("accountEmail"),
      menuPopover: $("menuPopover"),
      menuName: $("menuName"),
      menuEmail: $("menuEmail"),
      logoutBtn: $("logoutBtn"),
      loginModal: $("loginModal"),
      closeLoginBtn: $("closeLoginBtn"),
      loginForm: $("loginForm"),
      emailInput: $("emailInput"),
      passwordInput: $("passwordInput"),
      authMessage: $("authMessage"),
      submitLoginBtn: $("submitLoginBtn"),
      forgotPasswordBtn: $("forgotPasswordBtn"),
      searchInput: $("searchInput"),
      topicInput: $("topicInput"),
      randomBtn: $("randomBtn"),
      clearBtn: $("clearBtn"),
      intentChips: $("intentChips"),
      categories: $("categories"),
      results: $("results"),
      emptyState: $("emptyState"),
      resultSummary: $("resultSummary"),
      prevBtn: $("prevBtn"),
      nextBtn: $("nextBtn"),
      pageLabel: $("pageLabel"),
      toast: $("toast"),
    };

    bindEvents();
    initializeAuth();

    if (window.lucide) window.lucide.createIcons();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
