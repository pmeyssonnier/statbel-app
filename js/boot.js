/*
 * js/boot.js — Amorçage PWA autonome (enregistrement du Service Worker +
 * popup « Mise à jour disponible »). Extrait du <script> inline de index.html
 * pour permettre une CSP stricte (script-src 'self' sans 'unsafe-inline').
 *
 * Script CLASSIQUE (pas un module) et volontairement INDÉPENDANT de js/app.js :
 * il doit fonctionner même si le reste de l'app est en cache, pour que le popup
 * de mise à jour reste toujours proposable. Réexpose signalerMajDispo/poserMaj/
 * fermerMajDispo sur window (tests headless).
 */
  // PWA : actif uniquement quand l'app est servie en http(s) (ex. GitHub Pages).
  // En file:// on ne fait rien (service workers indisponibles, manifeste inutile).
  if (location.protocol === 'https:' || location.protocol === 'http:') {
    // Manifeste : injecté seulement si la page n'en déclare pas déjà un en statique.
    // (index.html laisse boot.js l'ajouter ; les mono-fichiers Convertisseur/Planner,
    // qui réutilisent ce script pour le popup de mise à jour, ont un <link rel="manifest">
    // statique → on évite un doublon.)
    if (!document.querySelector('link[rel="manifest"]')) {
      const m = document.createElement('link');
      m.rel = 'manifest'; m.href = 'manifest.webmanifest';
      document.head.appendChild(m);
    }
    // (apple-touch-icon est désormais déclaré en statique dans le <head>)
    if ('serviceWorker' in navigator) {
      // Mise à jour de la PWA installée en OPT-IN : quand une nouvelle version est
      // publiée, le nouveau SW s'installe mais reste « en attente » ; on affiche un
      // petit popup « Mise à jour disponible — Poser » et l'utilisateur choisit le
      // moment (pas de rechargement surprise en pleine saisie). Sans ce mécanisme,
      // le raccourci écran d'accueil continuerait de servir l'ancienne version.
      const avaitControleur = !!navigator.serviceWorker.controller;   // false au 1er install
      let rechargement = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Le SW en attente a pris la main (après « Poser » → SKIP_WAITING →
        // activate → clients.claim) : on recharge UNE fois pour servir les nouveaux
        // fichiers. Pas de rechargement au tout premier install (aucun contrôleur).
        if (rechargement || !avaitControleur) return;
        rechargement = true;
        window.location.reload();
      });
      // Popup « Mise à jour disponible » AUTONOME (ne dépend PAS de js/app.js).
      // Crucial : les sous-ressources JS/CSS sont servies « cache d'abord » par le
      // service worker → un app.js/base.css périmé resterait en cache. Si le popup
      // vivait dans app.js, un utilisateur bloqué sur une vieille version ne le
      // verrait jamais (app.js en cache sans le code du popup) → il ne cliquerait
      // jamais « Poser » → le SW ne s'activerait jamais → blocage. index.html est
      // rechargé frais (navigation réseau) : en y logeant le popup + ses styles
      // inline, il fonctionne quel que soit l'âge du cache.
      const MAJ_I18N = {
        fr:{d:'Mise à jour disponible',p:'OK',b:'…',l:'Plus tard'},
        nl:{d:'Update beschikbaar',p:'OK',b:'…',l:'Later'},
        en:{d:'Update available',p:'OK',b:'…',l:'Later'},
        de:{d:'Update verfügbar',p:'OK',b:'…',l:'Später'}
      };
      function majTxt() {
        let lang = 'fr';
        try { lang = (JSON.parse(localStorage.getItem('statbel_settings') || '{}').lang) || 'fr'; } catch (e) {}
        return MAJ_I18N[Object.prototype.hasOwnProperty.call(MAJ_I18N, lang) ? lang : 'fr'];
      }
      function poserMaj() {
        const b = document.querySelector('#majDispo .maj-poser');
        if (b) { b.disabled = true; b.textContent = majTxt().b; b.style.opacity = '0.7'; b.style.cursor = 'default'; }
        if (window.__swWaiting) window.__swWaiting.postMessage({ type: 'SKIP_WAITING' });
        // controllerchange (plus haut) rechargera la page une fois le SW actif.
      }
      function fermerMajDispo() {
        const d = document.getElementById('majDispo');
        if (d) d.remove();   // on garde __swWaiting : reproposé au prochain lancement
      }
      function signalerMajDispo() {
        if (!window.__swWaiting || document.getElementById('majDispo')) return;
        const T = majTxt();
        const sombre = document.body.classList.contains('dark');
        const d = document.createElement('div');
        d.id = 'majDispo'; d.setAttribute('role', 'status');
        d.style.cssText = 'position:fixed;left:50%;bottom:12px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;max-width:min(94vw,360px);padding:5px 6px 5px 12px;background:' + (sombre ? '#123a72' : '#0d47a1') + ';color:#fff;border-radius:9px;font-size:12px;box-shadow:0 4px 14px rgba(0,0,0,0.3);z-index:10000;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial,sans-serif';
        const ico = document.createElement('span');
        ico.className = 'maj-ico'; ico.setAttribute('aria-hidden', 'true'); ico.textContent = '⬆️';
        ico.style.cssText = 'font-size:16px;flex-shrink:0';
        const msg = document.createElement('span');
        msg.className = 'maj-msg'; msg.textContent = T.d; msg.style.cssText = 'flex:1;min-width:0;font-weight:600';
        const poser = document.createElement('button');
        poser.className = 'maj-poser'; poser.type = 'button'; poser.textContent = T.p;
        poser.style.cssText = 'background:#fff;color:#0d47a1;border:none;border-radius:7px;padding:5px 14px;font-size:12px;font-weight:700;cursor:pointer;min-height:30px;flex-shrink:0';
        poser.addEventListener('click', poserMaj);
        const later = document.createElement('button');
        later.className = 'maj-later'; later.type = 'button'; later.textContent = '✕';
        later.setAttribute('aria-label', T.l); later.title = T.l;
        later.style.cssText = 'background:transparent;border:none;color:#cfe0ff;cursor:pointer;font-size:13px;width:26px;height:26px;border-radius:6px;flex-shrink:0';
        later.addEventListener('click', fermerMajDispo);
        d.append(ico, msg, poser, later);
        document.body.appendChild(d);
      }
      // Exposé pour les tests headless (mêmes noms qu'avant, désormais autonomes).
      window.signalerMajDispo = signalerMajDispo;
      window.poserMaj = poserMaj;
      window.fermerMajDispo = fermerMajDispo;

      // Signale qu'une mise à jour est prête à poser → affiche le popup autonome.
      function majPrete(worker) {
        if (!worker) return;
        window.__swWaiting = worker;
        signalerMajDispo();
      }
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(reg => {
          // Un SW déjà en attente au chargement (mise à jour vue lors d'une visite
          // précédente et « Plus tard ») → reproposer le popup.
          if (reg.waiting && navigator.serviceWorker.controller) majPrete(reg.waiting);
          reg.addEventListener('updatefound', () => {
            const nv = reg.installing;
            if (!nv) return;
            nv.addEventListener('statechange', () => {
              // installé + un contrôleur existe déjà = vraie mise à jour (pas le
              // premier install) → prête à poser.
              if (nv.state === 'installed' && navigator.serviceWorker.controller) majPrete(nv);
            });
          });
          reg.update();                                   // check au démarrage
          setInterval(() => reg.update(), 60 * 60 * 1000); // + check horaire si l'app reste ouverte
          // PWA relancée depuis le cache : revérifier dès qu'elle revient au 1er plan.
          document.addEventListener('visibilitychange', () => {
            if (!document.hidden) reg.update();
          });
        }).catch(() => {});
      });
    }
  }
