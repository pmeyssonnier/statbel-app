/*
 * js/ui/map.js — Carte Leaflet : initialisation, fond de tuiles (régional/OSM),
 * géolocalisation « ma position », placement des marqueurs de contacts avec file
 * de géocodage annulable, légende et actions depuis les popups. Extrait de app.js.
 *
 * Imports : esc, regionPourCP (util) ; t (i18n) ; statutLabel (canon) ;
 * coordsCache, saveCoords (idb). L (Leaflet), settings, GEO, vueActive et les
 * fonctions applicatives (contactsFiltres, statutDef(s)/Defaut, changerStatut,
 * ouvrirEdit, rendu, afficherToast, formatDist/haversine, mapsUrl) sont globaux.
 * L'état carte (leafletMap, markersLayer, baseLayer, maPosition, markerMoi,
 * _geoSession, _fondActuel) est déclaré ici sur globalThis (partagé avec app.js).
 */
import { esc, regionPourCP } from '../core/util.js';
import { t } from '../core/i18n.js';
import { statutLabel } from '../data/canon.js';
import { coordsCache, saveCoords } from '../data/idb.js';



globalThis.maPosition = null;
globalThis.markerMoi  = null;
globalThis.leafletMap   = null;
globalThis.markersLayer = null;
globalThis.baseLayer    = null;
globalThis._geoSession  = 0;   // jeton d'annulation des files de géocodage
globalThis._fondActuel = null;

export function toggleMaPosition() {
  const btn = document.getElementById('btnGeo');
  if (maPosition) {
    maPosition=null;
    if (markerMoi && leafletMap) leafletMap.removeLayer(markerMoi);
    markerMoi=null; btn.classList.remove('active'); btn.textContent='🎯'; btn.title='Ma position';
    rendu(); return;
  }
  if (!navigator.geolocation) { afficherToast(t('toast_geo_unsupported'),4000); return; }
  if (navigator.permissions) {
    navigator.permissions.query({name:'geolocation'}).then(r => {
      if (r.state==='denied') { afficherToast(t('toast_geo_blocked'),6000); return; }
      demanderPosition(btn);
    }).catch(()=>demanderPosition(btn));
  } else demanderPosition(btn);
}

export function demanderPosition(btn) {
  btn.textContent='⏳'; btn.title='Localisation en cours...';
  navigator.geolocation.getCurrentPosition(
    pos => {
      maPosition={lat:pos.coords.latitude,lng:pos.coords.longitude};
      btn.textContent='🎯'; btn.classList.add('active'); btn.title='Position active';
      afficherToast(t('toast_geo_ok'),2000);
      if (vueActive==='carte') { placerMarqueurMoi(); afficherMarqueurs(); }
      rendu();
    },
    err => {
      btn.textContent='🎯'; btn.classList.remove('active'); btn.title=t('title_mypos');
      const msgs={1:t('geo_err_1'),2:t('geo_err_2'),3:t('geo_err_3')};
      afficherToast(msgs[err.code]||(t('geo_err')+err.code),6000);
    },
    {enableHighAccuracy:true,timeout:15000,maximumAge:30000}
  );
}

export function placerMarqueurMoi() {
  if (!leafletMap||!maPosition) return;
  if (markerMoi) leafletMap.removeLayer(markerMoi);
  markerMoi = L.marker([maPosition.lat,maPosition.lng],{
    icon:L.divIcon({className:'',html:'<div class="marker-moi"></div>',iconSize:[20,20],iconAnchor:[10,10],popupAnchor:[0,-14]}),
    zIndexOffset:1000
  }).addTo(leafletMap).bindPopup('<div style="font-weight:bold;color:#1a73e8;">📍 Ma position</div>');
}

export function recentrerCarte() {
  if (!leafletMap||!markersLayer) return;
  leafletMap.invalidateSize();   // recalcule la taille (corrige tuiles grises sur mobile)
  const bounds = markersLayer.getLayers().filter(l=>l.getLatLng).map(l=>l.getLatLng());
  if (bounds.length===1) leafletMap.setView(bounds[0],16);
  else if (bounds.length>1) leafletMap.fitBounds(L.latLngBounds(bounds),{padding:[40,40],maxZoom:16});
}

