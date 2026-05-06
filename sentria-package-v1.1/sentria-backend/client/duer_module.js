// @ts-nocheck
// ════════════════════════════════════════════════════════
// SENTRIA — Module DUER
// Fichier à intégrer dans le HTML déployé
// NE PAS DÉPLOYER SEUL — voir brief d'intégration
// ════════════════════════════════════════════════════════

// ── CONSTANTES ──────────────────────────────────────────
const RISK_FAMILIES = ["TMS","Chute / Glissade","Chimique","Bruit","Chaleur",
  "Électrique","RPS","Organisation du travail","Ambiance physique",
  "Incendie / Explosion","Biologique","Autre"];

const RISK_LIB = {
  "Postures statiques prolongées (debout)":"TMS",
  "Manutention manuelle de charges":"TMS",
  "Gestes répétitifs":"TMS",
  "Travail de nuit / horaires décalés":"Organisation du travail",
  "Exposition au bruit > 80 dB":"Bruit",
  "Exposition à la chaleur excessive":"Chaleur",
  "Incivilités / agressivité":"RPS",
  "Stress / surcharge de travail":"RPS",
  "Risque électrique sur équipements":"Électrique",
  "Coupures / blessures outils tranchants":"Chute / Glissade",
  "Sol glissant / encombrement":"Chute / Glissade",
  "Exposition produits chimiques":"Chimique",
  "Exposition agents biologiques":"Biologique",
  "Travail en hauteur":"Chute / Glissade",
  "Incendie / risque explosion":"Incendie / Explosion",
};

const UNITS_DEFAULT = {
  "Hôtel 2 Février": ["Réception / Accueil","Cuisine","Restauration",
    "Étages / Housekeeping","Sécurité / Gardiennage","Maintenance","Administration"],
  "Souroubat": ["Chantier BTP","Bureau technique","Magasin / Stocks","Conduite engins"],
  "Bio-Partners": ["Laboratoire","Conditionnement","Logistique","Administration"],
  "Clinique Biasa": ["Consultation médicale","Soins infirmiers","Bloc opératoire",
    "Accueil patients","Administration"],
  "Moov Togo": ["Agences commerciales","Service technique","Datacenter","Administration"],
};

const ACTIONS_LIB = {
  "TMS": "Mise en place de tapis anti-fatigue, rotation des postes, formation gestes et postures",
  "RPS": "Entretien individuel avec le médecin du travail, formation des managers, cellule d'écoute",
  "Bruit": "Fourniture d'EPI auditifs (bouchons / casque), contrôle phonométrique, rotation",
  "Chaleur": "Installation ventilation / climatisation, hydratation, horaires décalés",
  "Chute / Glissade": "Revêtement antidérapant, balisage zones dangereuses, EPI chaussures sécurité",
  "Électrique": "Vérification périodique installations, consignation/déconsignation, habilitations",
  "Chimique": "Substitution produits, EPI adaptés (gants/masque), formation FDS",
  "Biologique": "EPI barrières, protocole hygiène, vaccination selon risque",
  "Incendie / Explosion": "Extincteurs vérifiés, plan évacuation affiché, exercice annuel",
  "Organisation du travail": "Révision des plannings, respect temps de repos, entretien managérial",
  "Ambiance physique": "Mesure paramètres, aménagement environnement, EPI",
  "Autre": "Action corrective à définir avec l'employeur",
};

// ── ÉTAT LOCAL (cache des données chargées depuis l'API) ──
let DB = {};
let CUR = { client: null, unit: null };
let DUER_VIEW = 'list';
let EDIT_RISK = null;

// ── PANEL HELPERS ────────────────────────────────────────
let _duerSavedFooter = null;

function duerOpenPanel(title, sub, bodyHTML, footerHTML) {
  document.getElementById('fp-title').textContent = title;
  document.getElementById('fp-sub').textContent = sub;
  document.getElementById('fp-content').innerHTML = bodyHTML;
  _duerSavedFooter = document.getElementById('fp-foot').innerHTML;
  document.getElementById('fp-foot').innerHTML = footerHTML;
  document.getElementById('form-panel').classList.add('open');
}

function duerClosePanel() {
  if (_duerSavedFooter !== null) {
    document.getElementById('fp-foot').innerHTML = _duerSavedFooter;
    _duerSavedFooter = null;
  }
  if (typeof closePanel === 'function') {
    closePanel();
  } else {
    document.getElementById('form-panel').classList.remove('open');
  }
}

