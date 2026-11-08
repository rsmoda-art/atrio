const API = 'https://script.google.com/macros/s/AKfycbyZD-KEfgaA2DmFsEzUUOypom6zVq59P1smBy2E2YJdXCBqvdhsD1OA0tiVtWbHa3BA/exec';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s.split('-').reverse().join('/') : esc(s);
const hoje = () => new Date().toLocaleDateString('sv-SE');
let sessao = JSON.parse(localStorage.getItem('atrio_sessao') || 'null');

const MODS = {
  Visitantes: { titulo: 'Visitantes', icone: '🙋', lista: ['nome','telefone','data_visita','convidado_por'], campos: [
    { n:'nome', l:'Nome', req:1 }, { n:'telefone', l:'Telefone', t:'tel' }, { n:'email', l:'E-mail', t:'email' },
    { n:'data_visita', l:'Data da visita', t:'date', hoje:1 }, { n:'convidado_por', l:'Convidado por' },
    { n:'observacoes', l:'Observações', t:'textarea' } ] },
  Oracoes: { titulo: 'Orações', icone: '🙏', lista: ['nome','categoria','status','data'], filtro: 'status', campos: [
    { n:'nome', l:'Nome (opcional)' }, { n:'pedido', l:'Pedido', t:'textarea', req:1 },
    { n:'categoria', l:'Categoria', op:['Saúde','Família','Finanças','Trabalho','Espiritual','Outros'] },
    { n:'status', l:'Status', op:['Pendente','Em oração','Respondida'] }, { n:'data', l:'Data', t:'date', hoje:1 } ] },
  Aniversariantes: { titulo: 'Aniversariantes', icone: '🎂', lista: ['nome','data_nascimento','telefone'], campos: [
    { n:'nome', l:'Nome', req:1 }, { n:'data_nascimento', l:'Nascimento', t:'date', req:1 }, { n:'telefone', l:'Telefone', t:'tel' } ] },
  Recados: { titulo: 'Recados', icone: '📢', lista: ['tipo','titulo','data'], filtro: 'tipo', campos: [
    { n:'tipo', l:'Tipo', op:['geral','agradecimento','eventos'] }, { n:'titulo', l:'Título', req:1 },
    { n:'mensagem', l:'Mensagem', t:'textarea' }, { n:'data', l:'Data', t:'date', hoje:1 } ] },
  Agendas: { titulo: 'Agendas', icone: '📅', lista: ['titulo','recorrencia','data_inicio','hora','ativo'], filtro: 'recorrencia', campos: [
    { n:'titulo', l:'Título', req:1 }, { n:'descricao', l:'Descrição', t:'textarea' },
    { n:'recorrencia', l:'Recorrência', op:['Única','Diário','Semanal','Quinzenal','Mensal','Semestral','Anual'] },
    { n:'data_inicio', l:'Data inicial', t:'date', hoje:1, req:1 }, { n:'hora', l:'Hora', t:'time' },
    { n:'ativo', l:'Ativo', op:['Sim','Não'] } ] }
};
const campo = (m, n) => m.campos.find(c => c.n === n);

async function api(action, d = {}) {
  const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token: sessao?.token, ...d }) });
  const j = await r.json();
  if (j.erro === 'SESSAO') { sair(); throw new Error('Sessão expirada'); }
  if (!j.ok) throw new Error(j.erro);
  return j;
}

// ---------- LOGIN ----------
$('form-login').addEventListener('submit', async e => {
  e.preventDefault();
  $('btn-entrar').disabled = true; $('erro').textContent = '';
  try {
    sessao = await api('login', { usuario: $('usuario').value.trim(), senha: $('senha').value });
    localStorage.setItem('atrio_sessao', JSON.stringify(sessao));
    abrirApp();
  } catch (err) { $('erro').textContent = err.message || 'Falha na conexão'; }
  $('btn-entrar').disabled = false;
});
function sair() { localStorage.removeItem('atrio_sessao'); location.reload(); }

function abrirApp() {
  $('tela-login').classList.add('hidden');
  $('tela-app').classList.remove('hidden');
  $('nome-usuario').textContent = '👤 ' + sessao.usuario.nome;
  $('nav').innerHTML = `<a data-menu="recepcao">🏠 Recepção</a>` +
    Object.entries(MODS).map(([k, m]) => `<a data-menu="${k}" class="sub">${m.icone} ${m.titulo}</a>`).join('');
  $('nav').querySelectorAll('a').forEach(a => a.onclick = e => { e.preventDefault(); abrir(a.dataset.menu); });
  abrir('recepcao');
}

async function abrir(menu) {
  $('nav').querySelectorAll('a').forEach(a => a.classList.toggle('ativo', a.dataset.menu === menu));
  $('titulo-pagina').textContent = menu === 'recepcao' ? 'Recepção' : MODS[menu].titulo;
  $('sidebar').classList.remove('aberto');
  $('conteudo').innerHTML = '<p class="load">Carregando...</p>';
  try { menu === 'recepcao' ? await painel() : await modulo(menu); }
  catch (err) { $('conteudo').innerHTML = `<p class="erro">${esc(err.message)}</p>`; }
}

