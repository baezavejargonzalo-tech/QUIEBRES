// ── ESTADO ─────────────────────────────────────────────────────────────────────
let currentTipo = 'all';
let currentPlanta = 'all';
let currentGrupo = []; // varios grupos de marketing seleccionables a la vez
let currentCategoria = 'all';
let skuSearch = '';

// ── UTILIDADES ─────────────────────────────────────────────────────────────────
function toggleHelp() {
  document.getElementById('helpbox').classList.toggle('open');
}

// ── SETTERS (filtros compartidos) ────────────────────────────────────────────────
function setTipo(tipo, btn) {
  document.querySelectorAll('.filterbar .tipo-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentTipo = tipo;
  renderRiesgos();
}
function setPlanta(val) {
  currentPlanta = val;
  renderRiesgos();
}
function toggleGrupoFilter(g, checked) {
  if (checked) {
    if (!currentGrupo.includes(g)) currentGrupo.push(g);
  } else {
    currentGrupo = currentGrupo.filter(x => x !== g);
  }
  updateGrupoLabel();
  updateGrupoTodosCheckbox();
  renderRiesgos();
}
function selectTodosGrupos() {
  currentGrupo = [];
  document.querySelectorAll('#grupoDropdown .grupo-item-cb').forEach(cb => cb.checked = false);
  updateGrupoLabel();
  updateGrupoTodosCheckbox();
  renderRiesgos();
}
function updateGrupoTodosCheckbox() {
  const cb = document.getElementById('grupoTodosCb');
  if (cb) cb.checked = currentGrupo.length === 0;
}
function updateGrupoLabel() {
  const lbl = document.getElementById('grupoSelLabel');
  if (!lbl) return;
  if (currentGrupo.length === 0) lbl.textContent = 'Todos los grupos';
  else if (currentGrupo.length === 1) lbl.textContent = currentGrupo[0];
  else lbl.textContent = `${currentGrupo.length} grupos seleccionados`;
}
function toggleGrupoDropdown(ev) {
  if (ev) ev.stopPropagation();
  const dd = document.getElementById('grupoDropdown');
  if (!dd) return;
  dd.style.display = dd.style.display === 'none' ? '' : 'none';
}
document.addEventListener('click', ev => {
  const dd = document.getElementById('grupoDropdown');
  const btn = document.getElementById('grupoSelBtn');
  if (!dd || dd.style.display === 'none') return;
  if (dd.contains(ev.target) || (btn && btn.contains(ev.target))) return;
  dd.style.display = 'none';
});
function setCategoria(val) {
  currentCategoria = val;
  renderRiesgos();
}
function setSkuSearch(val) {
  skuSearch = val;
  renderRiesgos();
}
function resetFiltros() {
  currentTipo = 'all';
  currentPlanta = 'all';
  currentGrupo = [];
  currentCategoria = 'all';
  skuSearch = '';
  document.querySelectorAll('.filterbar .tipo-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  const pSel = document.getElementById('plantaSel');
  if (pSel) pSel.value = 'all';
  document.querySelectorAll('#grupoDropdown .grupo-item-cb').forEach(cb => cb.checked = false);
  updateGrupoTodosCheckbox();
  updateGrupoLabel();
  const cSel = document.getElementById('categoriaSel');
  if (cSel) cSel.value = 'all';
  const sInput = document.getElementById('skuSearchInput');
  if (sInput) sInput.value = '';
  renderRiesgos();
}

function initPlantaSelect() {
  const sel = document.getElementById('plantaSel');
  if (!sel || sel.options.length > 1) return;
  const plantas = [...new Set(RIESGOS.map(r => r.planta))].sort();
  plantas.forEach(p => {
    const o = document.createElement('option');
    o.value = p; o.textContent = p;
    sel.appendChild(o);
  });
}
function initGrupoSelect() {
  const dd = document.getElementById('grupoDropdown');
  if (!dd || dd.dataset.init) return;
  dd.dataset.init = '1';
  const grupos = [...new Set(RIESGOS.map(r => r.grupo))].filter(Boolean).sort();
  const todosHtml = `
    <label style="display:flex;align-items:center;gap:8px;padding:6px 8px 10px;border-bottom:1px solid var(--border);margin-bottom:4px;cursor:pointer;font-size:12.5px;font-weight:700;color:var(--dark2);white-space:nowrap">
      <input type="checkbox" id="grupoTodosCb" checked onchange="if(this.checked){selectTodosGrupos()}else{this.checked=true}">Todos los grupos
    </label>`;
  const itemsHtml = grupos.map(g => `
    <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:12.5px;color:var(--dark2);white-space:nowrap">
      <input type="checkbox" class="grupo-item-cb" value="${g}" onchange="toggleGrupoFilter('${g}', this.checked)">${g}
    </label>`).join('');
  dd.innerHTML = todosHtml + itemsHtml;
  const btn = document.getElementById('grupoSelBtn');
  if (btn) btn.title = `Filtrar por grupo de marketing (elige uno o varios) — cruzado por SKU con LOGISTICO: ${GRUPO_COVERAGE.con_grupo} de ${GRUPO_COVERAGE.total} SKU en riesgo tienen grupo asignado`;
}
function initCategoriaSelect() {
  const sel = document.getElementById('categoriaSel');
  if (!sel || sel.options.length > 1) return;
  const cats = [...new Set(RIESGOS.map(r => r.cat))].filter(Boolean).sort();
  cats.forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    sel.appendChild(o);
  });
}

let riesgosFilter = 'all';
let riesgsSem = 'all';

function setRiesgSem(v) {
  riesgsSem = v;
  const lbl = document.getElementById('subcatSemLabel');
  if (lbl) lbl.textContent = (v === 'all' ? 'semana actual' : 'semana ' + v) + ' · ton';
  renderRiesgosSubcat();
  renderRiesgosQuebraKPIs();
  renderRiesgosTable();
}

