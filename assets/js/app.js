let DB = DB_QUIEBRES;

function getSems(){const m=currentVista==='quiebres'?SEMS_Q:currentVista==='bloqueos'?SEMS_B:SEMS_C;return m[currentTipo]||m['all'];}

// ── ESTADO ─────────────────────────────────────────────────────────────────────
let currentVista = 'quiebres';
let currentTipo  = 'all';
let currentSem   = 'all';
let currentPlanta = 'all';
let currentGrupo = 'all';
let currentCategoria = 'all';
let skuSearch = '';
let currentMes = 'all';

// ── COLORES ────────────────────────────────────────────────────────────────────
const BAR_COLS = ['#C8001E','#c82a00','#b05000','#808060','#606060',
                  '#505080','#404060','#303040','#505050','#707070','#909090','#b0b0b0'];
const barCol  = i => BAR_COLS[i] || '#999';
const trendCol = (q, max) => q === max ? 'var(--red)' : q > max * .6 ? '#4A5568' : '#D0D4DE';

// ── UTILIDADES ─────────────────────────────────────────────────────────────────
const fmt     = n => n.toLocaleString('es-CL', {minimumFractionDigits:1, maximumFractionDigits:1});
const chipCls = p => p > 20 ? 'c-red' : p > 10 ? 'c-amb' : p > 5 ? 'c-blu' : 'c-grn';
const getData = () => {
  const key = currentSem !== 'all' ? currentSem : (currentMes !== 'all' ? currentMes : 'all');
  return DB[currentTipo][key] || DB[currentTipo]['all'];
};

const tip = document.getElementById('tip');
const showTip = (e, t) => { tip.style.opacity=1; tip.innerHTML=t; tip.style.left=(e.clientX+14)+'px'; tip.style.top=(e.clientY-36)+'px'; };
const hideTip = () => tip.style.opacity = 0;

// ── SETTERS ────────────────────────────────────────────────────────────────────
function setVista(vista, btn) {
  currentVista = vista;
  DB = vista === 'quiebres' ? DB_QUIEBRES : vista === 'bloqueos' ? DB_BLOQUEOS : DB_COMBINADO;

  ['quiebres','bloqueos','combinado','riesgos'].forEach(v => {
    const b = document.getElementById('vbtn-' + v);
    if(!b) return;
    b.classList.toggle('active', v === vista);
    b.style.color = v === vista ? '' : 'rgba(255,255,255,.5)';
  });

  const root = document.documentElement;
  const isRiesgos = vista === 'riesgos';
  const secRiesgos = document.getElementById('sec-riesgos');
  if(secRiesgos) secRiesgos.style.display = isRiesgos ? '' : 'none';
  document.querySelectorAll('section.sec-main').forEach(el => {
    el.style.display = isRiesgos ? 'none' : '';
  });

  const filterbar = document.querySelector('.filterbar');
  if (filterbar) filterbar.style.display = isRiesgos ? 'none' : '';
  const quicknav = document.querySelector('.quicknav');
  if (quicknav) quicknav.style.display = isRiesgos ? 'none' : '';

  if (vista === 'quiebres') {
    root.style.setProperty('--red','#C8001E'); root.style.setProperty('--red2','#E8001E');
    root.style.setProperty('--red-light','#fff0f0'); root.style.setProperty('--red-mid','#ffd6d6');
  } else if (vista === 'bloqueos') {
    root.style.setProperty('--red','#2D3748'); root.style.setProperty('--red2','#4A5568');
    root.style.setProperty('--red-light','#f0f2f5'); root.style.setProperty('--red-mid','#d0d6e0');
  } else if (vista === 'combinado') {
    root.style.setProperty('--red','#1A5276'); root.style.setProperty('--red2','#2471A3');
    root.style.setProperty('--red-light','#eaf4fb'); root.style.setProperty('--red-mid','#b8d9ef');
  } else {
    root.style.setProperty('--red','#8B1A1A'); root.style.setProperty('--red2','#A52020');
    root.style.setProperty('--red-light','#fff0f0'); root.style.setProperty('--red-mid','#ffd6d6');
  }
  if (isRiesgos) { initRiesgosControls(); renderRiesgos(); } else renderAll();
}

function setTipo(tipo, btn) {
  document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentTipo = tipo;
  renderAll();
}

function setSemana(sem) {
  currentSem = sem;
  document.getElementById('weekSel').value = sem;
  renderAll();
}

function toggleHelp() {
  document.getElementById('helpbox').classList.toggle('open');
}

function resetFiltros() {
  currentTipo = 'all';
  currentSem = 'all';
  currentMes = 'all';
  currentPlanta = 'all';
  currentGrupo = 'all';
  currentCategoria = 'all';
  skuSearch = '';
  document.querySelectorAll('.filterbar .tipo-btn').forEach((b,i) => b.classList.toggle('active', i === 0));
  const wSel = document.getElementById('weekSel');
  if (wSel) { wSel.value = 'all'; [...wSel.options].forEach(o => o.style.display = ''); }
  const mSel = document.getElementById('mesSel');
  if (mSel) mSel.value = 'all';
  const pSel = document.getElementById('plantaSel');
  if (pSel) pSel.value = 'all';
  const gSel = document.getElementById('grupoSel');
  if (gSel) gSel.value = 'all';
  const cSel = document.getElementById('categoriaSel');
  if (cSel) cSel.value = 'all';
  const sInput = document.getElementById('skuSearchInput');
  if (sInput) sInput.value = '';
  if (currentVista === 'riesgos') renderRiesgos(); else renderAll();
}

// ── RENDER PRINCIPAL ───────────────────────────────────────────────────────────
function renderAll() {
  const label = currentVista === 'quiebres' ? 'Quiebres' : currentVista === 'bloqueos' ? 'Bloqueos' : 'Combinado';
  document.getElementById('lbl-cadena').textContent = '🏷️ ' + label + ' por Grupo de Marketing';
  document.getElementById('lbl-planta').textContent = '🏭 ' + label + ' por Planta';
  document.getElementById('lbl-sku').textContent    = '🔎 Top SKUs — Detalle por producto (' + label + ')';

  const badge = (currentTipo === 'all' ? '' : currentTipo + ' · ') +
                (currentSem  === 'all' ? 'Todas las semanas' : currentSem);
  document.getElementById('filterBadge').textContent = badge ? '— ' + badge : '';


  const d = getData();
  renderStatusHero(d);
  renderKPIs(d);
  renderCadenas(d);
  renderPlantas(d);
  renderTrend(d);
  renderSemCards(d);
  renderSKUs(d);
}

