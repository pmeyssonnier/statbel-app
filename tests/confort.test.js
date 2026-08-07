/*
 * Tests de non-régression — confort / robustesse (app Interviews, index.html)
 *
 * Couvre le « bloc 4 » de la revue :
 *   #9 sauver() incrémental : n'écrit que les enquêtes modifiées, supprime les
 *      enquêtes retirées, reste cohérent sans changement (persistance vérifiée
 *      par relecture IndexedDB)
 *   #4 un ordre manquant reste vide (pas de numéro inventé qui entrerait en
 *      collision et fausserait l'appariement)
 *
 * Pré-requis (dev) :  npm i -D playwright-core   ·   CHROMIUM_PATH=/chemin/chrome
 * Lancer :  CHROMIUM_PATH=… node tests/confort.test.js
 */
const path = require('path');
const { chromium } = require('playwright-core');

const EXEC = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM || '/usr/bin/chromium';
const INDEX_URL = 'file://' + path.resolve(__dirname, '..', 'index.html');

(async () => {
  const b = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const p = await b.newPage();
  const perr = [];
  p.on('pageerror', e => perr.push(e.message));
  await p.goto(INDEX_URL, { waitUntil: 'load' });
  await p.waitForTimeout(700);

  const r = await p.evaluate(async () => {
    const out = {};
    const readAll = () => new Promise((res, rej) => {
      const tx = db.transaction('enquetes', 'readonly');
      const rq = tx.objectStore('enquetes').getAll();
      rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
    });
    // état de départ propre
    _lastSaved = {};
    await new Promise(res => { const tx = db.transaction('enquetes', 'readwrite'); tx.objectStore('enquetes').clear(); tx.oncomplete = res; });
    settings.statuts = [{ label: 'To do', done: false, rdv: false }];
    Object.keys(enquetes).forEach(k => delete enquetes[k]);

    // #9 — écriture des deux enquêtes
    enquetes.A = [{ ordre: '1', nom: 'X', prenom: 'a' }];
    enquetes.B = [{ ordre: '2', nom: 'Y', prenom: 'b' }];
    enqueteActive = 'A';
    await sauver();
    out.after1 = (await readAll()).map(x => x.nom + ':' + x.contacts.length).sort();

    // modifier A, retirer B → doit se répercuter (put A, delete B)
    enquetes.A.push({ ordre: '3', nom: 'Z', prenom: 'c' });
    delete enquetes.B;
    await sauver();
    out.after2 = (await readAll()).map(x => x.nom + ':' + x.contacts.length).sort();

    // sauvegarde sans changement → état persistant cohérent
    await sauver();
    out.after3 = (await readAll()).map(x => x.nom + ':' + x.contacts.length).sort();

    // #4 — ordre manquant reste vide
    out.ordreVide = parseCSV('first_name,last_name,address\nJean,Dupont,Rue A\n').rows[0].ordre === '';
    return out;
  });

  await b.close();

  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const checks = [
    ['#9 les deux enquêtes écrites',        eq(r.after1, ['A:1', 'B:1'])],
    ['#9 modif A + retrait B répercutés',   eq(r.after2, ['A:2'])],
    ['#9 sauvegarde sans changement cohérente', eq(r.after3, ['A:2'])],
    ['#4 ordre manquant reste vide',        r.ordreVide === true],
  ];
  let ok = true;
  for (const [name, pass] of checks) { console.log((pass ? '✓ PASS ' : '✗ FAIL ') + name); if (!pass) ok = false; }
  if (perr.length) { console.log('PAGEERRORS:', perr); ok = false; }
  console.log(ok ? '\nTOUS LES TESTS PASSENT' : '\nÉCHEC');
  process.exit(ok ? 0 : 1);
})();
