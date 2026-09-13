/*
 * Prototype des modèles de rappel personnalisables.
 * Vérifie substitution, persistance locale, aperçu et réinitialisation.
 */
const { chromium } = require('playwright-core');
const { serve } = require('./_serve');

const EXEC = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM || '/usr/bin/chromium';

(async () => {
  const srv = await serve();
  const b = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const p = await b.newPage();
  const perr = [];
  p.on('pageerror', e => perr.push(e.message));
  await p.goto(srv.url + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const r = await p.evaluate(() => {
    const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles:true }));
    settings.lang = 'fr';

    // Le bouton charge les modèles proposés et les signatures du prototype.
    document.querySelector('[data-act="loadReminderTemplates"]').click();
    const loaded = Object.keys(settings.reminderTemplates || {}).sort();
    const preview = document.getElementById('reminderTemplatePreview').textContent;

    // Une modification via l'éditeur est persistée et utilisée par le moteur.
    const sms = document.getElementById('setReminderSmsCati');
    sms.value = 'Bonjour {{prenom}} — {{enquete}} — {{signature_courte}}';
    fire(sms, 'input');
    const sig = document.getElementById('setReminderSignatureShort');
    sig.value = 'Pierre – Statbel';
    fire(sig, 'input');

    const built = construireRappel({
      contact:{ prenom:'Alice', collect_method:'CATI', gsm:'0470123456' },
      canal:'sms',
      cawiUrl:'',
      surveyName:'EFT 2026',
      templates:settings.reminderTemplates,
      signature:settings.reminderSignature,
      shortSignature:settings.reminderSignatureShort,
    });
    const stored = JSON.parse(localStorage.getItem('statbel_settings') || '{}');

    // Réinitialiser revient au message automatique i18n historique.
    document.querySelector('[data-act="resetReminderTemplates"]').click();
    const reset = Object.keys(settings.reminderTemplates || {}).length;
    const fallback = construireRappel({
      contact:{ prenom:'Alice', collect_method:'CATI', gsm:'0470123456' },
      canal:'sms', templates:settings.reminderTemplates,
    }).body;

    return {
      loaded, preview, body:built.body, href:built.href,
      storedSms:stored.reminderTemplates && stored.reminderTemplates.smsCati,
      reset, fallback,
      inline:document.querySelectorAll('#modalSettings [onclick],[oninput],[onchange]').length,
    };
  });

  await b.close();
  await srv.close();

  const expected = ['mailCati','mailCawi','mailSubject','smsCati','smsCawi'];
  const checks = [
    ['5 modèles proposés chargés', JSON.stringify(r.loaded) === JSON.stringify(expected)],
    ['aperçu CATI/CAWI généré', /E-MAIL CATI/.test(r.preview) && /SMS CAWI/.test(r.preview)],
    ['variables remplacées', r.body === 'Bonjour Alice — EFT 2026 — Pierre – Statbel'],
    ['lien SMS encodé', r.href.startsWith('sms:+32470123456?&body=')],
    ['modèle persisté', r.storedSms === 'Bonjour {{prenom}} — {{enquete}} — {{signature_courte}}'],
    ['réinitialisation', r.reset === 0],
    ['repli i18n conservé', /Bonjour Alice/.test(r.fallback)],
    ['aucun handler inline', r.inline === 0],
    ['aucune erreur de page', perr.length === 0],
  ];
  let ok = true;
  for (const [name, pass] of checks) {
    console.log((pass ? '✓ PASS ' : '✗ FAIL ') + name);
    if (!pass) ok = false;
  }
  if (perr.length) console.log('PAGEERRORS:', perr);
  console.log(ok ? '\nTOUS LES TESTS PASSENT' : '\nÉCHEC');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