// Quiebre (ton) de un SKU para la "Semana quiebres" seleccionada arriba.
// 'all' usa el total de semanas ya calculado en RIESGOS; un mes (ej. 'Ago')
// suma las semanas de ese mes; una semana puntual (ej. 'S34') usa solo esa.
function getQuiebreTon(r) {
  if (riesgsSem === 'all') return r.quiebre_ton || 0;
  const bySem = QUIEBRE_SKU_SEM[r.sku];
  if (!bySem) return 0;
  if (MES_MAP[riesgsSem]) {
    return MES_MAP[riesgsSem].reduce((sum, s) => sum + (bySem[s] || 0), 0);
  }
  return bySem[riesgsSem] || 0;
}
function renderRiesgosSubcat() {
  // Usar datos de quiebres de la semana seleccionada para el chart subcategoría
  const sem = riesgsSem === 'all' ? null : riesgsSem;
  const d = sem ? (DB_QUIEBRES[currentTipo] && DB_QUIEBRES[currentTipo][sem]) : (DB_QUIEBRES[currentTipo] && DB_QUIEBRES[currentTipo]['all']);
  const el = document.getElementById('chartSubcat');
  if (!el) return;
  if (BY_SUBCAT && !sem) {
    const PAL = ['#C8001E', '#c84000', '#b06010', '#2D5BE3', '#009060', '#7A5AA0', '#1a6a8a', '#a03050', '#508030', '#7A5A10'];
    const entries = Object.entries(BY_SUBCAT);
    if (!entries.length) { el.innerHTML = '<p style="color:var(--muted);font-size:12px">Sin datos</p>'; return; }
    const maxV = Math.max(...entries.map(([, v]) => v));
    el.innerHTML = entries.map(([k, v], i) => {
      const col = PAL[i] || '#555'; const pct = (v / maxV * 100).toFixed(1);
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:11px">
        <div style="min-width:140px;font-size:11px;font-weight:600;color:var(--dark2)" title="${k}">${k.length > 26 ? k.slice(0, 26) + '…' : k}</div>
        <div style="flex:1;background:var(--gray2);border-radius:4px;height:8px">
          <div style="height:8px;border-radius:4px;width:${pct}%;background:${col};transition:width .4s"></div></div>
        <div style="text-align:right;min-width:62px"><span style="font-family:var(--cond);font-size:18px;font-weight:800;color:${col}">${v.toLocaleString('es-CL', { minimumFractionDigits: 1 })}</span>
          <span style="font-size:9px;color:var(--muted);margin-left:2px">ton</span></div></div>`;
    }).join('');
  } else if (d && d.skus && d.skus.length) {
    const bycat = {};
    d.skus.forEach(s => { bycat[s.cat] = (bycat[s.cat] || 0) + s.q; });
    const sorted = Object.entries(bycat).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const PAL = ['#C8001E', '#c84000', '#b06010', '#2D5BE3', '#009060', '#7A5AA0', '#1a6a8a', '#a03050'];
    if (!sorted.length) { el.innerHTML = '<p style="color:var(--muted);font-size:12px">Sin datos para esta semana</p>'; return; }
    const maxV = Math.max(...sorted.map(([, v]) => v));
    el.innerHTML = sorted.map(([k, v], i) => {
      const col = PAL[i] || '#555'; const pct = (v / maxV * 100).toFixed(1);
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:11px">
        <div style="min-width:140px;font-size:11px;font-weight:600;color:var(--dark2)">${k.length > 26 ? k.slice(0, 26) + '…' : k}</div>
        <div style="flex:1;background:var(--gray2);border-radius:4px;height:8px">
          <div style="height:8px;border-radius:4px;width:${pct}%;background:${col};transition:width .4s"></div></div>
        <div style="text-align:right;min-width:62px"><span style="font-family:var(--cond);font-size:18px;font-weight:800;color:${col}">${v.toLocaleString('es-CL', { minimumFractionDigits: 1 })}</span>
          <span style="font-size:9px;color:var(--muted);margin-left:2px">ton</span></div></div>`;
    }).join('');
  } else {
    el.innerHTML = '<p style="color:var(--muted);font-size:12px">Sin datos</p>';
  }
}
function renderRiesgosQuebraKPIs() {
  const sem = riesgsSem === 'all' ? null : riesgsSem;
  const d = sem ? (DB_QUIEBRES[currentTipo] && DB_QUIEBRES[currentTipo][sem]) : (DB_QUIEBRES[currentTipo] && DB_QUIEBRES[currentTipo]['all']);
  const el = document.getElementById('riesgo-quebra-kpis');
  if (!el || !d) return;
  const semLabel = sem || 'Todas las semanas';
  el.innerHTML = `
    <div style="background:var(--card);border:1.5px solid var(--border);border-radius:10px;padding:8px 14px;display:flex;align-items:center;gap:8px;flex:1;min-width:150px">
      <div style="font-size:18px;font-family:var(--cond);font-weight:900;color:#C8001E">${d.q.toLocaleString('es-CL', { minimumFractionDigits: 1 })}</div>
      <div><div style="font-size:9.5px;font-weight:800;color:#C8001E;text-transform:uppercase">ton Quebradas</div><div style="font-size:9px;color:var(--muted)">${semLabel}</div></div>
    </div>
    <div style="background:var(--card);border:1.5px solid var(--border);border-radius:10px;padding:8px 14px;display:flex;align-items:center;gap:8px;flex:1;min-width:150px">
      <div style="font-size:18px;font-family:var(--cond);font-weight:900;color:#2D5BE3">${d.fcst.toLocaleString('es-CL', { minimumFractionDigits: 1 })}</div>
      <div><div style="font-size:9.5px;font-weight:800;color:#2D5BE3;text-transform:uppercase">ton FCST</div><div style="font-size:9px;color:var(--muted)">${semLabel}</div></div>
    </div>
    <div style="background:var(--card);border:1.5px solid var(--border);border-radius:10px;padding:8px 14px;display:flex;align-items:center;gap:8px;flex:1;min-width:150px">
      <div style="font-size:18px;font-family:var(--cond);font-weight:900;color:#009060">${d.vr.toLocaleString('es-CL', { minimumFractionDigits: 1 })}</div>
      <div><div style="font-size:9.5px;font-weight:800;color:#009060;text-transform:uppercase">ton Venta Real</div><div style="font-size:9px;color:var(--muted)">${semLabel}</div></div>
    </div>`;
}

