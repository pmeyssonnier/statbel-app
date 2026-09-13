# Chantier — Dé-globalisation des handlers `onclick` (Interviews)

> Plan de chantier. **Aucun code n'est modifié tant qu'un lot n'est pas explicitement lancé.**
> Document de référence : ordre des lots, motif technique retenu, tests par lot, critère de fin.

## 1. Objectif

Supprimer **tous les handlers HTML inline** (`onclick=`, `onchange=`, `oninput=`, `onkeydown=`)
de l'app Interviews (`index.html` + modules `js/**`) et les remplacer par de la **délégation
d'événements** en JavaScript.

Trois bénéfices, liés à la même racine :

1. **Le pont `window` fond** — les fonctions n'ont plus besoin d'être exposées au global juste
   pour être atteignables depuis un attribut HTML.
2. **La CSP peut se durcir** — une fois **zéro** `on*=` inline, on retire `'unsafe-inline'` de
   `script-src` (dernier lot).
3. **Testabilité** — les actions deviennent des fonctions de module normales, câblées par un
   routeur central testable.

### Non-objectifs (hors périmètre)

- Aucun changement de **comportement visible** ni de design.
- Ne **pas** toucher au Convertisseur ni au Planner (mono-fichiers `file://`, contrainte volontaire).
- Ne pas réécrire la logique métier des actions — seulement leur **câblage** (comment elles sont
  déclenchées).

## 2. Ampleur mesurée (2026-09-13)

**111 handlers inline** : 59 statiques dans `index.html` + 52 générés dans les modules JS.
(Les ~9 affectations `el.onclick = …` en JS sont déjà sûres et hors périmètre.)

| Écran / zone | Statique | Généré (JS) | Total | Risque |
|---|---:|---:|---:|---|
| Réglages (modale) | 22 | 7 `settings.js` | 29 | **faible** (surtout `onchange` de `<select>`) |
| Fiches / liste de contacts | 0 | 28 `contacts.js` | 28 | **élevé** (actions par ligne, avec paramètres) |
| En-tête + barre d'outils + bascule de vues | 18 | 2 `app.js` | 20 | moyen |
| Résumé | 0 | 8 `resume.js` + 2 `stats.js` | 10 | moyen |
| Carte + chrome zone principale | 5 | 1 `map.js` | 6 | faible |
| Modales diverses (Nouvelle enquête, Renommer, Sauvegarde, PIN, Aide) | 14 | 0 | 14 | faible |
| Suivi / RDV | 0 | 3 `rdv.js` | 3 | faible |
| Import (contenu modale) | 0 | 1 `import.js` | 1 | faible |
| **Total** | **59** | **52** | **111** | |

## 3. Motif technique retenu — routeur de délégation

