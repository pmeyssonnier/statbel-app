/*
 * js/features/backup.js — Sauvegarde & restauration JSON : bandeau de rappel,
 * export complet (enquêtes en clés EN + réglages + cache de coordonnées),
 * import avec comparaison avant/après (réutilise l'appariement/le diff de
 * features/import), et sérialisation EN↔interne (KEYMAP). Extrait de app.js.
 *
 * Imports : buildCompareHTML, apparieurAnciens (import) ; normaliserPays
 * (canon) ; esc (util) ; t, tf, localeApp (i18n) ; GEO_PROVIDERS (geocoding).
 * L'orchestration (enquetes, settings, validerSettings, migrerVersAnglais,
 * sauver, refreshSelect, rendu, majSettingsUI, appliquerTheme, afficherToast,
 * GEO, rafraichirFond, leafletMap) est globale (pont).
 */
import { buildCompareHTML, apparieurAnciens } from './import.js';
import { normaliserPays } from '../data/canon.js';
import { esc } from '../core/util.js';
import { t, tf, localeApp } from '../core/i18n.js';
import { GEO_PROVIDERS } from './geocoding.js';



// ── Bandeau de rappel de sauvegarde (non-modal, dans la liste) ───────
// S'affiche quand il y a des données et qu'aucune sauvegarde n'a été faite,
// ou que la dernière remonte à plus de BACKUP_RAPPEL_JOURS jours.
const BACKUP_RAPPEL_JOURS = 7;
export function majBackupBanner() {
  const el = document.getElementById('backupBanner');
  if (!el) return;
  const aDesDonnees = Object.keys(enquetes).length > 0 &&
    Object.values(enquetes).some(arr => Array.isArray(arr) && arr.length > 0);
  if (sessionStorage.getItem('statbel_bkbanner_dismiss') || !aDesDonnees) {
    el.classList.add('hidden');
    return;
  }
  const iso = localStorage.getItem('statbel_last_backup');
  let msg = null;
  if (!iso) {
    msg = t('bkbanner_never');
  } else {
    const jours = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (jours >= BACKUP_RAPPEL_JOURS) msg = tf('bkbanner_old', { n: jours });
  }
  el.classList.toggle('hidden', !msg);
  if (msg) el.querySelector('.bk-msg').textContent = msg;
}
export function fermerBackupBanner() {
  sessionStorage.setItem('statbel_bkbanner_dismiss', '1');
  const el = document.getElementById('backupBanner');
  if (el) el.classList.add('hidden');
}

/** Construit le HTML du détail enquêtes × statuts pour un objet enquetes */
export function buildBackupDetailHTML(src, meta) {
  const statutsCfg = settings.statuts;

  function colorFor(label) {
    const s = statutsCfg.find(s => s.label === label);
    return s ? s.color : '#90a4ae';
  }
  function iconFor(label) {
    const s = statutsCfg.find(s => s.label === label);
    return s ? s.icon : '•';
  }

  const noms = Object.keys(src);
  let grandTotal = 0;
  let html = '';

  if (meta) {
    html += `<div class="backup-meta">${meta}</div>`;
  }

  noms.forEach(nom => {
    const arr = src[nom] || [];
    const cpt = {};
    arr.forEach(c => {
      const st = c.statut || statutDefaut();
      cpt[st] = (cpt[st] || 0) + 1;
    });
    const tot = arr.length;
    grandTotal += tot;

    let pillsHtml = '';
    // Statuts configurés d'abord, dans l'ordre
    statutsCfg.forEach(s => {
      const nb = cpt[s.label] || 0;
      if (!nb) return;
      const pct = tot ? Math.round(nb / tot * 100) : 0;
      pillsHtml += `<span class="backup-statut-pill" style="background:${s.color}22;color:${s.color}">
        ${esc(s.icon)} ${esc(statutLabel(s.label))} <strong>${nb}</strong> <span style="opacity:.7">(${pct}%)</span>
      </span>`;
    });
    // Statuts hors config (données orphelines)
    Object.entries(cpt).forEach(([st, nb]) => {
      if (statutsCfg.find(s => s.label === st)) return;
      pillsHtml += `<span class="backup-statut-pill" style="background:#eee;color:#666">
        ${esc(st)} <strong>${nb}</strong>
      </span>`;
    });

    html += `
      <div class="backup-enq-block">
        <div class="backup-enq-header">
          <span title="${esc(nom)}">${esc(nom)}</span>
          <span class="backup-enq-total">${tot} contact${tot > 1 ? 's' : ''}</span>
        </div>
        <div class="backup-statuts">${pillsHtml || '<span style="font-size:12px;color:var(--text3)">Aucun contact</span>'}</div>
      </div>`;
  });

  html += `<div class="backup-grand-total">
    <span>${t('bk_total')}</span>
    <span>${grandTotal} ${tPlural('bk_w_contact',grandTotal)} · ${noms.length} ${tPlural('bk_w_survey',noms.length)}</span>
  </div>`;

  return html;
}


