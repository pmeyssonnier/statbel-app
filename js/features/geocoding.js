/*
 * js/features/geocoding.js — Fournisseurs de carte/géocodage régionaux
 * (GEO_PROVIDERS : fond de tuiles + géocodage adresse→coordonnées pour
 * Bruxelles/UrbIS, Wallonie/SPW, Flandre/Geopunt, OSM, et mode auto par code
 * postal) et changement de fournisseur. Extrait de js/app.js (modules ES).
 *
 * Imports : regionPourCP, adresseSansBoite, parseAdresse (util). GEO (provider
 * courant, mutable) et les actions (saveSettings, majSettingsUI, rafraichirFond)
 * sont des globaux (pont / globalThis).
 */
import { regionPourCP, adresseSansBoite, parseAdresse } from '../core/util.js';



export const GEO_PROVIDERS = {

  // Mode automatique : route chaque adresse vers le bon géocodeur régional
  // selon son code postal. Fond de carte IGN/NGI (couvre toute la Belgique).
  auto: {
    label: 'Automatique (selon le code postal)',
    tileAttribution: '© <a href="https://www.ngi.be" target="_blank">IGN/NGI</a> · géocodage UrbIS / SPW / Geopunt',
    maxZoom: 17,
    tileUrl: function() {
      return 'https://cartoweb.wmts.ngi.be/1.0.0/topo/default/3857/{z}/{y}/{x}.png';
    },
    geocode: function(adresse) {
      const cpm = (parseAdresse(adresse).cpville || '').match(/\d{4}/);
      const region = regionPourCP(cpm ? cpm[0] : '');
      return GEO_PROVIDERS[region].geocode(adresse);
    }
  },

  // Région de Bruxelles-Capitale — service public régional (CIRB / UrbIS).
  // Données belges, hébergées en Belgique, pas de transfert hors UE.
  bruxelles: {
    label: 'Bruxelles (UrbIS — CIRB)',
    tileAttribution: '© <a href="https://cirb.brussels" target="_blank">UrbIS® — CIRB</a>',
    maxZoom: 19,
    // style : 'gray' (sobre) ou 'color' (couleur)
    tileUrl: function(style) {
      const layer = style === 'color' ? 'urbisFR' : 'urbisFRGray';
      return 'https://geoservices-urbis.irisnet.be/geowebcache/service/wmts/rest/'
           + layer + '/default/EPSG:900913/EPSG:900913:{z}/{y}/{x}?format=image/png';
    },
    geocode: function(adresse) {
      const base = 'https://geoservices.irisnet.be/localization/Rest/Localize/getaddresses'
                 + '?language=fr&spatialReference=4326&address=';
      const q = adresseSansBoite(adresse);
      // Tolérance aux accents / mauvais encodage : on réessaie sans diacritiques,
      // puis en ne gardant que l'ASCII (corrige « â » cassé, mojibake, etc.)
      const sansAccent = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
      const variantes = [...new Set([
        q,
        sansAccent(q),
        q.replace(/[^\x00-\x7F]/g, '')
      ])];
      function essai(i) {
        if (i >= variantes.length) return Promise.resolve(null);
        return fetch(base + encodeURIComponent(variantes[i]))
          .then(r => r.json())
          .then(data => {
            const r0 = data && !data.error && data.result && data.result[0];
            if (r0 && r0.point && (r0.score === undefined || r0.score >= 50))
              return { lat: r0.point.y, lng: r0.point.x };
            return essai(i + 1);
          })
          .catch(() => essai(i + 1));
      }
      return essai(0);
    }
  },

  // Région wallonne — géocodage SPW (ICAR) + fond de carte IGN/NGI Cartoweb.
  // Deux services publics belges, hébergés en Belgique, pas de transfert hors UE.
  wallonie: {
    label: 'Wallonie (SPW + IGN)',
    tileAttribution: '© <a href="https://www.ngi.be" target="_blank">IGN/NGI</a> · géocodage © SPW',
    maxZoom: 17,
    tileUrl: function() {
      return 'https://cartoweb.wmts.ngi.be/1.0.0/topo/default/3857/{z}/{y}/{x}.png';
    },
    geocode: function(adresse) {
      const url = 'https://geoservices.wallonie.be/geocodeWS/geocode'
                + '?geom=true&crs=EPSG:4326&address=' + encodeURIComponent(adresseSansBoite(adresse));
      return fetch(url).then(r => r.json()).then(d => {
        const cand = d && d.candidates && d.candidates[0];
        if (!cand) return null;
        const g = (cand.house && cand.house.geometry)
               || (cand.street && cand.street.geometry) || cand.geometry;
        return (g && g.coordinates) ? { lat: g.coordinates[1], lng: g.coordinates[0] } : null;
      }).catch(() => null);
    }
  },

  // Région flamande — géocodage Geopunt (Informatie Vlaanderen) + fond IGN/NGI.
  // Deux services publics belges, hébergés en Belgique, pas de transfert hors UE.
  flandre: {
    label: 'Flandre (Geopunt + IGN)',
    tileAttribution: '© <a href="https://www.ngi.be" target="_blank">IGN/NGI</a> · géocodage © Geopunt',
    maxZoom: 17,
    tileUrl: function() {
      return 'https://cartoweb.wmts.ngi.be/1.0.0/topo/default/3857/{z}/{y}/{x}.png';
    },
    geocode: function(adresse) {
      const url = 'https://geo.api.vlaanderen.be/geolocation/v4/Location?c=1&q='
                + encodeURIComponent(adresseSansBoite(adresse));
      return fetch(url).then(r => r.json()).then(d => {
        const r0 = d && d.LocationResult && d.LocationResult[0];
        const loc = r0 && r0.Location;
        return (loc && loc.Lat_WGS84 && loc.Lon_WGS84)
          ? { lat: loc.Lat_WGS84, lng: loc.Lon_WGS84 } : null;
      }).catch(() => null);
    }
  },

  // Reste de la Belgique / usage générique — OpenStreetMap + Nominatim.
  // ⚠️ Moins conforme RGPD (tiers hors UE) : à n'utiliser que faute de mieux.
  osm: {
    label: 'Belgique générique (OpenStreetMap + Nominatim)',
    tileAttribution: '© OpenStreetMap',
    maxZoom: 19,
    tileUrl: function() { return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'; },
    geocode: function(adresse) {
      const { rue, cpville } = parseAdresse(adresse);
      const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q='
                + encodeURIComponent(rue + ', ' + cpville + ', Belgique');
      return fetch(url).then(r => r.json()).then(d =>
        (d && d[0]) ? { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) } : null
      ).catch(() => null);
    }
  }

};

export function changerProvider(val) {
  settings.provider = val;
  GEO = GEO_PROVIDERS[val] || GEO_PROVIDERS.bruxelles;
  saveSettings();
  majSettingsUI();
  rafraichirFond();
}