export function changerStatutCarte(idx, val) { changerStatut(idx,val); if (markersLayer) afficherMarqueurs(); }

export function ouvrirFicheDepuisCarte(idx) {
  setView('liste');
  setTimeout(()=>{ const el=ouvrirEdit(idx); if(el) el.scrollIntoView({behavior:'smooth',block:'center'}); },150);
}

export function renderLegend() {
  const el = document.getElementById('mapLegend');
  if (!el) return;
  el.innerHTML = statutDefs().map(s =>
    `<div class="leg-item"><div class="leg-dot" style="background:${s.color}"></div> ${esc(statutLabel(s.label))}</div>`
  ).join('') +
    `<div class="leg-item"><div class="leg-dot" style="background:#1a73e8;box-shadow:0 0 0 3px rgba(26,115,232,0.3)"></div> ${t('title_mypos')}</div>`;
}

export function initCarte() {
  if (!leafletMap) {
    leafletMap = L.map('map',{wheelPxPerZoomLevel:120,wheelDebounceTime:100}).setView([50.8670,4.3800],14);
    const F = fondEffectif();
    baseLayer = L.tileLayer(F.tileUrl(settings.mapStyle),{attribution:F.tileAttribution,maxZoom:F.maxZoom}).addTo(leafletMap);
    _fondActuel = F;
    markersLayer = L.layerGroup().addTo(leafletMap);
  }
  renderLegend();
  afficherMarqueurs();
  if (maPosition) placerMarqueurMoi();
  // Mobile : la hauteur du conteneur peut changer (barre d'adresse) → recalcul
  setTimeout(() => leafletMap.invalidateSize(), 250);
}

export function afficherMarqueurs() {
  // Mode auto : le fond peut changer si l'enquête active relève d'une autre région
  if (settings.provider === 'auto' && fondEffectif() !== _fondActuel) rafraichirFond();
  markersLayer.clearLayers();
  const all = contactsFiltres();
  if (all.filter(c=>!coordsCache(c.adresse)).length > 0)
    document.getElementById('geocodeProgress').style.display = 'block';

  function placerMarqueur(c, lat, lng) {
    const statut = c.statut||statutDefaut();
    const def    = statutDef(statut);
    const icon   = L.divIcon({className:'',html:`<div class="marker-pin" style="background:${def.color}"><span>${esc(c.ordre)}</span></div>`,iconSize:[30,30],iconAnchor:[15,30],popupAnchor:[0,-32]});
    const idx    = enquetes[enqueteActive].indexOf(c);
    const gsm    = c.gsm   ? `<div style="margin-top:5px">📞 <a href="tel:${esc(c.gsm)}" style="color:#1a73e8;text-decoration:none;">${esc(c.gsm)}</a></div>` : '';
    const email  = c.email ? `<div style="margin-top:3px">✉️ <a href="mailto:${esc(c.email)}" style="color:#1a73e8;text-decoration:none;">${esc(c.email)}</a></div>` : '';
    let distPopup='';
    if (maPosition) {
      const cd=coordsCache(c.adresse);
      if (cd) distPopup='<div style="margin-top:5px"><span style="background:#e3f2fd;color:#1a73e8;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;">🚶 '+formatDist(haversine(maPosition.lat,maPosition.lng,cd.lat,cd.lng))+'</span></div>';
    }
    const demo = ligneDemographie(c);
    const dateStatut = (c.rdv && def.rdv) ? '📅 ' + formatRdv(c.rdv) : (c.date ? formatDateJour(c.date) : '');
    const popup=`
      <div class="popup-titre">N° ${esc(c.ordre)} — ${esc(c.prenom)} ${esc(c.nom)}</div>
      ${demo ? `<div style="font-size:12px;color:#666;margin-bottom:4px">👤 ${demo}</div>` : ''}
      <a href="${mapsUrl(c.adresse)}" target="_blank" style="color:#1a73e8;text-decoration:none;font-size:13px;">📍 ${esc(c.adresse)}</a>
      ${distPopup}${gsm}${email}
      <div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span class="s-btn actif" style="color:${def.color};border-color:${def.color};background:${def.color}22;cursor:default;opacity:1">${esc(def.icon)} ${esc(statutLabel(statut))}</span>
        ${dateStatut ? `<span style="font-size:12px;color:#666">${esc(dateStatut)}</span>` : ''}
      </div>
      <div style="margin-top:8px"><button onclick="ouvrirFicheDepuisCarte(${idx})" style="width:100%;padding:8px;background:#1a237e;color:white;border:none;border-radius:8px;font-size:13px;cursor:pointer;">🖊️ Éditer la fiche</button></div>`;
    // Largeur du popup adaptée à l'écran (téléphone/tablette)
    const vw = window.innerWidth || 360;
    const popMax = Math.min(340, vw - 40);
    const popMin = Math.min(280, popMax);
    L.marker([lat,lng],{icon}).addTo(markersLayer).bindPopup(popup,{maxWidth:popMax,minWidth:popMin});
  }

  function zoomSurMarqueurs() {
    const bounds=markersLayer.getLayers().filter(l=>l.getLatLng).map(l=>l.getLatLng());
    if (bounds.length===1) leafletMap.setView(bounds[0],16);
    else if (bounds.length>1) leafletMap.fitBounds(L.latLngBounds(bounds),{padding:[40,40],maxZoom:16});
  }

  // Jeton de session : tout réaffichage (changement d'enquête, de filtre…)
  // invalide la file de géocodage précédente pour éviter une boucle fantôme.
  const session = ++_geoSession;

  const queue=[];
  all.forEach(c=>{ const cc=coordsCache(c.adresse); if(cc) placerMarqueur(c,cc.lat,cc.lng); else queue.push(c); });
  if (markersLayer.getLayers().length>0) zoomSurMarqueurs();

  let qi=0;
  function nextGeocode() {
    if (session!==_geoSession) return;   // session annulée : on arrête l'ancienne boucle
    if (qi>=queue.length){ document.getElementById('geocodeProgress').style.display='none'; zoomSurMarqueurs(); return; }
    const c=queue[qi++];
    document.getElementById('geocodeCount').textContent=qi+' / '+queue.length;
    GEO.geocode(c.adresse).then(coords=>{
      if (session!==_geoSession) return; // résultat obsolète : on l'ignore
      if(coords){ saveCoords(c.adresse,coords.lat,coords.lng); placerMarqueur(c,coords.lat,coords.lng); zoomSurMarqueurs(); }
      setTimeout(nextGeocode,300);
    });
  }
  nextGeocode();
}