export function fermerBackupDetail() {
  document.getElementById('modalBackupDetail').classList.remove('open');
}

// Clés de champs : modèle interne (FR) ↔ pivot anglais (export/backup/CSV).
const KEYMAP_OUT = { prenom:'first_name', nom:'last_name', adresse:'address', ordre:'order', sexe:'sex', statut:'status', historique:'history', taille_menage:'household_size', gsm:'mobile_number', rdv:'appointment' };
const KEYMAP_IN  = { first_name:'prenom', last_name:'nom', address:'adresse', order:'ordre', sex:'sexe', status:'statut', history:'historique', household_size:'taille_menage', mobile_number:'gsm', appointment:'rdv' };
export function renommerCles(c, map) { const o = {}; for (const k in c) o[map[k] || k] = c[k]; return o; }
export function contactVersEN(c) {
  const o = renommerCles(c, KEYMAP_OUT);
  if (Array.isArray(o.history)) o.history = o.history.map(h => renommerCles(h, { statut:'status' }));
  return o;
}
export function contactVersInterne(c) {
  const o = renommerCles(c, KEYMAP_IN);
  if (Array.isArray(o.historique)) o.historique = o.historique.map(h => renommerCles(h, { status:'statut' }));
  return o;
}
export function enquetesVersEN(enq) { const r = {}; Object.entries(enq).forEach(([n, arr]) => r[n] = arr.map(contactVersEN)); return r; }
export function enquetesVersInterne(enq) { const r = {}; Object.entries(enq).forEach(([n, arr]) => r[n] = arr.map(contactVersInterne)); return r; }

export function exporterBackup() {
  const date   = new Date();
  const isoNow = date.toISOString();
  // Inclure le cache de géocodage (coords_<adresse> → {lat,lng})
  const coords = {};
  Object.keys(localStorage).forEach(k => {
    if (!k.startsWith('coords_')) return;
    try { coords[k.slice(7)] = JSON.parse(localStorage.getItem(k)); } catch(e) {}
  });
  // Exclure le verrouillage PIN du backup : c'est un réglage propre à
  // l'appareil (et son hash n'a pas à voyager dans un fichier exporté).
  const { pinCode, pinTimeout, ...settingsExport } = settings;
  const data   = JSON.stringify({ version: 2, date: isoNow, settings: settingsExport, surveys: enquetesVersEN(enquetes), coords }, null, 2);
  const blob   = new Blob([data], { type: 'application/json' });
  const url    = URL.createObjectURL(blob);
  const fname  = 'statbel_sauvegarde_' + isoNow.slice(0, 10) + '.json';

  const meta = `${t('bk_date')} ${date.toLocaleDateString(localeApp(), {day:'2-digit',month:'long',year:'numeric'})}
&nbsp;&nbsp;${t('bk_file')} <code>${fname}</code>`;

  const detailHtml = buildBackupDetailHTML(enquetes, meta);

  document.getElementById('modalBackupTitle').textContent = t('bk_save_title');
  document.getElementById('modalBackupBody').innerHTML    = detailHtml;
  document.getElementById('backupPreserveRow').classList.add('hidden');     // options réservées au restore
  document.getElementById('backupOnlyValidRow').classList.add('hidden');
  document.getElementById('restoreExclusDetail').innerHTML = '';
  document.getElementById('restoreExcluded').textContent = '';

  const btnConfirm = document.getElementById('btnBackupConfirm');
  btnConfirm.textContent = t('bk_download');
  btnConfirm.onclick = () => {
    const a = Object.assign(document.createElement('a'), { href: url, download: fname });
    a.click();
    localStorage.setItem('statbel_last_backup', isoNow);
    majLastBackupInfo();
    fermerBackupDetail();
  };

  // Bouton annuler = juste fermer (pas de téléchargement)
  document.querySelector('#modalBackupDetail .btn-secondary').textContent = t('btn_cancel');

  document.getElementById('modalBackupDetail').classList.add('open');
}

