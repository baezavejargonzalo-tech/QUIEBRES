// ── ESTADO ─────────────────────────────────────────────────────────────────────
let currentTipo = 'all';
let currentPlanta = 'all';
let currentGrupo = 'all';
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
function setGrupo(val) {
  currentGrupo = val;
  renderRiesgos();
}
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
  currentGrupo = 'all';
  currentCategoria = 'all';
  skuSearch = '';
  document.querySelectorAll('.filterbar .tipo-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  const pSel = document.getElementById('plantaSel');
  if (pSel) pSel.value = 'all';
  const gSel = document.getElementById('grupoSel');
  if (gSel) gSel.value = 'all';
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
  const sel = document.getElementById('grupoSel');
  if (!sel || sel.options.length > 1) return;
  const grupos = [...new Set(RIESGOS.map(r => r.grupo))].filter(Boolean).sort();
  grupos.forEach(g => {
    const o = document.createElement('option');
    o.value = g; o.textContent = g;
    sel.appendChild(o);
  });
  sel.title = `Filtrar por grupo de marketing — cruzado por SKU con LOGISTICO: ${GRUPO_COVERAGE.con_grupo} de ${GRUPO_COVERAGE.total} SKU en riesgo tienen grupo asignado`;
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
    <div style="background:var(--card);border:1.5px solid var(--border);border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:14px">
      <div style="font-size:32px;font-family:var(--cond);font-weight:900;color:#C8001E">${d.q.toLocaleString('es-CL', { minimumFractionDigits: 1 })}</div>
      <div><div style="font-size:11px;font-weight:800;color:#C8001E;text-transform:uppercase">ton Quebradas</div><div style="font-size:10px;color:var(--muted)">${semLabel}</div></div>
    </div>
    <div style="background:var(--card);border:1.5px solid var(--border);border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:14px">
      <div style="font-size:32px;font-family:var(--cond);font-weight:900;color:#2D5BE3">${d.fcst.toLocaleString('es-CL', { minimumFractionDigits: 1 })}</div>
      <div><div style="font-size:11px;font-weight:800;color:#2D5BE3;text-transform:uppercase">ton FCST</div><div style="font-size:10px;color:var(--muted)">${semLabel}</div></div>
    </div>
    <div style="background:var(--card);border:1.5px solid var(--border);border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:14px">
      <div style="font-size:32px;font-family:var(--cond);font-weight:900;color:#009060">${d.vr.toLocaleString('es-CL', { minimumFractionDigits: 1 })}</div>
      <div><div style="font-size:11px;font-weight:800;color:#009060;text-transform:uppercase">ton Venta Real</div><div style="font-size:10px;color:var(--muted)">${semLabel}</div></div>
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
  if (currentGrupo !== 'all') filtered = filtered.filter(r => r.grupo === currentGrupo);
  if (currentCategoria !== 'all') filtered = filtered.filter(r => r.cat === currentCategoria);
  const q = skuSearch.trim().toLowerCase();
  if (q) filtered = filtered.filter(r => r.n.toLowerCase().includes(q));
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
  if (currentGrupo !== 'all') activos.push(`Grupo: ${currentGrupo}`);
  if (currentCategoria !== 'all') activos.push(`Categoría: ${currentCategoria}`);
  if (skuSearch.trim()) activos.push(`Búsqueda: "${skuSearch.trim()}"`);

  let html = '';
  if (activos.length) {
    html += `🔗 Filtros activos — ${activos.join(' · ')}. <button onclick="resetFiltros()" style="border:none;background:none;color:var(--red);font-weight:700;font-size:12px;cursor:pointer;padding:0;text-decoration:underline">Quitar</button>`;
  }
  if (currentGrupo !== 'all') {
    html += `${html ? '<br>' : ''}ℹ️ El Grupo de Marketing se cruza por código de SKU con el historial de quiebres (LOGISTICO) — solo ${GRUPO_COVERAGE.con_grupo} de los ${GRUPO_COVERAGE.total} SKU en riesgo tienen grupo asignado; los que no tienen pedidos recientes no aparecen al filtrar por grupo.`;
  }
  if (currentPlanta !== 'all') {
    const totalPlanta = RIESGOS.filter(r => r.planta === currentPlanta).length;
    html += `${html ? '<br>' : ''}📍 Mostrando el detalle <b>completo</b> de ${currentPlanta}: sus ${totalPlanta} SKU en riesgo (crítico + alerta).`;
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

  const top10 = estancados.slice(0, 10);
  const listHtml = top10.length ? `
    <div style="overflow-x:auto">
    <table class="tbl">
      <thead><tr><th>#</th><th>Producto</th><th>Planta</th><th class="r">Alcance</th><th class="r">FCST sem</th></tr></thead>
      <tbody>
      ${top10.map((r, i) => `<tr>
        <td style="font-family:var(--cond);font-size:13px;font-weight:800;color:var(--muted2)">${i + 1}</td>
        <td style="font-weight:600;max-width:220px">
          <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${r.n}">${r.n}</div>
          <div style="font-size:10px;color:var(--muted)">${r.cat}${r.grupo ? ' · ' + r.grupo : ''}</div>
        </td>
        <td><span style="font-size:10px;font-weight:700;background:var(--gray2);padding:2px 8px;border-radius:10px;white-space:nowrap">${r.planta}</span></td>
        <td class="r"><span style="font-family:var(--cond);font-size:18px;font-weight:900;color:#C8001E">${r.alcance.toFixed(1)}</span><div style="font-size:9px;color:var(--muted)">sem</div></td>
        <td class="r"><span style="font-family:var(--cond);font-size:15px;color:var(--dark2)">${r.fcst.toLocaleString('es-CL', { minimumFractionDigits: 0 })}</span></td>
      </tr>`).join('')}
      </tbody>
    </table>
    </div>
    ${estancados.length > 10 ? `<div style="text-align:center;padding:8px 0 0;font-size:11px;color:var(--muted)">Mostrando 10 de ${estancados.length} — usa los filtros de arriba para acotar, o descarga el Excel (Top 50) para ver el resto.</div>` : ''}
  ` : `<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">✅ Ningún SKU crítico está estancado con este filtro</div>`;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1.3fr;gap:14px;align-items:stretch">
      <div>${cardsHtml}</div>
      <div class="panel" style="padding:16px 18px;margin:0">
        <div class="panel-title" style="margin-bottom:10px">🚨 Top 10 · Críticos sin fecha de recuperación</div>
        ${listHtml}
      </div>
    </div>`;
}

// ── EXPORTAR TOP 50 A EXCEL (CSV) ──────────────────────────────────────────────
// Junta, por SKU: estado de riesgo, stock, FCST, alcance (de RIESGOS),
// quiebre (buscado por nombre en el listado de quiebres) y merma (buscada
// por código de SKU en MERMA_VENC). Se exporta como CSV separado por ";"
// con BOM UTF-8 — Excel lo abre directo, con acentos y decimales correctos.
// Usa exactamente el mismo filtro combinado que se ve en la tabla de pantalla.
function exportRiesgosExcel() {
  const filtered = getFilteredRiesgos();
  if (!filtered.length) { alert('No hay filas para exportar con este filtro.'); return; }

  const quiebreByName = {};
  (DB_QUIEBRES.all.all.skus || []).forEach(s => { quiebreByName[s.n.toUpperCase().trim()] = s.q; });
  const mermaBySku = {};
  (MERMA_VENC || []).forEach(m => { mermaBySku[m.sku] = m; });

  const headers = ['SKU', 'Producto', 'Categoría', 'Planta', 'Grupo de Marketing', 'CPFR', 'Estado riesgo',
    'Stock disponible (kg)', 'Stock XLIB (kg)', 'Fecha liberación XLIB', 'Stock bloqueado (kg)',
    'Stock tránsito (kg)', 'FCST semanal (kg)', 'Alcance (sem)',
    'Quiebre (ton)', 'Merma - días a vencer', 'Merma - kg en riesgo', 'Merma - nivel'];
  const numCols = [7, 8, 10, 11, 12, 13, 14, 15, 16];

  const rows = filtered.map(r => {
    const q = quiebreByName[r.n.toUpperCase().trim()];
    const m = mermaBySku[r.sku];
    return [
      r.sku, r.n, r.cat, r.planta, r.grupo || '', cpfrLabel(r.tipo),
      r.riesgo === 'critico' ? 'Crítico' : 'Alerta',
      r.stock, r.stock_xlib || '', r.xlib_fecha || '', r.stock_bloq, r.stock_transito || '', r.fcst, r.alcance,
      q !== undefined ? q : '',
      m ? m.dias : '',
      m ? m.kilos : '',
      m ? (m.nivel === 'critico' ? 'Crítico' : 'Alerta') : ''
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

function renderRiesgosTable() {
  const body = document.getElementById('riesgosBody'); if (!body) return;
  const tituloEl = document.getElementById('riesgosTablaTitulo');
  const ep = currentPlanta;
  if (tituloEl) {
    tituloEl.textContent = ep !== 'all' ? `📋 Detalle · Planta ${ep}` : '📋 Top 50 · Menor Alcance de Stock';
  }
  renderRiesgoCrossFilterNote();
  const filtered = getFilteredRiesgos();
  if (!filtered.length) { body.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--muted)">Sin datos para este filtro</td></tr>'; return; }
  const capado = ep === 'all' && filtered.length > 50;
  const rows = capado ? filtered.slice(0, 50) : filtered;
  let html = rows.map((r, i) => {
    const isCrit = r.riesgo === 'critico'; const col = isCrit ? '#C8001E' : '#B8860B'; const bp = Math.min((r.alcance / 4) * 100, 100).toFixed(1);
    return `<tr><td style="font-family:var(--cond);font-size:13px;font-weight:800;color:var(--muted2)">${i + 1}</td>
    <td style="font-weight:600;max-width:240px">
      <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${r.n}">${r.n}</div>
      <div style="background:var(--gray2);border-radius:3px;height:4px;margin-top:4px"><div style="height:4px;border-radius:3px;width:${bp}%;background:${col}"></div></div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">${r.cat}</div>
    </td>
    <td style="font-size:11px;color:var(--muted)">${cpfrLabel(r.tipo)}</td>
    <td><span style="font-size:10px;font-weight:700;background:var(--gray2);padding:2px 8px;border-radius:10px;white-space:nowrap">${r.planta}</span></td>
    <td class="r">
      <div style="font-family:var(--cond);font-size:17px;font-weight:700;color:${r.stock === 0 ? '#C8001E' : 'var(--dark2)'}">${r.stock.toLocaleString('es-CL', { minimumFractionDigits: 0 })}</div>
      ${r.stock_xlib > 0 ? `<div style="font-size:10px;color:#2D5BE3">+${r.stock_xlib.toLocaleString('es-CL', { minimumFractionDigits: 0 })} xlib${r.xlib_fecha ? ` · libera ${r.xlib_fecha}` : ''}</div>` : ''}
      ${r.stock_bloq > 0 ? `<div style="font-size:10px;color:#B8860B">+${r.stock_bloq.toLocaleString('es-CL', { minimumFractionDigits: 0 })} bloq</div>` : ''}
      ${r.stock_transito > 0 ? `<div style="font-size:10px;color:#7A5AA0">+${r.stock_transito.toLocaleString('es-CL', { minimumFractionDigits: 0 })} tránsito</div>` : ''}
    </td>
    <td class="r"><div style="font-family:var(--cond);font-size:17px;color:var(--dark2)">${r.fcst.toLocaleString('es-CL', { minimumFractionDigits: 0 })}</div></td>
    <td class="r"><div style="font-family:var(--cond);font-size:22px;font-weight:900;color:${col}">${r.alcance.toFixed(1)}</div><div style="font-size:9px;color:var(--muted)">sem</div></td>
    <td class="r"><span class="chip ${isCrit ? 'c-red' : 'c-amb'}">${isCrit ? '🔴 CRÍTICO' : '🟡 ALERTA'}</span></td></tr>`;
  }).join('');
  if (capado) {
    html += `<tr><td colspan="8" style="text-align:center;padding:10px;font-size:11px;color:var(--muted)">Mostrando 50 de ${filtered.length} SKU en riesgo con este filtro — usa <b>⬇ Descargar Excel</b> para ver el listado completo.</td></tr>`;
  }
  body.innerHTML = html;
}

function renderMermaVenc(filtroPlanta) {
  const el = document.getElementById('mermaVencList');
  if (!el || !MERMA_VENC || !MERMA_VENC.length) { if (el) el.innerHTML = '<p style="color:var(--muted);font-size:13px">Sin datos de vencimiento disponibles</p>'; return; }
  const items = filtroPlanta && filtroPlanta !== 'all' ? MERMA_VENC.filter(x => x.planta === filtroPlanta) : MERMA_VENC;
  const crit = items.filter(x => x.nivel === 'critico');
  const ale = items.filter(x => x.nivel === 'alerta');
  const row = (x, color, bg) => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;background:${bg};margin-bottom:6px;border-left:4px solid ${color}">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700;color:var(--dark2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${x.n}</div>
        <div style="font-size:10px;color:var(--muted)">${x.cat} · ${x.planta}</div>
      </div>
      <div style="text-align:right;white-space:nowrap">
        <div style="font-family:var(--cond);font-size:18px;font-weight:800;color:${color}">${x.dias}d</div>
        <div style="font-size:9px;color:var(--muted)">${x.kilos.toLocaleString('es-CL')} kg</div>
      </div>
    </div>`;
  let html = '';
  if (crit.length) {
    html += `<div style="font-size:11px;font-weight:800;color:#C8001E;text-transform:uppercase;letter-spacing:.5px;margin:14px 0 8px">🔴 Vencen esta semana (${crit.length})</div>`;
    html += crit.map(x => row(x, '#C8001E', '#fff5f5')).join('');
  }
  if (ale.length) {
    html += `<div style="font-size:11px;font-weight:800;color:#B8860B;text-transform:uppercase;letter-spacing:.5px;margin:14px 0 8px">🟡 Vencen en 1–4 semanas (${ale.length})</div>`;
    html += ale.map(x => row(x, '#B8860B', '#fffbf0')).join('');
  }
  if (!items.length) html = '<p style="color:var(--muted);font-size:13px;padding:12px 0">Sin productos próximos a vencer para esta planta</p>';
  el.innerHTML = html;
}

let _mermaPlanta = 'all';
function setMermaPlanta(p, btn) {
  document.querySelectorAll('.mv-planta-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _mermaPlanta = p;
  renderMermaVenc(p);
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

  renderMermaVenc(_mermaPlanta);
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
  const btnDiv = document.getElementById('mermaPlantaBtns');
  if (btnDiv && MERMA_VENC && MERMA_VENC.length && !btnDiv.childElementCount) {
    const plantas = [...new Set(MERMA_VENC.map(x => x.planta))].sort();
    btnDiv.innerHTML = `<button class="mv-planta-btn active" onclick="setMermaPlanta('all',this)" style="padding:4px 12px;border-radius:20px;border:1px solid #ddd;background:#C8001E;color:#fff;font-size:11px;font-weight:700;cursor:pointer">Todas</button>`
      + plantas.map(p => `<button class="mv-planta-btn" onclick="setMermaPlanta('${p}',this)" style="padding:4px 12px;border-radius:20px;border:1px solid #ddd;background:var(--card);color:var(--dark2);font-size:11px;font-weight:600;cursor:pointer">${p}</button>`).join('');
  }
}

// ── INICIO ────────────────────────────────────────────────────────────────────
initPlantaSelect();
initGrupoSelect();
initCategoriaSelect();
initRiesgosControls();
renderRiesgos();
