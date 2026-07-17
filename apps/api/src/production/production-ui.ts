// ─────────────────────────────────────────────────────────────────────────────
// UI mínima de produção (Monitor + Config) servida pela PRÓPRIA API em
// /production/ui — assim o portal congelado permanece intocado. Uma página,
// dark, auto-refresh, sem dependências. A tela definitiva no portal aguarda
// autorização de descongelamento.
// ─────────────────────────────────────────────────────────────────────────────

export const PRODUCTION_UI_HTML = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AHRIOS — Produção</title>
<style>
body{background:#0b0e14;color:#e6e9f0;font-family:ui-sans-serif,system-ui;margin:0;padding:24px}
h1{font-size:18px}h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#8b93a7;margin:18px 0 8px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
.card{background:#121722;border:1px solid #232b3b;border-radius:10px;padding:12px}
.v{font-size:22px;font-weight:700}.l{font-size:11px;color:#8b93a7}
.ok{color:#34d399}.bad{color:#f87171}.warn{color:#fbbf24}
table{width:100%;border-collapse:collapse;font-size:12px}td,th{padding:6px 8px;border-bottom:1px solid #232b3b;text-align:left}
input,select,textarea{width:100%;background:#0b0e14;color:#e6e9f0;border:1px solid #232b3b;border-radius:6px;padding:7px;font-size:12px;box-sizing:border-box}
button{background:#4f8cff;color:#fff;border:0;border-radius:6px;padding:8px 14px;font-weight:600;cursor:pointer;margin-top:8px}
label{font-size:11px;color:#8b93a7;display:block;margin-top:8px}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:20px}@media(max-width:900px){.cols{grid-template-columns:1fr}}
pre{background:#121722;border:1px solid #232b3b;border-radius:8px;padding:10px;font-size:11px;overflow:auto}
</style></head><body>
<h1>AHRIOS — Monitor de Produção</h1>
<div id="monitor" class="grid"></div>
<h2>WhatsApp</h2>
<div id="whatsapp" class="grid"></div>
<h2>Shadow Center</h2>
<div id="shadow" class="grid"></div>
<div id="detections"></div>
<div class="chat-input" style="margin:10px 0"><input id="shq" placeholder="Pergunte à AHRI sobre a operação (Shadow Reports)…"><button id="shask">Perguntar</button></div>
<pre id="shout" style="display:none"></pre>
<h2>Go-Live Checklist</h2><div id="golive"></div>
<div class="cols"><div>
<h2>Configuração (persistida; segredos mascarados)</h2>
<form id="cfg"></form>
</div><div>
<h2>REAL_FIRST_CLIENT (homologação)</h2>
<button id="rfc">Executar fluxo do primeiro cliente</button>
<pre id="rfcout">—</pre>
</div></div>
<script>
const $=s=>document.querySelector(s);
// B5.1: as rotas /production/* exigem o segredo do operador (Bearer). O console guarda
// o token no localStorage e o injeta em toda chamada; em 401, limpa e repergunta.
let TK=localStorage.getItem('ahrios_token')||'';
function ensureToken(){if(!TK){TK=prompt('Segredo do operador (ADMIN_ACCESS_SECRET):')||'';if(TK)localStorage.setItem('ahrios_token',TK)}}
async function j(u,o){ensureToken();const opt=Object.assign({},o);opt.headers=Object.assign({},o&&o.headers,{authorization:'Bearer '+TK});let r=await fetch(u,opt);if(r.status===401){localStorage.removeItem('ahrios_token');TK='';ensureToken();opt.headers.authorization='Bearer '+TK;r=await fetch(u,opt)}return r.json()}
function stat(l,v,c){return '<div class="card"><div class="v '+(c||'')+'">'+v+'</div><div class="l">'+l+'</div></div>'}
async function monitor(){try{const m=await j('/production/monitor');
$('#monitor').innerHTML=stat('Clientes online',m.clientsOnline)+stat('Conversas',m.conversations)
+stat('Fila scheduler',m.queues.scheduler)+stat('Fila advogado',m.queues.advogado)+stat('Fila perito',m.queues.perito)
+stat('Eventos/s',m.eventsPerSecond.toFixed(2))+stat('LLM ('+m.llm.provider+')',m.llm.calls+' calls')
+stat('Latência média',m.latencyAvgMs?Math.round(m.latencyAvgMs)+' ms':'—')
+stat('Health',m.health,m.health==='ONLINE'?'ok':'bad')+stat('Uptime',m.uptimeSeconds+' s');
}catch(e){$('#monitor').innerHTML='<div class="card bad">API indisponível</div>'}}
async function whatsapp(){try{const w=await j('/production/whatsapp');
const online=w.live&&w.live.state==='open'&&w.matchesOfficial;
$('#whatsapp').innerHTML=stat('WhatsApp',online?'● Online':'○ Offline',online?'ok':'bad')
+stat('Número conectado',w.live&&w.live.number?('+'+w.live.number):'—')
+stat('OwnerJid',(w.live&&w.live.ownerJid)||'—')
+stat('Instância',w.active.instance||(w.pending&&w.pending.instance)||'—')
+stat('Webhook',w.webhookUrl?'configurado':'—')
+stat('Última sync',w.lastSyncAt||'—');
}catch(e){$('#whatsapp').innerHTML='<div class="card bad">WhatsApp indisponível</div>'}}
async function golive(){try{const g=await j('/production/go-live');
$('#golive').innerHTML='<div class="card"><b class="'+(g.ready?'ok':'bad')+'">'+(g.ready?'PRONTO PARA PRODUÇÃO':'PRODUÇÃO BLOQUEADA')+'</b><table>'+
g.results.map(r=>'<tr><td>'+r.item+'</td><td class="'+(r.passed?'ok':'bad')+'">'+(r.passed?'✓':'✗')+'</td><td>'+r.detail+'</td></tr>').join('')+'</table></div>'}catch(e){}}
async function cfg(){const c=await j('/production/config');const f=$('#cfg');
const F=(l,p,v,t)=>'<label>'+l+'</label><input name="'+p+'" value="'+(v??'')+'" type="'+(t||'text')+'">';
const T=(l,p,v)=>'<label>'+l+'</label><textarea name="'+p+'" rows="2">'+(v??'')+'</textarea>';
f.innerHTML=F('Evolution URL','evolution.baseUrl',c.evolution.baseUrl)+F('Evolution instância','evolution.instance',c.evolution.instance)
+F('Evolution API Key','evolution.apiKey',c.evolution.apiKey)+F('Número WhatsApp','evolution.whatsappNumber',c.evolution.whatsappNumber)
+F('Provedor LLM (openai|anthropic|gemini|offline)','llm.provider',c.llm.provider)
+F('OpenAI Key','llm.openaiApiKey',c.llm.openaiApiKey)+F('OpenAI Model','llm.openaiModel',c.llm.openaiModel)
+F('Anthropic Key','llm.anthropicApiKey',c.llm.anthropicApiKey)+F('Anthropic Model','llm.anthropicModel',c.llm.anthropicModel)
+F('Gemini Key','llm.geminiApiKey',c.llm.geminiApiKey)+F('Gemini Model','llm.geminiModel',c.llm.geminiModel)
+F('Meta Access Token','meta.accessToken',c.meta.accessToken)+F('Meta Pixel ID','meta.pixelId',c.meta.pixelId)
+F('URL pública (https)','publicUrl',c.publicUrl)
+T('Prompt Global','prompts.global',c.prompts.global)+T('Prompt Founder','prompts.founder',c.prompts.founder)
+T('Prompt Conversation','prompts.conversation',c.prompts.conversation)+T('Prompt Memory','prompts.memory',c.prompts.memory)
+T('Prompt Admin','prompts.admin',c.prompts.admin)
+'<button type="submit">Salvar configuração</button>';
f.onsubmit=async e=>{e.preventDefault();const d=new FormData(f);const set=(o,p,v)=>{const k=p.split('.');let x=o;for(let i=0;i<k.length-1;i++)x=x[k[i]];x[k[k.length-1]]=v};
const out=JSON.parse(JSON.stringify(c));for(const[p,v]of d.entries())set(out,p,v);
await j('/production/config',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(out)});
alert('Configuração salva. Reinicie o processo para aplicar provedores.');cfg()};}
$('#rfc').onclick=async()=>{$('#rfcout').textContent='executando…';
const r=await j('/production/first-client',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
$('#rfcout').textContent=JSON.stringify(r,null,2)};
async function shadow(){try{const s=await j('/production/shadow/center');
$('#shadow').innerHTML=stat('Turnos',s.summary.totalTurns)+stat('Conversas',s.summary.conversations)
+stat('Decisões',s.summary.decisions)+stat('Entregues',s.summary.delivered)+stat('Silêncios',s.summary.silent)
+stat('Escaladas',s.summary.escalations)+stat('Follow-ups',s.summary.followUps)
+stat('Erros',s.summary.errors,s.summary.errors>0?'bad':'ok')
+stat('Latência p95',Math.round(s.summary.latency.p95Ms)+' ms')
+stat('LLM calls',s.summary.llm.calls)+stat('Tokens in/out',(s.summary.llm.tokensIn??'—')+'/'+(s.summary.llm.tokensOut??'—'))
+stat('Shadow',s.shadowMode?'ATIVO':'inativo',s.shadowMode?'ok':'warn');
$('#detections').innerHTML='<div class="card"><b>Detecções ('+s.detections.length+')</b><table>'+
s.detections.slice(0,30).map(d=>'<tr><td class="'+(d.severity==='CRITICO'||d.severity==='ALTO'?'bad':d.severity==='MEDIO'?'warn':'ok')+'">'+d.severity+'</td><td>'+d.kind+'</td><td>'+d.detail+'</td></tr>').join('')+'</table></div>';
}catch(e){}}
$('#shask').onclick=async()=>{const q=$('#shq').value;if(!q)return;
const a=await j('/production/shadow/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:q})});
$('#shout').style.display='block';$('#shout').textContent=a.answer+'\\n[fonte: '+a.provenance+']'};
monitor();whatsapp();golive();cfg();shadow();setInterval(monitor,5000);setInterval(whatsapp,7000);setInterval(golive,15000);setInterval(shadow,7000);
</script></body></html>`;