// ── HELPERS API ──────────────────────────────────────────
function getDuerClientId(name) {
  // Cherche l'UUID du client par son nom dans les données existantes
  if (typeof S !== 'undefined' && S._clients) {
    const cl = S._clients.find(c => c.name === name);
    if (cl) return cl.id;
  }
  return null;
}

async function loadDuerClient(clientName) {
  const clientId = getDuerClientId(clientName);
  if (!clientId) return;
  try {
    const res = await fetch(`/api/v1/duer/${clientId}`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const { success, data } = await res.json();
    if (!success) return;
    if (!DB[clientName]) DB[clientName] = {};
    // Merge avec les unités par défaut pour ce client
    const defaults = UNITS_DEFAULT[clientName] || ['Administration'];
    defaults.forEach(u => {
      if (!data.units[u]) data.units[u] = [];
    });
    DB[clientName].units = data.units;
  } catch (e) {
    console.warn('DUER load error:', e.message);
  }
}

// ── UTILS ────────────────────────────────────────────────
function duerScore(r) { return r.probabilite * r.gravite; }
function duerScoreClass(s) { return s>=6?'score-red':s>=3?'score-amber':'score-green'; }
function duerScoreBadge(s) { return s>=6?'b-red':s>=3?'b-amber':'b-green'; }
function duerScoreLabel(s) { return s>=6?'Critique':s>=3?'Modéré':'Faible'; }
function duerStatusBadge(st) {
  return {Ouverte:'b-amber','En cours':'b-teal',Clôturée:'b-green'}[st]||'b-gray';
}
function duerDateInputValue(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.split('T')[0];
  return new Date(value).toISOString().split('T')[0];
}
function duerAllRisks(c) { return Object.values(DB[c]?.units||{}).flat(); }
function duerCritiques(c) { return duerAllRisks(c).filter(r=>duerScore(r)>=6).length; }
function duerActionsOpen(c) { return duerAllRisks(c).filter(r=>r.statut!=='Clôturée').length; }
function duerClotureRate(c) {
  const all = duerAllRisks(c);
  return all.length ? Math.round(all.filter(r=>r.statut==='Clôturée').length/all.length*100) : 0;
}

// ── VUE LISTE CLIENTS ────────────────────────────────────
async function renderDUER() {
  const container = document.getElementById('duer-main-content');
  if (!container) return;
  container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text2);">Chargement…</div>';

  // Charger toutes les données depuis l'API
  const clients = typeof S !== 'undefined' ? S.clients : [];
  await Promise.all(clients.map(c => loadDuerClient(c)));

  const totalRisks = clients.reduce((s,c) => s + duerAllRisks(c).length, 0);
  const totalCrit  = clients.reduce((s,c) => s + duerCritiques(c), 0);
  const totalAct   = clients.reduce((s,c) => s + duerActionsOpen(c), 0);
  const icons = ['ico-teal','ico-blue','ico-purple','ico-teal','ico-blue'];

  let html = `<div class="ph">
    <div class="ph-left"><h2>DUER</h2>
    <p>Document Unique d'Évaluation des Risques — suivi par entreprise</p></div>
  </div>
  <div class="stats">
    <div class="sc"><div class="sc-acc" style="background:var(--navy);"></div>
      <div class="sc-lbl">Risques identifiés</div>
      <div class="sc-num">${totalRisks}</div>
      <div class="sc-sub">toutes entreprises</div></div>
    <div class="sc"><div class="sc-acc" style="background:var(--red);"></div>
      <div class="sc-lbl">Risques critiques</div>
      <div class="sc-num" style="color:${totalCrit?'var(--red)':'var(--navy)'};">${totalCrit}</div>
      <div class="sc-sub">score ≥ 6</div></div>
    <div class="sc"><div class="sc-acc" style="background:var(--amber);"></div>
      <div class="sc-lbl">Actions en attente</div>
      <div class="sc-num" style="color:${totalAct?'var(--amber)':'var(--navy)'};">${totalAct}</div>
      <div class="sc-sub">ouvertes ou en cours</div></div>
  </div>
  <div class="cg">`;

  clients.forEach((c,i) => {
    const crit = duerCritiques(c);
    const rate = duerClotureRate(c);
    const nb   = duerAllRisks(c).length;
    const unitCount = Object.keys(DB[c]?.units||{}).length;
    html += `<div class="cc" onclick="duerOpenClient('${c}')">
      <div class="cc-ico ${icons[i%icons.length]}">${c.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
      <div class="cc-name">${c}</div>
      <div class="cc-meta">${nb} risque(s) · ${unitCount} unité(s)</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
        ${crit?`<span class="badge b-red">⚠ ${crit} critique${crit>1?'s':''}</span>`:''}
        <span class="badge b-green">${rate}% clôturés</span>
      </div>
      <div class="prog-bar"><div class="prog-fill" style="width:${rate}%;background:var(--teal);"></div></div>
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

function duerOpenClient(c) {
  CUR.client = c;
  CUR.unit = Object.keys(DB[c]?.units||{})[0] || '';
  DUER_VIEW = 'detail';
  duerRenderDetail();
}

// ── VUE DÉTAIL ───────────────────────────────────────────
function duerRenderDetail() {
  const container = document.getElementById('duer-main-content');
  if (!container) return;
  const c = CUR.client;
  const u = CUR.unit;
  const units = Object.keys(DB[c]?.units||{});
  const risks = DB[c]?.units?.[u] || [];
  const allR  = duerAllRisks(c);
  const crit  = duerCritiques(c);
  const rate  = duerClotureRate(c);
  const openAct = allR.filter(r=>r.statut!=='Clôturée').length;

  const unitPills = units.map(un => {
    const rs = DB[c].units[un] || [];
    const hasCrit = rs.some(r=>duerScore(r)>=6);
    const hasMod  = rs.some(r=>duerScore(r)>=3&&duerScore(r)<6);
    const dotColor = hasCrit?'var(--red)':hasMod?'var(--amber)':'var(--green)';
    const active = un === u;
    return `<div onclick="duerSelectUnit('${c}','${un}')"
      style="display:flex;align-items:center;justify-content:space-between;
      padding:8px 10px;border-radius:8px;cursor:pointer;margin-bottom:2px;
      background:${active?'var(--navy3)':'transparent'};
      border:1px solid ${active?'var(--border)':'transparent'};">
      <span style="font-size:11px;font-weight:${active?600:400};
        color:${active?'var(--navy)':'var(--text2)'};">${un}</span>
      <span style="font-size:10px;font-weight:700;color:${dotColor};">(${rs.length})</span>
    </div>`;
  }).join('');

  const risksRows = risks.length ? risks.map(r => {
    const s = duerScore(r);
    return `<tr>
      <td style="font-weight:500;">${r.danger}</td>
      <td><span class="badge b-gray" style="font-size:9px;">${r.famille||r.family||'—'}</span></td>
      <td style="text-align:center;">${r.probabilite||r.p||'—'}</td>
      <td style="text-align:center;">${r.gravite||r.g||'—'}</td>
      <td style="text-align:center;"><span class="score-circ ${duerScoreClass(s)}">${s}</span></td>
      <td><span class="badge ${duerStatusBadge(r.statut)}">${r.statut}</span></td>
      <td><div style="display:flex;gap:4px;">
        <button class="btn btn-xs btn-out" onclick="duerOpenPlan('${r.id}')">Plan</button>
        <button class="btn btn-xs btn-ghost" onclick="duerEditRisk('${r.id}')">✎</button>
        <button class="btn btn-xs" style="background:var(--red3);color:var(--red);border:1px solid var(--red);border-radius:6px;font-size:10px;font-weight:600;padding:4px 8px;cursor:pointer;"
          onclick="duerDeleteRisk('${r.id}')">✕</button>
      </div></td>
    </tr>`;
  }).join('') :
    '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:32px;font-size:12px;">Aucun risque pour cette unité.</td></tr>';

  container.innerHTML = `
    <div class="ph">
      <div class="ph-left">
        <h2>DUER — ${c}</h2>
        <p>Dernière révision : ${new Date().toLocaleDateString('fr-FR')}</p>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-ghost btn-sm" onclick="renderDUER()">← Retour</button>
        <button class="btn btn-navy btn-sm" onclick="duerOpenAddRisk()">+ Ajouter un risque</button>
      </div>
    </div>
    <div class="stats">
      <div class="sc"><div class="sc-acc" style="background:var(--red);"></div>
        <div class="sc-lbl">Risques critiques</div>
        <div class="sc-num" style="color:${crit?'var(--red)':'var(--navy)'};">${crit}</div>
        <div class="sc-sub">score ≥ 6</div></div>
      <div class="sc"><div class="sc-acc" style="background:var(--amber);"></div>
        <div class="sc-lbl">Actions en cours</div>
        <div class="sc-num">${openAct}</div>
        <div class="sc-sub">non clôturées</div></div>
      <div class="sc"><div class="sc-acc" style="background:var(--teal);"></div>
        <div class="sc-lbl">Taux de clôture</div>
        <div class="sc-num">${rate}%</div>
        <div class="sc-sub">actions terminées</div></div>
    </div>
    <div style="display:grid;grid-template-columns:200px 1fr;gap:16px;">
      <div>
        <div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px;">Unités de travail</div>
        ${unitPills}
        <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:10px;"
          onclick="duerAddUnit('${c}')">+ Unité</button>
      </div>
      <div class="tcard">
        <div class="ttbar">
          <span class="ttbar-title">${u}</span>
          <span style="font-size:10px;color:var(--text2);">P = Probabilité · G = Gravité · Score = P×G</span>
        </div>
        <table class="tbl">
          <thead><tr>
            <th style="width:28%;">Danger identifié</th>
            <th>Famille</th>
            <th style="text-align:center;">P</th>
            <th style="text-align:center;">G</th>
            <th style="text-align:center;">Score</th>
            <th>Statut action</th>
            <th></th>
          </tr></thead>
          <tbody>${risksRows}</tbody>
        </table>
        <div style="font-size:10px;color:var(--text3);padding:4px 8px;">
          🟢 Score ≤ 2 Faible &nbsp;·&nbsp; 🟡 Score 3–5 Modéré &nbsp;·&nbsp; 🔴 Score ≥ 6 Critique
        </div>
      </div>
    </div>`;
}

function duerSelectUnit(c, u) { CUR.client=c; CUR.unit=u; duerRenderDetail(); }

// ── FORMULAIRE RISQUE ────────────────────────────────────
function duerOpenAddRisk() {
  EDIT_RISK = null;
  duerOpenPanel(
    'Nouveau risque',
    `${CUR.client} — ${CUR.unit}`,
    duerBuildForm({}),
    `<button class="btn btn-ghost" onclick="duerClosePanel()">Annuler</button>
     <button class="btn btn-teal" onclick="duerSaveRisk()">Enregistrer</button>`
  );
  duerUpdateScore();
}

function duerEditRisk(id) {
  const r = (DB[CUR.client]?.units?.[CUR.unit]||[]).find(x=>x.id===id);
  if (!r) return;
  EDIT_RISK = id;
  duerOpenPanel(
    'Modifier le risque',
    `${CUR.client} — ${CUR.unit}`,
    duerBuildForm(r),
    `<button class="btn btn-ghost" onclick="duerClosePanel()">Annuler</button>
     <button class="btn btn-teal" onclick="duerSaveRisk()">Enregistrer</button>`
  );
  duerUpdateScore();
}

function duerBuildForm(r) {
  const libs = ['— Choisir dans la bibliothèque',...Object.keys(RISK_LIB),'Autre (saisie libre)'];
  const units = Object.keys(DB[CUR.client]?.units||{});
  return `<div class="fgrid">
    <div class="fg full">
      <label>Bibliothèque de risques</label>
      <select id="f-lib" onchange="duerFillFromLib()">
        ${libs.map(l=>`<option value="${l}">${l}</option>`).join('')}
      </select>
    </div>
    <div class="fsep full"><div class="fsep-l"></div><div class="fsep-t">Identification du risque</div><div class="fsep-l"></div></div>
    <div class="fg full">
      <label>Danger identifié *</label>
      <input id="f-danger" value="${r.danger||''}" placeholder="Ex : Postures statiques prolongées">
    </div>
    <div class="fg">
      <label>Famille de risque</label>
      <select id="f-family">
        ${RISK_FAMILIES.map(f=>`<option${(r.famille||r.family)===f?' selected':''}>${f}</option>`).join('')}
      </select>
    </div>
    <div class="fg">
      <label>Unité de travail</label>
      <select id="f-unit">
        ${units.map(u=>`<option${u===CUR.unit?' selected':''}>${u}</option>`).join('')}
      </select>
    </div>
    <div class="fsep full"><div class="fsep-l"></div><div class="fsep-t">Cotation du risque</div><div class="fsep-l"></div></div>
    <div class="fg">
      <label>Probabilité (P)</label>
      <select id="f-p" onchange="duerUpdateScore()">
        <option value="1"${(r.probabilite||r.p)==1?' selected':''}>1 — Rare</option>
        <option value="2"${(r.probabilite||r.p)==2?' selected':''}>2 — Possible</option>
        <option value="3"${(r.probabilite||r.p)==3?' selected':''}>3 — Fréquent</option>
      </select>
    </div>
    <div class="fg">
      <label>Gravité (G)</label>
      <select id="f-g" onchange="duerUpdateScore()">
        <option value="1"${(r.gravite||r.g)==1?' selected':''}>1 — Légère</option>
        <option value="2"${(r.gravite||r.g)==2?' selected':''}>2 — Sérieuse</option>
        <option value="3"${(r.gravite||r.g)==3?' selected':''}>3 — Grave</option>
      </select>
    </div>
    <div class="fg full">
      <label>Score P × G</label>
      <div id="score-display" style="padding:10px 14px;border-radius:8px;font-size:14px;font-weight:700;background:var(--bg);border:1.5px solid var(--border);">—</div>
    </div>
    <div class="fg full">
      <label>Référence réglementaire (optionnel)</label>
      <input id="f-ref" value="${r.ref_regl||r.ref||''}" placeholder="Ex : Art. 182 Code du Travail togolais">
    </div>
    <div class="fsep full"><div class="fsep-l"></div><div class="fsep-t">Plan d'action</div><div class="fsep-l"></div></div>
    <div class="fg full">
      <label>Action corrective</label>
      <textarea id="f-action">${r.action||''}</textarea>
    </div>
    <div class="fg">
      <label>Responsable</label>
      <input id="f-resp" value="${r.responsable||r.resp||''}" placeholder="Ex : DRH">
    </div>
    <div class="fg">
      <label>Échéance</label>
      <input type="date" id="f-echeance" value="${duerDateInputValue(r.echeance)}">
    </div>
    <div class="fg full">
      <label>Statut de l'action</label>
      <select id="f-statut">
        <option${(r.statut||'Ouverte')==='Ouverte'?' selected':''}>Ouverte</option>
        <option${r.statut==='En cours'?' selected':''}>En cours</option>
        <option${r.statut==='Clôturée'?' selected':''}>Clôturée</option>
      </select>
    </div>
  </div>`;
}

function duerFillFromLib() {
  const sel = document.getElementById('f-lib')?.value;
  if (!sel || sel.startsWith('—') || sel.startsWith('Autre')) return;
  document.getElementById('f-danger').value = sel;
  const fam = RISK_LIB[sel] || '';
  const fs = document.getElementById('f-family');
  if (fs) Array.from(fs.options).forEach(o => o.selected = o.value === fam);
  const act = document.getElementById('f-action');
  if (act) act.value = ACTIONS_LIB[fam] || '';
  duerUpdateScore();
}

function duerUpdateScore() {
  const p = parseInt(document.getElementById('f-p')?.value) || 1;
  const g = parseInt(document.getElementById('f-g')?.value) || 1;
  const s = p * g;
  const disp = document.getElementById('score-display');
  if (!disp) return;
  const cls = s>=6?'var(--red)':s>=3?'var(--amber)':'var(--green)';
  const bg  = s>=6?'var(--red3)':s>=3?'var(--amber3)':'var(--green3)';
  disp.style.background = bg;
  disp.style.borderColor = cls;
  disp.style.color = cls;
  disp.textContent = `${s} — ${duerScoreLabel(s)}`;
}

// ── ÉCRITURE VERS L'API ──────────────────────────────────
async function duerSaveRisk() {
  const danger = document.getElementById('f-danger')?.value?.trim();
  if (!danger) { alert('Danger identifié obligatoire'); return; }
  const clientId = getDuerClientId(CUR.client);
  if (!clientId) { alert('Client introuvable — vérifier getDuerClientId()'); return; }
  const payload = {
    unite:       document.getElementById('f-unit')?.value || CUR.unit,
    danger,
    famille:     document.getElementById('f-family')?.value || '',
    probabilite: parseInt(document.getElementById('f-p')?.value) || 1,
    gravite:     parseInt(document.getElementById('f-g')?.value) || 1,
    ref_regl:    document.getElementById('f-ref')?.value || '',
    action:      document.getElementById('f-action')?.value || '',
    responsable: document.getElementById('f-resp')?.value || '',
    echeance:    document.getElementById('f-echeance')?.value || '',
    statut:      document.getElementById('f-statut')?.value || 'Ouverte',
  };
  const url    = EDIT_RISK ? `/api/v1/duer/risques/${EDIT_RISK}` : `/api/v1/duer/${clientId}/risques`;
  const method = EDIT_RISK ? 'PATCH' : 'POST';
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(payload)
    });
    const { success, error } = await res.json();
    if (!success) throw new Error(error);
    duerClosePanel();
    await loadDuerClient(CUR.client);
    duerRenderDetail();
  } catch (err) { alert('Erreur : ' + err.message); }
}

async function duerDeleteRisk(id) {
  if (!confirm('Supprimer ce risque ?')) return;
  try {
    await fetch(`/api/v1/duer/risques/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    await loadDuerClient(CUR.client);
    duerRenderDetail();
  } catch (err) { alert('Erreur suppression : ' + err.message); }
}

async function duerAddUnit(clientName) {
  const nom = prompt('Nom de la nouvelle unité de travail :');
  if (!nom?.trim()) return;
  const clientId = getDuerClientId(clientName);
  try {
    await fetch(`/api/v1/duer/${clientId}/unites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ nom: nom.trim() })
    });
    await loadDuerClient(clientName);
    CUR.unit = nom.trim();
    duerRenderDetail();
  } catch (err) { alert('Erreur : ' + err.message); }
}

// ── PLAN D'ACTION ────────────────────────────────────────
function duerOpenPlan(id) {
  const r = (DB[CUR.client]?.units?.[CUR.unit]||[]).find(x=>x.id===id);
  if (!r) return;
  const s = duerScore(r);
  duerOpenPanel(
    'Plan d\'action',
    r.danger,
    `<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;padding:14px;background:var(--bg);border-radius:var(--r);border:1px solid var(--border);">
      <span class="score-circ ${duerScoreClass(s)}" style="width:40px;height:40px;font-size:16px;">${s}</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--navy);">${r.danger}</div>
        <div style="font-size:11px;color:var(--text2);">${r.famille||'—'} · P${r.probabilite||r.p}×G${r.gravite||r.g}=${s} (${duerScoreLabel(s)})</div>
      </div>
      <span class="badge ${duerStatusBadge(r.statut)}" style="margin-left:auto;">${r.statut}</span>
    </div>
    <div class="fgrid">
      <div class="fg full"><label>Action corrective</label>
        <textarea id="pa-action" style="min-height:90px;">${r.action||''}</textarea></div>
      <div class="fg"><label>Responsable</label>
        <input id="pa-resp" value="${r.responsable||r.resp||''}"></div>
      <div class="fg"><label>Échéance</label>
        <input type="date" id="pa-echeance" value="${duerDateInputValue(r.echeance)}"></div>
      <div class="fg full"><label>Statut</label>
        <select id="pa-statut">
          <option${r.statut==='Ouverte'?' selected':''}>Ouverte</option>
          <option${r.statut==='En cours'?' selected':''}>En cours</option>
          <option${r.statut==='Clôturée'?' selected':''}>Clôturée</option>
        </select></div>
    </div>`,
    `<button class="btn btn-ghost" onclick="duerClosePanel()">Annuler</button>
     <button class="btn btn-teal" onclick="duerSavePlan('${id}')">Enregistrer</button>`
  );
}

async function duerSavePlan(id) {
  const payload = {
    action:      document.getElementById('pa-action')?.value,
    responsable: document.getElementById('pa-resp')?.value,
    echeance:    document.getElementById('pa-echeance')?.value,
    statut:      document.getElementById('pa-statut')?.value,
  };
  try {
    const res = await fetch(`/api/v1/duer/risques/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(payload)
    });
    const { success, error } = await res.json();
    if (!success) throw new Error(error);
    duerClosePanel();
    await loadDuerClient(CUR.client);
    duerRenderDetail();
  } catch (err) { alert('Erreur : ' + err.message); }
}