// Région majoritaire des contacts affichés (mode auto) — détermine le fond.
export function regionDominante() {
  const arrs = (enqueteActive && enquetes[enqueteActive])
    ? [enquetes[enqueteActive]] : Object.values(enquetes);
  const cpt = {};
  arrs.forEach(a => a.forEach(c => {
    const m = (parseAdresse(c.adresse).cpville || '').match(/\d{4}/);
    const r = regionPourCP(m ? m[0] : '');
    cpt[r] = (cpt[r] || 0) + 1;
  }));
  let best = 'bruxelles', n = -1;
  Object.entries(cpt).forEach(([r, v]) => { if (v > n) { n = v; best = r; } });
  return best;
}

// Fond de carte « plan de rue » universel (OpenStreetMap), couvre toute la
// Belgique. Les tuiles ne contiennent que l'image de la carte (pas de donnée
// personnelle) → conforme RGPD. Utilisé pour le fond en mode auto.
export const FOND_OSM = {
  tileUrl: function() { return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'; },
  tileAttribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
  maxZoom: 19
};

// Fond de carte effectif : en mode auto, on affiche un plan de rue OSM unique
// pour toutes les régions (le géocodage, lui, reste routé par région).
export function fondEffectif() {
  if (settings.provider !== 'auto') return GEO;
  return FOND_OSM;
}

export function rafraichirFond() {
  if (!leafletMap) return;
  const F = fondEffectif();
  if (baseLayer) leafletMap.removeLayer(baseLayer);
  baseLayer = L.tileLayer(F.tileUrl(settings.mapStyle),
    { attribution: F.tileAttribution, maxZoom: F.maxZoom }).addTo(leafletMap);
  _fondActuel = F;
}
