// ─────────────────────────────────────────────────────────────────────────────
// WEBCHAT UI (decreto 2026-07-30) — a página PÚBLICA do canal próprio da AHRI,
// servida pela API (mesmo padrão do /production/ui: zero container novo).
// O dono envia o link; o cliente se identifica (nome + WhatsApp com DDD) e
// conversa com a MESMA AHRI do WhatsApp — texto e HISCON em PDF.
// Vanilla HTML/CSS/JS, mobile-first; mensagens sempre via textContent (XSS-safe);
// Token no sessionStorage (2026-08-28, pedido do dono): a sessão vive só
// enquanto a ABA está aberta — fechou, a próxima visita começa no cadastro
// (novo lead no mesmo aparelho). Quem informar o MESMO WhatsApp retoma a
// mesma conversa de sempre: a identidade é o telefone, não o navegador.
// ─────────────────────────────────────────────────────────────────────────────
export const WEBCHAT_UI_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>Atendimento — Reconstrua</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; background: #ece5dd; display: flex; flex-direction: column; }
  header { background: #075e54; color: #fff; padding: 12px 16px; display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
  header .avatar { width: 40px; height: 40px; border-radius: 50%; background: #25d366; color: #075e54; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; }
  header h1 { font-size: 16px; font-weight: 600; }
  header p { font-size: 12px; opacity: .85; }
  main { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 6px; }
  .msg { max-width: 82%; padding: 8px 12px; border-radius: 10px; font-size: 14.5px; line-height: 1.45; white-space: pre-wrap; word-wrap: break-word; box-shadow: 0 1px 1px rgba(0,0,0,.12); }
  .msg .hora { display: block; font-size: 10.5px; color: #667; text-align: right; margin-top: 3px; }
  .ahri { background: #fff; align-self: flex-start; border-top-left-radius: 2px; }
  .cliente { background: #d9fdd3; align-self: flex-end; border-top-right-radius: 2px; }
  .aviso { align-self: center; background: #fdf3c7; color: #5b4a12; font-size: 12px; padding: 6px 12px; border-radius: 8px; text-align: center; }
  /* "digitando…" (2026-08-26): aparece logo após o cliente enviar — a espera
     pela AHRI deixa de parecer silêncio. Três pontos pulsando, WhatsApp-like. */
  #digitando { align-self: flex-start; background: #fff; border-radius: 10px; border-top-left-radius: 2px; padding: 12px 16px; box-shadow: 0 1px 1px rgba(0,0,0,.12); margin: 0 12px 6px; flex-shrink: 0; }
  #digitando span { display: inline-block; width: 7px; height: 7px; margin-right: 4px; border-radius: 50%; background: #9ab; animation: pulsar 1.2s infinite ease-in-out; }
  #digitando span:nth-child(2) { animation-delay: .2s; }
  #digitando span:nth-child(3) { animation-delay: .4s; margin-right: 0; }
  @keyframes pulsar { 0%, 80%, 100% { opacity: .3; transform: scale(.8); } 40% { opacity: 1; transform: scale(1); } }
  footer { flex-shrink: 0; padding: 8px; display: flex; gap: 8px; align-items: flex-end; background: #f0f0f0; }
  footer textarea { flex: 1; resize: none; border: none; border-radius: 20px; padding: 11px 14px; font-size: 15px; font-family: inherit; max-height: 110px; outline: none; }
  .btn { border: none; border-radius: 50%; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 19px; flex-shrink: 0; }
  .btn-enviar { background: #075e54; color: #fff; }
  .btn-anexo { background: #fff; color: #075e54; border: 1px solid #cfd8d6; }
  .btn:disabled { opacity: .5; cursor: default; }
  /* Tela de identificação */
  #entrada { flex: 1; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .card { background: #fff; border-radius: 14px; padding: 26px 22px; width: 100%; max-width: 380px; box-shadow: 0 4px 18px rgba(0,0,0,.10); }
  .card h2 { color: #075e54; font-size: 19px; margin-bottom: 6px; }
  .card p { color: #556; font-size: 13.5px; margin-bottom: 16px; line-height: 1.5; }
  .card label { display: block; font-size: 13px; color: #334; font-weight: 600; margin: 12px 0 4px; }
  .card input { width: 100%; border: 1px solid #c8d0ce; border-radius: 8px; padding: 11px 12px; font-size: 15px; outline-color: #075e54; }
  .card button { width: 100%; margin-top: 18px; background: #075e54; color: #fff; border: none; border-radius: 8px; padding: 13px; font-size: 15px; font-weight: 600; cursor: pointer; }
  .card .erro { color: #b3261e; font-size: 13px; margin-top: 10px; display: none; }
  .oculto { display: none !important; }
</style>
</head>
<body>
<header>
  <div class="avatar">A</div>
  <div>
    <h1>AHRI — Reconstrua</h1>
    <p>Atendimento oficial · revisão de empréstimo consignado do INSS</p>
  </div>
</header>

<div id="entrada">
  <div class="card">
    <h2>Bem-vindo(a)!</h2>
    <p>Este é o canal oficial de atendimento da Reconstrua. Para começar, informe o seu nome e o seu WhatsApp — a nossa assistente AHRI continua o atendimento aqui mesmo.</p>
    <label for="nome">Seu nome</label>
    <input id="nome" autocomplete="name" placeholder="Ex.: Maria Aparecida">
    <label for="fone">Seu WhatsApp (com DDD)</label>
    <input id="fone" inputmode="numeric" autocomplete="tel" placeholder="Ex.: 48 99999-9999">
    <button id="comecar">Iniciar atendimento</button>
    <div class="erro" id="erroEntrada"></div>
  </div>
</div>

<main id="chat" class="oculto"></main>
<div id="digitando" class="oculto"><span></span><span></span><span></span></div>
<footer id="rodape" class="oculto">
  <button class="btn btn-anexo" id="anexar" title="Enviar o HISCON em PDF">&#128206;</button>
  <input type="file" id="arquivo" accept="application/pdf" class="oculto">
  <textarea id="texto" rows="1" placeholder="Escreva a sua mensagem…"></textarea>
  <button class="btn btn-enviar" id="enviar" title="Enviar">&#10148;</button>
</footer>

<script>
(function () {
  var token = sessionStorage.getItem('wcToken') || '';
  var ultimaQtd = -1;
  var chat = document.getElementById('chat');
  var entrada = document.getElementById('entrada');
  var rodape = document.getElementById('rodape');
  var texto = document.getElementById('texto');
  var digitando = document.getElementById('digitando');
  // AGILIDADE (2026-08-26): depois que o cliente envia, o polling ACELERA
  // (800ms) até a resposta da AHRI chegar (ou 90s), e o balão "digitando…"
  // preenche a espera. Fora disso, cadência normal de 2,5s.
  var aguardandoDesde = 0;   // 0 = não esperando resposta
  var ahriAoEnviar = 0;      // quantas mensagens da AHRI existiam quando enviamos
  var ultimoAhri = 0;        // contagem corrente de mensagens da AHRI

  function contarAhri(mensagens) {
    var n = 0;
    for (var i = 0; i < mensagens.length; i += 1) if (mensagens[i].de === 'ahri') n += 1;
    return n;
  }
  function esperarResposta() {
    aguardandoDesde = Date.now();
    ahriAoEnviar = ultimoAhri;
    digitando.classList.remove('oculto');
    chat.scrollTop = chat.scrollHeight;
    rajada();
  }
  function rajada() {
    if (aguardandoDesde === 0) return;
    if (Date.now() - aguardandoDesde > 90000) { pararEspera(); return; }
    atualizar();
    setTimeout(rajada, 800);
  }
  function pararEspera() {
    aguardandoDesde = 0;
    digitando.classList.add('oculto');
  }

  function post(caminho, corpo) {
    return fetch(caminho, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corpo)
    }).then(function (r) { return r.json(); }).catch(function () { return null; });
  }

  function mostrarChat() {
    entrada.classList.add('oculto');
    chat.classList.remove('oculto');
    rodape.classList.remove('oculto');
    atualizar();
    setInterval(atualizar, 2500);
  }

  function hora(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  function desenhar(mensagens) {
    if (mensagens.length === ultimaQtd) return;
    var deveRolar = chat.scrollTop + chat.clientHeight >= chat.scrollHeight - 60;
    ultimaQtd = mensagens.length;
    chat.textContent = '';
    var avisoEl = document.createElement('div');
    avisoEl.className = 'aviso';
    avisoEl.textContent = 'Atendimento seguro da Reconstrua. Nunca pedimos senhas.';
    chat.appendChild(avisoEl);
    for (var i = 0; i < mensagens.length; i += 1) {
      var m = mensagens[i];
      var el = document.createElement('div');
      el.className = 'msg ' + (m.de === 'cliente' ? 'cliente' : 'ahri');
      el.textContent = m.texto;
      var h = document.createElement('span');
      h.className = 'hora';
      h.textContent = hora(m.em);
      el.appendChild(h);
      chat.appendChild(el);
    }
    if (deveRolar || mensagens.length <= 2) chat.scrollTop = chat.scrollHeight;
  }

  function atualizar() {
    if (token === '') return;
    fetch('/webchat/historico?token=' + encodeURIComponent(token))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || j.ok !== true) return;
        var mensagens = j.mensagens || [];
        desenhar(mensagens);
        ultimoAhri = contarAhri(mensagens);
        if (aguardandoDesde > 0 && ultimoAhri > ahriAoEnviar) pararEspera();
      })
      .catch(function () { /* rede oscilou: o próximo polling tenta de novo */ });
  }

  document.getElementById('comecar').addEventListener('click', function () {
    var nome = document.getElementById('nome').value;
    var fone = document.getElementById('fone').value;
    var erro = document.getElementById('erroEntrada');
    erro.style.display = 'none';
    post('/webchat/sessao', { nome: nome, telefone: fone }).then(function (j) {
      if (j && j.ok === true) {
        token = j.token;
        sessionStorage.setItem('wcToken', token);
        mostrarChat();
      } else {
        erro.textContent = (j && j.error) || 'Não foi possível iniciar. Tente de novo.';
        erro.style.display = 'block';
      }
    });
  });

  function enviarTexto() {
    var t = texto.value.trim();
    if (t === '' || token === '') return;
    texto.value = '';
    post('/webchat/mensagem', { token: token, texto: t }).then(function (j) {
      if (j && j.ok === false && j.error) {
        if (String(j.error).indexOf('sess') >= 0) { sessionStorage.removeItem('wcToken'); location.reload(); }
        return;
      }
      esperarResposta();
    });
  }
  document.getElementById('enviar').addEventListener('click', enviarTexto);
  texto.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarTexto(); }
  });

  var arquivo = document.getElementById('arquivo');
  document.getElementById('anexar').addEventListener('click', function () { arquivo.click(); });
  arquivo.addEventListener('change', function () {
    var f = arquivo.files && arquivo.files[0];
    arquivo.value = '';
    if (!f || token === '') return;
    if (f.size > 20 * 1024 * 1024) { alert('O arquivo passa de 20 MB.'); return; }
    var leitor = new FileReader();
    leitor.onload = function () {
      post('/webchat/anexo', { token: token, base64: String(leitor.result), fileName: f.name })
        .then(function (j) {
          if (j && j.ok === false && j.error) { alert(j.error); return; }
          esperarResposta();
        });
    };
    leitor.readAsDataURL(f);
  });

  if (token !== '') {
    fetch('/webchat/historico?token=' + encodeURIComponent(token))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok === true) mostrarChat();
        else { token = ''; sessionStorage.removeItem('wcToken'); }
      })
      .catch(function () { /* sem rede: fica na tela de entrada */ });
  }
})();
</script>
</body>
</html>`;