// ── SECCIÓN ⓪ ESTADO — 5s (¿bien o mal?) / 15s (¿dónde?) / 30s (¿qué?) / Acción ─
function renderStatusHero(d) {
  const el = document.getElementById('statusHero');
  if (!el) return;

  const labelAcc = currentVista === 'quiebres' ? 'quebrado'
                 : currentVista === 'bloqueos' ? 'bloqueado' : 'quebrado + bloqueado';
  const tonLabel = currentVista === 'quiebres' ? 'Ton quebradas'
                 : currentVista === 'bloqueos' ? 'Ton bloqueadas' : 'Ton combinadas';

  const cadenas = d.cadenas || [];
  const plantas = d.plantas || [];
  // Si hay un grupo de marketing filtrado, toda la cabecera se acota a ese grupo
  const grupoActivo = currentGrupo !== 'all' ? cadenas.find(c => c.n === currentGrupo) : null;

  // 5s — ¿estamos bien o mal? (gravedad relativa al FCST del propio filtro/grupo)
  const baseQ    = grupoActivo ? grupoActivo.q    : d.q;
  const baseFcst = grupoActivo ? grupoActivo.fcst : d.fcst;
  const pctGlobal = baseFcst > 0 ? (baseQ / baseFcst * 100) : 0;
  const estado = pctGlobal > 15 ? { ic: '🔴', txt: 'CRÍTICO',       col: 'var(--red)' }
               : pctGlobal > 7  ? { ic: '🟡', txt: 'ATENCIÓN',      col: '#B8860B' }
               :                  { ic: '🟢', txt: 'BAJO CONTROL', col: '#1a8a3a' };

  // 15s — ¿dónde está el problema? (top grupo de marketing y top planta; o el grupo filtrado)
  const topGrupo  = cadenas[0] || null;
  const topPlanta = plantas[0] || null;
  const totalGrupos  = cadenas.reduce((s, c) => s + c.q, 0) || 1;
  const totalPlantas = plantas.reduce((s, p) => s + p.q, 0) || 1;
  const rankGrupoActivo = grupoActivo ? cadenas.indexOf(grupoActivo) + 1 : null;

  // 30s — ¿qué SKUs lo están provocando? (top 10 a primera vista, o el top 5 del grupo filtrado)
  const top10Sku = grupoActivo
    ? ((d.skuPorCadena && d.skuPorCadena[currentGrupo]) || [])
    : (d.skus || []).slice(0, 10);
  const topSku = top10Sku[0] || null;

  // Acción — cruce con Riesgo de Quiebre: ¿alguno de los top 3 SKU en quiebre
  // también aparece en el Top 50 de menor alcance de stock (RIESGOS)?
  // Es información hacia adelante (¿va a seguir pasando?), no una repetición del top de al lado.
  let riesgoMatch = null;
  for (let i = 0; i < Math.min(3, top10Sku.length); i++) {
    const s = top10Sku[i];
    const hit = (typeof RIESGOS !== 'undefined' ? RIESGOS : []).find(r => r.n.toUpperCase().trim() === s.n.toUpperCase().trim());
    if (hit) { riesgoMatch = { sku: s, rank: i + 1, riesgo: hit }; break; }
  }
  const irARiesgos = `setVista('riesgos', document.getElementById('vbtn-riesgos')); return false;`;

  el.innerHTML = `
    <div class="status-step">
      <div class="status-step-eyebrow">¿Estamos bien o mal?</div>
      <div class="status-badge" style="color:${estado.col}">${estado.ic} ${estado.txt}</div>
      <div class="status-badge-sub">${fmt(baseQ)} ton ${labelAcc}${grupoActivo ? ' en ' + grupoActivo.n : ''}${baseFcst > 0 ? ' · ' + pctGlobal.toFixed(1) + '% del FCST' : ''}</div>
    </div>
    <div class="status-step">
      <div class="status-step-eyebrow">¿Dónde está el problema?</div>
      ${grupoActivo ? `<div class="status-where-row">
        <div class="status-where-tag">Grupo</div>
        <div class="status-where-name" title="${grupoActivo.n}">${grupoActivo.n}</div>
        <div class="status-where-val">${(grupoActivo.q / totalGrupos * 100).toFixed(0)}%</div>
      </div>
      <div class="status-badge-sub">#${rankGrupoActivo} de ${cadenas.length} grupos por quiebre</div>` : `
      ${topGrupo ? `<div class="status-where-row">
        <div class="status-where-tag">Grupo</div>
        <div class="status-where-name" title="${topGrupo.n}">${topGrupo.n}</div>
        <div class="status-where-val">${(topGrupo.q / totalGrupos * 100).toFixed(0)}%</div>
      </div>` : ''}
      ${topPlanta ? `<div class="status-where-row">
        <div class="status-where-tag">Planta</div>
        <div class="status-where-name" title="${topPlanta.n}">${topPlanta.n}</div>
        <div class="status-where-val">${(topPlanta.q / totalPlantas * 100).toFixed(0)}%</div>
      </div>` : ''}
      ${!topGrupo && !topPlanta ? '<div class="status-badge-sub">Sin datos para este filtro</div>' : ''}`}
    </div>
    <div class="status-step">
      <div class="status-step-eyebrow">¿Qué lo provoca? <em>· ${grupoActivo ? 'Top SKU del grupo' : 'Top 10 SKU'}</em></div>
      ${top10Sku.length ? `
      <div class="status-sku-head"><span>SKU</span><span>${tonLabel}</span></div>
      <div class="status-sku-list">
        ${top10Sku.map((s,i) => `<div class="status-sku-row">
          <div class="status-sku-rank">${i+1}</div>
          <div class="status-sku-name" title="${s.n}">${s.n}</div>
          <div class="status-sku-val">${fmt(s.q)}<small>t</small></div>
        </div>`).join('')}
      </div>` : '<div class="status-badge-sub">Sin datos para este filtro</div>'}
    </div>
    <div class="status-step">
      <div class="status-step-eyebrow">¿Qué revisar ahora?</div>
      <div class="status-action">
        ${riesgoMatch ? `
          <span class="chip ${riesgoMatch.riesgo.riesgo === 'critico' ? 'c-red' : 'c-amb'}">${riesgoMatch.riesgo.riesgo === 'critico' ? '🔴 CRÍTICO' : '🟡 ALERTA'}</span>
          <b>${riesgoMatch.sku.n}</b> (SKU #${riesgoMatch.rank} en quiebre) ya está en riesgo de volver a quebrar:
          alcanza para <b>${riesgoMatch.riesgo.alcance.toFixed(1)} sem</b> de stock en ${riesgoMatch.riesgo.planta}.
          <a href="#" onclick="${irARiesgos}">Ver en Riesgo de Quiebre →</a>
        ` : topSku ? `
          Ninguno de los SKU con mayor quiebre${grupoActivo ? ' de ' + grupoActivo.n : ''} aparece hoy en el
          Top 50 de menor alcance de stock (Riesgo de Quiebre) — no significa que estén sanos, ese top solo
          cubre los 50 casos más urgentes. <a href="#" onclick="${irARiesgos}">Revisar Riesgo de Quiebre →</a>
        ` : 'No hay suficientes datos para sugerir una acción con este filtro.'}
      </div>
    </div>`;
}

// ── SECCIÓN ① KPIs ────────────────────────────────────────────────────────────
function renderKPIs(d) {
  const labels = {
    quiebres: ['Total Quebrado','cantidad quebrada'],
    bloqueos: ['Total Bloqueado','cantidad bloqueada'],
    combinado: ['Total Combinado','quebrado + bloqueado']
  }[currentVista];
  document.getElementById('kpiRow').innerHTML = `
    <div class="kpi k-red">
      <div class="kpi-label">${labels[0]}</div>
      <div class="kpi-val" style="color:var(--red)">${fmt(d.q)}</div>
      <div class="kpi-unit">Toneladas</div>
      <div class="kpi-meta">${labels[1]}</div>
    </div>
    <div class="kpi k-gray">
      <div class="kpi-label">FCST Asignado</div>
      <div class="kpi-val" style="color:var(--dark2)">${fmt(d.fcst)}</div>
      <div class="kpi-unit">Toneladas</div>
      <div class="kpi-meta">volumen estimado</div>
    </div>
    <div class="kpi k-gray">
      <div class="kpi-label">Diferencia vs FCST</div>
      <div class="kpi-val" style="color:var(--dark)">${fmt(Math.abs(d.fcst - d.vr))}</div>
      <div class="kpi-unit">Toneladas</div>
      <div class="kpi-meta">brecha real vs estimado</div>
    </div>
    <div class="kpi k-gray">
      <div class="kpi-label">Venta Real</div>
      <div class="kpi-val" style="color:var(--dark)">${fmt(d.vr)}</div>
      <div class="kpi-unit">Toneladas</div>
      <div class="kpi-meta">despachado real</div>
    </div>`;
}

// ── SECCIÓN ② CADENAS ─────────────────────────────────────────────────────────
function renderCadenas(d) {
  const cadenasAll  = d.cadenas || [];
  const cadenasView = currentGrupo === 'all' ? cadenasAll : cadenasAll.filter(c => c.n === currentGrupo);
  const totalQ = cadenasAll.reduce((s, c) => s + c.q, 0) || 1;
  const weeks = getSems().map(s => s.s).slice(-8); // últimas semanas disponibles, serie real por grupo

  const noteEl = document.getElementById('grupoFiltroNote');
  if (noteEl) noteEl.style.display = currentGrupo === 'all' ? 'none' : '';

  const emEl = document.getElementById('cadenaEm');
  emEl.textContent = (currentGrupo !== 'all' && cadenasView[0])
    ? `${fmt(cadenasView[0].q)} ton · ${(cadenasView[0].q/totalQ*100).toFixed(1)}% del total`
    : fmt(d.q) + ' ton total';

  const tonLabelCadenas = currentVista === 'quiebres' ? 'Ton Quebradas'
                        : currentVista === 'bloqueos' ? 'Ton Bloqueadas' : 'Ton Combinadas';

  document.getElementById('cadenasBars').innerHTML = cadenasView.length
    ? `<div style="overflow-x:auto"><table class="tbl">
        <thead><tr>
          <th>#</th><th>Grupo de Marketing</th>
          <th class="r">${tonLabelCadenas}</th>
          <th class="r">% FCST</th>
          <th class="r">Participación</th>
          <th class="r">Tendencia</th>
        </tr></thead>
        <tbody>
        ${cadenasView.map((c) => {
          const i = cadenasAll.indexOf(c); // color consistente con el ranking sin filtrar
          const pctFcst  = c.fcst > 0 ? (c.q/c.fcst*100) : 0;
          const pctTotal = (c.q/totalQ*100).toFixed(1);

          // serie semanal real del grupo (no inventada: viene de DB[tipo][semana].cadenas)
          const serie = weeks.map(w => {
            const wd = DB[currentTipo] && DB[currentTipo][w];
            const row = wd && wd.cadenas ? wd.cadenas.find(x => x.n === c.n) : null;
            return row ? row.q : 0;
          });
          const half = Math.floor(serie.length/2) || 1;
          const prevAvg = serie.slice(0, half).reduce((a,b) => a+b, 0) / half;
          const lastAvg = serie.slice(half).reduce((a,b) => a+b, 0) / (serie.length - half || 1);
          const deltaPct = prevAvg > 0 ? ((lastAvg - prevAvg) / prevAvg * 100) : (lastAvg > 0 ? 100 : 0);
          const up = deltaPct > 3, down = deltaPct < -3;
          const trendArrow = up ? '▲' : down ? '▼' : '▬';
          const trendColor = up ? 'var(--red)' : down ? '#1a8a3a' : 'var(--muted)';

          return `<tr>
            <td style="font-family:var(--cond);font-size:14px;font-weight:800;color:var(--muted2)">${i+1}</td>
            <td style="font-weight:700;color:var(--dark)"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${barCol(i)};margin-right:8px;flex-shrink:0"></span>${c.n}</td>
            <td class="r"><div class="tbl-q">${fmt(c.q)}</div></td>
            <td class="r"><span class="chip ${chipCls(pctFcst)}">${c.fcst > 0 ? pctFcst.toFixed(1)+'%' : '—'}</span></td>
            <td class="r" style="font-family:var(--cond);font-weight:700;font-size:15px;color:var(--dark2)">${pctTotal}%</td>
            <td class="r" style="font-family:var(--cond);font-weight:800;font-size:15px;color:${trendColor}" title="Tendencia — últimas ${serie.length} semanas (${weeks[0] || ''}–${weeks[weeks.length-1] || ''})">${trendArrow} ${Math.abs(deltaPct).toFixed(0)}%</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>`
    : `<div class="empty">${currentGrupo !== 'all' ? 'Este grupo no tiene quiebres para este filtro' : 'Sin quiebres para este filtro'}</div>`;

  document.getElementById('drillCadena').innerHTML = cadenasView.length
    ? cadenasView.map((c, k) => {
        const i = cadenasAll.indexOf(c); // color consistente con el ranking sin filtrar
        const skus  = (d.skuPorCadena || {})[c.n] || [];
        const maxQ  = skus.length ? Math.max(...skus.map(s => s.q)) : 1;
        const forced = currentGrupo !== 'all'; // filtrado a un solo grupo: mostrar el detalle abierto de inmediato
        return `<div class="drill">
          <div class="drill-hdr" onclick="toggleDrill(${k})">
            <div class="drill-dot" style="background:${barCol(i)}"></div>
            <div class="drill-name">${c.n}</div>
            <div style="text-align:right;flex-shrink:0">
              <div class="drill-q">${fmt(c.q)}</div>
              <div class="drill-unit">ton</div>
            </div>
            <div style="font-size:10px;color:var(--muted);text-align:right">
              FCST: <span style="font-family:var(--cond);font-weight:700;color:var(--dark2)">${fmt(c.fcst)}</span> ton
            </div>
            <div class="drill-arrow ${forced ? 'open' : ''}" id="arr${k}">›</div>
          </div>
          <div class="drill-body ${forced ? 'open' : ''}" id="bdy${k}">
            <div style="font-size:10px;font-weight:700;color:var(--muted2);letter-spacing:.07em;text-transform:uppercase;margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid var(--border)">Top 5 SKUs</div>
            ${skus.length
              ? skus.map((s,j) => `
                <div class="sku-row">
                  <div class="sku-rank">${j+1}</div>
                  <div class="sku-info">
                    <div class="sku-name" title="${s.n}">${s.n}</div>
                    <div class="sku-planta">${s.pl}</div>
                    <div class="sku-bar-track"><div class="sku-bar-fill" style="width:${(s.q/maxQ*100).toFixed(1)}%;background:${barCol(i)}"></div></div>
                  </div>
                  <div class="sku-nums"><div class="sku-q">${fmt(s.q)}</div><div class="sku-unit">ton</div></div>
                </div>`).join('')
              : '<div class="empty" style="padding:.5rem">Sin datos</div>'}
          </div>
        </div>`;
      }).join('')
    : '<div class="empty">Sin datos para este filtro</div>';
}

// ── SECCIÓN ③ PLANTAS ─────────────────────────────────────────────────────────
function renderPlantas(d) {
  const max    = d.plantas.length ? Math.max(...d.plantas.map(p => p.q)) : 1;
  const totalQ = d.plantas.reduce((s, p) => s + p.q, 0) || 1;
  document.getElementById('plantaEm').textContent = fmt(d.q) + ' ton total';
  document.getElementById('plantaBars').innerHTML = d.plantas.length
    ? d.plantas.map((p, i) => {
        const pctFcst  = p.fcst > 0 ? (p.q/p.fcst*100).toFixed(1) : '—';
        const pctTotal = (p.q/totalQ*100).toFixed(1);
        const cls      = p.fcst > 0 ? (p.q/p.fcst*100) > 20 ? 'c-red' : (p.q/p.fcst*100) > 10 ? 'c-amb' : 'c-grn' : 'c-grn';
        return `<div class="hbar" style="margin-bottom:14px;align-items:flex-start">
          <div class="hbar-name" style="min-width:110px;padding-top:2px">${p.n}</div>
          <div style="flex:1">
            <div class="hbar-track" style="margin-bottom:4px">
              <div class="hbar-fill" style="width:${(p.q/max*100).toFixed(1)}%;background:${barCol(i)}"></div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <div style="font-size:10px;color:var(--muted)">FCST: <span style="font-family:var(--cond);font-weight:700;color:var(--dark2);font-size:12px">${fmt(p.fcst)}</span> ton</div>
              <div style="font-size:10px;color:var(--muted)">Participación: <span style="font-family:var(--cond);font-weight:700;color:var(--dark);font-size:12px">${pctTotal}%</span> del total</div>
            </div>
          </div>
          <div class="hbar-right" style="min-width:110px;text-align:right">
            <div class="hbar-q">${fmt(p.q)}</div>
            <div class="hbar-unit">ton</div>
            <span class="chip ${cls}" style="margin-top:4px;display:inline-block">${pctFcst}% del FCST</span>
          </div>
        </div>`;
      }).join('')
    : '<div class="empty">Sin datos</div>';
}

// ── SECCIÓN ④ TENDENCIA ───────────────────────────────────────────────────────
function renderTrend(d) {
  const trendTitleEl = document.getElementById('trendTitle');
  const _sems=getSems();if (!_sems||!_sems.length) { document.getElementById('trendBars').innerHTML = '<div class="empty">Sin datos</div>'; if(trendTitleEl) trendTitleEl.textContent=''; return; }
  const max = Math.max(..._sems.map(s => s.q));
  if (trendTitleEl) trendTitleEl.textContent = _sems[0].s + '–' + _sems[_sems.length-1].s;
  document.getElementById('trendBars').innerHTML = _sems.map(s => {
    const isSel = currentSem === s.s;
    return `
    <div class="trend-col-wrap ${isSel ? 'show-val' : ''}">
      <div class="trend-val">${fmt(s.q)}</div>
      <div class="trend-col ${isSel ? 'sel' : ''}" style="height:${Math.max((s.q/max*100),2).toFixed(1)}%;background:${trendCol(s.q,max)}"
        onmouseenter="showTip(event,'<b>${s.s}</b>: ${fmt(s.q)} ton')"
        onmouseleave="hideTip()" onclick="setSemana('${currentSem===s.s ? 'all' : s.s}')"></div>
    </div>`;
  }).join('');
  document.getElementById('trendX').innerHTML = _sems
    .filter((_,i) => i % 3 === 0 || i === _sems.length - 1)
    .map(s => `<span>${s.s}</span>`).join('');
}

// ── SECCIÓN ④ Detalle de la semana seleccionada ───────────────────────────────
function renderSemCards(d) {
  if (currentSem === 'all') {
    document.getElementById('semDetail').innerHTML =
      '<div style="font-size:13px;color:var(--muted)">💡 Toca una barra del gráfico para ver el detalle de esa semana.</div>';
    return;
  }
  const semD = DB[currentTipo][currentSem];
  if (!semD) { document.getElementById('semDetail').innerHTML = ''; return; }
  const top  = semD.cadenas.slice(0, 5);
  const maxQ = top.length ? Math.max(...top.map(c => c.q)) : 1;
  document.getElementById('semDetail').innerHTML = `
    <div style="width:100%">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px">
        <div><b>Semana ${currentSem}</b> — <span style="font-family:var(--cond);font-weight:800;color:var(--red);font-size:18px">${fmt(semD.q)}</span> ton</div>
        <button class="trend-clear" onclick="setSemana('all')">✕ Quitar selección</button>
      </div>
      <div style="font-size:10px;font-weight:700;color:var(--muted2);letter-spacing:.07em;text-transform:uppercase;margin-bottom:8px">Top 5 grupos de marketing — ${currentSem}</div>
      ${top.map((c,i) => `
        <div class="hbar" style="margin-bottom:7px">
          <div class="hbar-name" style="min-width:110px">${c.n}</div>
          <div class="hbar-track"><div class="hbar-fill" style="width:${(c.q/maxQ*100).toFixed(1)}%;background:${barCol(i)}"></div></div>
          <div class="hbar-right" style="min-width:70px">
            <div class="hbar-q" style="font-size:18px">${fmt(c.q)}</div>
            <div class="hbar-unit">ton</div>
          </div>
        </div>`).join('')}
    </div>`;
}

// ── SECCIÓN ⑤ SKUs ────────────────────────────────────────────────────────────


function renderSKUs(d) {
  const thq = document.getElementById('th-q');
  if (thq) thq.textContent = currentVista === 'quiebres' ? 'Ton Quebradas'
                           : currentVista === 'bloqueos'  ? 'Ton Bloqueadas' : 'Ton Combinadas';

  document.getElementById('skuSub').textContent =
    (currentTipo === 'all' ? 'Todos' : currentTipo) + ' · ' +
    (currentSem  === 'all' ? 'S01–S19' : currentSem);

  const q = skuSearch.trim().toLowerCase();
  const skus = d.skus.filter(s =>
    (currentPlanta === 'all' || s.pl === currentPlanta) &&
    (currentCategoria === 'all' || s.cat === currentCategoria) &&
    (!q || s.n.toLowerCase().includes(q))
  );
  if (!skus.length) {
    document.getElementById('skuBody').innerHTML =
      '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--muted)">Sin datos para este filtro</td></tr>';
    return;
  }

  document.getElementById('skuBody').innerHTML = skus.map(s => {
    const fcst      = s.q > 0 && s.pct > 0 ? Math.round(s.q / (s.pct / 100)) : 0;
    const estadoCls = s.pct > 20 ? 'c-red' : s.pct > 10 ? 'c-amb' : 'c-grn';
    const estadoTxt = s.pct > 20 ? 'CRÍTICO' : s.pct > 10 ? 'ALERTA' : 'NORMAL';
    const qColor    = s.q > 100 ? 'var(--red)' : s.q > 30 ? '#4A5568' : 'var(--dark)';
    const nameUp    = s.n.toUpperCase().trim();
    const semKey    = currentSem === 'all' ? 'all' : currentSem;
    const c         = COMENTARIOS[nameUp+'|'+semKey] || null;
    const motivo    = c ? (c.motivo || '') : '';
    const fecha     = c ? (c.recuperacion || '') : '';
    return `<tr>
      <td style="font-family:var(--cond);font-size:14px;font-weight:800;color:var(--muted2)">${s.r}</td>
      <td style="max-width:200px;font-weight:600">
        <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${s.n}">${s.n}</div>
        ${fecha ? `<div style="margin-top:5px;display:inline-flex;align-items:center;gap:5px;
            background:linear-gradient(135deg,#e8f8f0,#d0f0e0);
            border-left:3px solid #00a060;border-radius:0 5px 5px 0;
            padding:3px 8px;font-size:10px;font-weight:700;color:#005535;letter-spacing:.02em">
            📅 Rec: ${fecha}
          </div>` : ''}
      </td>
      <td style="font-size:12px;color:var(--muted)">${s.pl}</td>
      <td style="font-size:11px;color:var(--muted)">${s.cat}</td>
      <td class="r">
        <div class="tbl-q" style="color:${qColor}">${fmt(s.q)}</div>
        <div class="tbl-unit">ton</div>
      </td>
      <td class="r">
        <div style="font-family:var(--cond);font-size:16px;font-weight:700;color:var(--dark2)">${fmt(fcst)}</div>
        <div class="tbl-unit">ton FCST</div>
      </td>
      <td class="r"><span class="chip ${estadoCls}">${estadoTxt}</span></td>
      <td style="max-width:200px;font-size:11px;color:var(--muted);font-style:italic;line-height:1.4">
        ${motivo ? motivo.slice(0,90)+(motivo.length>90?'…':'') : '<span style="color:var(--gray3)">—</span>'}
      </td>
    </tr>`;
  }).join('');
}



function toggleDrill(i) {
  document.getElementById('bdy' + i).classList.toggle('open');
  document.getElementById('arr' + i).classList.toggle('open');
}




// ── PLANTA + BÚSQUEDA ─────────────────────────────────────────────────────────
function initMesSelect() {
  const sel = document.getElementById('mesSel');
  if (!sel || sel.options.length > 1) return;
  Object.keys(MES_MAP).forEach(m => {
    const o = document.createElement('option');
    o.value = m; o.textContent = m;
    sel.appendChild(o);
  });
}
function setMes(mes) {
  currentMes = mes;
  // Actualizar semanas disponibles en weekSel
  const wSel = document.getElementById('weekSel');
  if (wSel) {
    for (const opt of wSel.options) {
      if (opt.value === 'all') { opt.style.display = ''; continue; }
      opt.style.display = (mes === 'all' || (MES_MAP[mes]||[]).includes(opt.value)) ? '' : 'none';
    }
    // Si la semana actual no está en el mes, resetear a 'all'
    if (mes !== 'all' && currentSem !== 'all' && !(MES_MAP[mes]||[]).includes(currentSem)) {
      currentSem = 'all';
      wSel.value = 'all';
    }
  }
  renderAll();
}

function initPlantaSelect() {
  const sel = document.getElementById('plantaSel');
  if (!sel || sel.options.length > 1) return;
  // plantas desde los datos de quiebres globales
  const plantas = (DB_QUIEBRES.all.all.plantas || []).map(p => p.n).filter(Boolean);
  plantas.forEach(p => {
    const o = document.createElement('option');
    o.value = p; o.textContent = p;
    sel.appendChild(o);
  });
}
function setPlanta(val) {
  currentPlanta = val;
  renderAll();
}

function initGrupoSelect() {
  const sel = document.getElementById('grupoSel');
  if (!sel || sel.options.length > 1) return;
  // grupos desde los datos de quiebres globales, en el mismo orden del ranking (mayor a menor)
  const grupos = (DB_QUIEBRES.all.all.cadenas || []).map(c => c.n).filter(Boolean);
  grupos.forEach(g => {
    const o = document.createElement('option');
    o.value = g; o.textContent = g;
    sel.appendChild(o);
  });
}
function setGrupo(val) {
  currentGrupo = val;
  renderAll();
}

function initCategoriaSelect() {
  const sel = document.getElementById('categoriaSel');
  if (!sel || sel.options.length > 1) return;
  const cats = new Set();
  [DB_QUIEBRES, DB_BLOQUEOS, DB_COMBINADO].forEach(db => {
    Object.values(db).forEach(porTipo => {
      Object.values(porTipo).forEach(porSem => {
        (porSem.skus || []).forEach(s => { if (s.cat) cats.add(s.cat); });
      });
    });
  });
  [...cats].sort().forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    sel.appendChild(o);
  });
}
function setCategoria(val) {
  currentCategoria = val;
  renderAll();
}
function setSkuSearch(val) {
  skuSearch = val;
  renderAll();
}


let riesgosFilter='all';
let riesgosPlanta='all';
let riesgsSem='all';
let plantaActiva=null;

function setRiesgSem(v){
  riesgsSem=v;
  // Actualizar label del subcat chart
  const lbl=document.getElementById('subcatSemLabel');
  if(lbl) lbl.textContent=(v==='all'?'semana actual':'semana '+v)+' · ton';
  renderRiesgosSubcat();
  renderRiesgosQuebraKPIs();
}
function renderRiesgosSubcat(){
  // Usar datos de quiebres de la semana seleccionada para el chart subcategoría
  const sem=riesgsSem==='all'?null:riesgsSem;
  const d=sem?(DB_QUIEBRES[currentTipo]&&DB_QUIEBRES[currentTipo][sem]):(DB_QUIEBRES[currentTipo]&&DB_QUIEBRES[currentTipo]['all']);
  const el=document.getElementById('chartSubcat');
  if(!el)return;
  if(BY_SUBCAT&&!sem){
    // Semana actual: usar BY_SUBCAT (semana actual)
    const PAL=['#C8001E','#c84000','#b06010','#2D5BE3','#009060','#7A5AA0','#1a6a8a','#a03050','#508030','#7A5A10'];
    const entries=Object.entries(BY_SUBCAT);
    if(!entries.length){el.innerHTML='<p style="color:var(--muted);font-size:12px">Sin datos</p>';return;}
    const maxV=Math.max(...entries.map(([,v])=>v));
    el.innerHTML=entries.map(([k,v],i)=>{
      const col=PAL[i]||'#555';const pct=(v/maxV*100).toFixed(1);
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:11px">
        <div style="min-width:140px;font-size:11px;font-weight:600;color:var(--dark2)" title="${k}">${k.length>26?k.slice(0,26)+'…':k}</div>
        <div style="flex:1;background:var(--gray2);border-radius:4px;height:8px">
          <div style="height:8px;border-radius:4px;width:${pct}%;background:${col};transition:width .4s"></div></div>
        <div style="text-align:right;min-width:62px"><span style="font-family:var(--cond);font-size:18px;font-weight:800;color:${col}">${v.toLocaleString('es-CL',{minimumFractionDigits:1})}</span>
          <span style="font-size:9px;color:var(--muted);margin-left:2px">ton</span></div></div>`;
    }).join('');
  } else if(d&&d.skus&&d.skus.length){
    // Semana seleccionada: agrupar skus por cat
    const bycat={};
    d.skus.forEach(s=>{bycat[s.cat]=(bycat[s.cat]||0)+s.q;});
    const sorted=Object.entries(bycat).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const PAL=['#C8001E','#c84000','#b06010','#2D5BE3','#009060','#7A5AA0','#1a6a8a','#a03050'];
    if(!sorted.length){el.innerHTML='<p style="color:var(--muted);font-size:12px">Sin datos para esta semana</p>';return;}
    const maxV=Math.max(...sorted.map(([,v])=>v));
    el.innerHTML=sorted.map(([k,v],i)=>{
      const col=PAL[i]||'#555';const pct=(v/maxV*100).toFixed(1);
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:11px">
        <div style="min-width:140px;font-size:11px;font-weight:600;color:var(--dark2)">${k.length>26?k.slice(0,26)+'…':k}</div>
        <div style="flex:1;background:var(--gray2);border-radius:4px;height:8px">
          <div style="height:8px;border-radius:4px;width:${pct}%;background:${col};transition:width .4s"></div></div>
        <div style="text-align:right;min-width:62px"><span style="font-family:var(--cond);font-size:18px;font-weight:800;color:${col}">${v.toLocaleString('es-CL',{minimumFractionDigits:1})}</span>
          <span style="font-size:9px;color:var(--muted);margin-left:2px">ton</span></div></div>`;
    }).join('');
  } else {
    el.innerHTML='<p style="color:var(--muted);font-size:12px">Sin datos</p>';
  }
}
function renderRiesgosQuebraKPIs(){
  // KPI quiebres para semana seleccionada (complementa los de stock)
  const sem=riesgsSem==='all'?null:riesgsSem;
  const d=sem?(DB_QUIEBRES[currentTipo]&&DB_QUIEBRES[currentTipo][sem]):(DB_QUIEBRES[currentTipo]&&DB_QUIEBRES[currentTipo]['all']);
  const el=document.getElementById('riesgo-quebra-kpis');
  if(!el||!d)return;
  const semLabel=sem||'Todas las semanas';
  el.innerHTML=`
    <div style="background:var(--card);border:1.5px solid var(--border);border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:14px">
      <div style="font-size:32px;font-family:var(--cond);font-weight:900;color:#C8001E">${d.q.toLocaleString('es-CL',{minimumFractionDigits:1})}</div>
      <div><div style="font-size:11px;font-weight:800;color:#C8001E;text-transform:uppercase">ton Quebradas</div><div style="font-size:10px;color:var(--muted)">${semLabel}</div></div>
    </div>
    <div style="background:var(--card);border:1.5px solid var(--border);border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:14px">
      <div style="font-size:32px;font-family:var(--cond);font-weight:900;color:#2D5BE3">${d.fcst.toLocaleString('es-CL',{minimumFractionDigits:1})}</div>
      <div><div style="font-size:11px;font-weight:800;color:#2D5BE3;text-transform:uppercase">ton FCST</div><div style="font-size:10px;color:var(--muted)">${semLabel}</div></div>
    </div>
    <div style="background:var(--card);border:1.5px solid var(--border);border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:14px">
      <div style="font-size:32px;font-family:var(--cond);font-weight:900;color:#009060">${d.vr.toLocaleString('es-CL',{minimumFractionDigits:1})}</div>
      <div><div style="font-size:11px;font-weight:800;color:#009060;text-transform:uppercase">ton Venta Real</div><div style="font-size:10px;color:var(--muted)">${semLabel}</div></div>
    </div>`;
}
function setRiesgosPlanta(p,btn){
  riesgosPlanta=p;
  document.querySelectorAll('.rp-btn').forEach(b=>{
    b.style.background='var(--card)';b.style.color='var(--dark2)';b.style.borderColor='var(--border)';
  });
  btn.style.background='#C8001E';btn.style.color='#fff';btn.style.borderColor='#C8001E';
  renderRiesgosTable();
}

function filterRiesgos(f,btn){
  riesgosFilter=f;
  document.querySelectorAll('.rpill').forEach(b=>{b.style.background='#fff';b.style.color='#555';b.style.borderColor='#ddd';});
  btn.style.background='#fff0f0';btn.style.color='#C8001E';btn.style.borderColor='#C8001E';
  renderRiesgosTable();
}
function renderCharts(){
  /* ── KPI CARDS ── */
  const kpiEl=document.getElementById('riesgos-kpis');
  if(kpiEl){
    const total=TOTAL_CRITICOS+TOTAL_ALERTAS;
    const topP=PLANTAS_RIESGO.slice().sort((a,b)=>b.criticos-a.criticos)[0];
    const topCat=Object.entries(BY_SUBCAT||{})[0]||['—',0];
    /* bigCard: número grande + etiqueta debajo */
    const bigCard=(bg,border,accentColor,num,label,sub)=>`
      <div style="background:${bg};border:2px solid ${border};border-radius:16px;padding:22px 24px;
                  position:relative;overflow:hidden;display:flex;flex-direction:column;gap:6px">
        <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${accentColor}"></div>
        <div style="font-size:56px;line-height:1;font-family:var(--cond);font-weight:900;color:${accentColor}">${num}</div>
        <div style="font-size:12px;font-weight:800;color:${accentColor};text-transform:uppercase;letter-spacing:.5px">${label}</div>
        <div style="font-size:10px;color:var(--muted);line-height:1.4">${sub}</div>
      </div>`;

    /* infoCard: etiqueta arriba + valor grande */
    const infoCard=(bg,border,accentColor,label,val,sub)=>`
      <div style="background:${bg};border:2px solid ${border};border-radius:16px;padding:18px 20px;
                  position:relative;overflow:hidden;display:flex;flex-direction:column;gap:4px">
        <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${accentColor}"></div>
        <div style="font-size:10px;font-weight:800;color:${accentColor};text-transform:uppercase;letter-spacing:.5px">${label}</div>
        <div style="font-size:22px;line-height:1.15;font-family:var(--cond);font-weight:800;color:var(--dark2);
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${val}</div>
        <div style="font-size:10px;color:var(--muted);line-height:1.4">${sub}</div>
      </div>`;

    kpiEl.style.cssText='margin-bottom:20px';
    kpiEl.innerHTML=`
      <!-- Fila 1: métricas principales -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
        ${bigCard('#fff0f0','#ffd6d6','#C8001E',TOTAL_CRITICOS,'🔴 Críticos','Refrig &lt;1 sem · Abarr &lt;2 sem')}
        ${bigCard('#fffbf0','#fde0a0','#C88000',TOTAL_ALERTAS,'🟡 Alertas','Refrig 1–2 sem · Abarr 2–4 sem')}
        ${bigCard('#f0f4ff','#c8d4ff','#2D5BE3',total,'📊 Total en Riesgo','SKUs con stock crítico o alerta')}
      </div>
      <!-- Fila 2: contexto -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${infoCard('#fff8f0','#ffd8b0','#c84000','🏭 Planta con más riesgo',topP?topP.planta:'—',topP?`${topP.criticos} críticos · ${topP.alertas} alertas · ${topP.criticos+topP.alertas} SKUs total`:'')}
        ${infoCard('#fff8fc','#f0b8e0','#8B2070','🔺 Subcategoría más quebrada',topCat[0],`${topCat[1].toLocaleString('es-CL',{minimumFractionDigits:1})} ton`)}
      </div>`;
  }

  /* ── PALETA ── */
  const PAL=['#C8001E','#c84000','#b06010','#2D5BE3','#009060','#7A5AA0','#1a6a8a','#a03050','#508030','#7A5A10'];
  const bar=(el,entries,valFn,labelFn,unitLabel)=>{
    if(!el||!entries.length)return;
    const maxV=Math.max(...entries.map(e=>valFn(e)));
    el.innerHTML=entries.map(([k,v],i)=>{
      const col=PAL[i]||'#555';const pct=(valFn([k,v])/maxV*100).toFixed(1);
      const lbl=labelFn(k);
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:11px">
        <div style="min-width:140px;font-size:11px;font-weight:600;color:var(--dark2)" title="${k}">${lbl}</div>
        <div style="flex:1;background:var(--gray2);border-radius:4px;height:8px">
          <div style="height:8px;border-radius:4px;width:${pct}%;background:${col};transition:width .4s"></div></div>
        <div style="text-align:right;min-width:62px">
          <span style="font-family:var(--cond);font-size:18px;font-weight:800;color:${col}">${valFn([k,v]).toLocaleString('es-CL',{minimumFractionDigits:typeof v==='number'&&v%1!==0?1:0})}</span>
          <span style="font-size:9px;color:var(--muted);margin-left:2px">${unitLabel}</span></div></div>`;
    }).join('');
  };

  bar(document.getElementById('chartPlanta'),Object.entries(BY_PLANT),([,v])=>v,k=>k,'SKUs');
  bar(document.getElementById('chartCat'),  Object.entries(BY_CAT),  ([,v])=>v,k=>k.length>26?k.slice(0,26)+'…':k,'SKUs');
  if(BY_SUBCAT) bar(document.getElementById('chartSubcat'),Object.entries(BY_SUBCAT),([,v])=>v,k=>k.length>26?k.slice(0,26)+'…':k,'ton');
}
// CPFR: en este archivo "tipo" (Refrigerados/Abarrotes) es la clasificación
// Frío/Seco que usan los equipos de planificación.
const cpfrLabel = tipo => tipo === 'Refrigerados' ? 'Frío' : tipo === 'Abarrotes' ? 'Seco' : (tipo || '—');

