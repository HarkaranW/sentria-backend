// @ts-nocheck
// ─────────────────────────────────────────────────────────────────
// SENTRIA — Global Period Filter Module
// Replaces dashboard_module.js
// Add <script src="period_filter_module.js"></script> before </body>
// ─────────────────────────────────────────────────────────────────

// ── Global period state ───────────────────────────────────────
let SENTRIA_PERIOD = 'month'; // 'month' | 'quarter' | 'year' | 'custom'
let SENTRIA_FROM   = null;    // custom start date (YYYY-MM-DD)
let SENTRIA_TO     = null;    // custom end date   (YYYY-MM-DD)

// ── Core filter — used by ALL modules ────────────────────────
function inPeriod(dateStr) {
  if (!dateStr) return false;
  const d   = new Date(dateStr);
  const now = new Date();

  if (SENTRIA_PERIOD === 'custom') {
    if (!SENTRIA_FROM || !SENTRIA_TO) return false;
    return d >= new Date(SENTRIA_FROM + 'T00:00:00') &&
           d <= new Date(SENTRIA_TO   + 'T23:59:59');
  }
  if (SENTRIA_PERIOD === 'month') {
    return d.getMonth()    === now.getMonth() &&
           d.getFullYear() === now.getFullYear();
  }
  if (SENTRIA_PERIOD === 'quarter') {
    const q  = Math.floor(now.getMonth() / 3);
    const dq = Math.floor(d.getMonth() / 3);
    return dq === q && d.getFullYear() === now.getFullYear();
  }
  if (SENTRIA_PERIOD === 'year') {
    return d.getFullYear() === now.getFullYear();
  }
  return false;
}

// ── Previous period — for trend comparison ────────────────────
function inPrevPeriod(dateStr) {
  if (!dateStr) return false;
  const d   = new Date(dateStr);
  const now = new Date();

  if (SENTRIA_PERIOD === 'month') {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth()    === prev.getMonth() &&
           d.getFullYear() === prev.getFullYear();
  }
  if (SENTRIA_PERIOD === 'quarter') {
    const q      = Math.floor(now.getMonth() / 3);
    const prevQ  = q === 0 ? 3 : q - 1;
    const prevYr = q === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return Math.floor(d.getMonth() / 3) === prevQ &&
           d.getFullYear() === prevYr;
  }
  if (SENTRIA_PERIOD === 'year') {
    return d.getFullYear() === now.getFullYear() - 1;
  }
  return false;
}

// ── Period label ──────────────────────────────────────────────
function periodLabel() {
  const now = new Date();
  if (SENTRIA_PERIOD === 'month')
    return now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  if (SENTRIA_PERIOD === 'quarter')
    return `T${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
  if (SENTRIA_PERIOD === 'year')
    return `Année ${now.getFullYear()}`;
  if (SENTRIA_PERIOD === 'custom' && SENTRIA_FROM && SENTRIA_TO) {
    const f = new Date(SENTRIA_FROM + 'T00:00:00').toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
    const t = new Date(SENTRIA_TO   + 'T00:00:00').toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' });
    return `${f} — ${t}`;
  }
  return '—';
}

// ── Trend badge ───────────────────────────────────────────────
function trendBadge(current, previous) {
  if (SENTRIA_PERIOD === 'custom' || previous === 0) return '';
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0)
    return '<span style="font-size:10px;color:var(--text3);">= période préc.</span>';
  const color = pct > 0 ? 'var(--green)' : 'var(--red)';
  const arrow = pct > 0 ? '↑' : '↓';
  return `<span style="font-size:10px;font-weight:700;color:${color};">${arrow} ${Math.abs(pct)}%</span>`;
}

// ── Period selector widget ─────────────────────────────────────
function renderPeriodBar(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const btns = [
    { id:'month',   label:'Ce mois' },
    { id:'quarter', label:'Trimestre' },
    { id:'year',    label:'Cette année' },
    { id:'custom',  label:'Personnalisé' },
  ];

  const customHtml = SENTRIA_PERIOD === 'custom' ? `
    <div style="display:flex;align-items:center;gap:6px;margin-left:4px;flex-wrap:wrap;">
      <span style="font-size:11px;color:var(--text2);">Du</span>
      <input type="date" id="${containerId}-from" value="${SENTRIA_FROM || ''}"
        style="padding:5px 8px;border:1.5px solid var(--border);border-radius:6px;
               font-size:11px;font-family:inherit;background:var(--card);color:var(--text);"
        onchange="SENTRIA_FROM=this.value;sentriaRefreshAll()">
      <span style="font-size:11px;color:var(--text2);">Au</span>
      <input type="date" id="${containerId}-to" value="${SENTRIA_TO || ''}"
        style="padding:5px 8px;border:1.5px solid var(--border);border-radius:6px;
               font-size:11px;font-family:inherit;background:var(--card);color:var(--text);"
        onchange="SENTRIA_TO=this.value;sentriaRefreshAll()">
    </div>` : '';

  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:12px 0;">
      ${btns.map(b => `
        <button onclick="sentriaSetPeriod('${b.id}')"
          style="font-family:inherit;font-size:12px;
                 font-weight:${SENTRIA_PERIOD === b.id ? 700 : 500};
                 padding:6px 14px;border-radius:8px;cursor:pointer;
                 border:1.5px solid ${SENTRIA_PERIOD === b.id ? 'var(--navy)' : 'var(--border)'};
                 background:${SENTRIA_PERIOD === b.id ? 'var(--navy)' : 'var(--card)'};
                 color:${SENTRIA_PERIOD === b.id ? '#fff' : 'var(--text2)'};
                 transition:all .15s;">
          ${b.label}
        </button>`).join('')}
      ${customHtml}
    </div>`;
}