// ---------- PAINEL ----------
async function painel() {
  const { dados: r } = await api('resumo');
  const card = (t, ic, itens, fn, menu) => `<div class="box">
    <h3>${ic} ${t} <span class="badge">${itens.length}</span></h3>
    ${itens.length ? '<ul>' + itens.map(fn).join('') + '</ul>' : '<p class="vazio">Nada por aqui.</p>'}
    <a href="#" class="ver" data-ir="${menu}">Ver todos →</a></div>`;
  const dm = s => fmt(s).slice(0, 5);
  $('conteudo').innerHTML = `
    <p class="data-hoje">${new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' })}</p>
    <div class="grid">
      ${card('Visitantes de hoje','🙋', r.visitantes, v => `<li><b>${esc(v.nome)}</b><small>${esc(v.telefone)}${v.convidado_por ? ' · convidado por ' + esc(v.convidado_por) : ''}</small></li>`, 'Visitantes')}
      ${card('Eventos – próximos 7 dias','📅', r.eventos, e => `<li><b>${dm(e.dia)} ${esc(e.hora)}</b> ${esc(e.titulo)} <span class="tag">${esc(e.recorrencia)}</span></li>`, 'Agendas')}
      ${card('Orações – últimos 4 dias','🙏', r.oracoes, o => `<li><b>${esc(o.nome || 'Anônimo')}</b> <span class="tag">${esc(o.categoria)}</span><small>${dm(o.data)} · ${esc(o.pedido)}</small></li>`, 'Oracoes')}
      ${card('Aniversariantes – 7 dias','🎂', r.aniversariantes, a => `<li><b>${dm(a.proximo)}</b> ${esc(a.nome)} ${a.proximo === r.hoje ? '🎉' : ''}<small>${esc(a.telefone)}</small></li>`, 'Aniversariantes')}
      ${card('Recados de hoje','📢', r.recados, m => `<li><span class="tag">${esc(m.tipo)}</span> <b>${esc(m.titulo)}</b><small>${esc(m.mensagem)}</small></li>`, 'Recados')}
    </div>`;
  $('conteudo').querySelectorAll('[data-ir]').forEach(a => a.onclick = e => { e.preventDefault(); abrir(a.dataset.ir); });
}

// ---------- CADASTROS ----------
let cache = [];
async function modulo(t) {
  const m = MODS[t];
  cache = (await api('listar', { tabela: t })).dados.reverse();
  $('conteudo').innerHTML = `
    <div class="barra">
      <input id="busca" placeholder="🔎 Buscar...">
      ${m.filtro ? `<select id="filtro"><option value="">Todos</option>${campo(m, m.filtro).op.map(o => `<option>${o}</option>`).join('')}</select>` : ''}
      <button id="novo">+ Novo</button>
    </div>
    <div class="tabela-wrap"><table>
      <thead><tr>${m.lista.map(c => `<th>${campo(m, c).l}</th>`).join('')}<th></th></tr></thead>
      <tbody id="linhas"></tbody>
    </table></div>`;
  const render = () => {
    const q = $('busca').value.toLowerCase(), f = $('filtro')?.value;
    const rows = cache.filter(r => (!f || r[m.filtro] === f) && JSON.stringify(r).toLowerCase().includes(q));
    $('linhas').innerHTML = rows.map(r => `<tr data-id="${r.id}">${m.lista.map(c => `<td>${fmt(r[c])}</td>`).join('')}
      <td class="acoes"><button class="mini" data-ed>✏️</button><button class="mini" data-del>🗑️</button></td></tr>`).join('')
      || `<tr><td colspan="${m.lista.length + 1}" class="vazio">Nenhum registro.</td></tr>`;
  };
  $('busca').oninput = render;
  if ($('filtro')) $('filtro').onchange = render;
  $('novo').onclick = () => formulario(t);
  $('linhas').onclick = async e => {
    const id = e.target.closest('tr')?.dataset.id; if (!id) return;
    if (e.target.closest('[data-ed]')) formulario(t, cache.find(r => r.id === id));
    if (e.target.closest('[data-del]') && confirm('Excluir este registro?')) { await api('excluir', { tabela: t, id }); abrir(t); }
  };
  render();
}

function formulario(t, reg = {}) {
  const m = MODS[t];
  $('dlg-titulo').textContent = `${reg.id ? 'Editar' : 'Novo'} – ${m.titulo}`;
  $('dlg-campos').innerHTML = m.campos.map(c => {
    const v = esc(reg[c.n] ?? (c.hoje ? hoje() : ''));
    const at = `name="${c.n}" ${c.req ? 'required' : ''}`;
    const inp = c.t === 'textarea' ? `<textarea ${at} rows="3">${v}</textarea>`
      : c.op ? `<select ${at}>${c.op.map(o => `<option ${o === reg[c.n] ? 'selected' : ''}>${o}</option>`).join('')}</select>`
      : `<input type="${c.t || 'text'}" ${at} value="${v}">`;
    return `<label>${c.l}${inp}</label>`;
  }).join('');
  $('dlg').showModal();
  $('dlg-form').onsubmit = async e => {
    e.preventDefault();
    $('dlg-salvar').disabled = true;
    try {
      const dados = Object.fromEntries(new FormData(e.target));
      if (reg.id) dados.id = reg.id;
      await api('salvar', { tabela: t, dados });
      $('dlg').close(); abrir(t);
    } catch (err) { alert(err.message); }
    $('dlg-salvar').disabled = false;
  };
}

// ---------- INIT ----------
$('btn-menu').onclick = () => $('sidebar').classList.toggle('aberto');
$('btn-sair').onclick = sair;
if (sessao) api('verify').then(abrirApp).catch(() => {});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