// Filtro combinado de la tabla Top 50 / export: sus propios controles
// (estado crítico/alerta, planta) MÁS los filtros activos en la pestaña
// Quiebres (Tipo=CPFR, Categoría, Búsqueda de SKU). La Planta de la pestaña
// Quiebres se usa solo si no se tocó el filtro de Planta propio de esta tabla.
//
// Fuente de datos: sin planta filtrada, se usa RIESGOS (el Top 50 peor-alcance
// de TODA la compañía). Con una planta filtrada, se usa el detalle propio de
// esa planta en PLANTAS_RIESGO (refrigerados+abarrotes .productos) — para la
// mayoría de las plantas es la lista COMPLETA de sus críticos+alertas, no solo
// los que alcanzaron a entrar al ranking global de 50. Esas filas no traen
// código de SKU (el archivo no lo guarda a ese nivel), por eso esa columna
// queda vacía cuando se exportan.
function effectiveRiesgoPlanta(){
  return riesgosPlanta !== 'all' ? riesgosPlanta : currentPlanta;
}
function getRiesgosPorPlanta(planta){
  const p = PLANTAS_RIESGO.find(x => x.planta === planta);
  if (!p) return { rows: [], completo: true, totalPlanta: 0 };
  const rows = [...(p.refrigerados.productos || []), ...(p.abarrotes.productos || [])]
    .map(r => ({ ...r, planta, sku: null }))
    .sort((a, b) => a.alcance - b.alcance);
  const totalPlanta = p.criticos + p.alertas;
  return { rows, completo: rows.length >= totalPlanta, totalPlanta };
}
function getFilteredRiesgos(){
  const effectivePlanta = effectiveRiesgoPlanta();
  let base = effectivePlanta !== 'all' ? getRiesgosPorPlanta(effectivePlanta).rows : RIESGOS;
  let filtered = riesgosFilter === 'all' ? base : base.filter(r => r.riesgo === riesgosFilter);
  if (currentTipo !== 'all') filtered = filtered.filter(r => r.tipo === currentTipo);
  if (currentCategoria !== 'all') filtered = filtered.filter(r => r.cat === currentCategoria);
  const q = skuSearch.trim().toLowerCase();
  if (q) filtered = filtered.filter(r => r.n.toLowerCase().includes(q));
  return filtered;
}