// ── Set period and refresh all modules ────────────────────────
function sentriaSetPeriod(p) {
  SENTRIA_PERIOD = p;
  if (p !== 'custom') { SENTRIA_FROM = null; SENTRIA_TO = null; }
  sentriaRefreshAll();
}

// ── Refresh all period-sensitive modules ──────────────────────
function sentriaRefreshAll() {
  sentriaRefreshDashboard();
  sentriaRefreshFactures();
  ['dash-period-bar','fact-period-bar'].forEach(id => {
    if (document.getElementById(id)) renderPeriodBar(id);
  });
}

// ── MODULE: DASHBOARD ─────────────────────────────────────────

function sentriaRefreshDashboard() {
  const now = new Date();

  const nC = S.consultations.filter(x => inPeriod(x.date)).length;
  const nV = S.visites.filter(x => inPeriod(x.date)).length;
  const nA = S.accidents.filter(x => inPeriod(x.date)).length;
  const nF = S.factures.filter(x =>
    x.statut === 'Envoyée' || x.statut === 'En retard').length;

  const pC = S.consultations.filter(x => inPrevPeriod(x.date)).length;
  const pV = S.visites.filter(x => inPrevPeriod(x.date)).length;
  const pA = S.accidents.filter(x => inPrevPeriod(x.date)).length;

  const periodEl = document.getElementById('dash-period');
  if (periodEl) periodEl.textContent = 'Activité — ' + periodLabel();

  ['s-c','s-v','s-a','s-f'].forEach((id,i) => {
    const el = document.getElementById(id);
    if (el) el.textContent = [nC,nV,nA,nF][i];
  });

  // Inject trend lines under each KPI (create if missing)
  [['s-c',nC,pC],['s-v',nV,pV],['s-a',nA,pA]].forEach(([id,cur,prev]) => {
    const numEl = document.getElementById(id);
    if (!numEl) return;
    let tEl = document.getElementById(id + '-trend');
    if (!tEl) {
      tEl = document.createElement('div');
      tEl.id = id + '-trend';
      tEl.style.cssText = 'margin-top:3px;min-height:14px;';
      numEl.insertAdjacentElement('afterend', tEl);
    }
    tEl.innerHTML = trendBadge(cur, prev);
  });

  // Inject period bar under .ph if not already there
  if (!document.getElementById('dash-period-bar')) {
    const ph = document.querySelector('#dashboard .ph');
    if (ph) {
      const bar = document.createElement('div');
      bar.id = 'dash-period-bar';
      ph.insertAdjacentElement('afterend', bar);
    }
  }
  renderPeriodBar('dash-period-bar');

  // Alerts
  const soon = S.visites.filter(x => {
    if (!x.prochaineVisite) return false;
    const diff = (new Date(x.prochaineVisite) - now) / 86400000;
    return diff <= 30 && diff >= 0;
  });
  const ab = document.getElementById('alert-box');
  if (ab) {
    ab.className = 'alert' + (soon.length ? ' alert-warn show' : '');
    if (soon.length)
      ab.textContent = `${soon.length} visite(s) médicale(s) à renouveler dans les 30 prochains jours.`;
  }

  // Recent activity table — filtered by period
  const all = [
    ...S.consultations.filter(x => inPeriod(x.date))
      .map(x => ({...x, _t:'consultation', _r:x.diagnostic})),
    ...S.visites.filter(x => inPeriod(x.date))
      .map(x => ({...x, _t:'visite', _r:x.aptitude})),
    ...S.accidents.filter(x => inPeriod(x.date))
      .map(x => ({...x, _t:'accident', _r:(x.naturesLesion||[]).slice(0,1).join('')})),
  ].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 15);

  const TM = {
    consultation: ['b-teal','Consultation'],
    visite:       ['b-purple','Visite médicale'],
    accident:     ['b-red','Accident'],
  };
  const tbody = document.getElementById('dash-tbody');
  if (tbody) {
    tbody.innerHTML = all.length
      ? all.map(x => `<tr>
          <td><span class="dchip">${fmt(x.date)}</span></td>
          <td style="font-weight:600;">${x.nom||''} ${x.prenom||''}</td>
          <td>${x.client||''}</td>
          <td><span class="badge ${TM[x._t][0]}">${TM[x._t][1]}</span></td>
          <td>${x._t==='visite' ? aptBadge(x._r) : (x._r||'—')}</td>
        </tr>`).join('')
      : '<tr><td colspan="5" class="tbl-empty">Aucune entrée pour cette période.</td></tr>';
  }
}

