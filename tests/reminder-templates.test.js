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

    // En langue non francophone, « Charger les modèles proposés » remplit la
    // version traduite ; la ligne rendez-vous suit aussi la langue active.
    settings.lang = 'nl';
    settings.reminderSignature = '';
    settings.reminderSignatureShort = '';
    document.querySelector('[data-act="loadReminderTemplates"]').click();
    const nlSubject = settings.reminderTemplates.mailSubject;
    const nlSig = settings.reminderSignature;
    const nlRdv = construireRappel({
      contact:{ prenom:'Alice', collect_method:'CATI', rdv:'18/09/2026', gsm:'0470123456' },
      canal:'sms', templates:settings.reminderTemplates,
      signature:settings.reminderSignature, shortSignature:settings.reminderSignatureShort,
    }).body;

    // Les libellés de la section suivent aussi la langue active.
    appliquerLangue();
    const nlSection = document.querySelector('[data-i18n="reminder_section"]').textContent;
    const nlLoadBtn = document.querySelector('[data-act="loadReminderTemplates"]').textContent;
    const nlSubjectPh = document.getElementById('setReminderMailSubject').placeholder;

    // Amélioration 1 — variables inconnues détectées (et non silencieusement vidées).
    const varsInc = variablesInconnues({ a:'Bonjour {{prenom}} {{inconnue}} {{autre_faux}} {{enquete}}' });

    // Amélioration 2 — estimation de longueur SMS (GSM-7 vs UCS-2).
    const smsAscii = smsInfo('a'.repeat(200));            // 2 segments GSM-7 (153)
    const smsEmoji = smsInfo('’'.repeat(80));             // apostrophe courbe hors Latin-1 → UCS-2 : 2 segments (67)

    // Amélioration 3 — option « ne pas inclure le mot de passe ».
    const cawiC = { prenom:'Bob', collect_method:'CAWI', web_user_id:'ID42', web_user_pwd:'Secret9', gsm:'0470123456' };
    const avecPwd = construireRappel({ contact:cawiC, canal:'sms', includePwd:true }).body;
    const sansPwd = construireRappel({ contact:cawiC, canal:'sms', includePwd:false }).body;

    // Amélioration 4 — données CAWI référencées mais absentes de la fiche.
    const cawiVide = { prenom:'Bob', collect_method:'CAWI', gsm:'0470123456' };
    const wMissing = construireRappel({ contact:cawiVide, canal:'sms' }).warnings;
    const wComplet = construireRappel({ contact:cawiC, canal:'sms' }).warnings;
    // Modèle CAWI personnalisé sans {{mot_de_passe}} : ne pas signaler le MDP manquant.
    const wNoRefPwd = construireRappel({
      contact:cawiVide, canal:'sms',
      templates:{ smsCawi:'Bonjour {{prenom}}, ID : {{identifiant}}' },
    }).warnings;

    return {
      loaded, preview, body:built.body, href:built.href,
      storedSms:stored.reminderTemplates && stored.reminderTemplates.smsCati,
      reset, fallback, nlSubject, nlSig, nlRdv, nlSection, nlLoadBtn, nlSubjectPh,
      varsInc, smsAscii, smsEmoji, avecPwd, sansPwd, wMissing, wComplet, wNoRefPwd,
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
    ['modèles proposés en NL', /Herinnering/.test(r.nlSubject)],
    ['signature par défaut NL', /Statbel-enquêteur/.test(r.nlSig)],
    ['rendez-vous localisé NL', /Geplande afspraak/.test(r.nlRdv)],
    ['libellé de section traduit NL', /Herinneringssjablonen/.test(r.nlSection)],
    ['bouton « charger » traduit NL', /Voorgestelde sjablonen laden/.test(r.nlLoadBtn)],
    ['placeholder objet traduit NL', /Herinnering/.test(r.nlSubjectPh)],
    ['variables inconnues détectées', JSON.stringify(r.varsInc) === JSON.stringify(['autre_faux','inconnue'])],
    ['SMS ASCII : 200 car. → 2 segments', r.smsAscii.len === 200 && r.smsAscii.segments === 2 && r.smsAscii.unicode === false],
    ['SMS UCS-2 : 80 car. → 2 segments', r.smsEmoji.len === 80 && r.smsEmoji.segments === 2 && r.smsEmoji.unicode === true],
    ['mot de passe inclus par défaut', /Secret9/.test(r.avecPwd)],
    ['mot de passe exclu sur option', !/Secret9/.test(r.sansPwd)],
    ['données CAWI absentes signalées', JSON.stringify(r.wMissing.missingData) === JSON.stringify(['identifiant','mot_de_passe'])],
    ['fiche CAWI complète : rien à signaler', r.wComplet.missingData.length === 0],
    ['modèle sans {{mot_de_passe}} : seul l’ID est signalé', JSON.stringify(r.wNoRefPwd.missingData) === JSON.stringify(['identifiant'])],
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