function renderRiesgoCrossFilterNote(){
  const el = document.getElementById('riesgoCrossFilterNote');
  if (!el) return;
  const activos = [];
  if (currentTipo !== 'all') activos.push(`CPFR: ${cpfrLabel(currentTipo)}`);
  if (currentCategoria !== 'all') activos.push(`Categoría: ${currentCategoria}`);
  if (skuSearch.trim()) activos.push(`Búsqueda: "${skuSearch.trim()}"`);
  if (riesgosPlanta === 'all' && currentPlanta !== 'all') activos.push(`Planta: ${currentPlanta}`);

  let html = '';
  if (activos.length) {
    html += `🔗 También filtrado desde la pestaña Quiebres — ${activos.join(' · ')}. <button onclick="resetFiltros()" style="border:none;background:none;color:var(--red);font-weight:700;font-size:12px;cursor:pointer;padding:0;text-decoration:underline">Quitar</button>`;
  }
  if (currentGrupo !== 'all') {
    html += `${html ? '<br>' : ''}⚠️ El filtro de <b>Grupo (${currentGrupo})</b> no se puede aplicar acá: el archivo de riesgo no trae el grupo de marketing por SKU, solo por planta/categoría — mostrando el total general, sin acotar por grupo.`;
  }
  const ep = effectiveRiesgoPlanta();
  if (ep !== 'all') {
    const { completo, totalPlanta, rows } = getRiesgosPorPlanta(ep);
    const msg = completo
      ? `📍 Mostrando el detalle <b>completo</b> de ${ep}: sus ${totalPlanta} SKU en riesgo (crítico + alerta), no solo los que entraron al ranking global de 50.`
      : `📍 Mostrando hasta 20 SKU por familia (Frío/Seco) con menor alcance en ${ep} — tiene ${totalPlanta} SKU en riesgo en total, se listan ${rows.length} con detalle disponible. Estas filas no traen código de SKU (el archivo no lo guarda a este nivel).`;
    html += `${html ? '<br>' : ''}${msg}`;
  }
  if (html) { el.style.display = ''; el.innerHTML = html; } else { el.style.display = 'none'; }
}

