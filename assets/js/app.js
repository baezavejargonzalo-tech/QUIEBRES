// ── ESTADO ─────────────────────────────────────────────────────────────────────
let currentTipo = 'all';
let currentPlanta = 'all';
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
  currentCategoria = 'all';
  skuSearch = '';
  document.querySelectorAll('.filterbar .tipo-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  const pSel = document.getElementById('plantaSel');
  if (pSel) pSel.value = 'all';
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
let plantaActiva = null;

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
  /* ── KPI CARDS ── */
  const kpiEl = document.getElementById('riesgos-kpis');
  if (kpiEl) {
    const total = TOTAL_CRITICOS + TOTAL_ALERTAS;
    const topP = PLANTAS_RIESGO.slice().sort((a, b) => b.criticos - a.criticos)[0];
    const topCat = Object.entries(BY_SUBCAT || {})[0] || ['—', 0];
    const bigCard = (bg, border, accentColor, num, label, sub) => `
      <div style="background:${bg};border:2px solid ${border};border-radius:16px;padding:22px 24px;
                  position:relative;overflow:hidden;display:flex;flex-direction:column;gap:6px">
        <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${accentColor}"></div>
        <div style="font-size:56px;line-height:1;font-family:var(--cond);font-weight:900;color:${accentColor}">${num}</div>
        <div style="font-size:12px;font-weight:800;color:${accentColor};text-transform:uppercase;letter-spacing:.5px">${label}</div>
        <div style="font-size:10px;color:var(--muted);line-height:1.4">${sub}</div>
      </div>`;
    const infoCard = (bg, border, accentColor, label, val, sub) => `
      <div style="background:${bg};border:2px solid ${border};border-radius:16px;padding:18px 20px;
                  position:relative;overflow:hidden;display:flex;flex-direction:column;gap:4px">
        <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${accentColor}"></div>
        <div style="font-size:10px;font-weight:800;color:${accentColor};text-transform:uppercase;letter-spacing:.5px">${label}</div>
        <div style="font-size:22px;line-height:1.15;font-family:var(--cond);font-weight:800;color:var(--dark2);
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${val}</div>
        <div style="font-size:10px;color:var(--muted);line-height:1.4">${sub}</div>
      </div>`;
    kpiEl.style.cssText = 'margin-bottom:20px';
    kpiEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
        ${bigCard('#fff0f0', '#ffd6d6', '#C8001E', TOTAL_CRITICOS, '🔴 Críticos', 'Refrig &lt;1 sem · Abarr &lt;2 sem')}
        ${bigCard('#fffbf0', '#fde0a0', '#C88000', TOTAL_ALERTAS, '🟡 Alertas', 'Refrig 1–2 sem · Abarr 2–4 sem')}
        ${bigCard('#f0f4ff', '#c8d4ff', '#2D5BE3', total, '📊 Total en Riesgo', 'SKUs con stock crítico o alerta')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${infoCard('#fff8f0', '#ffd8b0', '#c84000', '🏭 Planta con más riesgo', topP ? topP.planta : '—', topP ? `${topP.criticos} críticos · ${topP.alertas} alertas · ${topP.criticos + topP.alertas} SKUs total` : '')}
        ${infoCard('#fff8fc', '#f0b8e0', '#8B2070', '🔺 Subcategoría más quebrada', topCat[0], `${topCat[1].toLocaleString('es-CL', { minimumFractionDigits: 1 })} ton`)}
      </div>`;
  }

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

// Filtro combinado de la tabla / export: Tipo (CPFR), Planta, Categoría y
// Búsqueda de SKU, todos sobre el universo completo de RIESGOS (ya ordenado
// por alcance ascendente y, en empate, por FCST semanal descendente).
function getFilteredRiesgos() {
  let filtered = riesgosFilter === 'all' ? RIESGOS : RIESGOS.filter(r => r.riesgo === riesgosFilter);
  if (currentPlanta !== 'all') filtered = filtered.filter(r => r.planta === currentPlanta);
  if (currentTipo !== 'all') filtered = filtered.filter(r => r.tipo === currentTipo);
  if (currentCategoria !== 'all') filtered = filtered.filter(r => r.cat === currentCategoria);
  const q = skuSearch.trim().toLowerCase();
  if (q) filtered = filtered.filter(r => r.n.toLowerCase().includes(q));
  return filtered;
}

function renderRiesgoCrossFilterNote() {
  const el = document.getElementById('riesgoCrossFilterNote');
  if (!el) return;
  const activos = [];
  if (currentTipo !== 'all') activos.push(`CPFR: ${cpfrLabel(currentTipo)}`);
  if (currentPlanta !== 'all') activos.push(`Planta: ${currentPlanta}`);
  if (currentCategoria !== 'all') activos.push(`Categoría: ${currentCategoria}`);
  if (skuSearch.trim()) activos.push(`Búsqueda: "${skuSearch.trim()}"`);

  let html = '';
  if (activos.length) {
    html += `🔗 Filtros activos — ${activos.join(' · ')}. <button onclick="resetFiltros()" style="border:none;background:none;color:var(--red);font-weight:700;font-size:12px;cursor:pointer;padding:0;text-decoration:underline">Quitar</button>`;
  }
  if (currentPlanta !== 'all') {
    const totalPlanta = RIESGOS.filter(r => r.planta === currentPlanta).length;
    html += `${html ? '<br>' : ''}📍 Mostrando el detalle <b>completo</b> de ${currentPlanta}: sus ${totalPlanta} SKU en riesgo (crítico + alerta).`;
  }
  if (html) { el.style.display = ''; el.innerHTML = html; } else { el.style.display = 'none'; }
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

  const headers = ['SKU', 'Producto', 'Categoría', 'Planta', 'CPFR', 'Estado riesgo',
    'Stock disponible (kg)', 'Stock XLIB (kg)', 'Fecha liberación XLIB', 'Stock bloqueado (kg)',
    'Stock tránsito (kg)', 'FCST semanal (kg)', 'Alcance (sem)',
    'Quiebre (ton)', 'Merma - días a vencer', 'Merma - kg en riesgo', 'Merma - nivel'];
  const numCols = [6, 7, 9, 10, 11, 12, 13, 14, 15];

  const rows = filtered.map(r => {
    const q = quiebreByName[r.n.toUpperCase().trim()];
    const m = mermaBySku[r.sku];
    return [
      r.sku, r.n, r.cat, r.planta, cpfrLabel(r.tipo),
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

// Exporta exactamente la tabla Críticos/Alertas que se ve en el Desglose por
// Planta (planta + familia Frío/Seco activas), con las mismas columnas en
// pantalla: XLIB, fecha XLIB, tránsito y venta YoY (cuando el dato existe).
function exportPlantaTablaExcel(riesgoTipo) {
  const p = PLANTAS_RIESGO.find(x => x.planta === plantaActiva);
  if (!p) return;
  const ta = window._tipoActivo || 'Refrigerados';
  const d = ta === 'Refrigerados' ? p.refrigerados : p.abarrotes;
  const rows = d.productos.filter(r => r.riesgo === riesgoTipo);
  if (!rows.length) { alert('No hay filas para exportar en esta tabla.'); return; }

  const headers = ['SKU', 'Producto', 'Categoría', 'Planta', 'CPFR', 'Estado riesgo',
    'Stock disponible (kg)', 'Stock bloqueado (kg)', 'Stock XLIB (kg)', 'Fecha liberación XLIB',
    'Stock tránsito (kg)', 'FCST semanal (kg)', 'Alcance (sem)', 'Venta YoY (%)'];
  const numCols = [6, 7, 8, 10, 11, 12, 13];

  const dataRows = rows.map(r => {
    const m = MERMAS_YOY[r.sku];
    const yoy = (m && m.yoy_ytd !== null && m.yoy_ytd !== undefined) ? m.yoy_ytd : '';
    return [
      r.sku, r.n, r.cat, plantaActiva, cpfrLabel(r.tipo),
      r.riesgo === 'critico' ? 'Crítico' : 'Alerta',
      r.stock, r.stock_bloq, r.stock_xlib || '', r.xlib_fecha || '',
      r.stock_transito || '', r.fcst, r.alcance, yoy
    ];
  });

  const escCsv = v => {
    if (v === null || v === undefined || v === '') return '';
    const s = String(v).replace(/"/g, '""');
    return /[;"\n]/.test(s) ? `"${s}"` : s;
  };
  const cellCsv = (v, i) => numCols.includes(i) && typeof v === 'number' ? String(v).replace('.', ',') : escCsv(v);

  const lines = [headers.map(escCsv).join(';')];
  dataRows.forEach(row => lines.push(row.map(cellCsv).join(';')));

  const csv = '﻿' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `riesgo_${riesgoTipo}_${plantaActiva}_${ta}.csv`;
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

function renderPlantaTabs() {
  const tabsEl = document.getElementById('plantaTabs'); if (!tabsEl) return;
  const sorted = [...PLANTAS_RIESGO].sort((a, b) => b.criticos - a.criticos);
  if (!plantaActiva) plantaActiva = sorted[0].planta;
  const maxC = Math.max(...sorted.map(p => p.criticos));
  tabsEl.innerHTML = sorted.map(p => {
    const isActive = p.planta === plantaActiva;
    const danger = p.criticos > 20 ? '#C8001E' : p.criticos > 10 ? '#c84000' : p.criticos > 5 ? '#B8860B' : '#2D5BE3';
    const bgCard = isActive ? (p.criticos > 20 ? '#fff0f0' : p.criticos > 10 ? '#fff4ef' : p.criticos > 5 ? '#fffbf0' : '#f0f4ff') : '#fafafa';
    return `<button onclick="selectPlanta('${p.planta}')" style="display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:14px 16px;border-radius:14px;border:2px solid ${isActive ? danger : '#e2e8f0'};background:${bgCard};cursor:pointer;min-width:140px;box-shadow:${isActive ? `0 4px 16px ${danger}22` : 'none'}">
      <div style="font-size:14px;font-weight:800;color:${isActive ? danger : '#4A5568'};width:100%">${p.planta}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:-6px">${p.criticos + p.alertas} SKUs en riesgo</div>
      <div style="display:flex;gap:6px;width:100%">
        <div style="flex:1;background:${p.criticos > 0 ? danger : '#e8ecf0'};border-radius:8px;padding:5px 6px;text-align:center"><div style="font-family:var(--cond);font-size:22px;font-weight:800;color:#fff;line-height:1">${p.criticos}</div><div style="font-size:9px;color:rgba(255,255,255,.85)">🔴 CRÍTICOS</div></div>
        <div style="flex:1;background:${p.alertas > 0 ? '#B8860B' : '#e8ecf0'};border-radius:8px;padding:5px 6px;text-align:center"><div style="font-family:var(--cond);font-size:22px;font-weight:800;color:#fff;line-height:1">${p.alertas}</div><div style="font-size:9px;color:rgba(255,255,255,.85)">🟡 ALERTAS</div></div>
      </div>
      <div style="width:100%;background:#e2e8f0;border-radius:4px;height:5px;margin-top:-2px"><div style="height:5px;border-radius:4px;width:${maxC > 0 ? (p.criticos / maxC * 100).toFixed(0) : 0}%;background:${danger}"></div></div>
    </button>`;
  }).join('');
}
function selectPlanta(nombre) { plantaActiva = nombre; if (!window._tipoActivo) window._tipoActivo = 'Refrigerados'; renderPlantaTabs(); renderPlantaContent(); }
function renderPlantaContent() {
  const el = document.getElementById('plantaContent'); if (!el) return;
  const p = PLANTAS_RIESGO.find(x => x.planta === plantaActiva); if (!p) return;
  const pct = p.fcst_total > 0 ? (p.stock_total / p.fcst_total * 100).toFixed(1) : '—'; const cc = parseFloat(pct) < 50 ? '#C8001E' : parseFloat(pct) < 100 ? '#B8860B' : '#009060';
  const kpis = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px"><div style="background:#fff0f0;border-radius:10px;padding:12px 14px;border-left:4px solid #C8001E"><div style="font-size:10px;font-weight:700;color:#C8001E;text-transform:uppercase">🔴 Total Críticos</div><div style="font-family:var(--cond);font-size:36px;font-weight:800;color:#C8001E">${p.criticos}</div><div style="font-size:10px;color:var(--muted)">Refrig &lt;1sem · Abarr &lt;2sem</div></div><div style="background:#fffbf0;border-radius:10px;padding:12px 14px;border-left:4px solid #B8860B"><div style="font-size:10px;font-weight:700;color:#B8860B;text-transform:uppercase">🟡 Total Alertas</div><div style="font-family:var(--cond);font-size:36px;font-weight:800;color:#B8860B">${p.alertas}</div><div style="font-size:10px;color:var(--muted)">Refrig 1-2sem · Abarr 2-4sem</div></div><div style="background:#f8faff;border-radius:10px;padding:12px 14px;border-left:4px solid #2D5BE3"><div style="font-size:10px;font-weight:700;color:#2D5BE3;text-transform:uppercase">📦 Stock Disponible</div><div style="font-family:var(--cond);font-size:26px;font-weight:800;color:${cc}">${(p.stock_total / 1000).toFixed(1)} <span style="font-size:13px">ton</span></div><div style="font-size:10px;color:var(--muted)">FCST ${(p.fcst_total / 1000).toFixed(1)} ton/sem</div></div><div style="background:#f8faff;border-radius:10px;padding:12px 14px;border-left:4px solid ${cc}"><div style="font-size:10px;font-weight:700;color:${cc};text-transform:uppercase">📊 Cobertura</div><div style="font-family:var(--cond);font-size:36px;font-weight:800;color:${cc}">${pct}%</div><div style="font-size:10px;color:var(--muted)">Stock / FCST semanal</div></div></div>`;
  const ta = window._tipoActivo || 'Refrigerados';
  const subTabs = `<div style="display:flex;gap:0;border-bottom:2px solid #e2e8f0;margin-bottom:0">${['Refrigerados', 'Abarrotes'].map(t => {
    const isA = t === ta; const d = t === 'Refrigerados' ? p.refrigerados : p.abarrotes; const rule = t === 'Refrigerados' ? 'Crítico &lt;1sem · Alerta 1-2sem' : 'Crítico &lt;2sem · Alerta 2-4sem'; const icon = t === 'Refrigerados' ? '❄️' : '🛒';
    return `<button onclick="window._tipoActivo='${t}';renderPlantaContent()" style="flex:1;padding:12px 16px;border:none;background:${isA ? '#fff' : '#f8faff'};border-bottom:${isA ? '3px solid #C8001E' : 'none'};margin-bottom:${isA ? '-2px' : '0'};cursor:pointer;border-radius:8px 8px 0 0"><div style="font-size:13px;font-weight:800;color:${isA ? '#C8001E' : '#4A5568'}">${icon} ${t}</div><div style="display:flex;gap:8px;justify-content:center;margin-top:4px"><span style="font-size:11px;background:${d.criticos > 0 ? '#C8001E' : '#e2e8f0'};color:#fff;padding:1px 8px;border-radius:20px;font-weight:700">${d.criticos} 🔴</span><span style="font-size:11px;background:${d.alertas > 0 ? '#B8860B' : '#e2e8f0'};color:#fff;padding:1px 8px;border-radius:20px;font-weight:700">${d.alertas} 🟡</span></div><div style="font-size:9px;color:var(--muted);margin-top:3px">${rule}</div></button>`;
  }).join('')}</div>`;
  const d = ta === 'Refrigerados' ? p.refrigerados : p.abarrotes;
  const cr = ta === 'Refrigerados' ? '&lt; 1 semana' : '&lt; 2 semanas'; const ar = ta === 'Refrigerados' ? '1 – 2 semanas' : '2 – 4 semanas'; const ma = ta === 'Refrigerados' ? 2 : 4;
  const ct = d.fcst > 0 ? (d.stock / d.fcst * 100).toFixed(1) : '—'; const ctc = parseFloat(ct) < 50 ? '#C8001E' : parseFloat(ct) < 100 ? '#B8860B' : '#009060';
  const kpisTipo = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:14px 0 12px"><div style="background:#fff0f0;border-radius:8px;padding:10px 12px;border-left:3px solid #C8001E;display:flex;align-items:center;gap:10px"><div style="font-family:var(--cond);font-size:32px;font-weight:800;color:#C8001E">${d.criticos}</div><div><div style="font-size:10px;font-weight:700;color:#C8001E">🔴 CRÍTICOS</div><div style="font-size:10px;color:var(--muted)">alcance ${cr}</div></div></div><div style="background:#fffbf0;border-radius:8px;padding:10px 12px;border-left:3px solid #B8860B;display:flex;align-items:center;gap:10px"><div style="font-family:var(--cond);font-size:32px;font-weight:800;color:#B8860B">${d.alertas}</div><div><div style="font-size:10px;font-weight:700;color:#B8860B">🟡 ALERTAS</div><div style="font-size:10px;color:var(--muted)">alcance ${ar}</div></div></div><div style="background:#f8faff;border-radius:8px;padding:10px 12px;border-left:3px solid ${ctc};display:flex;align-items:center;gap:10px"><div style="font-family:var(--cond);font-size:28px;font-weight:800;color:${ctc}">${ct}%</div><div><div style="font-size:10px;font-weight:700;color:${ctc}">📊 COBERTURA</div><div style="font-size:10px;color:var(--muted)">${(d.stock / 1000).toFixed(1)} / ${(d.fcst / 1000).toFixed(1)} ton</div></div></div></div>`;
  const catBars = d.top_cats.length ? `<div style="background:#f8faff;border-radius:10px;padding:12px 14px;margin-bottom:12px"><div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:8px">Categorías críticas</div>${d.top_cats.map((c, i) => {
    const col = i === 0 ? '#C8001E' : i === 1 ? '#c84000' : '#906000'; return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><div style="min-width:160px;font-size:11px;font-weight:600">${c.cat}</div><div style="flex:1;background:var(--gray2);border-radius:3px;height:7px"><div style="height:7px;border-radius:3px;width:${(c.n / d.top_cats[0].n * 100).toFixed(1)}%;background:${col}"></div></div><div style="font-family:var(--cond);font-size:16px;font-weight:800;color:${col};min-width:25px;text-align:right">${c.n}</div><div style="font-size:9px;color:var(--muted)">SKUs</div></div>`;
  }).join('')}</div>` : '';
  const bR = rows => rows.map((r, i) => {
    const col = r.riesgo === 'critico' ? '#C8001E' : '#B8860B'; const bp = Math.min((r.alcance / ma) * 100, 100).toFixed(1);
    return `<tr style="${r.stock === 0 && r.riesgo === 'critico' ? 'background:rgba(200,0,30,.03)' : ''}"><td style="font-family:var(--cond);font-size:13px;font-weight:800;color:var(--muted2)">${i + 1}</td><td style="font-weight:600;max-width:210px"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${r.n}">${r.n}</div><div style="display:flex;align-items:center;gap:4px;margin-top:3px"><div style="flex:1;background:var(--gray2);border-radius:3px;height:4px"><div style="height:4px;border-radius:3px;width:${bp}%;background:${col}"></div></div><span style="font-size:9px;color:var(--muted)">${bp}%</span></div></td><td style="font-size:11px;color:var(--muted)">${r.cat}</td><td class="r">${r.stock === 0 ? '<span style="font-size:11px;font-weight:900;color:#C8001E">SIN STOCK</span>' : `<div style="font-family:var(--cond);font-size:17px;font-weight:700;color:var(--dark2)">${r.stock.toLocaleString('es-CL', { minimumFractionDigits: 1 })}</div><div class="tbl-unit">kg disp</div>`}${r.stock_bloq > 0 ? `<div style="font-size:10px;color:#B8860B;font-weight:600">+${r.stock_bloq.toLocaleString('es-CL', { minimumFractionDigits: 0 })} bloq</div>` : ''}</td><td class="r">${r.stock_xlib > 0 ? `<div style="font-family:var(--cond);font-size:15px;font-weight:700;color:#2D5BE3">${r.stock_xlib.toLocaleString('es-CL', { minimumFractionDigits: 0 })}</div><div class="tbl-unit">kg</div>` : '<span style="color:var(--muted);font-size:11px">—</span>'}</td><td class="r" style="font-size:11px;color:#2D5BE3;white-space:nowrap">${r.xlib_fecha || '<span style="color:var(--muted)">—</span>'}</td><td class="r">${r.stock_transito > 0 ? `<div style="font-family:var(--cond);font-size:15px;font-weight:700;color:#7A5AA0">${r.stock_transito.toLocaleString('es-CL', { minimumFractionDigits: 0 })}</div><div class="tbl-unit">kg</div>` : '<span style="color:var(--muted);font-size:11px">—</span>'}</td><td class="r"><div style="font-family:var(--cond);font-size:17px;font-weight:700;color:var(--dark2)">${r.fcst.toLocaleString('es-CL', { minimumFractionDigits: 1 })}</div><div class="tbl-unit">kg/sem</div></td><td class="r"><div style="font-family:var(--cond);font-size:20px;font-weight:800;color:${col}">${r.alcance.toFixed(2)}</div><div class="tbl-unit">semanas</div></td><td class="r"><span class="chip ${r.riesgo === 'critico' ? 'c-red' : 'c-amb'}">${r.riesgo === 'critico' ? '🔴 CRÍTICO' : '🟡 ALERTA'}</span></td>${(() => { const m = MERMAS_YOY[r.sku]; if (!m || m.yoy_ytd === null) return '<td class="r" style="color:var(--muted);font-size:11px">—</td>'; const v = m.yoy_ytd; const c = v >= 0 ? "#1a8a3a" : "#C8001E"; const arr = v >= 0 ? "▲" : "▼"; return `<td class="r"><span style="font-family:var(--cond);font-size:15px;font-weight:800;color:${c}">${arr}${Math.abs(v).toFixed(1)}%</span><div style="font-size:9px;color:var(--muted)">YTD vs 2025</div></td>`; })()} </tr>`;
  }).join('');
  const tbl = (rows, titulo, color, cls, riesgoTipo) => rows.length ? `<div style="margin-bottom:14px"><div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px"><div style="font-size:11px;font-weight:800;text-transform:uppercase;color:${color};padding:5px 12px;background:${cls === 'c-red' ? '#fff0f0' : '#fffbf0'};border-radius:8px;display:inline-block">${cls === 'c-red' ? '🔴' : '🟡'} ${titulo} (${rows.length} SKUs)</div><button onclick="exportPlantaTablaExcel('${riesgoTipo}')" title="Descarga esta tabla (${titulo}) con XLIB, tránsito, fecha XLIB y venta YoY" style="font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;border:1.5px solid #1A5276;background:#eaf4fb;color:#1A5276;cursor:pointer;white-space:nowrap">⬇ Descargar Excel</button></div><div style="overflow-x:auto"><table class="tbl" style="min-width:960px"><thead><tr><th>#</th><th>Producto</th><th>Categoría</th><th class="r">Stock Disp</th><th class="r" style="white-space:nowrap">XLIB (kg)</th><th class="r" style="white-space:nowrap">Fecha XLIB</th><th class="r" style="white-space:nowrap">Tránsito (kg)</th><th class="r">FCST Sem</th><th class="r">Alcance</th><th class="r">Estado</th><th class="r" style="white-space:nowrap">Venta YoY</th></tr></thead><tbody>${bR(rows)}</tbody></table></div></div>` : `<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">✅ Sin ${titulo.toLowerCase()} en ${ta}</div>`;
  const cl = d.productos.filter(r => r.riesgo === 'critico'); const al = d.productos.filter(r => r.riesgo === 'alerta');
  el.innerHTML = kpis + subTabs + '<div style="padding:0 2px">' + kpisTipo + catBars + tbl(cl, `Críticos — ${cr}`, '#C8001E', 'c-red', 'critico') + tbl(al, `Alertas — ${ar}`, '#B8860B', 'c-amb', 'alerta') + '</div>';
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
  renderRiesgosQuebraKPIs();
  renderRiesgosSubcat();
  renderRiesgosTable();
  renderPlantaTabs();
  renderPlantaContent();

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
initCategoriaSelect();
initRiesgosControls();
renderRiesgos();
