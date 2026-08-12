/*
 * js/ui/resume.js — Vue « Résumé » : cartes KPI, barre de progression et tableau
 * croisé statuts × enquêtes (portée « toutes » ou enquête active), courbe
 * d'avancement, et exports du résumé (XLSX via SheetJS, PDF via impression).
 * Extrait de js/app.js (modules ES).
 *
 * Imports : renderCourbeAvancement (ui/stats) ; esc (util) ; t, labelNbEnquetes,
 * localeApp (i18n) ; statutLabel (canon). L'état (resumeScope, interne) et
 * l'orchestration (enquetes, enqueteActive, settings, statutDefaut, XLSX,
 * setView, vueActive) sont globaux (pont).
 */
import { renderCourbeAvancement } from './stats.js';
import { esc } from '../core/util.js';
import { t, labelNbEnquetes, localeApp } from '../core/i18n.js';
import { statutLabel } from '../data/canon.js';

export function exporterResumeXLSX() {
  const wb = XLSX.utils.book_new();
  const nomEnquetes = Object.keys(enquetes);
  const statutsCfg  = settings.statuts;

  // ── Feuille 1 : Tableau croisé ──────────────────────────────────
  const header = ['Enquête', ...statutsCfg.map(s => s.icon + ' ' + s.label), 'Total'];
  const rows   = [header];

  const totauxParStatut = {};
  statutsCfg.forEach(s => totauxParStatut[s.label] = 0);
  let grandTotal = 0;

  nomEnquetes.forEach(nom => {
    const cpt = {};
    statutsCfg.forEach(s => cpt[s.label] = 0);
    (enquetes[nom] || []).forEach(c => {
      const st = c.statut || statutDefaut();
      if (cpt[st] !== undefined) cpt[st]++;
      else cpt[st] = 1;
      totauxParStatut[st] = (totauxParStatut[st] || 0) + 1;
      grandTotal++;
    });
    const tot = Object.values(cpt).reduce((a,b)=>a+b, 0);
    rows.push([nom, ...statutsCfg.map(s => cpt[s.label] || 0), tot]);
  });

  // Ligne totaux
  rows.push(['TOTAL', ...statutsCfg.map(s => totauxParStatut[s.label] || 0), grandTotal]);

  const ws1 = XLSX.utils.aoa_to_sheet(rows);

  // Largeurs de colonnes
  ws1['!cols'] = [
    { wch: 35 },
    ...statutsCfg.map(() => ({ wch: 12 })),
    { wch: 10 }
  ];

  XLSX.utils.book_append_sheet(wb, ws1, 'Résumé');

  // ── Feuille 2 : Détail par statut (%) ──────────────────────────
  const header2 = ['Enquête', 'Total', ...statutsCfg.map(s => s.label + ' (%)') ];
  const rows2   = [header2];

  nomEnquetes.forEach(nom => {
    const cpt = {};
    statutsCfg.forEach(s => cpt[s.label] = 0);
    (enquetes[nom] || []).forEach(c => {
      const st = c.statut || statutDefaut();
      if (cpt[st] !== undefined) cpt[st]++;
    });
    const tot = Object.values(cpt).reduce((a,b)=>a+b, 0);
    rows2.push([
      nom, tot,
      ...statutsCfg.map(s => tot ? +(cpt[s.label]/tot*100).toFixed(1) : 0)
    ]);
  });

  const ws2 = XLSX.utils.aoa_to_sheet(rows2);
  ws2['!cols'] = [{ wch: 35 }, { wch: 8 }, ...statutsCfg.map(() => ({ wch: 14 }))];
  XLSX.utils.book_append_sheet(wb, ws2, 'Pourcentages');

  // ── Feuille 3 : KPI global ──────────────────────────────────────
  const rows3 = [
    ['Indicateur', 'Valeur', '%'],
    ['Total contacts', grandTotal, '100%'],
    ...statutsCfg.map(s => {
      const nb  = totauxParStatut[s.label] || 0;
      const pct = grandTotal ? (nb/grandTotal*100).toFixed(1)+'%' : '0%';
      return [s.icon + ' ' + s.label, nb, pct];
    }),
    [],
    ['Nombre d\'enquêtes', nomEnquetes.length, ''],
    ['Date export', new Date().toLocaleDateString('fr-BE'), ''],
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(rows3);
  ws3['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'KPI');

  const date = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `statbel_resume_${date}.xlsx`);
}

export function exporterResumePDF() {
  // Bascule sur la vue résumé si on n'y est pas déjà
  if (vueActive !== 'resume') setView('resume');
  setTimeout(() => window.print(), 150);
}


// ════════════════════════════════════════════════════════════════════
// VUE RÉSUMÉ — KPI cards + barre de progression + tableau croisé
// ════════════════════════════════════════════════════════════════════


let resumeScope = 'all';   // 'all' = toutes les enquêtes | 'active' = enquête sélectionnée
export function setResumeScope(s) { resumeScope = s; renduResume(); }

export function renduResume() {
  const box = document.getElementById('resumeContainer');
  if (!box) return;

  // ── Collecte des données (périmètre : toutes les enquêtes ou l'enquête active) ──
  const toutesEnq   = Object.keys(enquetes);
  const scopeActive = resumeScope === 'active' && enqueteActive && enquetes[enqueteActive];
  const nomEnquetes = scopeActive ? [enqueteActive] : toutesEnq;
  const statutsCfg  = settings.statuts; // [{ label, color, icon }]

  // Pour chaque statut, couleur et icône
  const statutMap = {};
  statutsCfg.forEach(s => { statutMap[s.label] = s; });

  // Couleur de fallback pour un statut inconnu
  function colorFor(label) {
    return (statutMap[label] && statutMap[label].color) || '#90a4ae';
  }
  function iconFor(label) {
    return (statutMap[label] && statutMap[label].icon) || '•';
  }

  // Tous les statuts présents dans les données (+ ceux de la config)
  const statutsPresents = new Set(statutsCfg.map(s => s.label));
  Object.values(enquetes).forEach(arr =>
    arr.forEach(c => statutsPresents.add(c.statut || statutDefaut()))
  );
  const statutsListe = [...statutsPresents];

  // Matrice : { [enquete]: { [statut]: count } }
  const matrice = {};
  let grandTotal = 0;
  const totauxParStatut = {};
  statutsListe.forEach(s => totauxParStatut[s] = 0);

  nomEnquetes.forEach(nom => {
    matrice[nom] = {};
    statutsListe.forEach(s => matrice[nom][s] = 0);
    (enquetes[nom] || []).forEach(c => {
      const st = c.statut || statutDefaut();
      if (!matrice[nom][st]) matrice[nom][st] = 0;
      matrice[nom][st]++;
      totauxParStatut[st] = (totauxParStatut[st] || 0) + 1;
      grandTotal++;
    });
  });

  // Totaux par enquête
  const totauxParEnquete = {};
  nomEnquetes.forEach(nom => {
    totauxParEnquete[nom] = Object.values(matrice[nom]).reduce((a,b) => a+b, 0);
  });

  // ── KPI cards ────────────────────────────────────────────────────
  // Trouver "Fait" et "À faire" dynamiquement
  const doneStatuts  = statutsCfg.filter(s => s.done).map(s => s.label);
  const rdvStatuts   = statutsCfg.filter(s => s.rdv).map(s => s.label);

  const nbFait   = doneStatuts.reduce((acc, s) => acc + (totauxParStatut[s] || 0), 0);
  const nbAfaire = (totauxParStatut[statutDefaut()] || 0);
  const nbRdv    = rdvStatuts.reduce((acc, s) => acc + (totauxParStatut[s] || 0), 0);
  const pctFait  = grandTotal ? Math.round(nbFait / grandTotal * 100) : 0;

  let kpiHtml = `
    <div class="kpi-card" style="border-top-color:#1a237e">
      <div class="kpi-val">${grandTotal}</div>
      <div class="kpi-lbl">${t('res_total_contacts')}</div>
      <div class="kpi-pct">${labelNbEnquetes(nomEnquetes.length)}</div>
    </div>`;

  statutsCfg.forEach(s => {
    const nb  = totauxParStatut[s.label] || 0;
    const pct = grandTotal ? Math.round(nb / grandTotal * 100) : 0;
    kpiHtml += `
    <div class="kpi-card" style="border-top-color:${s.color}">
      <div class="kpi-val" style="color:${s.color}">${nb}</div>
      <div class="kpi-lbl">${esc(s.icon)} ${esc(statutLabel(s.label))}</div>
      <div class="kpi-pct">${pct}%</div>
    </div>`;
  });

  // ── Barre de progression empilée ─────────────────────────────────
  let barHtml = '<div class="progress-stacked">';
  statutsCfg.forEach(s => {
    const nb  = totauxParStatut[s.label] || 0;
    if (!nb || !grandTotal) return;
    const pct = (nb / grandTotal * 100).toFixed(1);
    barHtml += `<div class="progress-seg" style="width:${pct}%;background:${s.color}" title="${esc(statutLabel(s.label))} : ${nb} (${pct}%)"></div>`;
  });
  barHtml += '</div>';

  let legendHtml = '<div class="progress-legend">';
  statutsCfg.forEach(s => {
    const nb  = totauxParStatut[s.label] || 0;
    if (!nb) return;
    const pct = grandTotal ? (nb / grandTotal * 100).toFixed(1) : 0;
    legendHtml += `
      <div class="prog-leg-item">
        <div class="prog-leg-dot" style="background:${s.color}"></div>
        <span>${esc(s.icon)} ${esc(statutLabel(s.label))} — <strong>${nb}</strong> (${pct}%)</span>
      </div>`;
  });
  legendHtml += '</div>';

  // ── Donut de répartition des statuts (lib partagée js/charts.js) ─────────
  const donutItems = statutsCfg.map(s => ({
    label: `${s.icon} ${statutLabel(s.label)}`,
    value: totauxParStatut[s.label] || 0,
    color: s.color,
  }));
  const donutHtml = (globalThis.Charts && grandTotal)
    ? Charts.donut(donutItems, { total: grandTotal, ariaLabel: t('res_distribution') })
    : legendHtml;   // repli si la lib n'est pas chargée

  // ── Données pour le tableau de contacts triable (lib partagée) ───────────
  const frToIso = d => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(d || '').trim()); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
  const contactsRows = [];
  nomEnquetes.forEach(nom => (enquetes[nom] || []).forEach(c => {
    const st = c.statut || statutDefaut();
    contactsRows.push({
      contact: `${c.nom || ''} ${c.prenom || ''}`.trim() || ('#' + (c.ordre || '')),
      enquete: nom,
      statut: statutLabel(st),
      _statut: st,
      visites: (c.historique || []).length,
      derniereIso: frToIso(c.date),
    });
  }));
  const badge = st => {
    const col = colorFor(st), ic = iconFor(st);
    return `<span class="chart-badge" style="background:${col}22;color:${col}">${esc(ic)} ${esc(statutLabel(st))}</span>`;
  };
  const contactsCols = [
    { k: 'contact',     label: t('res_col_contact') },
    { k: 'enquete',     label: t('res_col_survey') },
    { k: 'statut',      label: t('res_col_status'), render: (v, r) => badge(r._statut) },
    { k: 'visites',     label: t('res_col_visits'), num: true },
    { k: 'derniereIso', label: t('res_col_last'), render: v => v ? v.split('-').reverse().join('/') : '—' },
  ];

  // ── Tableau croisé ───────────────────────────────────────────────
  let thStatuts = statutsCfg.map(s =>
    `<th style="border-bottom:3px solid ${s.color}">${esc(s.icon)}<br>${esc(statutLabel(s.label))}</th>`
  ).join('');

  let tableHtml = `
    <div class="resume-table-wrap">
      <table class="resume-table">
        <thead>
          <tr>
            <th>${t('res_col_survey')}</th>
            ${thStatuts}
            <th>${t('res_col_total')}</th>
          </tr>
        </thead>
        <tbody>`;

  nomEnquetes.forEach(nom => {
    const tot = totauxParEnquete[nom] || 0;
    let cells = statutsCfg.map(s => {
      const nb = matrice[nom][s.label] || 0;
      if (!nb) return `<td><span class="cell-zero">—</span></td>`;
      const pct = tot ? Math.round(nb/tot*100) : 0;
      return `<td>
        <div class="cell-bar-wrap">
          <span class="cell-badge" style="background:${s.color}22;color:${s.color}">${nb}</span>
          <span style="font-size:10px;color:var(--text3)">${pct}%</span>
        </div>
      </td>`;
    }).join('');

    // Barre mini de progression dans la colonne Total
    let miniBar = '<div style="height:6px;border-radius:3px;overflow:hidden;display:flex;min-width:60px;margin-top:4px">';
    statutsCfg.forEach(s => {
      const nb = matrice[nom][s.label] || 0;
      if (!nb || !tot) return;
      const pct = (nb/tot*100).toFixed(1);
      miniBar += `<div style="width:${pct}%;background:${s.color};height:100%"></div>`;
    });
    miniBar += '</div>';

    tableHtml += `
      <tr>
        <td title="${esc(nom)}">${esc(nom)}</td>
        ${cells}
        <td>
          <strong>${tot}</strong>
          ${miniBar}
        </td>
      </tr>`;
  });

  // Ligne totaux
  let totalCells = statutsCfg.map(s => {
    const nb = totauxParStatut[s.label] || 0;
    const pct = grandTotal ? Math.round(nb/grandTotal*100) : 0;
    return nb
      ? `<td><span class="cell-badge" style="background:${s.color}22;color:${s.color}">${nb}</span> <small style="color:var(--text3)">${pct}%</small></td>`
      : `<td><span class="cell-zero">—</span></td>`;
  }).join('');

  tableHtml += `
        <tr class="resume-total">
          <td>${t('res_total_row')}</td>
          ${totalCells}
          <td><strong>${grandTotal}</strong></td>
        </tr>
        </tbody>
      </table>
    </div>`;

  // ── Assemblage final ──────────────────────────────────────────────
  box.innerHTML = `
    <div>
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px;">
        <div>
          <div class="resume-title">${t('res_title')} — ${labelNbEnquetes(nomEnquetes.length)}</div>
          <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
            <button class="resume-scope-btn${resumeScope === 'all' ? ' actif' : ''}" onclick="setResumeScope('all')">🗂️ ${t('res_scope_all')} (${toutesEnq.length})</button>
            <button class="resume-scope-btn${resumeScope === 'active' ? ' actif' : ''}" onclick="setResumeScope('active')"${!enqueteActive ? ' disabled' : ''}>📋 ${enqueteActive ? esc(enqueteActive) : t('res_scope_active')}</button>
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px">
            ${t('res_updated')} ${new Date().toLocaleTimeString(localeApp(), {hour:'2-digit',minute:'2-digit'})}
          </div>
        </div>
        <div class="resume-export-bar">
          <button class="btn-export btn-export-xlsx" onclick="exporterResumeXLSX()">${t('btn_xlsx')}</button>
          <button class="btn-export btn-export-pdf"  onclick="exporterResumePDF()">${t('btn_pdf')}</button>
        </div>
      </div>
      <div class="resume-print-header" style="margin-top:8px;font-size:11px;color:#666;">
        Statbel – Interviews · ${t('res_exported')} ${new Date().toLocaleDateString(localeApp(), {day:'2-digit',month:'long',year:'numeric'})}
      </div>
    </div>
    <div>
      <div class="resume-section-title">${t('res_kpi')}</div>
      <div class="kpi-grid">${kpiHtml}</div>
    </div>
    <div>
      <div class="resume-section-title">${t('res_progress')}</div>
      ${barHtml}
    </div>
    <div>
      <div class="resume-section-title">${t('res_distribution')}</div>
      ${donutHtml}
    </div>
    <div>
      <div class="resume-section-title">${t('cumul_title')}</div>
      ${renderCourbeAvancement(scopeActive ? enqueteActive : null)}
    </div>
    <div>
      <div class="resume-section-title">${t('res_table')}</div>
      ${tableHtml}
    </div>
    <div>
      <div class="resume-section-title">${t('res_contacts')}</div>
      <div id="resumeContactsTable" class="chart-scroll"></div>
    </div>`;

  // Tableau de contacts triable (rendu après l'injection du HTML).
  if (globalThis.Charts) Charts.table('resumeContactsTable', contactsCols, contactsRows, { key: 'visites', dir: -1 });
}