// ── EXPORTAR TOP 50 A EXCEL (CSV) ──────────────────────────────────────────────
// Junta, por SKU: estado de riesgo, stock, FCST, alcance (de RIESGOS),
// quiebre (buscado por nombre en el listado de quiebres) y merma (buscada
// por código de SKU en MERMA_VENC). Se exporta como CSV separado por ";"
// con BOM UTF-8 — Excel lo abre directo, con acentos y decimales correctos.
// Usa exactamente el mismo filtro combinado que se ve en la tabla de pantalla.
function exportRiesgosExcel(){
  const filtered = getFilteredRiesgos();
  if (!filtered.length) { alert('No hay filas para exportar con este filtro.'); return; }

  const quiebreByName = {};
  (DB_QUIEBRES.all.all.skus || []).forEach(s => { quiebreByName[s.n.toUpperCase().trim()] = s.q; });
  const mermaBySku = {};
  (MERMA_VENC || []).forEach(m => { mermaBySku[m.sku] = m; });

  const headers = ['SKU','Producto','Categoría','Planta','CPFR','Estado riesgo',
    'Stock disponible (kg)','Stock XLIB (kg)','Fecha liberación XLIB','Stock bloqueado (kg)',
    'FCST semanal (kg)','Alcance (sem)',
    'Quiebre (ton)','Merma - días a vencer','Merma - kg en riesgo','Merma - nivel'];
  const numCols = [6,7,9,10,11,12,13,14];

  const rows = filtered.map(r => {
    const q = quiebreByName[r.n.toUpperCase().trim()];
    const m = mermaBySku[r.sku];
    return [
      r.sku, r.n, r.cat, r.planta, cpfrLabel(r.tipo),
      r.riesgo === 'critico' ? 'Crítico' : 'Alerta',
      r.stock, r.stock_xlib || '', r.xlib_fecha || '', r.stock_bloq, r.fcst, r.alcance,
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

  const csv = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `riesgo_quiebre_${riesgosFilter}_${effectiveRiesgoPlanta()}_${currentTipo}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function renderRiesgosTable(){
  const body=document.getElementById('riesgosBody');if(!body)return;
  const tituloEl=document.getElementById('riesgosTablaTitulo');
  if(tituloEl){
    const ep=effectiveRiesgoPlanta();
    tituloEl.textContent = ep!=='all' ? `📋 Detalle · Planta ${ep}` : '📋 Top 50 · Menor Alcance de Stock';
  }
  renderRiesgoCrossFilterNote();
  const filtered=getFilteredRiesgos();
  if(!filtered.length){body.innerHTML='<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--muted)">Sin datos para este filtro</td></tr>';return;}
  body.innerHTML=filtered.map((r,i)=>{const isCrit=r.riesgo==='critico';const col=isCrit?'#C8001E':'#B8860B';const bp=Math.min((r.alcance/4)*100,100).toFixed(1);
    return `<tr><td style="font-family:var(--cond);font-size:13px;font-weight:800;color:var(--muted2)">${i+1}</td>
    <td style="font-weight:600;max-width:240px">
      <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${r.n}">${r.n}</div>
      <div style="background:var(--gray2);border-radius:3px;height:4px;margin-top:4px"><div style="height:4px;border-radius:3px;width:${bp}%;background:${col}"></div></div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">${r.cat}</div>
    </td>
    <td style="font-size:11px;color:var(--muted)">${cpfrLabel(r.tipo)}</td>
    <td><span style="font-size:10px;font-weight:700;background:var(--gray2);padding:2px 8px;border-radius:10px;white-space:nowrap">${r.planta}</span></td>
    <td class="r">
      <div style="font-family:var(--cond);font-size:17px;font-weight:700;color:${r.stock===0?'#C8001E':'var(--dark2)'}">${r.stock.toLocaleString('es-CL',{minimumFractionDigits:0})}</div>
      ${r.stock_xlib>0?`<div style="font-size:10px;color:#2D5BE3">+${r.stock_xlib.toLocaleString('es-CL',{minimumFractionDigits:0})} xlib${r.xlib_fecha?` · libera ${r.xlib_fecha}`:''}</div>`:''}
      ${r.stock_bloq>0?`<div style="font-size:10px;color:#B8860B">+${r.stock_bloq.toLocaleString('es-CL',{minimumFractionDigits:0})} bloq</div>`:''}
    </td>
    <td class="r"><div style="font-family:var(--cond);font-size:17px;color:var(--dark2)">${r.fcst.toLocaleString('es-CL',{minimumFractionDigits:0})}</div></td>
    <td class="r"><div style="font-family:var(--cond);font-size:22px;font-weight:900;color:${col}">${r.alcance.toFixed(1)}</div><div style="font-size:9px;color:var(--muted)">sem</div></td>
    <td class="r"><span class="chip ${isCrit?'c-red':'c-amb'}">${isCrit?'🔴 CRÍTICO':'🟡 ALERTA'}</span></td></tr>`;
  }).join('');
}
function renderPlantaTabs(){
  const tabsEl=document.getElementById('plantaTabs');if(!tabsEl)return;
  const sorted=[...PLANTAS_RIESGO].sort((a,b)=>b.criticos-a.criticos);
  if(!plantaActiva)plantaActiva=sorted[0].planta;
  const maxC=Math.max(...sorted.map(p=>p.criticos));
  tabsEl.innerHTML=sorted.map(p=>{const isActive=p.planta===plantaActiva;
    const danger=p.criticos>20?'#C8001E':p.criticos>10?'#c84000':p.criticos>5?'#B8860B':'#2D5BE3';
    const bgCard=isActive?(p.criticos>20?'#fff0f0':p.criticos>10?'#fff4ef':p.criticos>5?'#fffbf0':'#f0f4ff'):'#fafafa';
    return `<button onclick="selectPlanta('${p.planta}')" style="display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:14px 16px;border-radius:14px;border:2px solid ${isActive?danger:'#e2e8f0'};background:${bgCard};cursor:pointer;min-width:140px;box-shadow:${isActive?`0 4px 16px ${danger}22`:'none'}">
      <div style="font-size:14px;font-weight:800;color:${isActive?danger:'#4A5568'};width:100%">${p.planta}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:-6px">${p.criticos+p.alertas} SKUs en riesgo</div>
      <div style="display:flex;gap:6px;width:100%">
        <div style="flex:1;background:${p.criticos>0?danger:'#e8ecf0'};border-radius:8px;padding:5px 6px;text-align:center"><div style="font-family:var(--cond);font-size:22px;font-weight:800;color:#fff;line-height:1">${p.criticos}</div><div style="font-size:9px;color:rgba(255,255,255,.85)">🔴 CRÍTICOS</div></div>
        <div style="flex:1;background:${p.alertas>0?'#B8860B':'#e8ecf0'};border-radius:8px;padding:5px 6px;text-align:center"><div style="font-family:var(--cond);font-size:22px;font-weight:800;color:#fff;line-height:1">${p.alertas}</div><div style="font-size:9px;color:rgba(255,255,255,.85)">🟡 ALERTAS</div></div>
      </div>
      <div style="width:100%;background:#e2e8f0;border-radius:4px;height:5px;margin-top:-2px"><div style="height:5px;border-radius:4px;width:${maxC>0?(p.criticos/maxC*100).toFixed(0):0}%;background:${danger}"></div></div>
    </button>`;
  }).join('');
}
function selectPlanta(nombre){plantaActiva=nombre;if(!window._tipoActivo)window._tipoActivo='Refrigerados';renderPlantaTabs();renderPlantaContent();}
function renderPlantaContent(){
  const el=document.getElementById('plantaContent');if(!el)return;
  const p=PLANTAS_RIESGO.find(x=>x.planta===plantaActiva);if(!p)return;
  const pct=p.fcst_total>0?(p.stock_total/p.fcst_total*100).toFixed(1):'—';const cc=parseFloat(pct)<50?'#C8001E':parseFloat(pct)<100?'#B8860B':'#009060';
  const kpis=`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px"><div style="background:#fff0f0;border-radius:10px;padding:12px 14px;border-left:4px solid #C8001E"><div style="font-size:10px;font-weight:700;color:#C8001E;text-transform:uppercase">🔴 Total Críticos</div><div style="font-family:var(--cond);font-size:36px;font-weight:800;color:#C8001E">${p.criticos}</div><div style="font-size:10px;color:var(--muted)">Refrig &lt;1sem · Abarr &lt;2sem</div></div><div style="background:#fffbf0;border-radius:10px;padding:12px 14px;border-left:4px solid #B8860B"><div style="font-size:10px;font-weight:700;color:#B8860B;text-transform:uppercase">🟡 Total Alertas</div><div style="font-family:var(--cond);font-size:36px;font-weight:800;color:#B8860B">${p.alertas}</div><div style="font-size:10px;color:var(--muted)">Refrig 1-2sem · Abarr 2-4sem</div></div><div style="background:#f8faff;border-radius:10px;padding:12px 14px;border-left:4px solid #2D5BE3"><div style="font-size:10px;font-weight:700;color:#2D5BE3;text-transform:uppercase">📦 Stock Disponible</div><div style="font-family:var(--cond);font-size:26px;font-weight:800;color:${cc}">${(p.stock_total/1000).toFixed(1)} <span style="font-size:13px">ton</span></div><div style="font-size:10px;color:var(--muted)">FCST ${(p.fcst_total/1000).toFixed(1)} ton/sem</div></div><div style="background:#f8faff;border-radius:10px;padding:12px 14px;border-left:4px solid ${cc}"><div style="font-size:10px;font-weight:700;color:${cc};text-transform:uppercase">📊 Cobertura</div><div style="font-family:var(--cond);font-size:36px;font-weight:800;color:${cc}">${pct}%</div><div style="font-size:10px;color:var(--muted)">Stock / FCST semanal</div></div></div>`;
  const ta=window._tipoActivo||'Refrigerados';
  const subTabs=`<div style="display:flex;gap:0;border-bottom:2px solid #e2e8f0;margin-bottom:0">${['Refrigerados','Abarrotes'].map(t=>{const isA=t===ta;const d=t==='Refrigerados'?p.refrigerados:p.abarrotes;const rule=t==='Refrigerados'?'Crítico &lt;1sem · Alerta 1-2sem':'Crítico &lt;2sem · Alerta 2-4sem';const icon=t==='Refrigerados'?'❄️':'🛒';
    return `<button onclick="window._tipoActivo='${t}';renderPlantaContent()" style="flex:1;padding:12px 16px;border:none;background:${isA?'#fff':'#f8faff'};border-bottom:${isA?'3px solid #C8001E':'none'};margin-bottom:${isA?'-2px':'0'};cursor:pointer;border-radius:8px 8px 0 0"><div style="font-size:13px;font-weight:800;color:${isA?'#C8001E':'#4A5568'}">${icon} ${t}</div><div style="display:flex;gap:8px;justify-content:center;margin-top:4px"><span style="font-size:11px;background:${d.criticos>0?'#C8001E':'#e2e8f0'};color:#fff;padding:1px 8px;border-radius:20px;font-weight:700">${d.criticos} 🔴</span><span style="font-size:11px;background:${d.alertas>0?'#B8860B':'#e2e8f0'};color:#fff;padding:1px 8px;border-radius:20px;font-weight:700">${d.alertas} 🟡</span></div><div style="font-size:9px;color:var(--muted);margin-top:3px">${rule}</div></button>`;
  }).join('')}</div>`;
  const d=ta==='Refrigerados'?p.refrigerados:p.abarrotes;
  const cr=ta==='Refrigerados'?'&lt; 1 semana':'&lt; 2 semanas';const ar=ta==='Refrigerados'?'1 – 2 semanas':'2 – 4 semanas';const ma=ta==='Refrigerados'?2:4;
  const ct=d.fcst>0?(d.stock/d.fcst*100).toFixed(1):'—';const ctc=parseFloat(ct)<50?'#C8001E':parseFloat(ct)<100?'#B8860B':'#009060';
  const kpisTipo=`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:14px 0 12px"><div style="background:#fff0f0;border-radius:8px;padding:10px 12px;border-left:3px solid #C8001E;display:flex;align-items:center;gap:10px"><div style="font-family:var(--cond);font-size:32px;font-weight:800;color:#C8001E">${d.criticos}</div><div><div style="font-size:10px;font-weight:700;color:#C8001E">🔴 CRÍTICOS</div><div style="font-size:10px;color:var(--muted)">alcance ${cr}</div></div></div><div style="background:#fffbf0;border-radius:8px;padding:10px 12px;border-left:3px solid #B8860B;display:flex;align-items:center;gap:10px"><div style="font-family:var(--cond);font-size:32px;font-weight:800;color:#B8860B">${d.alertas}</div><div><div style="font-size:10px;font-weight:700;color:#B8860B">🟡 ALERTAS</div><div style="font-size:10px;color:var(--muted)">alcance ${ar}</div></div></div><div style="background:#f8faff;border-radius:8px;padding:10px 12px;border-left:3px solid ${ctc};display:flex;align-items:center;gap:10px"><div style="font-family:var(--cond);font-size:28px;font-weight:800;color:${ctc}">${ct}%</div><div><div style="font-size:10px;font-weight:700;color:${ctc}">📊 COBERTURA</div><div style="font-size:10px;color:var(--muted)">${(d.stock/1000).toFixed(1)} / ${(d.fcst/1000).toFixed(1)} ton</div></div></div></div>`;
  const catBars=d.top_cats.length?`<div style="background:#f8faff;border-radius:10px;padding:12px 14px;margin-bottom:12px"><div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:8px">Categorías críticas</div>${d.top_cats.map((c,i)=>{const col=i===0?'#C8001E':i===1?'#c84000':'#906000';return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><div style="min-width:160px;font-size:11px;font-weight:600">${c.cat}</div><div style="flex:1;background:var(--gray2);border-radius:3px;height:7px"><div style="height:7px;border-radius:3px;width:${(c.n/d.top_cats[0].n*100).toFixed(1)}%;background:${col}"></div></div><div style="font-family:var(--cond);font-size:16px;font-weight:800;color:${col};min-width:25px;text-align:right">${c.n}</div><div style="font-size:9px;color:var(--muted)">SKUs</div></div>`;
  }).join('')}</div>`:'';
  const bR=rows=>rows.map((r,i)=>{const col=r.riesgo==='critico'?'#C8001E':'#B8860B';const bp=Math.min((r.alcance/ma)*100,100).toFixed(1);
    return `<tr style="${r.stock===0&&r.riesgo==='critico'?'background:rgba(200,0,30,.03)':''}"><td style="font-family:var(--cond);font-size:13px;font-weight:800;color:var(--muted2)">${i+1}</td><td style="font-weight:600;max-width:210px"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${r.n}">${r.n}</div><div style="display:flex;align-items:center;gap:4px;margin-top:3px"><div style="flex:1;background:var(--gray2);border-radius:3px;height:4px"><div style="height:4px;border-radius:3px;width:${bp}%;background:${col}"></div></div><span style="font-size:9px;color:var(--muted)">${bp}%</span></div></td><td style="font-size:11px;color:var(--muted)">${r.cat}</td><td class="r">${r.stock===0?'<span style="font-size:11px;font-weight:900;color:#C8001E">SIN STOCK</span>':`<div style="font-family:var(--cond);font-size:17px;font-weight:700;color:var(--dark2)">${r.stock.toLocaleString('es-CL',{minimumFractionDigits:1})}</div><div class="tbl-unit">kg disp</div>`}${r.stock_xlib>0?`<div style="font-size:10px;color:#2D5BE3;font-weight:600">+${r.stock_xlib.toLocaleString('es-CL',{minimumFractionDigits:0})} xlib${r.xlib_fecha?` · libera ${r.xlib_fecha}`:''}</div>`:''}${r.stock_bloq>0?`<div style="font-size:10px;color:#B8860B;font-weight:600">+${r.stock_bloq.toLocaleString('es-CL',{minimumFractionDigits:0})} bloq</div>`:''}</td><td class="r"><div style="font-family:var(--cond);font-size:17px;font-weight:700;color:var(--dark2)">${r.fcst.toLocaleString('es-CL',{minimumFractionDigits:1})}</div><div class="tbl-unit">kg/sem</div></td><td class="r"><div style="font-family:var(--cond);font-size:20px;font-weight:800;color:${col}">${r.alcance.toFixed(2)}</div><div class="tbl-unit">semanas</div></td><td class="r"><span class="chip ${r.riesgo==='critico'?'c-red':'c-amb'}">${r.riesgo==='critico'?'🔴 CRÍTICO':'🟡 ALERTA'}</span></td>${(()=>{const m=MERMAS_YOY[r.sku];if(!m||m.yoy_ytd===null)return'<td class="r" style="color:var(--muted);font-size:11px">—</td>';const v=m.yoy_ytd;const c=v>=0?"#1a8a3a":"#C8001E";const arr=v>=0?"▲":"▼";return `<td class="r"><span style="font-family:var(--cond);font-size:15px;font-weight:800;color:${c}">${arr}${Math.abs(v).toFixed(1)}%</span><div style="font-size:9px;color:var(--muted)">YTD vs 2025</div></td>`;})()} </tr>`;
  }).join('');
  const tbl=(rows,titulo,color,cls)=>rows.length?`<div style="margin-bottom:14px"><div style="font-size:11px;font-weight:800;text-transform:uppercase;color:${color};margin-bottom:8px;padding:5px 12px;background:${cls==='c-red'?'#fff0f0':'#fffbf0'};border-radius:8px;display:inline-block">${cls==='c-red'?'🔴':'🟡'} ${titulo} (${rows.length} SKUs)</div><div style="overflow-x:auto"><table class="tbl" style="min-width:720px"><thead><tr><th>#</th><th>Producto</th><th>Categoría</th><th class="r">Stock Disp</th><th class="r">FCST Sem</th><th class="r">Alcance</th><th class="r">Estado</th><th class="r" style="white-space:nowrap">Venta YoY</th></tr></thead><tbody>${bR(rows)}</tbody></table></div></div>`:`<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">✅ Sin ${titulo.toLowerCase()} en ${ta}</div>`;
  const cl=d.productos.filter(r=>r.riesgo==='critico');const al=d.productos.filter(r=>r.riesgo==='alerta');
  el.innerHTML=kpis+subTabs+'<div style="padding:0 2px">'+kpisTipo+catBars+tbl(cl,`Críticos — ${cr}`,'#C8001E','c-red')+tbl(al,`Alertas — ${ar}`,'#B8860B','c-amb')+'</div>';
}

