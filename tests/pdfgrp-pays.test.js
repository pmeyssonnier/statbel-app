/*
 * Test de non-régression — js/pdfgrp.js : résolution des noms de pays abrégés
 * des listings PDF (nom FR → code nationalité NIS).
 *
 * Les PDF abrègent les qualificatifs (« Congo (Rép. dém.) »). Le nom abrégé ne
 * correspond pas au libellé officiel de la table PAYS, et le repli « sans
 * parenthèses » est ambigu (3 Congo) → le champ tombait vide. paysCode doit
 * désormais rétablir les mots pleins (Rép.→République, dém.→démocratique…) et
 * gérer les sigles usuels (RDC), sans casser les résolutions exactes.
 *
 * Lancer :  CHROMIUM_PATH=… node tests/pdfgrp-pays.test.js
 */
const { chromium } = require('playwright-core');
const { serve } = require('./_serve');

const EXEC = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM || '/usr/bin/chromium';
let fails = 0;
const A = (cond, msg) => { if (!cond) { fails++; console.log('✗ FAIL ' + msg); } else console.log('✓ ' + msg); };

(async () => {
  const srv = await serve();
  const b = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  // pdfgrp.js est chargé par le Convertisseur (global pdfGrpPaysCode).
  await p.goto(srv.url + '/statbel_converter.html', { waitUntil: 'load' });
  await p.waitForTimeout(300);

  const r = await p.evaluate(() => {
    const pc = window.pdfGrpPaysCode;
    return {
      demAbbr:   pc('Congo (Rép. dém.)'),
      demFull:   pc('Congo (République démocratique)'),
      popAbbr:   pc('Congo (Rép. pop.)'),
      rep:       pc('Congo (République)'),
      rdc:       pc('RDC'),
      rdCongo:   pc('RD Congo'),
      allemFed:  pc('Allemagne (Rép. Féd.)'),
      belgique:  pc('Belgique'),          // non-régression : résolution exacte
      france:    pc('France'),
      inconnu:   pc('Atlantide'),
      vide:      pc(''),
    };
  });

  A(r.demAbbr === '306', `Congo (Rép. dém.) → 306 (got "${r.demAbbr}")`);
  A(r.demFull === '306', `Congo (République démocratique) → 306 (got "${r.demFull}")`);
  A(r.popAbbr === '307', `Congo (Rép. pop.) → 307 (got "${r.popAbbr}")`);
  A(r.rep === '362', `Congo (République) → 362 (got "${r.rep}")`);
  A(r.rdc === '306', `RDC → 306 (got "${r.rdc}")`);
  A(r.rdCongo === '306', `RD Congo → 306 (got "${r.rdCongo}")`);
  A(r.allemFed === '103', `Allemagne (Rép. Féd.) → 103 (got "${r.allemFed}")`);
  A(r.belgique === '150', `Belgique → 150 (non-régression) (got "${r.belgique}")`);
  A(r.france === '111', `France → 111 (non-régression) (got "${r.france}")`);
  A(r.inconnu === '', `pays inconnu → vide (got "${r.inconnu}")`);
  A(r.vide === '', `chaîne vide → vide (got "${r.vide}")`);
  A(errs.length === 0, 'aucune erreur JS' + (errs.length ? ' → ' + errs.join(' | ') : ''));

  await b.close();
  await srv.close();
  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
