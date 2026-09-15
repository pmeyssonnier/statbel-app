/*
 * js/planner/i18n-data.js — Planner : internationalisation (dictionnaire I18N fr/nl/en/de,
 * t()/tf()/tPlural(), appliquerLangue/changerLangue, langue partagee via localStorage) et
 * donnees/references (libelles de provinces PROV_I18N, jours/mois localises, couleurs de
 * vague). Extrait verbatim du <script> du Planner. Script CLASSIQUE, globales partagees ;
 * charge apres l'etat global et avant le reste du coeur (ordre preserve).
 */
// ══════════════════════════════════════════════════════════════════════
//  RÉGION — I18N · 4 langues (fr/nl/en/de), même mécanisme que le Convertisseur.
//  Langue partagée avec Interviews/Convertisseur via localStorage['statbel_settings'].lang ;
//  sélecteur 🌐 propre au Planner (autonome, fonctionne aussi en file://).
// ══════════════════════════════════════════════════════════════════════
const LANGS = ['fr', 'nl', 'en', 'de'];
const I18N = {
  // — En-tête / menu ⋮ —
  skip_link: { fr:"Aller au contenu", nl:"Naar de inhoud", en:"Skip to content", de:"Zum Inhalt springen" },
  plan_sel_title: { fr:"Trimestre / planning", nl:"Kwartaal / planning", en:"Quarter / schedule", de:"Quartal / Planung" },
  sel_all_quarters: { fr:"Tout — {n} trimestres", nl:"Alles — {n} kwartalen", en:"All — {n} quarters", de:"Alle — {n} Quartale" },
  tab_planning: { fr:"Planning", nl:"Planning", en:"Schedule", de:"Planung" },
  tab_agenda: { fr:"Agenda", nl:"Agenda", en:"Calendar", de:"Kalender" },
  tab_candidature: { fr:"Candidature", nl:"Kandidatuur", en:"Application", de:"Bewerbung" },
  more_options: { fr:"Plus d'options", nl:"Meer opties", en:"More options", de:"Weitere Optionen" },
  kb_import: { fr:"📥 Importer un planning", nl:"📥 Een planning importeren", en:"📥 Import a schedule", de:"📥 Planung importieren" },
  kb_rename: { fr:"✏️ Renommer le planning", nl:"✏️ Planning hernoemen", en:"✏️ Rename the schedule", de:"✏️ Planung umbenennen" },
  kb_delete: { fr:"🗑️ Supprimer le planning", nl:"🗑️ Planning verwijderen", en:"🗑️ Delete the schedule", de:"🗑️ Planung löschen" },
  kb_candidature: { fr:"📝 Candidature enquêteur", nl:"📝 Kandidatuur enquêteur", en:"📝 Interviewer application", de:"📝 Bewerbung als Befrager" },
  kb_save: { fr:"💾 Sauvegarder", nl:"💾 Opslaan", en:"💾 Save", de:"💾 Speichern" },
  kb_restore: { fr:"↩ Restaurer la sélection", nl:"↩ Selectie herstellen", en:"↩ Restore selection", de:"↩ Auswahl wiederherstellen" },
  kb_clear_save: { fr:"🗑️ Effacer la sauvegarde", nl:"🗑️ Back-up wissen", en:"🗑️ Clear the backup", de:"🗑️ Sicherung löschen" },
  kb_interviews: { fr:"📋 Interviews", nl:"📋 Interviews", en:"📋 Interviews", de:"📋 Interviews" },
  kb_converter: { fr:"🔄 Convertisseur", nl:"🔄 Omzetter", en:"🔄 Converter", de:"🔄 Konverter" },
  lbl_language: { fr:"🌐 Langue", nl:"🌐 Taal", en:"🌐 Language", de:"🌐 Sprache" },
  // — Onglet Planning —
  plan_empty_pre: { fr:"Aucun planning chargé. Importez ici votre fichier trimestriel LFS", nl:"Geen planning geladen. Importeer hier uw LFS-kwartaalbestand", en:"No schedule loaded. Import your quarterly LFS file here", de:"Keine Planung geladen. Importieren Sie hier Ihre LFS-Quartalsdatei" },
  plan_empty_post: { fr:"— il apparaîtra ensuite dans l'agenda.", nl:"— het verschijnt daarna in de agenda.", en:"— it will then appear in the calendar.", de:"— sie erscheint danach im Kalender." },
  plan_mgmt_title: { fr:"📅 Planning enquêtes terrain", nl:"📅 Planning veldenquêtes", en:"📅 Field survey schedule", de:"📅 Feldbefragungs-Planung" },
  plan_mgmt_desc: { fr:"Importe un fichier de planning LFS (Excel/CSV) puis associe ses colonnes. Sélectionne une province/commune pour voir les missions et localiser les quartiers/adresses sur la carte.", nl:"Importeer een LFS-planningbestand (Excel/CSV) en koppel de kolommen. Selecteer een provincie/gemeente om de opdrachten te zien en de wijken/adressen op de kaart te lokaliseren.", en:"Import an LFS schedule file (Excel/CSV) then map its columns. Select a province/municipality to see the assignments and locate the neighbourhoods/addresses on the map.", de:"Importieren Sie eine LFS-Planungsdatei (Excel/CSV) und ordnen Sie die Spalten zu. Wählen Sie eine Provinz/Gemeinde, um die Einsätze zu sehen und die Viertel/Adressen auf der Karte zu lokalisieren." },
  plan_mgmt_menu_pre: { fr:"Import, renommage et suppression du planning : menu", nl:"Importeren, hernoemen en verwijderen van de planning: menu", en:"Import, rename and delete the schedule: menu", de:"Import, Umbenennen und Löschen der Planung: Menü" },
  plan_mgmt_menu_post: { fr:"(en haut à droite).", nl:"(rechtsboven).", en:"(top right).", de:"(oben rechts)." },
  plan_upcoming_only: { fr:"À venir uniquement", nl:"Alleen toekomstige", en:"Upcoming only", de:"Nur bevorstehende" },
  plan_search_ph: { fr:"Rechercher groupe / quartier…", nl:"Zoek groep / wijk…", en:"Search group / neighbourhood…", de:"Gruppe / Viertel suchen…" },
  clear: { fr:"Effacer", nl:"Wissen", en:"Clear", de:"Löschen" },
  plan_check_addr: { fr:"📍 Vérifier une adresse :", nl:"📍 Een adres controleren:", en:"📍 Check an address:", de:"📍 Adresse prüfen:" },
  plan_addr_ph: { fr:"ex. Grande Rue au Bois 12, Schaerbeek", nl:"bv. Grande Rue au Bois 12, Schaarbeek", en:"e.g. Grande Rue au Bois 12, Schaerbeek", de:"z. B. Grande Rue au Bois 12, Schaerbeek" },
  locate: { fr:"Localiser", nl:"Lokaliseren", en:"Locate", de:"Lokalisieren" },
  plan_recalc_tip: { fr:"Vider le cache et recalculer la position des quartiers affichés", nl:"Cache wissen en de positie van de getoonde wijken herberekenen", en:"Clear the cache and recompute the position of the displayed neighbourhoods", de:"Cache leeren und die Position der angezeigten Viertel neu berechnen" },
  plan_recalc: { fr:"🔄 Recalculer", nl:"🔄 Herberekenen", en:"🔄 Recompute", de:"🔄 Neu berechnen" },
  // — Onglet Agenda —
  agenda_empty_pre: { fr:"Aucun planning chargé. Importez d'abord un planning dans l'onglet", nl:"Geen planning geladen. Importeer eerst een planning in het tabblad", en:"No schedule loaded. First import a schedule in the tab", de:"Keine Planung geladen. Importieren Sie zuerst eine Planung im Reiter" },
  agenda_empty_post: { fr:", puis revenez ici pour sélectionner des groupes et bâtir votre agenda.", nl:", en kom dan hier terug om groepen te selecteren en uw agenda op te bouwen.", en:", then come back here to select groups and build your calendar.", de:", und kehren Sie dann hierher zurück, um Gruppen auszuwählen und Ihren Kalender aufzubauen." },
  tab_planning_full: { fr:"🗺️ Planning", nl:"🗺️ Planning", en:"🗺️ Schedule", de:"🗺️ Planung" },
  sel_groups_title: { fr:"Sélectionner des groupes", nl:"Groepen selecteren", en:"Select groups", de:"Gruppen auswählen" },
  f_province: { fr:"Province", nl:"Provincie", en:"Province", de:"Provinz" },
  f_commune: { fr:"Commune", nl:"Gemeente", en:"Municipality", de:"Gemeinde" },
  f_quartier_letter: { fr:"Quartier / Lettre", nl:"Wijk / Letter", en:"Neighbourhood / Letter", de:"Viertel / Buchstabe" },
  pl_all_provinces: { fr:"Toutes les provinces", nl:"Alle provincies", en:"All provinces", de:"Alle Provinzen" },
  pl_all_communes: { fr:"Toutes les communes", nl:"Alle gemeenten", en:"All municipalities", de:"Alle Gemeinden" },
  pl_all_quartiers: { fr:"Tous les quartiers", nl:"Alle wijken", en:"All neighbourhoods", de:"Alle Viertel" },
  // Export .ics (nom du calendrier + libellés de la description d'événement)
  ics_calname: { fr:"LFS / EFT — Planning enquêtes", nl:"LFS / EFT — Enquêteplanning", en:"LFS / EFT — Survey schedule", de:"LFS / EFT — Erhebungsplanung" },
  ics_lbl_group: { fr:"Groupe", nl:"Groep", en:"Group", de:"Gruppe" },
  ics_lbl_quartier: { fr:"Quartier", nl:"Wijk", en:"Neighbourhood", de:"Viertel" },
  ics_lbl_wave: { fr:"Vague", nl:"Golf", en:"Wave", de:"Welle" },
  ics_lbl_weekref: { fr:"Semaine réf.", nl:"Ref. week", en:"Ref. week", de:"Ref. Woche" },
  sort_az: { fr:"A→Z", nl:"A→Z", en:"A→Z", de:"A→Z" },
  sort_za: { fr:"Z→A", nl:"Z→A", en:"Z→A", de:"Z→A" },
  select_all: { fr:"✅ Tout sélectionner", nl:"✅ Alles selecteren", en:"✅ Select all", de:"✅ Alle auswählen" },
  sel_clear: { fr:"✕ Effacer", nl:"✕ Wissen", en:"✕ Clear", de:"✕ Löschen" },
  grp_search_ph: { fr:"🔎 Rechercher groupe / quartier…", nl:"🔎 Zoek groep / wijk…", en:"🔎 Search group / neighbourhood…", de:"🔎 Gruppe / Viertel suchen…" },
  no_group_selected: { fr:"Aucun groupe sélectionné", nl:"Geen groep geselecteerd", en:"No group selected", de:"Keine Gruppe ausgewählt" },
  tab_agenda_full: { fr:"📅 Agenda", nl:"📅 Agenda", en:"📅 Calendar", de:"📅 Kalender" },
  v_list: { fr:"☰ Liste", nl:"☰ Lijst", en:"☰ List", de:"☰ Liste" },
  v_week: { fr:"Semaine", nl:"Week", en:"Week", de:"Woche" },
  v_month: { fr:"Mois", nl:"Maand", en:"Month", de:"Monat" },
  v_year: { fr:"Année", nl:"Jaar", en:"Year", de:"Jahr" },
  today: { fr:"Aujourd'hui", nl:"Vandaag", en:"Today", de:"Heute" },
  exp_excel: { fr:"⬇️ Excel", nl:"⬇️ Excel", en:"⬇️ Excel", de:"⬇️ Excel" },
  exp_excel_tip: { fr:"Exporter la liste en Excel", nl:"De lijst naar Excel exporteren", en:"Export the list to Excel", de:"Die Liste nach Excel exportieren" },
  exp_csv: { fr:"⬇️ CSV App", nl:"⬇️ CSV-app", en:"⬇️ CSV App", de:"⬇️ CSV-App" },
  exp_csv_tip: { fr:"Export CSV pour l'application Interviews", nl:"CSV-export voor de Interviews-app", en:"CSV export for the Interviews app", de:"CSV-Export für die Interviews-App" },
  exp_ical: { fr:"📅 iCal", nl:"📅 iCal", en:"📅 iCal", de:"📅 iCal" },
  exp_ical_tip: { fr:"Exporter vers Google Agenda / iCal", nl:"Exporteren naar Google Agenda / iCal", en:"Export to Google Calendar / iCal", de:"Nach Google Kalender / iCal exportieren" },
  exp_overlap: { fr:"⚠️ Chevauch.", nl:"⚠️ Overlap", en:"⚠️ Overlaps", de:"⚠️ Überschn." },
  exp_overlap_tip: { fr:"Exporter les chevauchements", nl:"De overlappingen exporteren", en:"Export the overlaps", de:"Die Überschneidungen exportieren" },
  leg_v1: { fr:"Vague 1", nl:"Golf 1", en:"Wave 1", de:"Welle 1" },
  leg_v2: { fr:"Vague 2", nl:"Golf 2", en:"Wave 2", de:"Welle 2" },
  leg_v3: { fr:"Vague 3", nl:"Golf 3", en:"Wave 3", de:"Welle 3" },
  leg_v4: { fr:"Vague 4", nl:"Golf 4", en:"Wave 4", de:"Welle 4" },
  // — Modale mapping colonnes —
  map_file_label: { fr:"Fichier :", nl:"Bestand:", en:"File:", de:"Datei:" },
  map_lines: { fr:"ligne(s).", nl:"regel(s).", en:"line(s).", de:"Zeile(n)." },
  map_assoc: { fr:"Associe chaque information à une colonne du fichier (1 ligne = 1 mission/interrogation).", nl:"Koppel elke gegeven aan een kolom van het bestand (1 regel = 1 opdracht/bevraging).", en:"Map each piece of information to a column of the file (1 line = 1 assignment/interview).", de:"Ordnen Sie jede Information einer Spalte der Datei zu (1 Zeile = 1 Einsatz/Befragung)." },
  map_name: { fr:"Nom du planning", nl:"Naam van de planning", en:"Schedule name", de:"Name der Planung" },
  map_name_ph: { fr:"ex. EU-SILC 2026 vague 1", nl:"bv. EU-SILC 2026 golf 1", en:"e.g. EU-SILC 2026 wave 1", de:"z. B. EU-SILC 2026 Welle 1" },
  map_type: { fr:"Type d'enquête", nl:"Type enquête", en:"Survey type", de:"Erhebungstyp" },
  map_type_travel: { fr:"Voyages & Vacances", nl:"Reizen & Vakanties", en:"Travel & Holidays", de:"Reisen & Urlaub" },
  map_type_health: { fr:"Santé", nl:"Gezondheid", en:"Health", de:"Gesundheit" },
  map_type_census: { fr:"Recensement / spéciale", nl:"Telling / speciaal", en:"Census / special", de:"Zählung / Sonder" },
  map_type_other: { fr:"Autre", nl:"Andere", en:"Other", de:"Andere" },
  map_quartier_addr: { fr:"Quartier / adresse", nl:"Wijk / adres", en:"Neighbourhood / address", de:"Viertel / Adresse" },
  map_group_code: { fr:"Groupe / code", nl:"Groep / code", en:"Group / code", de:"Gruppe / Code" },
  map_wave: { fr:"Vague", nl:"Golf", en:"Wave", de:"Welle" },
  map_week_ref: { fr:"Semaine de réf.", nl:"Ref.-week", en:"Ref. week", de:"Ref.-Woche" },
  map_date_start: { fr:"Date début", nl:"Startdatum", en:"Start date", de:"Startdatum" },
  map_date_stop: { fr:"Date fin", nl:"Einddatum", en:"End date", de:"Enddatum" },
  cancel: { fr:"Annuler", nl:"Annuleren", en:"Cancel", de:"Abbrechen" },
  map_import_confirm: { fr:"✅ Importer", nl:"✅ Importeren", en:"✅ Import", de:"✅ Importieren" },
  // — Onglet Candidature —
  cand_desc_pre: { fr:"Remplit le formulaire de candidature avec vos coordonnées et les groupes sélectionnés dans l'onglet", nl:"Vult het kandidatuurformulier in met uw gegevens en de groepen die u in het tabblad", en:"Fills the application form with your details and the groups selected in the tab", de:"Füllt das Bewerbungsformular mit Ihren Angaben und den im Reiter" },
  cand_desc_post: { fr:". Vos informations personnelles sont mémorisées sur cet appareil.", nl:"hebt geselecteerd. Uw persoonlijke gegevens worden op dit toestel bewaard.", en:". Your personal information is stored on this device.", de:"ausgewählten Gruppen. Ihre persönlichen Daten werden auf diesem Gerät gespeichert." },
  cand_survey: { fr:"Enquête — sigle + période (ex. EFT 2026-T3)", nl:"Enquête — code + periode (bv. EAK 2026-K3)", en:"Survey — code + period (e.g. LFS 2026-Q3)", de:"Erhebung — Kürzel + Zeitraum (z. B. AKE 2026-Q3)" },
  cand_nom: { fr:"Nom", nl:"Naam", en:"Last name", de:"Name" },
  cand_prenom: { fr:"Prénom", nl:"Voornaam", en:"First name", de:"Vorname" },
  cand_adresse: { fr:"Adresse", nl:"Adres", en:"Address", de:"Adresse" },
  cand_cp: { fr:"Code postal", nl:"Postcode", en:"Postal code", de:"Postleitzahl" },
  cand_phones_emails: { fr:"Téléphones & e-mails", nl:"Telefoons & e-mails", en:"Phones & emails", de:"Telefone & E-Mails" },
  cand_tel_prive: { fr:"Tél. privé", nl:"Tel. privé", en:"Home phone", de:"Tel. privat" },
  cand_hours_prive: { fr:"Heures limites d'appel (privé)", nl:"Beluren (privé)", en:"Call hours (home)", de:"Anrufzeiten (privat)" },
  cand_hours_ph: { fr:"ex. 18h–20h", nl:"bv. 18u–20u", en:"e.g. 6pm–8pm", de:"z. B. 18–20 Uhr" },
  cand_tel_port: { fr:"Tél. portable", nl:"Gsm", en:"Mobile phone", de:"Mobiltelefon" },
  cand_hours_port: { fr:"Heures limites d'appel (portable)", nl:"Beluren (gsm)", en:"Call hours (mobile)", de:"Anrufzeiten (mobil)" },
  cand_tel_bur: { fr:"Tél. bureau", nl:"Tel. kantoor", en:"Office phone", de:"Tel. Büro" },
  cand_hours_bur: { fr:"Heures limites d'appel (bureau)", nl:"Beluren (kantoor)", en:"Call hours (office)", de:"Anrufzeiten (Büro)" },
  cand_email_prive: { fr:"E-mail privé", nl:"E-mail privé", en:"Home email", de:"E-Mail privat" },
  cand_email_bur: { fr:"E-mail bureau", nl:"E-mail kantoor", en:"Office email", de:"E-Mail Büro" },
  cand_nb_groupes: { fr:"Nombre de groupes souhaités", nl:"Aantal gewenste groepen", en:"Number of groups wanted", de:"Anzahl gewünschter Gruppen" },
  cand_auto: { fr:"auto", nl:"auto", en:"auto", de:"auto" },
  cand_nb_tip: { fr:"Automatique — égal au nombre de groupes sélectionnés", nl:"Automatisch — gelijk aan het aantal geselecteerde groepen", en:"Automatic — equal to the number of selected groups", de:"Automatisch — entspricht der Anzahl ausgewählter Gruppen" },
  cand_date: { fr:"Date", nl:"Datum", en:"Date", de:"Datum" },
  cand_date_tip: { fr:"Automatique — date du jour", nl:"Automatisch — datum van vandaag", en:"Automatic — today's date", de:"Automatisch — heutiges Datum" },
  cand_communes: { fr:"Communes choisies —", nl:"Gekozen gemeenten —", en:"Chosen municipalities —", de:"Gewählte Gemeinden —" },
  cand_groupes_word: { fr:"groupe(s)", nl:"groep(en)", en:"group(s)", de:"Gruppe(n)" },
  cand_reorder_hint: { fr:"▲▼ pour l'ordre de priorité · ✕ pour retirer une commune (le nombre de groupes se recalcule)", nl:"▲▼ voor de prioriteitsvolgorde · ✕ om een gemeente te verwijderen (het aantal groepen wordt herberekend)", en:"▲▼ for priority order · ✕ to remove a municipality (the group count is recomputed)", de:"▲▼ für die Prioritätsreihenfolge · ✕ um eine Gemeinde zu entfernen (die Gruppenanzahl wird neu berechnet)" },
  cand_no_group: { fr:"Aucun groupe sélectionné — choisissez des groupes dans l'onglet Agenda.", nl:"Geen groep geselecteerd — kies groepen in het tabblad Agenda.", en:"No group selected — choose groups in the Calendar tab.", de:"Keine Gruppe ausgewählt — wählen Sie Gruppen im Reiter Kalender." },
  cand_checkbox_legend: { fr:"Case à cocher du formulaire", nl:"Aankruisvak van het formulier", en:"Form checkbox", de:"Ankreuzfeld des Formulars" },
  cand_radio_groupes: { fr:"Nombre de groupes souhaités", nl:"Aantal gewenste groepen", en:"Number of groups wanted", de:"Anzahl gewünschter Gruppen" },
  cand_radio_pas: { fr:"Pas intéressé(e) pour effectuer les enquêtes de cette vague", nl:"Niet geïnteresseerd in het afnemen van enquêtes voor deze golf", en:"Not interested in conducting this wave's surveys", de:"Nicht interessiert an der Durchführung der Erhebungen dieser Welle" },
  cand_radio_plus: { fr:"N'est plus intéressé(e) pour effectuer des enquêtes", nl:"Niet langer geïnteresseerd in het afnemen van enquêtes", en:"No longer interested in conducting surveys", de:"Nicht mehr an der Durchführung von Erhebungen interessiert" },
  cand_signature: { fr:"Signature", nl:"Handtekening", en:"Signature", de:"Unterschrift" },
  cand_sig_aria: { fr:"Zone de signature — dessinez votre signature à la souris ou au doigt", nl:"Handtekeningzone — teken uw handtekening met de muis of vinger", en:"Signature area — draw your signature with the mouse or finger", de:"Unterschriftsfeld — zeichnen Sie Ihre Unterschrift mit Maus oder Finger" },
  cand_sig_empty: { fr:"Signature vide", nl:"Lege handtekening", en:"Empty signature", de:"Leere Unterschrift" },
  cand_sig_clear: { fr:"✕ Effacer la signature", nl:"✕ Handtekening wissen", en:"✕ Clear signature", de:"✕ Unterschrift löschen" },
  cand_sig_hint: { fr:"Signez à la souris ou au doigt — la signature est intégrée au .docx.", nl:"Onderteken met de muis of vinger — de handtekening wordt in de .docx opgenomen.", en:"Sign with the mouse or finger — the signature is embedded in the .docx.", de:"Unterschreiben Sie mit Maus oder Finger — die Unterschrift wird in die .docx eingebettet." },
  cand_sig_or: { fr:"Ou tapez votre nom :", nl:"Of typ uw naam:", en:"Or type your name:", de:"Oder geben Sie Ihren Namen ein:" },
  cand_sig_name_ph: { fr:"Prénom Nom", nl:"Voornaam Naam", en:"First name Last name", de:"Vorname Name" },
  cand_sig_use: { fr:"Utiliser comme signature", nl:"Als handtekening gebruiken", en:"Use as signature", de:"Als Unterschrift verwenden" },
  cand_generate: { fr:"⬇️ Générer la candidature (.docx)", nl:"⬇️ Kandidatuur genereren (.docx)", en:"⬇️ Generate the application (.docx)", de:"⬇️ Bewerbung erzeugen (.docx)" },
  cand_generate_hint: { fr:"Formulaire de candidature rempli — s'ouvre dans Word / LibreOffice", nl:"Ingevuld kandidatuurformulier — opent in Word / LibreOffice", en:"Filled application form — opens in Word / LibreOffice", de:"Ausgefülltes Bewerbungsformular — öffnet in Word / LibreOffice" },
  // — Chaînes générées en JS (alertes, statuts, tableaux, agenda) —
  js_no_group_alert: { fr:"Aucun groupe sélectionné.", nl:"Geen groep geselecteerd.", en:"No group selected.", de:"Keine Gruppe ausgewählt." },
  js_no_group_match: { fr:"Aucun groupe correspond aux filtres", nl:"Geen groep komt overeen met de filters", en:"No group matches the filters", de:"Keine Gruppe entspricht den Filtern" },
  js_ics_downloaded: { fr:"Fichier .ics téléchargé.\n\nPour importer dans Google Agenda :\n1. Ouvrir Google Agenda\n2. ⚙️ Paramètres → Importer et exporter\n3. Importer → sélectionner le fichier .ics", nl:".ics-bestand gedownload.\n\nIn Google Agenda importeren:\n1. Google Agenda openen\n2. ⚙️ Instellingen → Importeren en exporteren\n3. Importeren → het .ics-bestand selecteren", en:".ics file downloaded.\n\nTo import into Google Calendar:\n1. Open Google Calendar\n2. ⚙️ Settings → Import & export\n3. Import → select the .ics file", de:".ics-Datei heruntergeladen.\n\nIn Google Kalender importieren:\n1. Google Kalender öffnen\n2. ⚙️ Einstellungen → Import & Export\n3. Importieren → die .ics-Datei auswählen" },
  js_error: { fr:"Erreur : {msg}", nl:"Fout: {msg}", en:"Error: {msg}", de:"Fehler: {msg}" },
  js_no_backup: { fr:"Aucune sauvegarde.", nl:"Geen back-up.", en:"No backup.", de:"Keine Sicherung." },
  js_confirm_clear_save: { fr:"Effacer la sauvegarde locale ?", nl:"Lokale back-up wissen?", en:"Clear the local backup?", de:"Lokale Sicherung löschen?" },
  close: { fr:"Fermer", nl:"Sluiten", en:"Close", de:"Schließen" },
  js_confirm_del_plan: { fr:"Supprimer le planning « {nom} » ?", nl:"Planning « {nom} » verwijderen?", en:"Delete the schedule “{nom}”?", de:"Planung „{nom}“ löschen?" },
  js_map_not_ready: { fr:"Carte non prête.", nl:"Kaart niet gereed.", en:"Map not ready.", de:"Karte nicht bereit." },
  js_searching: { fr:"Recherche…", nl:"Zoeken…", en:"Searching…", de:"Suche…" },
  js_file_empty: { fr:"Fichier vide ou sans données.", nl:"Leeg bestand of zonder gegevens.", en:"Empty file or no data.", de:"Leere Datei oder ohne Daten." },
  js_no_readable_lfs: { fr:"Aucun groupe lisible dans ce fichier LFS.", nl:"Geen leesbare groep in dit LFS-bestand.", en:"No readable group in this LFS file.", de:"Keine lesbare Gruppe in dieser LFS-Datei." },
  js_col_commune_required: { fr:"La colonne « Commune » est obligatoire.", nl:"De kolom « Gemeente » is verplicht.", en:"The “Municipality” column is required.", de:"Die Spalte „Gemeinde“ ist erforderlich." },
  js_no_line_commune: { fr:"Aucune ligne avec une commune.", nl:"Geen regel met een gemeente.", en:"No line with a municipality.", de:"Keine Zeile mit einer Gemeinde." },
  js_plan_count: { fr:"{g} groupe(s) · {i} interro.", nl:"{g} groep(en) · {i} bevr.", en:"{g} group(s) · {i} interv.", de:"{g} Gruppe(n) · {i} Bef." },
  js_quartiers_located: { fr:"{n} quartier(s) localisé(s).", nl:"{n} wijk(en) gelokaliseerd.", en:"{n} neighbourhood(s) located.", de:"{n} Viertel lokalisiert." },
  js_geocoding_progress: { fr:"Géocodage… {i}/{n}", nl:"Geocodering… {i}/{n}", en:"Geocoding… {i}/{n}", de:"Geokodierung… {i}/{n}" },
  js_geocoding_done: { fr:"{n} quartier(s) — localisation terminée.", nl:"{n} wijk(en) — lokalisatie voltooid.", en:"{n} neighbourhood(s) — location complete.", de:"{n} Viertel — Lokalisierung abgeschlossen." },
  js_agenda_count: { fr:"Agenda — {n} groupe(s)", nl:"Agenda — {n} groep(en)", en:"Calendar — {n} group(s)", de:"Kalender — {n} Gruppe(n)" },
  js_cand_count: { fr:"Candidature — {n} groupe(s)", nl:"Kandidatuur — {n} groep(en)", en:"Application — {n} group(s)", de:"Bewerbung — {n} Gruppe(n)" },
  th_group: { fr:"N° Groupe", nl:"Groepsnr.", en:"Group no.", de:"Gruppen-Nr." },
  th_group_short: { fr:"Groupe", nl:"Groep", en:"Group", de:"Gruppe" },
  th_quartier: { fr:"Quartier", nl:"Wijk", en:"Neighbourhood", de:"Viertel" },
  th_wave: { fr:"Vague", nl:"Golf", en:"Wave", de:"Welle" },
  th_week_ref: { fr:"Sem. réf.", nl:"Ref.-week", en:"Ref. week", de:"Ref.-Woche" },
  th_start: { fr:"Début", nl:"Begin", en:"Start", de:"Beginn" },
  th_end: { fr:"Fin", nl:"Einde", en:"End", de:"Ende" },
  th_duration: { fr:"Durée", nl:"Duur", en:"Duration", de:"Dauer" },
  unit_day: { fr:"j", nl:"d", en:"d", de:"T" },
  js_week_range: { fr:"Sem. {w} — {d1} au {d2}", nl:"Week {w} — {d1} tot {d2}", en:"Week {w} — {d1} to {d2}", de:"KW {w} — {d1} bis {d2}" },
  js_group_upper: { fr:"GROUPE", nl:"GROEP", en:"GROUP", de:"GRUPPE" },
  js_waves_count: { fr:" — {n} vague(s) : ", nl:" — {n} golf/golven: ", en:" — {n} wave(s): ", de:" — {n} Welle(n): " },
  js_no_wave: { fr:" — aucune vague", nl:" — geen golf", en:" — no wave", de:" — keine Welle" },
  js_precision: { fr:"Précision", nl:"Precisie", en:"Precision", de:"Genauigkeit" },
  js_next: { fr:"Prochaine", nl:"Volgende", en:"Next", de:"Nächste" },
  js_prec_fail: { fr:"échec", nl:"mislukt", en:"failed", de:"fehlgeschlagen" },
  js_prec_high: { fr:"élevée", nl:"hoog", en:"high", de:"hoch" },
  js_prec_mid: { fr:"moyenne", nl:"gemiddeld", en:"medium", de:"mittel" },
  js_prec_commune: { fr:"commune", nl:"gemeente", en:"municipality", de:"Gemeinde" },
  js_src_centre: { fr:"centre commune", nl:"centrum gemeente", en:"municipality centre", de:"Gemeindezentrum" },
  js_debug_geo_tip: { fr:"Clic = debug géocodage (essais + forme retenue)", nl:"Klik = geocodering debuggen (pogingen + gekozen vorm)", en:"Click = geocoding debug (attempts + chosen form)", de:"Klick = Geokodierung-Debug (Versuche + gewählte Form)" },
  js_priority: { fr:"Priorité {n}", nl:"Prioriteit {n}", en:"Priority {n}", de:"Priorität {n}" },
  js_move_up: { fr:"Monter", nl:"Omhoog", en:"Move up", de:"Nach oben" },
  js_move_down: { fr:"Descendre", nl:"Omlaag", en:"Move down", de:"Nach unten" },
  js_remove_commune: { fr:"Retirer cette commune", nl:"Deze gemeente verwijderen", en:"Remove this municipality", de:"Diese Gemeinde entfernen" },
  js_remove_commune_aria: { fr:"Retirer {c}", nl:"{c} verwijderen", en:"Remove {c}", de:"{c} entfernen" },
  js_field_required: { fr:"Veuillez renseigner : {field}.", nl:"Gelieve in te vullen: {field}.", en:"Please fill in: {field}.", de:"Bitte ausfüllen: {field}." },
  js_sig_required: { fr:"La signature est obligatoire : dessinez-la avant de générer le document.", nl:"De handtekening is verplicht: teken ze voordat u het document genereert.", en:"The signature is required: draw it before generating the document.", de:"Die Unterschrift ist erforderlich: zeichnen Sie sie, bevor Sie das Dokument erzeugen." },
  js_fix_fields: { fr:"Veuillez corriger les champs indiqués avant de générer la candidature.", nl:"Corrigeer de aangeduide velden voordat u de kandidatuur genereert.", en:"Please correct the indicated fields before generating the application.", de:"Bitte korrigieren Sie die angegebenen Felder, bevor Sie die Bewerbung erzeugen." },
  js_cand_no_group: { fr:"Aucun groupe sélectionné : choisissez au moins un groupe (onglet Agenda) ou cochez « Pas / Plus intéressé » avant de générer la candidature.", nl:"Geen groep geselecteerd: kies minstens één groep (tabblad Agenda) of vink « Niet / Niet langer geïnteresseerd » aan voordat u de kandidatuur genereert.", en:"No group selected: choose at least one group (Calendar tab) or tick « Not / No longer interested » before generating the application.", de:"Keine Gruppe ausgewählt: Wählen Sie mindestens eine Gruppe (Reiter Kalender) oder kreuzen Sie « Nicht / Nicht mehr interessiert » an, bevor Sie die Bewerbung erzeugen." },
  cand_sig_filled: { fr:"Signature saisie", nl:"Handtekening ingevoerd", en:"Signature captured", de:"Unterschrift erfasst" },
  js_selected_suffix: { fr:" · ✓ {n} sélectionné(s)", nl:" · ✓ {n} geselecteerd", en:" · ✓ {n} selected", de:" · ✓ {n} ausgewählt" },
  js_approx_full: { fr:"⚠️ approximatif (hors commune ?)", nl:"⚠️ benaderend (buiten de gemeente?)", en:"⚠️ approximate (outside municipality?)", de:"⚠️ ungefähr (außerhalb der Gemeinde?)" },
  js_approx_prefix: { fr:"⚠️ approx. ", nl:"⚠️ ong. ", en:"⚠️ approx. ", de:"⚠️ ungef. " },
  js_plan_updated: { fr:"🔄 Planning existant mis à jour (données remplacées).", nl:"🔄 Bestaande planning bijgewerkt (gegevens vervangen).", en:"🔄 Existing schedule updated (data replaced).", de:"🔄 Bestehende Planung aktualisiert (Daten ersetzt)." },
  js_gen_error: { fr:"Erreur lors de la génération : {msg}", nl:"Fout bij het genereren: {msg}", en:"Error while generating: {msg}", de:"Fehler beim Erzeugen: {msg}" },
  js_no_overlap: { fr:"✅ Aucun chevauchement détecté !", nl:"✅ Geen overlap gevonden!", en:"✅ No overlap detected!", de:"✅ Keine Überschneidung gefunden!" },
  js_overlaps_exported: { fr:"⚠️ {n} chevauchement(s) exporté(s)", nl:"⚠️ {n} overlap(pen) geëxporteerd", en:"⚠️ {n} overlap(s) exported", de:"⚠️ {n} Überschneidung(en) exportiert" },
  js_saved: { fr:"💾 Sauvegardé !", nl:"💾 Opgeslagen!", en:"💾 Saved!", de:"💾 Gespeichert!" },
  js_restored: { fr:"↩ Restauré !", nl:"↩ Hersteld!", en:"↩ Restored!", de:"↩ Wiederhergestellt!" },
  js_save_cleared: { fr:"✕ Sauvegarde effacée", nl:"✕ Back-up gewist", en:"✕ Backup cleared", de:"✕ Sicherung gelöscht" },
};