// Affiche « Dernière sauvegarde : … » dans la section Données des Paramètres
export function majLastBackupInfo() {
  const el = document.getElementById('lastBackupInfo');
  if (!el) return;
  const iso = localStorage.getItem('statbel_last_backup');
  if (!iso) {
    el.textContent = t('backup_none');
    el.style.color = '#e65100';
    return;
  }
  const d = new Date(iso);
  el.textContent = t('backup_last') + ' ' + d.toLocaleDateString(localeApp(),
      { day:'2-digit', month:'long', year:'numeric' })
    + ' ' + t('backup_at') + ' ' + d.toLocaleTimeString(localeApp(), { hour:'2-digit', minute:'2-digit' });
  el.style.color = '';
}

// Stockage temporaire pour la restauration (entre l'aperçu et la confirmation)
let _pendingRestore = null;
let _pendingSettings = null;
let _pendingCoords = null;
let _restoreRaw = null;    // données du backup (normalisées, avant filtrage erreurs)
let _restoreMeta = '';

// (Re)construit la comparaison de restauration selon la case « ne restaurer que les corrects »
export function majComparaisonRestore() {
  if (!_restoreRaw) return;
  const onlyValid = (document.getElementById('chkRestoreOnlyValid') || {}).checked;
  const filtered = {};
  const exclus = [];   // {c, raisons, garde}
  Object.entries(_restoreRaw).forEach(([n, arr]) => {
    if (!onlyValid) { filtered[n] = arr; return; }
    const cur = enquetes[n]; const trouver = apparieurAnciens(cur || []);
    const out = [];
    arr.forEach(rec => {
      if (recordEnErreur(rec)) {
        const o = trouver(rec);
        if (o) { out.push(o); exclus.push({ c: rec, raisons: raisonsErreur(rec), garde: true }); }  // existant conservé
        else exclus.push({ c: rec, raisons: raisonsErreur(rec), garde: false });                    // non restauré
      } else out.push(rec);
    });
    filtered[n] = out;
  });
  _pendingRestore = filtered;
  const elX = document.getElementById('restoreExcluded');
  if (elX) elX.textContent = exclus.length ? tf('ip_excluded', { n: exclus.length }) : '';
  const elD = document.getElementById('restoreExclusDetail');
  if (elD) elD.innerHTML = exclus.length ? exclus.map(x => {
    const nom = esc(((x.c.prenom || '') + ' ' + (x.c.nom || '')).trim()) || ('N° ' + esc(String(x.c.ordre || '—')));
    return `<div class="excl-row">⚠️ <b>${nom}</b> — ${x.raisons.map(esc).join(', ')} <span class="excl-state">(${x.garde ? t('ip_excl_kept') : t('ip_excl_skipped')})</span></div>`;
  }).join('') : '';
  const { html, stats } = buildCompareHTML(filtered, _restoreMeta);
  document.getElementById('modalBackupBody').innerHTML = html;
  const btn = document.getElementById('btnBackupConfirm');
  const totChanges = stats.add + stats.rem + stats.mod;
  const suffixExcl = exclus.length ? ' · ' + tf('ip_btn_excl', { n: exclus.length }) : '';
  btn.textContent = (totChanges
    ? tf('bk_confirm_n', { n: totChanges, word: tPlural('cmp_change', totChanges) })
    : t('bk_confirm')) + suffixExcl;
}

