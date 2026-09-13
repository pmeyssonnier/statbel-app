/*
 * Test unitaire PUR — js/data/statuses.js (résolution des statuts par enquête).
 *
 * Aucun navigateur : import direct du module ES, appels avec état EXPLICITE (la
 * liste de statuts / la map par enquête sont passées en paramètres). Démontre le
 * découplage visé par R3 : la logique métier des statuts se teste sans app.
 *
 * Lancer :  node tests/statuses.test.js
 */
let fails = 0;
const A = (cond, msg) => { if (!cond) { fails++; console.log('✗ FAIL ' + msg); } else console.log('✓ ' + msg); };

(async () => {
  const { STATUTS_DEFAULTS, STATUT_COULEURS, cloneStatuts,
    resoudreStatuts, statutDefautDe, statutDefDe, semerStatutsParEnquete } =
    await import('../js/data/statuses.js');

  const glob = [{ label: 'To do' }, { label: 'Done' }];
  const parEnq = { A: [{ label: 'X' }, { label: 'Y' }] };

  // resoudreStatuts : liste propre si définie et non vide, sinon repli global
  A(resoudreStatuts(glob, parEnq, 'A') === parEnq.A, 'resoudreStatuts : liste propre de l\'enquête');
  A(resoudreStatuts(glob, parEnq, 'B') === glob,    'resoudreStatuts : repli global si enquête absente');
  A(resoudreStatuts(glob, { A: [] }, 'A') === glob,  'resoudreStatuts : repli global si liste propre vide');
  A(resoudreStatuts(glob, parEnq, null) === glob,   'resoudreStatuts : repli global si aucun nom');
  A(resoudreStatuts(glob, undefined, 'A') === glob, 'resoudreStatuts : repli global si map absente');

  // statutDefautDe : premier label, repli « To do »
  A(statutDefautDe([{ label: 'X' }, { label: 'Y' }]) === 'X', 'statutDefautDe : premier statut');
  A(statutDefautDe([]) === 'To do',   'statutDefautDe : liste vide → To do');
  A(statutDefautDe(null) === 'To do', 'statutDefautDe : null → To do');

  // statutDefDe : correspondance exacte, sinon premier, sinon repli neutre
  const arr = [{ label: 'To do', color: '#111' }, { label: 'Done', color: '#222' }];
  A(statutDefDe(arr, 'Done').color === '#222', 'statutDefDe : correspondance exacte');
  A(statutDefDe(arr, 'Zzz') === arr[0],        'statutDefDe : inconnu → premier de la liste');
  const repli = statutDefDe([], 'Zzz');
  A(repli.label === 'Zzz' && repli.color === '#90a4ae', 'statutDefDe : liste vide → repli neutre');

  // semerStatutsParEnquete : idempotent, clone profond, true au 1er semis
  const map = {};
  const chg1 = semerStatutsParEnquete(map, glob, ['A', 'B']);
  A(chg1 === true && map.A.length === 2 && map.B.length === 2, 'semer : 1er semis peuple A et B (true)');
  A(map.A !== glob && map.A[0] !== glob[0], 'semer : clone profond (références distinctes)');
  A(semerStatutsParEnquete(map, glob, ['A', 'B']) === false, 'semer : 2e passe idempotente (false)');
  const chg3 = semerStatutsParEnquete(map, glob, ['A', 'C']);
  A(chg3 === true && !!map.C, 'semer : nouvelle enquête ajoutée (true)');

  // cloneStatuts / constantes
  A(cloneStatuts().length === STATUTS_DEFAULTS.length && cloneStatuts()[0] !== STATUTS_DEFAULTS[0],
    'cloneStatuts : copie indépendante du modèle');
  A(STATUT_COULEURS['To do'] === '#90a4ae', 'STATUT_COULEURS : palette présente');

  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
