/*
 * Test unitaire PUR — js/core/actions.js (routeur de délégation).
 *
 * Aucun navigateur : on teste la logique de dispatch via `_dispatch`, avec des
 * « éléments » simulés ({ dataset: {...} }) — la partie DOM (`installerDelegation`)
 * est un simple câblage d'écouteurs, couvert indirectement au navigateur quand
 * les premiers écrans seront migrés (lot 1+).
 *
 * Lancer :  node tests/actions.test.js
 */
let fails = 0;
const A = (cond, msg) => { if (!cond) { fails++; console.log('✗ FAIL ' + msg); } else console.log('✓ ' + msg); };

(async () => {
  const { registerActions, _dispatch, _resetActions } = await import('../js/core/actions.js');

  // ── dispatch vers la bonne action + passage de l'élément ────────────
  {
    _resetActions();
    let recu = null;
    registerActions('click', { supprimer: (el) => { recu = el.dataset.id; } });
    const ok = _dispatch('click', { dataset: { act: 'supprimer', id: '3' } });
    A(ok === true && recu === '3', 'dispatch : action trouvée, élément passé, data-* lisible');
  }

  // ── passage de l'événement en 2e argument ───────────────────────────
  {
    _resetActions();
    let vu = null;
    const evt = { type: 'click' };
    registerActions('click', { x: (el, e) => { vu = e; } });
    _dispatch('click', { dataset: { act: 'x' } }, evt);
    A(vu === evt, 'dispatch : événement transmis à l’action');
  }

  // ── action inconnue → ignorée sans erreur (coexistence avec onclick) ─
  {
    _resetActions();
    A(_dispatch('click', { dataset: { act: 'inconnue' } }) === false, 'dispatch : action inconnue ignorée (false)');
    A(_dispatch('click', { dataset: {} }) === false, 'dispatch : sans data-act ignoré (false)');
    A(_dispatch('click', null) === false, 'dispatch : élément absent ignoré (false)');
  }

  // ── séparation par type d'événement ─────────────────────────────────
  {
    _resetActions();
    let clic = 0, chg = 0;
    registerActions('click',  { m: () => clic++ });
    registerActions('change', { m: () => chg++ });
    _dispatch('change', { dataset: { act: 'm' } });
    A(chg === 1 && clic === 0, 'dispatch : le même nom est routé selon le type (change ≠ click)');
  }

  // ── registerActions complète sans écraser les autres actions ────────
  {
    _resetActions();
    registerActions('click', { a: () => 'A' });
    registerActions('click', { b: () => 'B' });   // 2e appel : fusion, pas remplacement
    A(_dispatch('click', { dataset: { act: 'a' } }) === true &&
      _dispatch('click', { dataset: { act: 'b' } }) === true, 'registerActions : appels successifs fusionnés');
  }

  console.log(fails ? `\nÉCHEC (${fails})` : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})();