function filterRiesgos(f, btn) {
  riesgosFilter = f;
  document.querySelectorAll('.rpill').forEach(b => { b.style.background = '#fff'; b.style.color = '#555'; b.style.borderColor = '#ddd'; });
  btn.style.background = '#fff0f0'; btn.style.color = '#C8001E'; btn.style.borderColor = '#C8001E';
  renderRiesgosTable();
}
function renderCharts() {
  /* ── PALETA ── */
  const PAL = ['#C8001E', '#c84000', '#b06010', '#2D5BE3', '#009060', '#7A5AA0', '#1a6a8a', '#a03050', '#508030', '#7A5A10'];
  const bar = (el, entries, valFn, labelFn, unitLabel) => {
    if (!el || !entries.length) return;
    const maxV = Math.max(...entries.map(e => valFn(e)));
    el.innerHTML = entries.map(([k, v], i) => {
      const col = PAL[i] || '#555'; const pct = (valFn([k, v]) / maxV * 100).toFixed(1);
      const lbl = labelFn(k);
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:11px">
        <div style="min-width:140px;font-size:11px;font-weight:600;color:var(--dark2)" title="${k}">${lbl}</div>
        <div style="flex:1;background:var(--gray2);border-radius:4px;height:8px">
          <div style="height:8px;border-radius:4px;width:${pct}%;background:${col};transition:width .4s"></div></div>
        <div style="text-align:right;min-width:62px">
          <span style="font-family:var(--cond);font-size:18px;font-weight:800;color:${col}">${valFn([k, v]).toLocaleString('es-CL', { minimumFractionDigits: typeof v === 'number' && v % 1 !== 0 ? 1 : 0 })}</span>
          <span style="font-size:9px;color:var(--muted);margin-left:2px">${unitLabel}</span></div></div>`;
    }).join('');
  };

  bar(document.getElementById('chartPlanta'), Object.entries(BY_PLANT), ([, v]) => v, k => k, 'SKUs');
  bar(document.getElementById('chartCat'), Object.entries(BY_CAT), ([, v]) => v, k => k.length > 26 ? k.slice(0, 26) + '…' : k, 'SKUs');
  if (BY_SUBCAT) bar(document.getElementById('chartSubcat'), Object.entries(BY_SUBCAT), ([, v]) => v, k => k.length > 26 ? k.slice(0, 26) + '…' : k, 'ton');
}

// CPFR: en este archivo "tipo" (Refrigerados/Abarrotes) es la clasificación
// Frío/Seco que usan los equipos de planificación.
const cpfrLabel = tipo => tipo === 'Refrigerados' ? 'Frío' : tipo === 'Abarrotes' ? 'Seco' : (tipo || '—');

// Filtro combinado de la tabla / export: Tipo (CPFR), Planta, Grupo de
// Marketing, Categoría y Búsqueda de SKU — aplicado sobre cualquier subset
// de RIESGOS (ya viene ordenado por alcance ascendente y, en empate, por
// FCST semanal descendente).
function filterRiesgosBase(list) {
  let filtered = list;
  if (currentPlanta !== 'all') filtered = filtered.filter(r => r.planta === currentPlanta);
  if (currentTipo !== 'all') filtered = filtered.filter(r => r.tipo === currentTipo);
  if (currentGrupo.length) filtered = filtered.filter(r => currentGrupo.includes(r.grupo));
  if (currentCategoria !== 'all') filtered = filtered.filter(r => r.cat === currentCategoria);
  const q = skuSearch.trim().toLowerCase();
  if (q) filtered = filtered.filter(r => r.n.toLowerCase().includes(q) || String(r.sku).toLowerCase().includes(q));
  return filtered;
}
function getFilteredRiesgos() {
  return filterRiesgosBase(riesgosFilter === 'all' ? RIESGOS : RIESGOS.filter(r => r.riesgo === riesgosFilter));
}
// SKU crítico "estancado": sin XLIB ni tránsito en camino — no tiene fecha
// de recuperación conocida, no se va a resolver solo. Respeta los mismos
// filtros que la tabla Top 50.
function getCriticosFiltrados() {
  return filterRiesgosBase(RIESGOS.filter(r => r.riesgo === 'critico'));
}
function getEstancados() {
  return getCriticosFiltrados().filter(r => !(r.stock_xlib > 0 || r.stock_transito > 0));
}

function renderRiesgoCrossFilterNote() {
  const el = document.getElementById('riesgoCrossFilterNote');
  if (!el) return;
  const activos = [];
  if (currentTipo !== 'all') activos.push(`CPFR: ${cpfrLabel(currentTipo)}`);
  if (currentPlanta !== 'all') activos.push(`Planta: ${currentPlanta}`);
  if (currentGrupo.length) activos.push(`Grupo: ${currentGrupo.join(', ')}`);
  if (currentCategoria !== 'all') activos.push(`Categoría: ${currentCategoria}`);
  if (skuSearch.trim()) activos.push(`Búsqueda: "${skuSearch.trim()}"`);

  let html = '';
  if (activos.length) {
    html += `🔗 Filtros activos — ${activos.join(' · ')}. <button onclick="resetFiltros()" style="border:none;background:none;color:var(--red);font-weight:700;font-size:12px;cursor:pointer;padding:0;text-decoration:underline">Quitar</button>`;
  }
  if (currentGrupo.length) {
    html += `${html ? '<br>' : ''}ℹ️ El Grupo de Marketing se cruza por código de SKU con el historial de quiebres (LOGISTICO) — solo ${GRUPO_COVERAGE.con_grupo} de los ${GRUPO_COVERAGE.total} SKU en riesgo tienen grupo asignado; los que no tienen pedidos recientes no aparecen al filtrar por grupo.`;
  }
  if (currentPlanta !== 'all') {
    const totalPlanta = RIESGOS.filter(r => r.planta === currentPlanta).length;
    html += `${html ? '<br>' : ''}📍 Mostrando el detalle <b>completo</b> de ${currentPlanta}: sus ${totalPlanta} SKU en riesgo (crítico + alerta).`;
  }
  if (riesgsSem !== 'all') {
    html += `${html ? '<br>' : ''}📅 La columna <b>Quiebre (ton)</b> muestra solo ${MES_MAP[riesgsSem] ? 'el mes' : 'la semana'} <b>${riesgsSem}</b> (seleccionado en "Semana quiebres" más arriba), no el total de todas las semanas.`;
  }
  if (html) { el.style.display = ''; el.innerHTML = html; } else { el.style.display = 'none'; }
}

// ── ¿QUÉ NECESITA ACCIÓN HOY? ──────────────────────────────────────────────────
// De los críticos filtrados: separa los que ya tienen stock en camino (XLIB o
// tránsito) de los que están estancados sin ninguna fecha de recuperación a
// la vista, y lista los 10 estancados con menor alcance para actuar primero.
function renderAccionHoy() {
  const el = document.getElementById('accionHoy');
  if (!el) return;
  const criticosF = getCriticosFiltrados();
  const estancados = getEstancados();
  const enCamino = criticosF.length - estancados.length;
  const totalF = criticosF.length;
  const pctEst = totalF > 0 ? Math.round(estancados.length / totalF * 100) : 0;
  const pctCam = totalF > 0 ? 100 - pctEst : 0;

  const cardsHtml = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;height:100%">
      <div style="background:#fff0f0;border:2px solid #ffb3b3;border-radius:16px;padding:20px 22px;position:relative;overflow:hidden;display:flex;flex-direction:column;gap:6px">
        <div style="position:absolute;top:0;left:0;right:0;height:4px;background:#C8001E"></div>
        <div style="display:flex;align-items:baseline;gap:10px">
          <div style="font-size:48px;line-height:1;font-family:var(--cond);font-weight:900;color:#C8001E">${estancados.length}</div>
          ${totalF > 0 ? `<div style="font-family:var(--cond);font-size:15px;font-weight:800;color:#C8001E">${pctEst}%</div>` : ''}
        </div>
        <div style="font-size:12px;font-weight:800;color:#C8001E;text-transform:uppercase;letter-spacing:.5px">🚨 Estancados — actuar hoy</div>
        <div style="font-size:11px;color:var(--muted);line-height:1.4">Sin XLIB ni tránsito en camino. No se resuelven solos.</div>
      </div>
      <div style="background:#f0faf3;border:2px solid #b8e6c8;border-radius:16px;padding:20px 22px;position:relative;overflow:hidden;display:flex;flex-direction:column;gap:6px">
        <div style="position:absolute;top:0;left:0;right:0;height:4px;background:#1a8a3a"></div>
        <div style="display:flex;align-items:baseline;gap:10px">
          <div style="font-size:48px;line-height:1;font-family:var(--cond);font-weight:900;color:#1a8a3a">${enCamino}</div>
          ${totalF > 0 ? `<div style="font-family:var(--cond);font-size:15px;font-weight:800;color:#1a8a3a">${pctCam}%</div>` : ''}
        </div>
        <div style="font-size:12px;font-weight:800;color:#1a8a3a;text-transform:uppercase;letter-spacing:.5px">🚚 Ya en camino</div>
        <div style="font-size:11px;color:var(--muted);line-height:1.4">Tienen XLIB o tránsito asignado — solo hay que confirmar fecha.</div>
      </div>
    </div>`;

  const gruposAccion = ['GRUPO PLF', 'GRUPO QUESOS, UNTABLES Y JUGOS', 'GRUPO FRUTAS Y ACEITES', 'GRUPO LACTEOS Y JUGOS'];
  const filtroGrupoActivo = currentGrupo.length > 0;
  const porGrupo = (filtroGrupoActivo ? currentGrupo : gruposAccion).map(g => {
    const all = estancados.filter(r => r.grupo === g);
    return { g, items: filtroGrupoActivo ? all : all.slice(0, 3), total: all.length };
  });
  const totalMostrados = porGrupo.reduce((acc, x) => acc + x.items.length, 0);
  const hayMasPorGrupo = !filtroGrupoActivo && porGrupo.some(x => x.total > 3);
  const itemsFlat = porGrupo.flatMap(x => x.items);
  const listHtml = totalMostrados ? `
    <div style="overflow-x:auto">
    <table class="tbl">
      <thead><tr><th>SKU</th><th>Producto</th><th class="r">Alcance</th><th class="r">FCST sem</th></tr></thead>
      <tbody>
      ${itemsFlat.map(r => `<tr>
        <td style="font-size:11px;color:var(--muted);white-space:nowrap">${r.sku}</td>
        <td style="font-weight:600;max-width:220px">
          <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${r.n}">${r.n}</div>
          <div style="font-size:10px;color:var(--muted)">${r.cat} · ${r.planta}</div>
        </td>
        <td class="r"><span style="font-family:var(--cond);font-size:18px;font-weight:900;color:#C8001E">${r.alcance.toFixed(1)}</span><div style="font-size:9px;color:var(--muted)">sem</div></td>
        <td class="r"><span style="font-family:var(--cond);font-size:15px;color:var(--dark2)">${r.fcst.toLocaleString('es-CL', { minimumFractionDigits: 0 })}</span></td>
      </tr>`).join('')}
      </tbody>
    </table>
    </div>
    ${hayMasPorGrupo ? `<div style="text-align:center;padding:8px 0 0;font-size:11px;color:var(--muted)">Mostrando 3 por grupo — usa los filtros de arriba o descarga el Excel (Top 50) para ver el listado completo por grupo.</div>` : ''}
  ` : `<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">✅ Ningún SKU crítico está estancado con este filtro</div>`;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1.3fr;gap:14px;align-items:stretch">
      <div>${cardsHtml}</div>
      <div class="panel" style="padding:16px 18px;margin:0">
        <div class="panel-title" style="margin-bottom:10px">🚨 Críticos sin fecha de recuperación · 3 por grupo</div>
        ${listHtml}
      </div>
    </div>`;
}

// ── EXPORTAR TOP 50 A EXCEL (CSV) ──────────────────────────────────────────────
// Junta, por SKU: estado de riesgo, stock, FCST, alcance (de RIESGOS),
// quiebre (getQuiebreTon — total o acotado a la semana/mes elegido en
// "Semana quiebres", cruzado por código de SKU contra LOGISTICO) y merma
// (buscada por código de SKU en MERMA_VENC). Se exporta como CSV
// separado por ";" con BOM UTF-8 — Excel lo abre directo, con acentos y
// decimales correctos. Usa el mismo filtro combinado que la tabla en pantalla.
function exportRiesgosExcel() {
  const filtered = getFilteredRiesgos();
  if (!filtered.length) { alert('No hay filas para exportar con este filtro.'); return; }

  const mermaBySku = {};
  (MERMA_VENC || []).forEach(m => { mermaBySku[m.sku] = m; });

  const headers = ['SKU', 'Producto', 'Planta',
    'FCST semanal (kg)', 'Alcance (sem)',
    'Stock disponible (kg)', 'Quiebre (ton)', 'Stock bloqueado (kg)', 'Stock XLIB (kg)', 'Fecha liberación XLIB',
    'Stock tránsito (kg)', 'Devoluciones (ton)', 'Cadenas fuera de filtro VU', 'Kg fuera de filtro VU',
    'Cadenas por vencer VU', 'Kg por vencer VU', 'Días para vencer VU',
    'Venta Intermedia/Liquidación (kg)',
    'Merma - días a vencer', 'Merma - kg en riesgo', 'Merma - nivel', 'Grupo de Marketing', 'Categoría', 'CPFR', 'Estado riesgo'];
  const numCols = [3, 4, 5, 6, 7, 8, 10, 11, 13, 15, 16, 17, 18, 19];

  const rows = filtered.map(r => {
    const m = mermaBySku[r.sku];
    return [
      r.sku, r.n, r.planta,
      r.fcst, r.alcance,
      r.stock, getQuiebreTon(r) || '', r.stock_bloq, r.stock_xlib || '', r.xlib_fecha || '',
      r.stock_transito || '', r.devolucion || '',
      r.vu_cadenas || '', r.vu_kg || '',
      r.vu_alerta_cadenas || '', r.vu_alerta_kg || '', r.vu_alerta_dias != null ? r.vu_alerta_dias : '',
      (r.vta_int + r.vta_liq) || '',
      m ? m.dias : '',
      m ? m.kilos : '',
      m ? (m.nivel === 'critico' ? 'Crítico' : 'Alerta') : '',
      r.grupo || '', r.cat, cpfrLabel(r.tipo),
      r.riesgo === 'critico' ? 'Crítico' : 'Alerta'
    ];
  });

  const escCsv = v => {
    if (v === null || v === undefined || v === '') return '';
    const s = String(v).replace(/"/g, '""');
    return /[;"\n]/.test(s) ? `"${s}"` : s;
  };
  const cellCsv = (v, i) => numCols.includes(i) && typeof v === 'number' ? String(v).replace('.', ',') : escCsv(v);

  const lines = [headers.map(escCsv).join(';')];
  rows.forEach(row => lines.push(row.map(cellCsv).join(';')));

  const csv = '﻿' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `riesgo_quiebre_${riesgosFilter}_${currentPlanta}_${currentTipo}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Exporta la tabla de Riesgo de Merma por Categoría — mismos filtros
// (Categoría/Grupo/Búsqueda) y columnas que se ven en pantalla.
function exportMermaCategoriaExcel() {
  let items = MERMA_CATEGORIA || [];
  if (currentCategoria !== 'all') items = items.filter(x => x.cat === currentCategoria);
  if (currentGrupo.length) items = items.filter(x => currentGrupo.includes(x.grupo));
  const q = skuSearch.trim().toLowerCase();
  if (q) items = items.filter(x => x.n.toLowerCase().includes(q) || String(x.sku).toLowerCase().includes(q));
  if (!items.length) { alert('No hay filas para exportar con este filtro.'); return; }

  const headers = ['SKU', 'Producto', 'Categoría', 'Grupo de Marketing',
    'Cadena más exigente', '% Avance Máx. Aceptado', '% VU avanzada', 'Kg en riesgo', '% Faltante para salir', 'Cadenas por vencer'];
  const numCols = [5, 6, 7, 8];

  const rows = items.map(x => [
    x.sku, x.n, x.cat, x.grupo || '',
    x.cadena_exigente, x.pct_aceptacion, x.vu_avance_pct, x.kg,
    x.margen_pct,
    x.cadenas_por_vencer
  ]);

  const escCsv = v => {
    if (v === null || v === undefined || v === '') return '';
    const s = String(v).replace(/"/g, '""');
    return /[;"\n]/.test(s) ? `"${s}"` : s;
  };
  const cellCsv = (v, i) => numCols.includes(i) && typeof v === 'number' ? String(v).replace('.', ',') : escCsv(v);

  const lines = [headers.map(escCsv).join(';')];
  rows.forEach(row => lines.push(row.map(cellCsv).join(';')));

  const csv = '﻿' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `riesgo_merma_categoria_${currentCategoria}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function renderRiesgosTable() {
  const body = document.getElementById('riesgosBody'); if (!body) return;
  const tituloEl = document.getElementById('riesgosTablaTitulo');
  const ep = currentPlanta;
  if (tituloEl) {
    tituloEl.textContent = ep !== 'all' ? `📋 Detalle · Planta ${ep}` : '📋 Top 50 · Menor Alcance de Stock';
  }
  renderRiesgoCrossFilterNote();
  const filtered = getFilteredRiesgos();
  if (!filtered.length) { body.innerHTML = '<tr><td colspan="22" style="text-align:center;padding:2rem;color:var(--muted)">Sin datos para este filtro</td></tr>'; return; }
  const capado = ep === 'all' && filtered.length > 50;
  const rows = capado ? filtered.slice(0, 50) : filtered;
  const mermaBySku = {};
  (MERMA_VENC || []).forEach(m => { mermaBySku[m.sku] = m; });
  let html = rows.map((r, i) => {
    const quiebre = getQuiebreTon(r);
    const isCrit = r.riesgo === 'critico';
    const alcCol = r.alcance <= 1 ? '#C8001E' : r.alcance <= 1.5 ? '#B8860B' : '#1a8a3a';
    const bp = Math.min((r.alcance / 4) * 100, 100).toFixed(1);
    const m = mermaBySku[r.sku];
    const mermaBadge = m ? (m.nivel === 'critico'
      ? `<span style="display:inline-block;margin-top:3px;font-size:9.5px;font-weight:700;color:#C8001E;background:#fff0f0;border:1px solid #ffc9c9;border-radius:8px;padding:1px 6px">🟠 Mermando · vence en ${m.dias}d</span>`
      : `<span style="display:inline-block;margin-top:3px;font-size:9.5px;font-weight:700;color:#B8860B;background:#fffbf0;border:1px solid #fde0a0;border-radius:8px;padding:1px 6px">🟡 Riesgo de merma · ${m.dias}d</span>`) : '';
    return `<tr><td style="font-family:var(--cond);font-size:13px;font-weight:800;color:var(--muted2)">${i + 1}</td>
    <td style="font-size:11px;color:var(--muted);white-space:nowrap">${r.sku}</td>
    <td style="font-weight:600;max-width:220px">
      <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${r.n}">${r.n}</div>
      <div style="background:var(--gray2);border-radius:3px;height:4px;margin-top:4px"><div style="height:4px;border-radius:3px;width:${bp}%;background:${alcCol}"></div></div>
      ${mermaBadge}
    </td>
    <td class="r"><div style="font-family:var(--cond);font-size:17px;color:var(--dark2)">${r.fcst.toLocaleString('es-CL', { minimumFractionDigits: 0 })}</div></td>
    <td class="r"><div style="font-family:var(--cond);font-size:22px;font-weight:900;color:${alcCol}">${r.alcance.toFixed(1)}</div><div style="font-size:9px;color:var(--muted)">sem</div></td>
    <td class="r">${r.stock === 0 ? '<span style="font-size:11px;font-weight:900;color:#C8001E">SIN STOCK</span>' : `<div style="font-family:var(--cond);font-size:17px;font-weight:700;color:var(--dark2)">${r.stock.toLocaleString('es-CL', { minimumFractionDigits: 0 })}</div><div class="tbl-unit">kg disp</div>`}</td>
    <td class="r">${quiebre > 0 ? `<div style="font-family:var(--cond);font-size:15px;font-weight:700;color:#C8001E">${quiebre.toLocaleString('es-CL', { minimumFractionDigits: 1 })}</div><div class="tbl-unit">ton</div>` : '<span style="color:var(--muted);font-size:11px">—</span>'}</td>
    <td class="r">${r.stock_bloq > 0 ? `<div style="font-family:var(--cond);font-size:15px;font-weight:700;color:#B8860B">${r.stock_bloq.toLocaleString('es-CL', { minimumFractionDigits: 0 })}</div><div class="tbl-unit">kg</div>` : '<span style="color:var(--muted);font-size:11px">—</span>'}</td>
    <td class="r">${r.stock_xlib > 0 ? `<div style="font-family:var(--cond);font-size:15px;font-weight:700;color:#2D5BE3">${r.stock_xlib.toLocaleString('es-CL', { minimumFractionDigits: 0 })}</div><div class="tbl-unit">kg</div>` : '<span style="color:var(--muted);font-size:11px">—</span>'}</td>
    <td class="r" style="font-size:11px;color:#2D5BE3;white-space:nowrap">${r.xlib_fecha || '<span style="color:var(--muted)">—</span>'}</td>
    <td class="r">${r.stock_transito > 0 ? `<div style="font-family:var(--cond);font-size:15px;font-weight:700;color:#7A5AA0">${r.stock_transito.toLocaleString('es-CL', { minimumFractionDigits: 0 })}</div><div class="tbl-unit">kg</div>` : '<span style="color:var(--muted);font-size:11px">—</span>'}</td>
    <td class="r">${r.devolucion > 0 ? `<div style="font-family:var(--cond);font-size:15px;font-weight:700;color:#a03050">${r.devolucion.toLocaleString('es-CL', { minimumFractionDigits: 2 })}</div><div class="tbl-unit">ton</div>` : '<span style="color:var(--muted);font-size:11px">—</span>'}</td>
    <td style="font-size:10.5px;color:#C8001E;font-weight:600;max-width:160px">${r.vu_cadenas || '<span style="color:var(--muted);font-weight:400">—</span>'}</td>
    <td class="r">${r.vu_kg > 0 ? `<div style="font-family:var(--cond);font-size:15px;font-weight:700;color:#C8001E">${r.vu_kg.toLocaleString('es-CL', { minimumFractionDigits: 0 })}</div><div class="tbl-unit">kg</div>` : '<span style="color:var(--muted);font-size:11px">—</span>'}</td>
    <td style="font-size:10.5px;color:#B8860B;font-weight:600;max-width:160px">${r.vu_alerta_cadenas || '<span style="color:var(--muted);font-weight:400">—</span>'}</td>
    <td class="r">${r.vu_alerta_kg > 0 ? `<div style="font-family:var(--cond);font-size:15px;font-weight:700;color:#B8860B">${r.vu_alerta_kg.toLocaleString('es-CL', { minimumFractionDigits: 0 })}</div><div class="tbl-unit">kg</div>` : '<span style="color:var(--muted);font-size:11px">—</span>'}</td>
    <td class="r">${r.vu_alerta_dias != null ? `<div style="font-family:var(--cond);font-size:15px;font-weight:700;color:#B8860B">${r.vu_alerta_dias}</div><div class="tbl-unit">días</div>` : '<span style="color:var(--muted);font-size:11px">—</span>'}</td>
    <td class="r">${(r.vta_int + r.vta_liq) > 0 ? `<div style="font-family:var(--cond);font-size:15px;font-weight:700;color:#7A5A10">${(r.vta_int + r.vta_liq).toLocaleString('es-CL', { minimumFractionDigits: 0 })}</div><div class="tbl-unit">kg</div>` : '<span style="color:var(--muted);font-size:11px">—</span>'}</td>
    <td style="font-size:11px;color:var(--muted);white-space:nowrap">${r.grupo || '<span style="color:var(--muted)">—</span>'}</td>
    <td style="font-size:11px;color:var(--muted)">${r.cat}</td>
    <td style="font-size:11px;color:var(--muted)">${cpfrLabel(r.tipo)}</td>
    <td class="r"><span class="chip ${isCrit ? 'c-red' : 'c-amb'}">${isCrit ? '🔴 CRÍTICO' : '🟡 ALERTA'}</span></td></tr>`;
  }).join('');
  if (capado) {
    html += `<tr><td colspan="22" style="text-align:center;padding:10px;font-size:11px;color:var(--muted)">Mostrando 50 de ${filtered.length} SKU en riesgo con este filtro — usa <b>⬇ Descargar Excel</b> para ver el listado completo.</td></tr>`;
  }
  body.innerHTML = html;
}

// Stock por rango de VU consumida (archivo "Stock x VUC"): vista rápida
// de cuánto stock (kg) está fresco vs. cerca de vencer, en 8 rangos fijos
// de % de vida útil ya consumida. No tiene planta/categoría por fila útil
// para filtrar — es un total país, complementario al detalle preciso de
// Riesgo de Merma por Categoría.
let _stockVucSelected = null;
function toggleStockVucBucket(bucket) {
  _stockVucSelected = _stockVucSelected === bucket ? null : bucket;
  renderStockVuc();
}
function renderStockVuc() {
  const el = document.getElementById('stockVucChart');
  if (!el || !STOCK_VUC || !STOCK_VUC.length) { if (el) el.innerHTML = '<p style="color:var(--muted);font-size:13px">Sin datos de VU consumida disponibles</p>'; return; }
  const PAL = { '<=20%': '#1a8a3a', '20-25%': '#5a9e2f', '25-33%': '#8ea82a', '33-40%': '#b8a020', '40-50%': '#c8860b', '50-75%': '#c86a10', '75-99%': '#c84000', '>=100%': '#C8001E', 'INDEFINIDO': '#999' };
  const items = STOCK_VUC.filter(x => x.bucket !== 'INDEFINIDO');
  const indefinido = STOCK_VUC.find(x => x.bucket === 'INDEFINIDO');
  const maxV = Math.max(...items.map(x => x.kg));
  const bars = items.map(x => {
    const col = PAL[x.bucket] || '#555';
    const pct = maxV > 0 ? (x.kg / maxV * 100).toFixed(1) : 0;
    const active = _stockVucSelected === x.bucket;
    return `<div onclick="toggleStockVucBucket('${x.bucket}')" style="display:flex;align-items:center;gap:10px;margin-bottom:11px;cursor:pointer;border-radius:6px;padding:3px 6px;margin-left:-6px;background:${active ? 'var(--gray)' : 'transparent'}">
      <div style="min-width:70px;font-size:11px;font-weight:700;color:${active ? col : 'var(--dark2)'}">${x.bucket}${active ? ' ▾' : ''}</div>
      <div style="flex:1;background:var(--gray2);border-radius:4px;height:10px">
        <div style="height:10px;border-radius:4px;width:${pct}%;background:${col};transition:width .4s"></div></div>
      <div style="text-align:right;min-width:110px"><span style="font-family:var(--cond);font-size:17px;font-weight:800;color:${col}">${x.kg.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</span>
        <span style="font-size:9px;color:var(--muted);margin-left:2px">kg</span></div></div>`;
  }).join('');
  const nota = indefinido ? `<div style="font-size:11px;color:var(--muted);margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">Sin dato de VU asignado: ${indefinido.kg.toLocaleString('es-CL', { maximumFractionDigits: 0 })} kg (no incluido en el gráfico)</div>` : '';
  let detalle = '';
  if (_stockVucSelected) {
    const skus = (STOCK_VUC_SKUS || []).filter(x => x.bucket === _stockVucSelected);
    const col = PAL[_stockVucSelected] || '#555';
    detalle = `
      <div style="margin-top:14px;padding-top:14px;border-top:1.5px solid var(--border)">
        <div style="font-size:11px;font-weight:800;color:${col};text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">SKU en rango ${_stockVucSelected} (${skus.length})</div>
        <div style="overflow-x:auto;max-height:360px;overflow-y:auto">
        <table class="tbl">
          <thead><tr><th>SKU</th><th>Producto</th><th>Categoría</th><th>Planta</th><th class="r">Kg</th></tr></thead>
          <tbody>
          ${skus.map(x => `<tr>
            <td style="font-size:11px;color:var(--muted);white-space:nowrap">${x.sku}</td>
            <td style="font-weight:600;max-width:260px"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${x.n}">${x.n}</div></td>
            <td style="font-size:11px;color:var(--muted)">${x.cat || '—'}</td>
            <td style="font-size:11px;color:var(--muted);white-space:nowrap">${x.planta || '—'}</td>
            <td class="r"><span style="font-family:var(--cond);font-size:15px;font-weight:700;color:var(--dark2)">${x.kg.toLocaleString('es-CL')}</span><div style="font-size:9px;color:var(--muted)">kg</div></td>
          </tr>`).join('')}
          </tbody>
        </table>
        </div>
      </div>`;
  }
  el.innerHTML = bars + nota + detalle;
}

// Riesgo de Merma por Categoría (regla del usuario, distinta de la fecha
// física de vencimiento): por SKU, el filtro de VU más exigente entre las
// cadenas (el % más alto). Si al lote le queda VU por encima de ese filtro
// pero a 6 puntos porcentuales o menos (a punto de caer bajo la cadena más
// dura), el SKU dispara la alerta — y con 1 solo SKU ya se marca toda su
// categoría en riesgo. MERMA_CATEGORIA ya viene ordenado por margen
// ascendente (más urgente primero) desde el ETL. No tiene planta (los
// lotes se agregan por SKU across todo el país), así que solo respeta
// Categoría/Búsqueda de los filtros de arriba.
function renderMermaCategoria() {
  const el = document.getElementById('mermaCategoriaList');
  if (!el) return;
  if (!MERMA_CATEGORIA || !MERMA_CATEGORIA.length) { el.innerHTML = '<p style="color:var(--muted);font-size:13px">Sin categorías en riesgo de merma</p>'; return; }
  let items = MERMA_CATEGORIA;
  if (currentCategoria !== 'all') items = items.filter(x => x.cat === currentCategoria);
  if (currentGrupo.length) items = items.filter(x => currentGrupo.includes(x.grupo));
  const q = skuSearch.trim().toLowerCase();
  if (q) items = items.filter(x => x.n.toLowerCase().includes(q) || String(x.sku).toLowerCase().includes(q));
  if (!items.length) { el.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:12px 0">Sin categorías en riesgo de merma para este filtro</p>'; return; }
  const cats = [...new Set(items.map(x => x.cat))];
  const summary = `<div style="font-size:11px;font-weight:800;color:#B8860B;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">🟡 ${cats.length} categoría${cats.length === 1 ? '' : 's'} en riesgo de merma (${items.length} SKU dentro del margen de 6%)</div>`;
  // Severidad según cuán cerca está del filtro más exigente: menos puntos
  // de margen = más urgente (0-2 pts, 2-4 pts, 4-6 pts).
  const severidad = m => m <= 2 ? { icon: '🔴', color: '#C8001E' } : m <= 4 ? { icon: '🟠', color: '#c84000' } : { icon: '🟡', color: '#B8860B' };
  const table = `
    <div style="overflow-x:auto">
    <table class="tbl">
      <thead><tr><th>SKU</th><th>Producto</th><th>Categoría</th><th>Grupo de Marketing</th>
        <th>Cadena más exigente</th><th class="r">% Avance Máx. Aceptado</th><th class="r">% VU avanzada</th>
        <th class="r">Kg en riesgo</th><th class="r">% Faltante para salir</th><th>Cadenas por vencer</th></tr></thead>
      <tbody>
      ${items.map(x => {
        const sev = severidad(x.margen_pct);
        return `<tr>
        <td style="font-size:11px;color:var(--muted);white-space:nowrap">${x.sku}</td>
        <td style="font-weight:600;max-width:220px"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${x.n}">${x.n}</div></td>
        <td style="font-size:11px;color:var(--muted)">${x.cat}</td>
        <td style="font-size:11px;color:var(--muted)">${x.grupo || '<span style="color:var(--muted)">—</span>'}</td>
        <td style="font-size:11px;color:var(--dark2);font-weight:600;white-space:nowrap">${x.cadena_exigente}</td>
        <td class="r"><span style="font-family:var(--cond);font-size:15px;font-weight:700;color:var(--dark2)">${x.pct_aceptacion.toFixed(1)}%</span></td>
        <td class="r"><span style="font-family:var(--cond);font-size:16px;font-weight:800;color:${sev.color}">${x.vu_avance_pct.toFixed(1)}%</span></td>
        <td class="r"><span style="font-family:var(--cond);font-size:15px;font-weight:700;color:var(--dark2)">${x.kg.toLocaleString('es-CL')}</span><div style="font-size:9px;color:var(--muted)">kg</div></td>
        <td class="r"><span style="font-family:var(--cond);font-size:16px;font-weight:800;color:${sev.color}">${sev.icon} ${x.margen_pct.toFixed(1)}%</span></td>
        <td style="font-size:10.5px;color:${sev.color};font-weight:600;max-width:200px">${x.cadenas_por_vencer}</td>
      </tr>`;
      }).join('')}
      </tbody>
    </table>
    </div>`;
  el.innerHTML = summary + table;
}

// Lista de vencimiento de la pestaña Riesgo de Merma (mermando = vencen
// esta semana, riesgo de merma = 1-4 semanas). Respeta los mismos filtros
// compartidos de la barra superior (Planta/Categoría/Búsqueda) en vez de
// un selector de planta aparte.
function renderMermaVenc() {
  const el = document.getElementById('mermaVencList');
  if (!el) return;
  if (!MERMA_VENC || !MERMA_VENC.length) { el.innerHTML = '<p style="color:var(--muted);font-size:13px">Sin datos de vencimiento disponibles</p>'; return; }
  let items = MERMA_VENC;
  if (currentPlanta !== 'all') items = items.filter(x => x.planta === currentPlanta);
  if (currentCategoria !== 'all') items = items.filter(x => x.cat === currentCategoria);
  const q = skuSearch.trim().toLowerCase();
  if (q) items = items.filter(x => x.n.toLowerCase().includes(q) || String(x.sku).toLowerCase().includes(q));
  const crit = items.filter(x => x.nivel === 'critico');
  const ale = items.filter(x => x.nivel === 'alerta');
  const table = (list, color) => `
    <div style="overflow-x:auto">
    <table class="tbl">
      <thead><tr><th>SKU</th><th>Producto</th><th class="r">Días para vencer</th><th class="r">Kilos en riesgo</th></tr></thead>
      <tbody>
      ${list.map(x => `<tr>
        <td style="font-size:11px;color:var(--muted);white-space:nowrap">${x.sku}</td>
        <td style="font-weight:600;max-width:320px">
          <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${x.n}">${x.n}</div>
          <div style="font-size:10px;color:var(--muted)">${x.cat} · ${x.planta}</div>
        </td>
        <td class="r"><span style="font-family:var(--cond);font-size:18px;font-weight:800;color:${color}">${x.dias}</span><div style="font-size:9px;color:var(--muted)">días</div></td>
        <td class="r"><span style="font-family:var(--cond);font-size:15px;font-weight:700;color:var(--dark2)">${x.kilos.toLocaleString('es-CL')}</span><div style="font-size:9px;color:var(--muted)">kg</div></td>
      </tr>`).join('')}
      </tbody>
    </table>
    </div>`;
  let html = '';
  if (crit.length) {
    html += `<div style="font-size:11px;font-weight:800;color:#C8001E;text-transform:uppercase;letter-spacing:.5px;margin:14px 0 8px">🟠 Mermando — vencen esta semana (${crit.length})</div>`;
    html += table(crit, '#C8001E');
  }
  if (ale.length) {
    html += `<div style="font-size:11px;font-weight:800;color:#B8860B;text-transform:uppercase;letter-spacing:.5px;margin:14px 0 8px">🟡 Riesgo de merma — vencen en 1–4 semanas (${ale.length})</div>`;
    html += table(ale, '#B8860B');
  }
  if (!items.length) html = '<p style="color:var(--muted);font-size:13px;padding:12px 0">Sin productos próximos a vencer para este filtro</p>';
  el.innerHTML = html;
}

// ── RIESGO FUTURO: toggle Quiebre / Merma ─────────────────────────────────────
function setRiesgoFutTab(tab, btn) {
  const isMerma = tab === 'merma';
  document.getElementById('riesgoQuiebreView').style.display = isMerma ? 'none' : '';
  document.getElementById('riesgoMermaView').style.display = isMerma ? '' : 'none';
  ['quiebre', 'merma'].forEach(t => {
    const b = document.getElementById('rfut-btn-' + t);
    if (!b) return;
    const active = t === tab;
    b.classList.toggle('active', active);
    b.style.background = active ? (t === 'merma' ? '#B8860B' : '#C8001E') : '#fff';
    b.style.borderColor = active ? (t === 'merma' ? '#B8860B' : '#C8001E') : '#ddd';
    b.style.color = active ? '#fff' : '#555';
  });
  if (isMerma) renderRiesgoMermaKpis();
}

function renderRiesgoMermaKpis() {
  const el = document.getElementById('riesgoMermaKpis');
  if (!el) return;
  const data = (typeof MERMA_VENC !== 'undefined') ? MERMA_VENC : [];
  const crit = data.filter(x => x.nivel === 'critico');
  const ale = data.filter(x => x.nivel === 'alerta');
  const kilos = data.reduce((a, x) => a + (x.kilos || 0), 0);
  const card = (bg, border, color, num, label, sub) => `
    <div style="background:${bg};border:2px solid ${border};border-radius:16px;padding:18px 20px;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${color}"></div>
      <div style="font-size:42px;line-height:1;font-family:var(--cond);font-weight:900;color:${color}">${num}</div>
      <div style="font-size:11.5px;font-weight:800;color:${color};text-transform:uppercase;letter-spacing:.5px;margin-top:4px">${label}</div>
      <div style="font-size:10.5px;color:var(--muted);margin-top:2px">${sub}</div>
    </div>`;
  el.innerHTML =
    card('#fff0f0', '#ffd6d6', '#C8001E', crit.length, '🔴 Vencen esta semana', 'Confirmado por vida útil') +
    card('#fffbf0', '#fde0a0', '#B8860B', ale.length, '🟡 Vencen en 1–4 semanas', 'Confirmado por vida útil') +
    card('#f0f4ff', '#c8d4ff', '#2D5BE3', kilos.toLocaleString('es-CL', { maximumFractionDigits: 0 }), '📦 Kg totales en riesgo', 'Solo productos con vencimiento confirmado');
}

function renderRiesgos() {
  renderCharts();
  renderAccionHoy();
  renderRiesgosQuebraKPIs();
  renderRiesgosSubcat();
  renderRiesgosTable();

  renderMermaCategoria();
  renderStockVuc();
  renderMermaVenc();
  renderRiesgoMermaKpis();
}

// Inicializa controles estáticos (se llama una sola vez)
function initRiesgosControls() {
  const rSem = document.getElementById('rSemSel');
  if (rSem && rSem.options.length <= 1) {
    (SEMS_Q['all'] || []).forEach(s => { const o = document.createElement('option'); o.value = s.s; o.textContent = s.s; rSem.appendChild(o); });
    Object.keys(MES_MAP).forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = '📅 ' + m; rSem.appendChild(o); });
    rSem.value = riesgsSem;
  }
}

// ── INICIO ────────────────────────────────────────────────────────────────────
initPlantaSelect();
initGrupoSelect();
initCategoriaSelect();
initRiesgosControls();
renderRiesgos();