function renderMermaVenc(filtroPlanta){
  const el=document.getElementById('mermaVencList');
  if(!el||!MERMA_VENC||!MERMA_VENC.length){if(el)el.innerHTML='<p style="color:var(--muted);font-size:13px">Sin datos de vencimiento disponibles</p>';return;}
  const items=filtroPlanta&&filtroPlanta!=='all'?MERMA_VENC.filter(x=>x.planta===filtroPlanta):MERMA_VENC;
  const crit=items.filter(x=>x.nivel==='critico');
  const ale=items.filter(x=>x.nivel==='alerta');
  const row=(x,color,bg)=>`
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
  let html='';
  if(crit.length){
    html+=`<div style="font-size:11px;font-weight:800;color:#C8001E;text-transform:uppercase;letter-spacing:.5px;margin:14px 0 8px">🔴 Vencen esta semana (${crit.length})</div>`;
    html+=crit.map(x=>row(x,'#C8001E','#fff5f5')).join('');
  }
  if(ale.length){
    html+=`<div style="font-size:11px;font-weight:800;color:#B8860B;text-transform:uppercase;letter-spacing:.5px;margin:14px 0 8px">🟡 Vencen en 1–4 semanas (${ale.length})</div>`;
    html+=ale.map(x=>row(x,'#B8860B','#fffbf0')).join('');
  }
  if(!items.length) html='<p style="color:var(--muted);font-size:13px;padding:12px 0">Sin productos próximos a vencer para esta planta</p>';
  el.innerHTML=html;
}

let _mermaPlanta='all';
function setMermaPlanta(p,btn){
  document.querySelectorAll('.mv-planta-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  _mermaPlanta=p;
  renderMermaVenc(p);
}

// ── RIESGO FUTURO: toggle Quiebre / Merma ─────────────────────────────────────
function setRiesgoFutTab(tab, btn){
  const isMerma = tab === 'merma';
  document.getElementById('riesgoQuiebreView').style.display = isMerma ? 'none' : '';
  document.getElementById('riesgoMermaView').style.display = isMerma ? '' : 'none';
  ['quiebre','merma'].forEach(t=>{
    const b = document.getElementById('rfut-btn-'+t);
    if(!b) return;
    const active = t === tab;
    b.classList.toggle('active', active);
    b.style.background = active ? (t==='merma' ? '#B8860B' : '#C8001E') : '#fff';
    b.style.borderColor = active ? (t==='merma' ? '#B8860B' : '#C8001E') : '#ddd';
    b.style.color = active ? '#fff' : '#555';
  });
  if (isMerma) renderRiesgoMermaKpis();
}

function renderRiesgoMermaKpis(){
  const el = document.getElementById('riesgoMermaKpis');
  if (!el) return;
  const data = (typeof MERMA_VENC !== 'undefined') ? MERMA_VENC : [];
  const crit = data.filter(x=>x.nivel==='critico');
  const ale  = data.filter(x=>x.nivel==='alerta');
  const kilos = data.reduce((a,x)=>a+(x.kilos||0),0);
  const card = (bg,border,color,num,label,sub) => `
    <div style="background:${bg};border:2px solid ${border};border-radius:16px;padding:18px 20px;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${color}"></div>
      <div style="font-size:42px;line-height:1;font-family:var(--cond);font-weight:900;color:${color}">${num}</div>
      <div style="font-size:11.5px;font-weight:800;color:${color};text-transform:uppercase;letter-spacing:.5px;margin-top:4px">${label}</div>
      <div style="font-size:10.5px;color:var(--muted);margin-top:2px">${sub}</div>
    </div>`;
  el.innerHTML =
    card('#fff0f0','#ffd6d6','#C8001E', crit.length, '🔴 Vencen esta semana', 'Confirmado por vida útil') +
    card('#fffbf0','#fde0a0','#B8860B', ale.length, '🟡 Vencen en 1–4 semanas', 'Confirmado por vida útil') +
    card('#f0f4ff','#c8d4ff','#2D5BE3', kilos.toLocaleString('es-CL',{maximumFractionDigits:0}), '📦 Kg totales en riesgo', 'Solo productos con vencimiento confirmado');
}

function renderRiesgos(){
  renderCharts();
  renderRiesgosQuebraKPIs();
  renderRiesgosSubcat();
  renderRiesgosTable();
  renderPlantaTabs();
  renderPlantaContent();

  renderMermaVenc(_mermaPlanta);
  renderRiesgoMermaKpis();
}

// Inicializa controles estáticos de Riesgos (se llama una sola vez)
function initRiesgosControls(){
  // Selector semanas
  const rSem=document.getElementById('rSemSel');
  if(rSem&&rSem.options.length<=1){
    (SEMS_Q['all']||[]).forEach(s=>{const o=document.createElement('option');o.value=s.s;o.textContent=s.s;rSem.appendChild(o);});
    Object.keys(MES_MAP).forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent='📅 '+m;rSem.appendChild(o);});
    rSem.value=riesgsSem;
  }
  // Botones planta (tabla alcance)
  const rPl=document.getElementById('rPlantas');
  if(rPl&&!rPl.childElementCount){
    const plantas=[...new Set(RIESGOS.map(r=>r.planta))].sort();
    const bs='padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;border:1.5px solid var(--border);background:var(--card);color:var(--dark2)';
    rPl.innerHTML=`<button class="rp-btn" onclick="setRiesgosPlanta('all',this)" style="${bs};background:#C8001E;color:#fff;border-color:#C8001E">Todas</button>`
      +plantas.map(p=>`<button class="rp-btn" onclick="setRiesgosPlanta('${p}',this)" style="${bs}">${p}</button>`).join('');
  }
  // Botones planta merma
  const btnDiv=document.getElementById('mermaPlantaBtns');
  if(btnDiv&&MERMA_VENC&&MERMA_VENC.length&&!btnDiv.childElementCount){
    const plantas=[...new Set(MERMA_VENC.map(x=>x.planta))].sort();
    btnDiv.innerHTML=`<button class="mv-planta-btn active" onclick="setMermaPlanta('all',this)" style="padding:4px 12px;border-radius:20px;border:1px solid #ddd;background:#C8001E;color:#fff;font-size:11px;font-weight:700;cursor:pointer">Todas</button>`
      +plantas.map(p=>`<button class="mv-planta-btn" onclick="setMermaPlanta('${p}',this)" style="padding:4px 12px;border-radius:20px;border:1px solid #ddd;background:var(--card);color:var(--dark2);font-size:11px;font-weight:600;cursor:pointer">${p}</button>`).join('');
  }
}

// ── INICIO ────────────────────────────────────────────────────────────────────
initMesSelect();
initPlantaSelect();
initGrupoSelect();
initCategoriaSelect();
initRiesgosControls();
renderAll();
renderRiesgos();