function t(key) {
  const e = I18N[key];
  if (!e) return key;
  return e[uiLang] || e.fr || key;
}
// Template avec variables : tf('key', {n:3}) remplace {n} dans la chaîne traduite
function tf(key, vars) {
  return t(key).replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] != null) ? vars[k] : '');
}
// Pluriel : la valeur du dico est [singulier, pluriel] par langue
function tPlural(key, n) {
  const e = I18N[key];
  const arr = (e && (e[uiLang] || e.fr)) || [key, key];
  return arr[n > 1 ? 1 : 0];
}
function detecterLangueNavigateur() {
  const l = (navigator.language || 'fr').slice(0, 2).toLowerCase();
  return LANGS.includes(l) ? l : 'fr';
}
// Lecture défensive de localStorage['statbel_settings'] — langue partagée avec Interviews/Convertisseur.
function lireSettings() {
  try { return JSON.parse(localStorage.getItem('statbel_settings') || '{}') || {}; } catch (e) { return {}; }
}
function chargerLangueInitiale() {
  const raw = lireSettings();
  if (LANGS.includes(raw.lang)) return raw.lang;
  return detecterLangueNavigateur();
}
let uiLang = chargerLangueInitiale();

// Applique la langue courante à tout le DOM balisé (data-i18n[-ph|-tip|-title|-aria]).
function appliquerLangue() {
  document.documentElement.lang = uiLang || 'fr';
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.getAttribute('data-i18n-ph')); });
  document.querySelectorAll('[data-i18n-tip]').forEach(el => { el.setAttribute('title', t(el.getAttribute('data-i18n-tip'))); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.getAttribute('data-i18n-title')); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
  const sel = document.getElementById('setLangPlanner'); if (sel) sel.value = uiLang;
  rafraichirVuesLangue();
}
// Changement de langue : persiste dans localStorage['statbel_settings'] (fusion — partagé avec les autres apps).
function changerLangue(v) {
  uiLang = LANGS.includes(v) ? v : 'fr';
  const raw = lireSettings();
  raw.lang = uiLang;
  try { localStorage.setItem('statbel_settings', JSON.stringify(raw)); } catch (e) {}
  appliquerLangue();
}
// Ré-affiche le contenu généré en JS (non couvert par data-i18n) après un changement de langue.
function rafraichirVuesLangue() {
  try {
    // Filtres « Sélectionner des groupes » (selProvince/selCommune) : libellés de
    // provinces/communes reconstruits, sélections préservées.
    if (typeof allRows !== 'undefined' && allRows && allRows.length && typeof populateFilters === 'function') populateFilters();
    if (typeof renderGroupsList === 'function') renderGroupsList();
    if (typeof renderView === 'function') renderView();
    if (typeof updateCandidaturePreview === 'function') updateCandidaturePreview();
    // Filtres du tableau Planning (planProvince/Commune/Quartier) : « Toutes … » +
    // libellés retraduits, sélections préservées.
    if (typeof _planRows !== 'undefined' && _planRows && _planRows.length) {
      if (typeof appliquerPlanningActif === 'function') appliquerPlanningActif();
      if (typeof filtrerPlanning === 'function') filtrerPlanning();
    }
  } catch (e) { /* pas bloquant */ }
}