Un **routeur central** installe **une seule fois** des écouteurs délégués (`click`, `change`,
`input`) sur `document`. Chaque écouteur remonte au plus proche élément portant un attribut
`data-act` et appelle l'action enregistrée, en lui passant l'élément (d'où il lit ses `data-*`).

### Nouveau module `js/core/actions.js` (à créer au lot 1)

```js
// Registre d'actions + délégation d'événements. Installé une fois par init().
const _actions = { click: {}, change: {}, input: {} };

export function registerActions(type, map) { Object.assign(_actions[type], map); }

export function installerDelegation() {
  const relai = type => e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = _actions[type][el.dataset.act];
    if (fn) fn(el, e);
  };
  document.addEventListener('click',  relai('click'));
  document.addEventListener('change', relai('change'));
  document.addEventListener('input',  relai('input'));
}
```

### Convention côté HTML / templates

Avant :
```html
<button onclick="supprimerContact(3)">🗑️</button>
<select onchange="setLang(this.value)">…</select>
```

Après :
```html
<button data-act="supprimerContact" data-id="3">🗑️</button>
<select data-act="setLang">…</select>
```

### Câblage côté module (exemple `contacts.js`)

```js
registerActions('click', {
  supprimerContact: el => supprimerContact(el.dataset.id),
  editerContact:    el => ouvrirEdit(el.dataset.id),
  // …
});
registerActions('change', { setLang: el => setLang(el.value) });
```

**Points de convention à respecter :**

- Les **paramètres** passent par `data-*` (`data-id`, `data-ordre`, `data-key`…), jamais concaténés
  dans du code — c'est ce qui permet de supprimer l'inline.
- `esc()` reste obligatoire sur toute valeur injectée dans un `data-*` généré (cohérent avec
  l'invariant du dépôt).
- Les actions restent des **exports de module** normaux ; le registre les référence directement
  (closure) → plus besoin du pont `window` pour elles.
- Les affectations `el.onclick = () => fn()` déjà présentes (ex. pavé PIN dans `pin.js`) sont
  **déjà conformes** (pas d'inline HTML) : on peut les laisser, ou les rallier au registre par
  cohérence, sans urgence.

### Alternative écartée

« Garder les fonctions globales et juste déplacer le binding en JS » : retire l'inline mais **ne
réduit pas** le pont `window`. Le routeur avec registre atteint les deux objectifs à la fois — on
le retient.

## 4. Découpage en lots (ordre d'exécution)

Chaque lot = **une PR dédiée**, avec son test, son rituel de version, sa passe `/simplify`.
Ordre choisi : **du plus sûr au plus dense**, pour roder le motif avant d'attaquer `contacts.js`,
et **le durcissement CSP en tout dernier**.

| Lot | Contenu | Fichiers | Handlers | Pourquoi ici |
|---|---|---|---|---|
| **0** | Créer `js/core/actions.js` + `installerDelegation()` dans `init()`. Aucun handler migré encore (le routeur coexiste avec les `onclick`). | `js/core/actions.js` (neuf), `js/app.js`, `sw.js` (APP_CRITICAL) | 0 | Pose l'infrastructure isolément, testable seule. |
| **1** | **Réglages** (le plus facile, surtout `onchange`) | `index.html`, `js/ui/settings.js` | 29 | Rode le motif sur des cas simples et nombreux. |
| **2** | **En-tête + barre d'outils + bascule de vues + modales diverses** | `index.html`, `js/app.js` | 34 | Chrome statique, faible risque. |
| **3** | **Carte** + **RDV** + **Import** | `js/ui/map.js`, `js/ui/rdv.js`, `js/features/import.js`, `index.html` | 10 | Petits écrans, peu de paramètres. |
| **4** | **Résumé** | `js/ui/resume.js`, `js/ui/stats.js` | 10 | Filtres/bascules, complexité moyenne. |
| **5** | **Fiches / liste de contacts** | `js/ui/contacts.js` | 28 | Le plus dense et le plus risqué — fait en dernier, motif déjà éprouvé. |
| **6** | **Durcissement CSP** : retirer `'unsafe-inline'` de `script-src` + test anti-régression « zéro `on*=` inline ». Élaguer les entrées du pont `window` devenues inutiles. | `index.html` (méta CSP), `js/app.js` (pont), `tests/` | 0 | Ne peut se faire qu'après le lot 5 (un seul inline oublié casserait tout). |

> Les lots 1→5 peuvent être **réordonnés ou fusionnés** selon l'appétit du moment, à une exception
> près : **le lot 6 (CSP) est toujours dernier**.

## 5. Tests — par lot et garde-fou final

**Par lot (1→5)** : un test navigateur qui, pour chaque écran migré, vérifie **« clic → l'action
se produit »** (l'effet observable : la fiche disparaît, le `<select>` applique la langue, la vue
change…). Beaucoup de ces écrans ont **déjà** un test (`contacts.test.js`, `resume.test.js`,
`statut-*.test.js`, `converter-*`…) : on **étend l'existant** plutôt que d'en créer, en s'assurant
que l'action passe bien par la délégation (et non par un `onclick` résiduel).

**Test du routeur (lot 0)** : un test **pur** de `actions.js` — enregistrement, dispatch vers la
bonne action, passage de l'élément, `data-*` lus correctement, action inconnue ignorée sans erreur.

**Garde-fou final (lot 6)** — le feu vert CSP :

```js
// Aucun handler inline ne doit subsister dans le HTML SERVI (statique + généré).
// 1) index.html : 0 occurrence de on<event>="
// 2) DOM après rendu complet de chaque vue : querySelectorAll('*') → aucun attribut on*
```

Tant que ce test n'est pas vert, **on ne retire pas** `'unsafe-inline'`.

## 6. Rituel de version (rappel, à chaque lot)

- Bumper `APP_VERSION` (`js/app.js`) **et** `CACHE` (`sw.js`) dans le même commit.
- Tout nouveau fichier servi (ex. `js/core/actions.js` au lot 0) → l'ajouter à `APP_CRITICAL`.
- Entrée `CHANGELOG.md`.
- `node tools/check-version-bump.js origin/main` vert avant push.

## 7. Risques & mitigations

| Risque | Mitigation |
|---|---|
| Un bouton cesse de réagir en silence (action mal enregistrée) | Test « clic → effet » par écran ; revue visuelle rapide au navigateur. |
| Un `onclick` appelle une fonction encore utilisée ailleurs | On ne retire du pont `window` **que** les symboles sans autre usage, et **seulement au lot 6**, vérifié contre la suite de tests (certains tests appellent des globals). |
| Valeur injectée non échappée dans un `data-*` | `esc()` systématique, comme pour tout contenu DOM (invariant dépôt). |
| Événements sur éléments recréés au rendu | La délégation sur `document` couvre nativement les éléments **futurs** — c'est justement un avantage sur `onclick` (pas de re-binding après re-render). |
| Régression entre deux lots (état intermédiaire) | Le routeur **coexiste** avec les `onclick` restants tant que tout n'est pas migré ; chaque lot est autonome et livrable. |

## 8. Estimation

- **7 lots** (0 → 6), chacun une PR courte et autonome.
- Effort concentré sur le **lot 5** (`contacts.js`, 28 handlers paramétrés).
- **Nature du gain** : maintenabilité + sécurité (CSP durcie), **pas** une fonctionnalité pour
  l'enquêteur. À faire seulement si ce gain justifie l'effort étalé.

## 9. Critère de « chantier terminé »

1. `grep -rE 'on(click|change|input|submit|keyup|keydown)="' index.html js/` → **0** résultat.
2. Test garde-fou (DOM rendu, toutes vues) → **0** attribut `on*`.
3. CSP `script-src` **sans** `'unsafe-inline'` ; app fonctionnelle au navigateur, 0 erreur console.
4. Pont `window` élagué des symboles n'ayant plus ni inline ni test qui les appelle.
5. Suite complète verte ; rituel de version respecté.
