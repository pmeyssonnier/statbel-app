/*
 * Test de parité PAYS — Convertisseur (js/converter/refdata.js) ↔ Interviews
 * (js/data/canon.js).  [audit F9, garde-fou du bug C2]
 *
 * Le Convertisseur décode les codes NIS numériques (CD_MB_NLTY, CD_MB_BTH_REFNIS)
 * en codes ISO-3 via `NLTY_ISO` (valeurs = codes émis dans le CSV « enquête »).
 * Interviews importe ce CSV et valide chaque pays contre `PAYS_I18N`. Donc TOUT
 * code que le Convertisseur peut émettre DOIT être connu d'Interviews — sinon la
 * fiche est signalée « pays inconnu » (et, historiquement, écartée : bug C2).
 *
 * Ce test exécute refdata.js (script classique, autonome) dans un bac à sable Node,
 * lit son `NLTY_ISO` réel, et vérifie que chacune de ses valeurs ISO-3 existe dans
 * le `PAYS_I18N` d'Interviews. Il aurait échoué avant l'ajout des 8 États disparus.
 *
 * Lancer :  node tests/pays-parite.test.js
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let fails = 0;
const A = (cond, msg) => { if (!cond) { fails++; console.log('✗ FAIL ' + msg); } else console.log('✓ ' + msg); };

(async () => {
  // 1. Interviews : PAYS_I18N (module ES).
  const { PAYS_I18N } = await import('../js/data/canon.js');
  const connusInterviews = new Set(Object.keys(PAYS_I18N));

  // 2. Convertisseur : exécuter refdata.js (classique) dans un bac à sable et
  //    récupérer NLTY_ISO (NIS→ISO3) + son PAYS_I18N.
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'converter', 'refdata.js'), 'utf8');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(src + '\n;this.__NLTY_ISO = NLTY_ISO; this.__PAYS_I18N = PAYS_I18N;', sandbox, { filename: 'refdata.js' });
  const nltyIso = sandbox.__NLTY_ISO;
  const paysConv = sandbox.__PAYS_I18N;

  A(nltyIso && Object.keys(nltyIso).length > 100, `refdata.js chargé, NLTY_ISO peuplé (${nltyIso ? Object.keys(nltyIso).length : 0} codes NIS)`);

  // 3. Parité : chaque code ISO-3 ÉMIS par le Convertisseur (valeurs de NLTY_ISO,
  //    alias historiques inclus) doit être connu d'Interviews.
  const emis = new Set(Object.values(nltyIso));
  const manquants = [...emis].filter(iso => iso && !connusInterviews.has(iso)).sort();
  A(manquants.length === 0,
    manquants.length
      ? `codes ISO-3 émis par le Convertisseur mais ABSENTS de canon.js : ${manquants.join(', ')}`
      : `parité OK : les ${emis.size} codes ISO-3 émissibles sont tous connus d'Interviews`);

  // 4. Les 8 États disparus (cœur du bug C2) sont bien présents des deux côtés.
  ['YUG', 'SUN', 'CSK', 'SCG', 'ANT', 'RUU', 'SGB', 'JRL'].forEach(code => {
    A(connusInterviews.has(code), `Interviews connaît ${code} (${(PAYS_I18N[code] || {}).fr || '—'})`);
    A(paysConv[code], `Convertisseur connaît ${code}`);
  });

  // 5. Le NIS de chaque État disparu concorde entre les deux tables (sinon le
  //    décodage du Convertisseur pointerait vers un autre pays côté import).
  ['YUG', 'SUN', 'CSK', 'SCG', 'ANT', 'RUU', 'SGB', 'JRL'].forEach(code => {
    A(paysConv[code] && PAYS_I18N[code] && paysConv[code].nis === PAYS_I18N[code].nis,
      `${code} : même code NIS des deux côtés (${(PAYS_I18N[code] || {}).nis})`);
  });

  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