export function importerBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      // Repli vers les clés internes (accepte backups EN « first_name… » et anciens FR « prenom… »)
      const src  = enquetesVersInterne(data.surveys || data.enquetes || data);
      // Correction auto ISO-2 → ISO-3 des codes pays (naissance + nationalité)
      Object.values(src).forEach(arr => arr.forEach(c => {
        if (c.birth_country) c.birth_country = normaliserPays(c.birth_country);
        if (c.nationality)   c.nationality   = normaliserPays(c.nationality);
      }));
      const noms = Object.keys(src);
      if (!noms.length) { alert(t('al_no_survey_file')); return; }

      const dateBackup = data.date
        ? new Date(data.date).toLocaleDateString(localeApp(), {day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit'})
        : t('bk_unknown');

      // Détecter conflits (enquêtes de même nom déjà en mémoire)
      const conflits = noms.filter(n => enquetes[n]);
      const metaHtml = `${t('bk_saved_on')} ${dateBackup}
&nbsp;&nbsp;${t('bk_file')} <code>${esc(file.name)}</code>${conflits.length ? `<br>${tf('bk_conflict', { n: conflits.length })}` : ''}`;

      document.getElementById('modalBackupTitle').textContent = t('bk_restore_title');
      _restoreRaw = src;            // données normalisées (avant filtrage)
      _restoreMeta = metaHtml;
      _pendingSettings = data.settings || null;
      _pendingCoords = data.coords || null;
      // Options visibles uniquement au restore
      document.getElementById('backupPreserveRow').classList.remove('hidden');
      document.getElementById('backupOnlyValidRow').classList.remove('hidden');
      document.getElementById('chkPreserveHist').checked = true;
      document.getElementById('chkRestoreOnlyValid').checked = true;
      majComparaisonRestore();      // construit la comparaison + _pendingRestore filtré

      const btnConfirm = document.getElementById('btnBackupConfirm');
      btnConfirm.onclick = () => {
        if (!_pendingRestore) return;
        const preserver = document.getElementById('chkPreserveHist').checked;
        const noms2 = Object.keys(_pendingRestore);
        noms2.forEach(n => {
          let arr = _pendingRestore[n];
          if (preserver && enquetes[n]) {
            // Conserver historique + RDV (et statut/date) des contacts appariés déjà suivis
            const trouver = apparieurAnciens(enquetes[n]);
            arr = arr.map(neu => {
              const o = trouver(neu);
              if (!o) return neu;
              const travaille = (Array.isArray(o.historique) && o.historique.length)
                || (o.statut && o.statut !== statutDefaut()) || o.rdv;
              if (!travaille) return neu;
              const m = Object.assign({}, neu);
              m.statut = o.statut; m.date = o.date;
              if (o.rdv) m.rdv = o.rdv; else delete m.rdv;
              if (Array.isArray(o.historique) && o.historique.length) m.historique = o.historique;
              return m;
            });
          }
          enquetes[n] = arr;
        });
        enqueteActive = enqueteActive || noms2[0];
        // Restaurer le cache de géocodage s'il était présent dans la sauvegarde
        if (_pendingCoords) Object.entries(_pendingCoords).forEach(([adr, v]) => {
          if (v && typeof v.lat === 'number' && typeof v.lng === 'number')
            try { localStorage.setItem('coords_' + adr, JSON.stringify(v)); } catch(e) {}
        });
        // Restaurer aussi les paramètres (statuts personnalisés, thème, fournisseur…)
        if (_pendingSettings) {
          // Préserver le verrouillage PIN local : il ne doit jamais être
          // écrasé/activé par un backup (évite tout blocage de l'app).
          const pinLocal = { pinCode: settings.pinCode, pinTimeout: settings.pinTimeout };
          // Réglages issus d'un fichier externe : jamais fusionnés tels quels.
          // On valide/assainit (clés connues + valeurs contraintes), puis on
          // réimpose le PIN local (validerSettings guarantit déjà des statuts).
          settings = validerSettings(_pendingSettings);
          settings.pinCode = pinLocal.pinCode;
          settings.pinTimeout = pinLocal.pinTimeout;
          GEO = GEO_PROVIDERS[settings.provider] || GEO_PROVIDERS.bruxelles;
          saveSettings();
          appliquerTheme();
          if (leafletMap) rafraichirFond();
        }
        _pendingRestore = null; _pendingSettings = null; _pendingCoords = null;
        migrerVersAnglais();   // backup éventuellement en FR → pivot EN
        sauver();
        refreshSelect();
        rendu();
        majSettingsUI();
        fermerBackupDetail();
        // Petit toast de confirmation
        afficherToast(tf('toast_restore_done', { n: noms2.length }), 3000);
      };

      document.querySelector('#modalBackupDetail .btn-secondary').textContent = t('btn_cancel');
      document.getElementById('modalBackupDetail').classList.add('open');

    } catch(err) { alert(t('al_backup_invalid') + err.message); }
  };
  reader.readAsText(file, 'UTF-8');
  event.target.value = '';
}