// Codes province (fichiers LFS Statbel) → libellés complets. Repli : code brut.
// ══════════════════════════════════════════════════════════════════════
//  RÉGION — DATA / RÉFÉRENCES · provinces, jours/mois, couleurs de vague
// ══════════════════════════════════════════════════════════════════════
// Libellés de provinces en 4 langues (fr/nl/en/de). Les variantes d'abréviation
// rencontrées selon les millésimes (ANV/ANT, BFL/VBR, FOC/WVL, FOR/OVL, BRU/BXL)
// pointent vers la même province.
const PROV_I18N = {
  BRU: { fr:'Bruxelles',            nl:'Brussel',          en:'Brussels',        de:'Brüssel' },
  BXL: { fr:'Bruxelles',            nl:'Brussel',          en:'Brussels',        de:'Brüssel' },
  BWA: { fr:'Brabant wallon',       nl:'Waals-Brabant',    en:'Walloon Brabant', de:'Wallonisch-Brabant' },
  HAI: { fr:'Hainaut',              nl:'Henegouwen',       en:'Hainaut',         de:'Hennegau' },
  LIE: { fr:'Liège',                nl:'Luik',             en:'Liège',           de:'Lüttich' },
  LUX: { fr:'Luxembourg',           nl:'Luxemburg',        en:'Luxembourg',      de:'Luxemburg' },
  NAM: { fr:'Namur',                nl:'Namen',            en:'Namur',           de:'Namür' },
  ANV: { fr:'Anvers',               nl:'Antwerpen',        en:'Antwerp',         de:'Antwerpen' },
  ANT: { fr:'Anvers',               nl:'Antwerpen',        en:'Antwerp',         de:'Antwerpen' },
  BFL: { fr:'Brabant flamand',      nl:'Vlaams-Brabant',   en:'Flemish Brabant', de:'Flämisch-Brabant' },
  VBR: { fr:'Brabant flamand',      nl:'Vlaams-Brabant',   en:'Flemish Brabant', de:'Flämisch-Brabant' },
  FOC: { fr:'Flandre occidentale',  nl:'West-Vlaanderen',  en:'West Flanders',   de:'Westflandern' },
  WVL: { fr:'Flandre occidentale',  nl:'West-Vlaanderen',  en:'West Flanders',   de:'Westflandern' },
  FOR: { fr:'Flandre orientale',    nl:'Oost-Vlaanderen',  en:'East Flanders',   de:'Ostflandern' },
  OVL: { fr:'Flandre orientale',    nl:'Oost-Vlaanderen',  en:'East Flanders',   de:'Ostflandern' },
  LIM: { fr:'Limbourg',             nl:'Limburg',          en:'Limburg',         de:'Limburg' },
};
function provLabel(code) {
  const c = String(code || '').trim().toUpperCase();
  const e = PROV_I18N[c];
  return e ? (e[uiLang] || e.fr) : (code || '');
}
// Libellé de commune selon la langue : les noms bilingues « FR/NL » (communes
// bruxelloises et à facilités) affichent la forme correspondant à la langue ;
// les communes à nom unique (flamandes/wallonnes) sont renvoyées telles quelles.
// fr/en/de retombent sur la forme primaire (FR) faute de données officielles.
function communeLabel(c) {
  const parts = String(c || '').split('/').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return String(c || '');
  return uiLang === 'nl' ? (parts[1] || parts[0]) : parts[0];
}
// Jours (Lun→Dim) et mois localisés — suivent la langue de l'UI.
const JOURS_I18N = {
  fr: ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'],
  nl: ['ma','di','wo','do','vr','za','zo'],
  en: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
  de: ['Mo','Di','Mi','Do','Fr','Sa','So'],
};
const MOIS_I18N = {
  fr: ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'],
  nl: ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'],
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  de: ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'],
};
function joursNoms() { return JOURS_I18N[uiLang] || JOURS_I18N.fr; }
function moisNoms() { return MOIS_I18N[uiLang] || MOIS_I18N.fr; }
