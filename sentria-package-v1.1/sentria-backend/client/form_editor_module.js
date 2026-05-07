// @ts-nocheck
// form_editor_module.js — Form Editor with editable sections
// Overrides showFE(), addFEField(), removeFEField() from the main HTML

// ── State ────────────────────────────────────────────────────
// feType, feSelType, feRequired, feCustomOptions are declared in cabinet_sst_v12.html
let feActiveSectionId = null;

// FIELD_TYPES is declared in cabinet_sst_v12.html

const DEFAULT_SECTIONS = {
  consultation: [
    {id:'c_s1', nom:'Contexte',                     position:0, obligatoire:true,  fields:[]},
    {id:'c_s2', nom:'Salarié',                       position:1, obligatoire:true,  fields:[]},
    {id:'c_s3', nom:'Examen',       position:2, obligatoire:true,  fields:[]},
    {id:'c_s4', nom:'Diagnostic',  position:3, obligatoire:false, fields:[]},
  ],
  visite: [
    {id:'v_s1', nom:'Contexte',          position:0, obligatoire:true,  fields:[]},
    {id:'v_s2', nom:'Salarié',           position:1, obligatoire:true,  fields:[]},
    {id:'v_s3', nom:'Examen',            position:2, obligatoire:true,  fields:[]},
    {id:'v_s4', nom:'Décision', position:3, obligatoire:false, fields:[]},
  ],
  accident: [
    {id:'a_s1', nom:'Identification', position:0, obligatoire:true,  fields:[]},
    {id:'a_s2', nom:'Circonstances',  position:1, obligatoire:true,  fields:[]},
    {id:'a_s3', nom:'Lésions',        position:2, obligatoire:true,  fields:[]},
    {id:'a_s4', nom:'Suites & CNSS',  position:3, obligatoire:false, fields:[]},
  ],
};

function initFormSections() {
  if (!S.formSections) S.formSections = {};
  ['consultation','visite','accident'].forEach(mod => {
    if (!S.formSections[mod] || !S.formSections[mod].length) {
      S.formSections[mod] = DEFAULT_SECTIONS[mod].map(s => ({...s, fields:[...s.fields]}));
    }
  });
}

// showFE and renderFEBody are handled by cabinet_sst_v12.html (v11 layout)

// ── Section Actions ──────────────────────────────────────────
function feSelectSection(id) {
  feActiveSectionId = id;
  renderFEBody(feType);
}

function feAddSection(type) {
  const nom = prompt('Nom de la nouvelle section :');
  if (!nom?.trim()) return;
  initFormSections();
  const sections = S.formSections[type];
  const newSection = { id: 'custom_' + Date.now(), nom: nom.trim(), position: sections.length, obligatoire: false, fields: [] };
  sections.push(newSection);
  feActiveSectionId = newSection.id;
  renderFEBody(type);
  toast(`✓ Section "${nom.trim()}" ajoutée`);
}

function feDeleteSection(id) {
  initFormSections();
  const sections = S.formSections[feType];
  const section = sections.find(s => s.id === id);
  if (!section) return;
  if (section.obligatoire && CU?.role !== 'admin') {
    toast('⚠ Section obligatoire — admin requis.', 'var(--amber)');
    return;
  }
  if (!confirm(`Supprimer la section "${section.nom}" ?`)) return;
  const firstSection = sections.find(s => s.id !== id);
  if (firstSection && S.customFields?.[feType]) {
    S.customFields[feType].forEach(f => { if (f.sectionId === id) f.sectionId = firstSection.id; });
  }
  S.formSections[feType] = sections.filter(s => s.id !== id);
  feActiveSectionId = S.formSections[feType][0]?.id || null;
  renderFEBody(feType);
  toast('✓ Section supprimée');
}

function feRenameSection(id, nom) {
  if (!nom?.trim()) return;
  initFormSections();
  const section = S.formSections[feType]?.find(s => s.id === id);
  if (section) { section.nom = nom.trim(); renderFEBody(feType); }
}

// ── Field Actions ────────────────────────────────────────────
function feSelectType(t) {
  feSelType = t;
  if (t !== 'select' && t !== 'check') feCustomOptions = [''];
  renderFEBody(feType);
}

function feToggleRequired() {
  feRequired = !feRequired;
  const btn = document.getElementById('fe-req-toggle');
  if (btn) btn.className = 'toggle ' + (feRequired ? 'on' : '');
}

function feAddOpt() {
  feCustomOptions.push('');
  const list = document.getElementById('fe-opts-list');
  if (list) {
    const i = feCustomOptions.length - 1;
    const div = document.createElement('div');
    div.className = 'opt-row';
    div.innerHTML = `<input class="opt-inp" value="" placeholder="Option ${i+1}" oninput="feCustomOptions[${i}]=this.value">
      <button class="opt-del" onclick="feRemoveOpt(${i})">✕</button>`;
    list.appendChild(div);
  }
}

function feRemoveOpt(i) {
  feCustomOptions.splice(i, 1);
  if (!feCustomOptions.length) feCustomOptions = [''];
  renderFEBody(feType);
}

function feAddField(type) {
  if (feSelType === 'select' || feSelType === 'check') {
    const inputs = document.querySelectorAll('.opt-inp');
    feCustomOptions = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);
    if (!feCustomOptions.length) { toast('⚠ Ajoutez au moins une option.', 'var(--amber)'); return; }
  }
  const lbl = document.getElementById('fe-lbl')?.value?.trim();
  if (!lbl) { toast('⚠ Nom du champ requis.', 'var(--amber)'); return; }
  const key = toKey(lbl);
  if (!key) { toast('⚠ Nom invalide.', 'var(--amber)'); return; }
  if (!S.customFields) S.customFields = {};
  if (!S.customFields[type]) S.customFields[type] = [];
  if (S.customFields[type].find(f => f.key === key)) { toast('⚠ Ce champ existe déjà.', 'var(--amber)'); return; }
  FIELD_LABELS[key] = lbl;
  if (!S.formFields) S.formFields = {};
  if (!S.formFields[type]) S.formFields[type] = [];
  S.formFields[type].push(key);
  S.customFields[type].push({ key, label: lbl, type: feSelType, required: feRequired, options: [...feCustomOptions], sectionId: feActiveSectionId, createdBy: CU?.id });
  feCustomOptions = [''];
  feRequired = false;
  showFE(type);
  toast(`✓ Champ "${lbl}" ajouté`);
}

function feRemoveField(type, key) {
  if (!confirm('Supprimer ce champ ? Les données déjà saisies ne seront pas affectées.')) return;
  S.formFields[type] = (S.formFields[type] || []).filter(k => k !== key);
  S.customFields[type] = (S.customFields[type] || []).filter(f => f.key !== key);
  delete FIELD_LABELS[key];
  showFE(type);
  toast('✓ Champ supprimé');
}

// selectFEType, addFEField, removeFEField, addOpt, removeOpt, toggleRequired
// are all handled by cabinet_sst_v12.html — do not override them here
