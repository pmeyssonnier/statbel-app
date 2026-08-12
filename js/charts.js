/*
 * charts.js — petite bibliothèque de composants de visualisation, sans dépendance.
 *
 * Extraite du prototype « statbel dashboard » pour servir de langage visuel commun
 * aux trois apps (Interviews / Convertisseur / Planner). 100 % hors-ligne, aucun CDN,
 * compatible CSP (rendu SVG/HTML inline ; le tri de tableau attache ses écouteurs via
 * addEventListener, sans onclick inline).
 *
 * Thème : les couleurs de données sont passées en argument ; les couleurs de structure
 * (texte, lignes de grille) utilisent des tokens CSS avec repli, donc le composant
 * s'adapte au thème clair/sombre de chaque app sans configuration.
 *
 * API (exposée sur window.Charts) :
 *   sparkline(values, opts?)              → string SVG (mini-tendance)
 *   donut(items, opts?)                   → string HTML (anneau + légende latérale)
 *   lineChart(labels, series, opts?)      → string SVG (courbe multi-séries)
 *   table(container, cols, rows, opts?)   → rend un tableau triable au clic
 */
(function (root) {
  'use strict';

  var INK  = 'var(--chart-ink, var(--text, #0f172a))';
  var INK2 = 'var(--chart-ink-2, var(--text2, #64748b))';
  var INK3 = 'var(--chart-ink-3, var(--text3, #94a3b8))';
  var LINE = 'var(--chart-line, var(--border, #e5e9ef))';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // ── Sparkline : mini-courbe de tendance (pour une carte KPI) ──────────────
  function sparkline(values, opts) {
    opts = opts || {};
    var w = opts.w || 200, h = opts.h || 38, color = opts.color || 'var(--chart-ok, #2e9e5b)';
    var vals = (values || []).map(Number).filter(function (v) { return !isNaN(v); });
    if (!vals.length) return '';
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals), span = (max - min) || 1;
    var x = function (i) { return (i / (vals.length - 1 || 1)) * w; };
    var y = function (v) { return h - 2 - ((v - min) / span) * (h - 4); };
    var line = vals.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1); }).join(' ');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" '
      + 'style="width:100%;height:' + h + 'px;display:block;margin-top:6px" aria-hidden="true">'
      + '<path d="' + line + ' L' + w + ',' + h + ' L0,' + h + ' Z" fill="' + color + '" opacity=".12"/>'
      + '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2" '
      + 'stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }

  // ── Donut : anneau + légende latérale (valeur + %) + total au centre ──────
  // items : [{ label, value, color }]  opts : { size, thick, total, unitLabel, ariaLabel }
  function donut(items, opts) {
    opts = opts || {};
    items = (items || []).filter(function (it) { return it && it.value > 0; });
    var size = opts.size || 190, thick = opts.thick || 24;
    var sum = items.reduce(function (a, b) { return a + b.value; }, 0) || 1;
    var r = (size - thick) / 2, c = size / 2, circ = 2 * Math.PI * r, off = 0;
    var arcs = items.map(function (it) {
      var len = it.value / sum * circ;
      var seg = '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="' + (it.color || INK3) + '" '
        + 'stroke-width="' + thick + '" stroke-dasharray="' + len.toFixed(2) + ' ' + (circ - len).toFixed(2) + '" '
        + 'stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 ' + c + ' ' + c + ')"/>';
      off += len; return seg;
    }).join('');
    var mid = opts.total == null ? '' :
      '<text x="' + c + '" y="' + (c + 2) + '" text-anchor="middle" font-size="22" font-weight="700" fill="' + INK + '">' + esc(opts.total) + '</text>'
      + (opts.unitLabel ? '<text x="' + c + '" y="' + (c + 20) + '" text-anchor="middle" font-size="10" fill="' + INK2 + '">' + esc(opts.unitLabel) + '</text>' : '');
    var legend = items.map(function (it) {
      return '<li style="display:flex;align-items:center;gap:8px">'
        + '<span style="width:9px;height:9px;border-radius:2px;background:' + (it.color || INK3) + ';flex-shrink:0"></span>'
        + '<span style="color:' + INK2 + ';flex:1">' + esc(it.label) + '</span>'
        + '<strong>' + esc(it.value) + '</strong>'
        + '<span style="color:' + INK3 + '">' + (it.value / sum * 100).toFixed(0) + '%</span></li>';
    }).join('');
    return '<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">'
      + '<svg viewBox="0 0 ' + size + ' ' + size + '" style="width:' + size + 'px;max-width:100%" role="img" aria-label="' + esc(opts.ariaLabel || 'répartition') + '">' + arcs + mid + '</svg>'
      + '<ul style="list-style:none;margin:0;padding:0;font-size:12px;display:grid;gap:8px;flex:1;min-width:150px">' + legend + '</ul></div>';
  }

  // ── Courbe multi-séries (réalisé cumulé vs objectif…) ─────────────────────
  // series : [{ label, data:[...], color, dash? }]
  function lineChart(labels, series, opts) {
    opts = opts || {};
    labels = labels || []; series = series || [];
    var w = opts.w || 640, h = opts.h || 250, fmt = opts.fmt || function (v) { return v; };
    var pad = { t: 24, r: 12, b: 26, l: 40 }, iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    var all = series.reduce(function (a, s) { return a.concat(s.data || []); }, []);
    var max = (Math.max.apply(null, all.length ? all : [0]) * 1.1) || 1, min = 0;
    var x = function (i) { return pad.l + (i / (labels.length - 1 || 1)) * iw; };
    var y = function (v) { return pad.t + ih - ((v - min) / (max - min || 1)) * ih; };
    var ticks = [0, 1, 2, 3, 4].map(function (k) { return min + k * (max - min) / 4; });
    var grid = ticks.map(function (tk) {
      return '<line x1="' + pad.l + '" y1="' + y(tk).toFixed(1) + '" x2="' + (w - pad.r) + '" y2="' + y(tk).toFixed(1) + '" stroke="' + LINE + '"/>'
        + '<text x="' + (pad.l - 8) + '" y="' + (y(tk) + 4).toFixed(1) + '" text-anchor="end" font-size="10" fill="' + INK2 + '">' + esc(fmt(Math.round(tk))) + '</text>';
    }).join('');
    var paths = series.map(function (s) {
      var d = (s.data || []).map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1); }).join(' ');
      var dots = (s.data || []).map(function (v, i) { return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="3" fill="' + s.color + '"/>'; }).join('');
      return '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="2.2" stroke-linejoin="round" ' + (s.dash ? 'stroke-dasharray="5 4"' : '') + '/>' + dots;
    }).join('');
    var xlab = labels.map(function (l, i) { return '<text x="' + x(i).toFixed(1) + '" y="' + (h - 8) + '" text-anchor="middle" font-size="10" fill="' + INK2 + '">' + esc(l) + '</text>'; }).join('');
    var legend = series.map(function (s, i) {
      return '<g transform="translate(' + (pad.l + i * 130) + ',4)"><rect width="9" height="9" rx="2" fill="' + s.color + '"/>'
        + '<text x="14" y="8" font-size="11" fill="' + INK2 + '">' + esc(s.label) + '</text></g>';
    }).join('');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:auto" role="img" aria-label="' + esc(opts.ariaLabel || 'courbe') + '">' + grid + paths + xlab + legend + '</svg>';
  }

  // ── Tableau triable (clic sur en-tête) ────────────────────────────────────
  // cols : [{ k, label, num?, render?(value,row) }]  ; opts : { key, dir }
  function table(container, cols, rows, opts) {
    var el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;
    opts = opts || {};
    var key = opts.key || (cols[0] && cols[0].k), dir = opts.dir || 1;
    function draw() {
      var sorted = rows.slice().sort(function (a, b) {
        var x = a[key], y = b[key];
        if (x == null && y == null) return 0;
        if (x == null) return 1; if (y == null) return -1;
        var cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'fr');
        return cmp * dir;
      });
      el.innerHTML = '<table class="dt"><thead><tr>' + cols.map(function (c) {
        var sort = c.k === key ? (dir > 0 ? 'ascending' : 'descending') : 'none';
        return '<th data-k="' + esc(c.k) + '" class="' + (c.num ? 'num' : '') + '" aria-sort="' + sort + '">' + esc(c.label) + '</th>';
      }).join('') + '</tr></thead><tbody>' + sorted.map(function (r) {
        return '<tr>' + cols.map(function (c) {
          var v = c.render ? c.render(r[c.k], r) : (r[c.k] == null ? '' : esc(r[c.k]));
          return '<td class="' + (c.num ? 'num' : '') + '">' + v + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
      el.querySelectorAll('th').forEach(function (th) {
        th.addEventListener('click', function () {
          var k = th.getAttribute('data-k');
          dir = (k === key) ? -dir : 1; key = k; draw();
        });
      });
    }
    draw();
  }

  root.Charts = { sparkline: sparkline, donut: donut, lineChart: lineChart, table: table };
})(typeof window !== 'undefined' ? window : this);