// Override renderDashboard
function renderDashboard() { sentriaRefreshDashboard(); }

// ── MODULE: FACTURATION ───────────────────────────────────────

function sentriaRefreshFactures() {
  const filt = document.getElementById('ff-statut')?.value;
  const data = S.factures
    .filter(x => inPeriod(x.dateEmission) && (!filt || x.statut === filt))
    .sort((a,b) => new Date(b.dateEmission) - new Date(a.dateEmission));

  const total = S.factures
    .filter(x => inPeriod(x.dateEmission))
    .reduce((s,x) => s + (parseInt(x.montantTotal)||0), 0);
  const payees  = S.factures.filter(x => x.statut === 'Payée').length;
  const attente = S.factures.filter(x =>
    x.statut === 'Envoyée' || x.statut === 'En retard').length;
  const taux = S.factures.length
    ? Math.round(payees / S.factures.length * 100) : 0;

  const prevTotal = S.factures
    .filter(x => inPrevPeriod(x.dateEmission))
    .reduce((s,x) => s + (parseInt(x.montantTotal)||0), 0);
  const trend = trendBadge(total, prevTotal);

  // Inject period bar under fact .ph if not already there
  if (!document.getElementById('fact-period-bar')) {
    const ph = document.querySelector('#facturation .ph');
    if (ph) {
      const bar = document.createElement('div');
      bar.id = 'fact-period-bar';
      ph.insertAdjacentElement('afterend', bar);
    }
  }
  renderPeriodBar('fact-period-bar');

  const kpis = document.getElementById('fact-kpis');
  if (kpis) {
    kpis.innerHTML = `
      <div class="fkpi">
        <div class="fkpi-acc" style="background:var(--teal);"></div>
        <div class="fkpi-lbl">Total facturé (${periodLabel()})</div>
        <div class="fkpi-num">${typeof fmtM === 'function' ? fmtM(total) : total + ' FCFA'}</div>
        <div style="margin-top:3px;">${trend}</div>
      </div>
      <div class="fkpi">
        <div class="fkpi-acc" style="background:var(--green);"></div>
        <div class="fkpi-lbl">Payées · Taux recouvrement</div>
        <div class="fkpi-num">${payees}
          <span style="font-size:13px;color:var(--text2);font-weight:500;">(${taux}%)</span>
        </div>
      </div>
      <div class="fkpi">
        <div class="fkpi-acc" style="background:var(--red);"></div>
        <div class="fkpi-lbl">En attente / En retard</div>
        <div class="fkpi-num">${attente}</div>
      </div>`;
  }

  const sB = {
    'Brouillon':'b-gray', 'Envoyée':'b-blue',
    'Payée':'b-green',    'En retard':'b-red'
  };
  const tbody = document.getElementById('fact-tbody');
  if (tbody) {
    tbody.innerHTML = data.length
      ? data.map(x => `<tr>
          <td style="font-weight:700;color:var(--navy);">${x.numero}</td>
          <td>${x.client||''}</td>
          <td style="font-size:10px;color:var(--text2);max-width:110px;">${x.description||''}</td>
          <td><span class="dchip">${fmt(x.dateEmission)}</span></td>
          <td><span class="dchip">${fmt(x.echeance)}</span></td>
          <td style="font-weight:600;">${typeof fmtM==='function'?fmtM(x.montantTotal):x.montantTotal}</td>
          <td><span class="badge ${sB[x.statut]||'b-gray'}">${x.statut}</span></td>
          <td style="font-size:10px;color:var(--text2);">
            ${x.datePaiement
              ? fmt(x.datePaiement)+'<br><span style="color:var(--text3)">'+x.modePaiement+'</span>'
              : '—'}
          </td>
          <td><div style="display:flex;gap:4px;">
            ${x.statut!=='Payée'
              ? `<button class="btn btn-xs btn-green" onclick="marquerPayee('${x.id}')">Payée</button>`
              : ''}
            <button class="btn btn-xs btn-out" onclick="afficherFacture('${x.id}')">Voir</button>
          </div></td>
        </tr>`).join('')
      : '<tr><td colspan="9" class="tbl-empty">Aucune facture enregistrée.</td></tr>';
  }

  const preview = document.getElementById('fact-preview-zone');
  if (preview) preview.innerHTML = '';
}

// Override renderFactures
function renderFactures() { sentriaRefreshFactures(); }

// ── Hook into goTo ────────────────────────────────────────────
const _sentriaOrigGoTo = typeof goTo === 'function' ? goTo : null;
if (_sentriaOrigGoTo) {
  goTo = function(id, btn) {
    _sentriaOrigGoTo(id, btn);
    setTimeout(() => {
      if (id === 'dashboard')   sentriaRefreshDashboard();
      if (id === 'facturation') sentriaRefreshFactures();
    }, 50);
  };
}

// ── Init ──────────────────────────────────────────────────────
setTimeout(() => {
  if (document.querySelector('#dashboard')?.style?.display !== 'none') {
    sentriaRefreshDashboard();
  }
  if (document.querySelector('#facturation')?.style?.display !== 'none') {
    sentriaRefreshFactures();
  }
}, 150);
