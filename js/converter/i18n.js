/*
 * js/converter/i18n.js — Convertisseur : I18N (fr/nl/en/de, miroir du systeme de l'app enquete).
 * Dictionnaire I18N, t()/tf()/tPlural(), lecture/persistance de la langue partagee
 * (localStorage['statbel_settings'].lang), appliquerLangue()/changerLangue() et le re-rendu
 * des libelles generes en JS. Extrait verbatim du <script> du Convertisseur. Script CLASSIQUE :
 * globales partagees (LANGS, I18N, t…) visibles par les scripts suivants et via onclick=.
 */
// ════════════════════════════════════════════════════════════════════════
//  I18N — FR / NL / EN / DE (miroir du système de l'app enquête, index.html)
// ════════════════════════════════════════════════════════════════════════
const LANGS = ['fr', 'nl', 'en', 'de'];

const I18N = {
  // ── En-tête / menu ⚙️ ──────────────────────────────────────────────
  tip_overview: { fr:"Aperçu", nl:"Overzicht", en:"Overview", de:"Übersicht" },
  tip_stats:    { fr:"Statistiques", nl:"Statistieken", en:"Statistics", de:"Statistiken" },
  tip_planning: { fr:"Planning", nl:"Planning", en:"Planning", de:"Planung" },
  title_settings: { fr:"Paramètres", nl:"Instellingen", en:"Settings", de:"Einstellungen" },
  title_active_source: { fr:"Fichier source actif", nl:"Actief bronbestand", en:"Active source file", de:"Aktive Quelldatei" },
  menu_import: { fr:"📁 Importer un fichier source", nl:"📁 Bronbestand importeren", en:"📁 Import a source file", de:"📁 Quelldatei importieren" },
  menu_export: { fr:"⬇️ Exporter les données converties", nl:"⬇️ Geconverteerde gegevens exporteren", en:"⬇️ Export converted data", de:"⬇️ Konvertierte Daten exportieren" },
  menu_remove: { fr:"🗑️ Retirer ce fichier source", nl:"🗑️ Dit bronbestand verwijderen", en:"🗑️ Remove this source file", de:"🗑️ Diese Quelldatei entfernen" },
  menu_appearance: { fr:"🎨 Apparence", nl:"🎨 Weergave", en:"🎨 Appearance", de:"🎨 Aussehen" },
  menu_lookup: { fr:"⚙️ Tables de correspondance", nl:"⚙️ Opzoektabellen", en:"⚙️ Lookup tables", de:"⚙️ Nachschlagetabellen" },
  menu_interviews: { fr:"📋 Application enquête", nl:"📋 Enquête-app", en:"📋 Interviews app", de:"📋 Interview-App" },
  menu_planner: { fr:"🗓️ Planning Statbel", nl:"🗓️ Statbel-planning", en:"🗓️ Statbel planner", de:"🗓️ Statbel-Planer" },

  // ── Zone de dépôt / chargement ────────────────────────────────────
  dz_title: { fr:"Glissez le fichier GRP ici", nl:"Sleep het GRP-bestand hierheen", en:"Drag the GRP file here", de:"GRP-Datei hierher ziehen" },
  aria_donut: { fr:"Graphique en anneau (total {n}) ; valeurs détaillées dans la légende ci-contre", nl:"Ringdiagram (totaal {n}); details in de legende hiernaast", en:"Donut chart (total {n}); detailed values in the legend beside it", de:"Ringdiagramm (Gesamt {n}); Detailwerte in der Legende daneben" },
  aria_treemap: { fr:"Treemap : surface proportionnelle à l'effectif ; effectif affiché sur chaque tuile", nl:"Treemap: oppervlak evenredig met aantal; aantal op elke tegel", en:"Treemap: area proportional to count; count shown on each tile", de:"Treemap: Fläche proportional zur Anzahl; Anzahl auf jeder Kachel" },
  aria_sankey_nat: { fr:"Diagramme de flux nationalité → sexe → âge ; touchez un nœud pour son effectif", nl:"Stroomdiagram nationaliteit → geslacht → leeftijd; tik op een knoop voor het aantal", en:"Flow diagram nationality → sex → age; tap a node for its count", de:"Flussdiagramm Staatsangehörigkeit → Geschlecht → Alter; tippen Sie einen Knoten für die Anzahl an" },
  aria_sankey_hh: { fr:"Diagramme de flux taille du ménage → à interroger → âge ; touchez un nœud pour son effectif", nl:"Stroomdiagram huishoudgrootte → te bevragen → leeftijd; tik op een knoop voor het aantal", en:"Flow diagram household size → to survey → age; tap a node for its count", de:"Flussdiagramm Haushaltsgröße → zu befragen → Alter; tippen Sie einen Knoten für die Anzahl an" },
  dz_sub:   { fr:"ou cliquez pour sélectionner", nl:"of klik om te selecteren", en:"or click to select", de:"oder klicken zum Auswählen" },
  local_note: { fr:"🔒 Traitement 100 % local — aucune donnée n'est envoyée.", nl:"🔒 100 % lokale verwerking — er worden geen gegevens verzonden.", en:"🔒 100% local processing — no data is sent.", de:"🔒 100 % lokale Verarbeitung — es werden keine Daten gesendet." },
  dz_formats: { fr:"CSV / TSV / XLSX / XLS / PDF — GRP_2026xxxxx", nl:"CSV / TSV / XLSX / XLS / PDF — GRP_2026xxxxx", en:"CSV / TSV / XLSX / XLS / PDF — GRP_2026xxxxx", de:"CSV / TSV / XLSX / XLS / PDF — GRP_2026xxxxx" },
  dz_aria:  { fr:"Importer un fichier GRP", nl:"Een GRP-bestand importeren", en:"Import a GRP file", de:"Eine GRP-Datei importieren" },
  app_h1:   { fr:"Convertisseur GRP Statbel", nl:"Statbel GRP-omzetter", en:"Statbel GRP Converter", de:"Statbel GRP-Konverter" },
  aria_location:         { fr:"Localisation", nl:"Locatie", en:"Location", de:"Standort" },
  aria_pyr_nlty:         { fr:"Filtrer la pyramide par nationalité", nl:"Piramide filteren op nationaliteit", en:"Filter pyramid by nationality", de:"Pyramide nach Nationalität filtern" },
  aria_filter_continent: { fr:"Filtrer par continent", nl:"Filteren op continent", en:"Filter by continent", de:"Nach Kontinent filtern" },
  aria_filter_eu:        { fr:"Filtrer par UE / hors-UE", nl:"Filteren op EU / niet-EU", en:"Filter by EU / non-EU", de:"Nach EU / Nicht-EU filtern" },
  aria_filter_region:    { fr:"Filtrer par région", nl:"Filteren op gewest", en:"Filter by region", de:"Nach Region filtern" },
  aria_filter_province:  { fr:"Filtrer par province", nl:"Filteren op provincie", en:"Filter by province", de:"Nach Provinz filtern" },
  aria_filter_district:  { fr:"Filtrer par arrondissement", nl:"Filteren op arrondissement", en:"Filter by district", de:"Nach Bezirk filtern" },
  loading_generic: { fr:"Conversion…", nl:"Bezig met converteren…", en:"Converting…", de:"Konvertierung läuft…" },
  loading_converting: { fr:"Conversion de {name}…", nl:"{name} wordt geconverteerd…", en:"Converting {name}…", de:"{name} wird konvertiert…" },

  // ── Overview ───────────────────────────────────────────────────────
  lbl_location: { fr:"📍 Localisation :", nl:"📍 Locatie:", en:"📍 Location:", de:"📍 Standort:" },
  ph_location: { fr:"ex. SCHAERBEEK", nl:"bv. SCHAARBEEK", en:"e.g. SCHAERBEEK", de:"z. B. SCHAERBEEK" },
  lbl_source_rows: { fr:"Membres", nl:"Leden", en:"Members", de:"Mitglieder" },
  lbl_households: { fr:"Ménages", nl:"Huishoudens", en:"Households", de:"Haushalte" },
  lbl_targets: { fr:"Référents (FL=1)", nl:"Referentiepersonen (FL=1)", en:"Reference persons (FL=1)", de:"Referenzpersonen (FL=1)" },
  lbl_total_members: { fr:"Total des membres", nl:"Totaal aantal leden", en:"Total members", de:"Mitglieder gesamt" },
  hint_click_row: { fr:"▸ cliquez sur une ligne pour déplier le ménage", nl:"▸ klik op een rij om het huishouden uit te vouwen", en:"▸ click a row to expand the household", de:"▸ Klicken Sie auf eine Zeile, um den Haushalt aufzuklappen" },
  th_contact: { fr:"Contact", nl:"Contact", en:"Contact", de:"Kontakt" },
  th_address: { fr:"Adresse", nl:"Adres", en:"Address", de:"Adresse" },
  th_phone: { fr:"📞 Téléphone", nl:"📞 Telefoon", en:"📞 Phone", de:"📞 Telefon" },
  th_email: { fr:"✉️ Email", nl:"✉️ E-mail", en:"✉️ Email", de:"✉️ E-Mail" },
  tip_call: { fr:"Appeler", nl:"Bellen", en:"Call", de:"Anrufen" },
  tip_sms:  { fr:"Envoyer un SMS", nl:"Sms versturen", en:"Send SMS", de:"SMS senden" },
  tip_email:{ fr:"Envoyer un e-mail", nl:"E-mail versturen", en:"Send email", de:"E-Mail senden" },
  th_household: { fr:"Ménage", nl:"Huishouden", en:"Household", de:"Haushalt" },
  th_collect: { fr:"Méthode de collecte", nl:"Verzamelmethode", en:"Collection method", de:"Erhebungsmethode" },
  th_cawi_id: { fr:"Identifiant CAWI", nl:"CAWI-gebruikersnaam", en:"CAWI user ID", de:"CAWI-Benutzerkennung" },
  th_cawi_pwd: { fr:"Mot de passe CAWI", nl:"CAWI-wachtwoord", en:"CAWI password", de:"CAWI-Passwort" },
  cawi_sci_tip: { fr:"Identifiant corrompu (notation scientifique) : les chiffres ont été écrasés par Excel dans le fichier source — inutilisable. Réexportez la source avec cette colonne au format Texte.", nl:"Beschadigde ID (wetenschappelijke notatie): de cijfers zijn door Excel in het bronbestand overschreven — onbruikbaar. Exporteer de bron opnieuw met deze kolom als Tekst.", en:"Corrupted ID (scientific notation): the digits were overwritten by Excel in the source file — unusable. Re-export the source with this column formatted as Text.", de:"Beschädigte Kennung (wissenschaftliche Notation): Excel hat die Ziffern in der Quelldatei überschrieben — unbrauchbar. Exportieren Sie die Quelle erneut mit dieser Spalte im Textformat." },
  collect_cati: { fr:"📞 Téléphone (CATI)", nl:"📞 Telefoon (CATI)", en:"📞 Phone (CATI)", de:"📞 Telefon (CATI)" },
  collect_cawi: { fr:"💻 Internet (CAWI)", nl:"💻 Internet (CAWI)", en:"💻 Web (CAWI)", de:"💻 Internet (CAWI)" },
  admin_year: { fr:"Année", nl:"Jaar", en:"Year", de:"Jahr" },
  admin_wave: { fr:"Vague", nl:"Golf", en:"Wave", de:"Welle" },
  admin_sequence: { fr:"Séquence", nl:"Volgnummer", en:"Sequence", de:"Sequenz" },
  admin_refweek: { fr:"Sem. réf.", nl:"Refweek", en:"Ref. wk", de:"Ref.-Woche" },
  admin_group: { fr:"Groupe", nl:"Groep", en:"Group", de:"Gruppe" },
  lbl_rows: { fr:"lignes", nl:"rijen", en:"rows", de:"Zeilen" },

  // ── Alertes / avertissements codes inconnus ─────────────────────────
  warn_unknown_codes_title: { fr:"⚠️ Codes inconnus", nl:"⚠️ Onbekende codes", en:"⚠️ Unknown codes", de:"⚠️ Unbekannte Codes" },
  warn_unknown_codes_suffix: { fr:"— le champ concerné restera vide :", nl:"— het betreffende veld blijft leeg:", en:"— affected field left empty:", de:"— betroffenes Feld bleibt leer:" },
  field_nationality_code: { fr:"Nationalité (CD_MB_NLTY)", nl:"Nationaliteit (CD_MB_NLTY)", en:"Nationality (CD_MB_NLTY)", de:"Nationalität (CD_MB_NLTY)" },
  field_birthcountry_code: { fr:"Pays de naissance (CD_MB_BTH_REFNIS)", nl:"Geboorteland (CD_MB_BTH_REFNIS)", en:"Birth country (CD_MB_BTH_REFNIS)", de:"Geburtsland (CD_MB_BTH_REFNIS)" },
  field_municipality_code: { fr:"Commune belge (CD_MB_BTH_REFNIS, 5 chiffres)", nl:"Belgische gemeente (CD_MB_BTH_REFNIS, 5 cijfers)", en:"Belgian municipality (CD_MB_BTH_REFNIS, 5 digits)", de:"Belgische Gemeinde (CD_MB_BTH_REFNIS, 5 Ziffern)" },
  field_marital_code: { fr:"Statut matrimonial (CD_MB_MRTL_STS)", nl:"Burgerlijke staat (CD_MB_MRTL_STS)", en:"Marital status (CD_MB_MRTL_STS)", de:"Familienstand (CD_MB_MRTL_STS)" },
  txt_not_in: { fr:"→ absent de", nl:"→ niet in", en:"→ not in", de:"→ nicht in" },
  hint_add_codes: { fr:"Ajoutez ces codes dans la table correspondante à la source (NLTY_ISO / NLTY_ALIAS, REFNIS_COMMUNE, MRTL_FR) pour les décoder.", nl:"Voeg deze codes toe aan de bijbehorende tabel in de broncode (NLTY_ISO / NLTY_ALIAS, REFNIS_COMMUNE, MRTL_FR) om ze te decoderen.", en:"Add these codes to the matching table in the source (NLTY_ISO / NLTY_ALIAS, REFNIS_COMMUNE, MRTL_FR) to decode them.", de:"Fügen Sie diese Codes der entsprechenden Tabelle im Quellcode hinzu (NLTY_ISO / NLTY_ALIAS, REFNIS_COMMUNE, MRTL_FR), um sie zu dekodieren." },
  warn_missing_cols_title: { fr:"⚠️ Certaines colonnes attendues sont absentes", nl:"⚠️ Sommige verwachte kolommen ontbreken", en:"⚠️ Some expected columns are missing", de:"⚠️ Einige erwartete Spalten fehlen" },
  warn_missing_cols_suffix: { fr:"— les données concernées seront vides :", nl:"— de betreffende gegevens blijven leeg:", en:"— related data will be empty:", de:"— betroffene Daten bleiben leer:" },
  warn_sci_id_title: { fr:"⚠️ Identifiants web corrompus", nl:"⚠️ Beschadigde web-ID's", en:"⚠️ Corrupted web IDs", de:"⚠️ Beschädigte Web-Kennungen" },
  warn_sci_id_body: { fr:"{n} identifiant(s) sont en notation scientifique (ex. « {ex} ») : Excel a écrasé les chiffres DANS le fichier source — précision définitivement perdue, ces logins CAWI sont inutilisables. Ré-importer le même fichier n'y changera rien : il faut réexporter la source avec les colonnes d'identifiants au format Texte (ou obtenir un export non ouvert dans Excel).", nl:"{n} ID('s) staan in wetenschappelijke notatie (bv. « {ex} »): Excel heeft de cijfers IN het bronbestand overschreven — precisie definitief verloren, deze CAWI-logins zijn onbruikbaar. Hetzelfde bestand opnieuw importeren helpt niet: exporteer de bron opnieuw met de ID-kolommen als Tekst (of gebruik een export die niet in Excel is geopend).", en:"{n} ID(s) are in scientific notation (e.g. \"{ex}\"): Excel overwrote the digits INSIDE the source file — precision is permanently lost and these CAWI logins are unusable. Re-importing the same file won't help: re-export the source with the ID columns formatted as Text (or get an export that hasn't been opened in Excel).", de:"{n} Kennung(en) in wissenschaftlicher Notation (z. B. „{ex}“): Excel hat die Ziffern IN der Quelldatei überschrieben — die Genauigkeit ist dauerhaft verloren, diese CAWI-Logins sind unbrauchbar. Dieselbe Datei erneut zu importieren hilft nicht: Exportieren Sie die Quelle erneut mit den Kennungsspalten im Textformat (oder verwenden Sie einen nicht in Excel geöffneten Export)." },
  plan_not_found: { fr:"introuvable dans les plannings chargés", nl:"niet gevonden in de geladen plannings", en:"not found in the loaded plannings", de:"in den geladenen Planungen nicht gefunden" },
  plan_via_base: { fr:"Rattaché au groupe initial (vague 1) — même groupe, ré-interrogé", nl:"Gekoppeld aan de oorspronkelijke groep (golf 1) — zelfde groep, heropgevraagd", en:"Linked to the initial group (wave 1) — same group, re-interviewed", de:"Mit der ursprünglichen Gruppe (Welle 1) verknüpft — dieselbe Gruppe, erneut befragt" },

  // ── Export ────────────────────────────────────────────────────────
  lbl_source_file: { fr:"Fichier source :", nl:"Bronbestand:", en:"Source file:", de:"Quelldatei:" },
  btn_targets_csv: { fr:"⬇️ CSV Cibles", nl:"⬇️ CSV Doelpersonen", en:"⬇️ Targets CSV", de:"⬇️ CSV Zielpersonen" },
  btn_members_csv: { fr:"⬇️ CSV Membres", nl:"⬇️ CSV Leden", en:"⬇️ Members CSV", de:"⬇️ CSV Mitglieder" },
  btn_survey_csv: { fr:"⬇️ CSV Enquête", nl:"⬇️ CSV Enquête", en:"⬇️ Survey CSV", de:"⬇️ CSV Umfrage" },
  btn_txt_report: { fr:"⬇️ Rapport TXT", nl:"⬇️ TXT-rapport", en:"⬇️ TXT Report", de:"⬇️ TXT-Bericht" },
  btn_close: { fr:"Fermer", nl:"Sluiten", en:"Close", de:"Schließen" },
  btn_cancel: { fr:"Annuler", nl:"Annuleren", en:"Cancel", de:"Abbrechen" },

  // ── Apparence ─────────────────────────────────────────────────────
  lbl_language: { fr:"🌐 Langue", nl:"🌐 Taal", en:"🌐 Language", de:"🌐 Sprache" },
  h3_theme: { fr:"Thème", nl:"Thema", en:"Theme", de:"Thema" },
  h3_font: { fr:"Police", nl:"Lettertype", en:"Font", de:"Schriftart" },
  h3_textsize: { fr:"Taille du texte", nl:"Tekstgrootte", en:"Text size", de:"Textgröße" },
  opt_theme_light: { fr:"☀️ Clair", nl:"☀️ Licht", en:"☀️ Light", de:"☀️ Hell" },
  opt_theme_dark:  { fr:"🌙 Sombre", nl:"🌙 Donker", en:"🌙 Dark", de:"🌙 Dunkel" },
  opt_theme_auto:  { fr:"🖥️ Auto", nl:"🖥️ Auto", en:"🖥️ Auto", de:"🖥️ Auto" },
  opt_font_system: { fr:"Police système (par défaut)", nl:"Systeemlettertype (standaard)", en:"System default", de:"Systemschriftart (Standard)" },
  opt_font_georgia: { fr:"Georgia (serif)", nl:"Georgia (schreef)", en:"Georgia (serif)", de:"Georgia (Serif)" },
  opt_font_times: { fr:"Times New Roman (serif)", nl:"Times New Roman (schreef)", en:"Times New Roman (serif)", de:"Times New Roman (Serif)" },
  opt_font_mono: { fr:"Courier New (mono)", nl:"Courier New (mono)", en:"Courier New (mono)", de:"Courier New (Mono)" },

  // ── Lookup tables (modale) ────────────────────────────────────────
  lookup_intro: { fr:"Codes STATBEL utilisés lors de la conversion.", nl:"STATBEL-codes die tijdens de conversie worden gebruikt.", en:"STATBEL codes used during conversion.", de:"STATBEL-Codes, die bei der Konvertierung verwendet werden." },
  lk_gender: { fr:"⚧ Sexe", nl:"⚧ Geslacht", en:"⚧ Gender", de:"⚧ Geschlecht" },
  lk_marital: { fr:"💍 État civil", nl:"💍 Burgerlijke staat", en:"💍 Marital", de:"💍 Familienstand" },
  lk_countries: { fr:"🌍 Pays", nl:"🌍 Landen", en:"🌍 Countries", de:"🌍 Länder" },
  lk_municipalities: { fr:"🏙️ Communes belges", nl:"🏙️ Belgische gemeenten", en:"🏙️ Belgian municipalities", de:"🏙️ Belgische Gemeinden" },
  col_code: { fr:"Code", nl:"Code", en:"Code", de:"Code" },
  col_abbr: { fr:"Abrév.", nl:"Afk.", en:"Abbr.", de:"Abk." },
  col_label: { fr:"Libellé", nl:"Label", en:"Label", de:"Bezeichnung" },
  col_nis: { fr:"NIS", nl:"NIS", en:"NIS", de:"NIS" },
  col_iso3: { fr:"ISO3", nl:"ISO3", en:"ISO3", de:"ISO3" },
  col_iso2: { fr:"ISO2", nl:"ISO2", en:"ISO2", de:"ISO2" },
  col_nuts0: { fr:"NUTS0", nl:"NUTS0", en:"NUTS0", de:"NUTS0" },
  col_country: { fr:"Pays", nl:"Land", en:"Country", de:"Land" },
  col_continent: { fr:"Continent", nl:"Continent", en:"Continent", de:"Kontinent" },
  col_eu: { fr:"EU", nl:"EU", en:"EU", de:"EU" },
  col_refnis: { fr:"REFNIS", nl:"REFNIS", en:"REFNIS", de:"REFNIS" },
  col_muni_fr: { fr:"Commune (FR)", nl:"Gemeente (FR)", en:"Municipality (FR)", de:"Gemeinde (FR)" },
  col_muni_nl: { fr:"Commune (NL)", nl:"Gemeente (NL)", en:"Municipality (NL)", de:"Gemeinde (NL)" },
  col_district: { fr:"Arrondissement", nl:"District", en:"District", de:"Bezirk" },
  col_province: { fr:"Province", nl:"Provincie", en:"Province", de:"Provinz" },
  col_region: { fr:"Région", nl:"Gewest", en:"Region", de:"Region" },
  col_nuts2: { fr:"NUTS2", nl:"NUTS2", en:"NUTS2", de:"NUTS2" },
  col_nuts3: { fr:"NUTS3", nl:"NUTS3", en:"NUTS3", de:"NUTS3" },
  opt_all_continents: { fr:"Tous les continents", nl:"Alle continenten", en:"All continents", de:"Alle Kontinente" },
  opt_all_regions: { fr:"Toutes les régions", nl:"Alle gewesten", en:"All regions", de:"Alle Regionen" },
  opt_all_provinces: { fr:"Toutes les provinces", nl:"Alle provincies", en:"All provinces", de:"Alle Provinzen" },
  opt_all_districts: { fr:"Tous les arrondissements", nl:"Alle districten", en:"All districts", de:"Alle Bezirke" },
  opt_all_communes: { fr:"Toutes les communes", nl:"Alle gemeenten", en:"All communes", de:"Alle Gemeinden" },
  opt_all_quartiers: { fr:"Tous les quartiers", nl:"Alle wijken", en:"All quartiers", de:"Alle Viertel" },
  opt_eu_and_noneu: { fr:"UE et hors UE", nl:"EU en niet-EU", en:"EU & non-EU", de:"EU und Nicht-EU" },
  opt_eu_only: { fr:"UE uniquement", nl:"Alleen EU", en:"EU only", de:"Nur EU" },
  opt_noneu: { fr:"Hors UE", nl:"Niet-EU", en:"Non-EU", de:"Nicht-EU" },
  lbl_unknown: { fr:"Inconnu", nl:"Onbekend", en:"Unknown", de:"Unbekannt" },
  lbl_eu_short: { fr:"UE", nl:"EU", en:"EU", de:"EU" },
  lbl_noneu_short: { fr:"Hors UE", nl:"Niet-EU", en:"Non-EU", de:"Nicht-EU" },
  continent_europe: { fr:"Europe", nl:"Europa", en:"Europe", de:"Europa" },
  continent_asia: { fr:"Asie", nl:"Azië", en:"Asia", de:"Asien" },
  continent_africa: { fr:"Afrique", nl:"Afrika", en:"Africa", de:"Afrika" },
  continent_america_north: { fr:"Amérique (Nord/Centrale)", nl:"Amerika (Noord/Centraal)", en:"America (North/Central)", de:"Amerika (Nord/Mittel)" },
  continent_america_south: { fr:"Amérique (Sud)", nl:"Amerika (Zuid)", en:"America (South)", de:"Amerika (Süd)" },
  continent_oceania: { fr:"Océanie", nl:"Oceanië", en:"Oceania", de:"Ozeanien" },
  ph_search_country: { fr:"Rechercher par NIS, ISO ou nom…", nl:"Zoeken op NIS, ISO of naam…", en:"Search NIS, ISO or name…", de:"Suche nach NIS, ISO oder Name…" },
  ph_search_commune: { fr:"Rechercher par REFNIS ou nom…", nl:"Zoeken op REFNIS of naam…", en:"Search REFNIS or name…", de:"Suche nach REFNIS oder Name…" },
  btn_clear: { fr:"Effacer", nl:"Wissen", en:"Clear", de:"Löschen" },
  pl_move_up: { fr:"Monter", nl:"Omhoog", en:"Move up", de:"Nach oben" },
  pl_move_down: { fr:"Descendre", nl:"Omlaag", en:"Move down", de:"Nach unten" },
  skip_link: { fr:"Aller au contenu", nl:"Naar de inhoud", en:"Skip to content", de:"Zum Inhalt springen" },

  // ── Statistics ────────────────────────────────────────────────────
  lbl_survey_colon: { fr:"Enquête :", nl:"Enquête:", en:"Survey:", de:"Umfrage:" },
  btn_this_survey: { fr:"📋 Cette enquête", nl:"📋 Deze enquête", en:"📋 This survey", de:"📋 Diese Umfrage" },
  btn_all_surveys: { fr:"🗂️ Toutes les enquêtes", nl:"🗂️ Alle enquêtes", en:"🗂️ All surveys", de:"🗂️ Alle Umfragen" },
  lbl_population_colon: { fr:"Population :", nl:"Populatie:", en:"Population:", de:"Bevölkerung:" },
  btn_reference: { fr:"👤 Référent", nl:"👤 Referentiepersoon", en:"👤 Reference person", de:"👤 Referenzperson" },
  btn_target_15: { fr:"🎯 Cibles", nl:"🎯 Doelpersonen", en:"🎯 Targets", de:"🎯 Zielpersonen" },
  btn_full_household: { fr:"👥 Ménage complet", nl:"👥 Volledig huishouden", en:"👥 Full household", de:"👥 Ganzer Haushalt" },
  lbl_age_min: { fr:"Âge min. cible", nl:"Min. leeftijd doel", en:"Min. target age", de:"Mindestalter Ziel" },
  legend_men: { fr:"Hommes", nl:"Mannen", en:"Men", de:"Männer" },
  legend_women: { fr:"Femmes", nl:"Vrouwen", en:"Women", de:"Frauen" },
  kpi_pop_total: { fr:"Population totale", nl:"Totale populatie", en:"Total population", de:"Gesamtbevölkerung" },
  kpi_households: { fr:"Ménages", nl:"Huishoudens", en:"Households", de:"Haushalte" },
  kpi_pct_men: { fr:"% Hommes", nl:"% Mannen", en:"% Men", de:"% Männer" },
  kpi_pct_women: { fr:"% Femmes", nl:"% Vrouwen", en:"% Women", de:"% Frauen" },
  kpi_avg_age: { fr:"Âge moyen", nl:"Gemiddelde leeftijd", en:"Average age", de:"Durchschnittsalter" },
  kpi_avg_hh_size: { fr:"Taille moy. ménage", nl:"Gem. gezinsgrootte", en:"Avg. household size", de:"Ø Haushaltsgröße" },
  kpi_targets15: { fr:"Cibles ≥15 ans", nl:"Doelen ≥15 jaar", en:"Targets ≥15", de:"Zielpers. ≥15" },
  kpi_targets_min: { fr:"Cibles ≥{n} ans", nl:"Doelen ≥{n} jaar", en:"Targets ≥{n}", de:"Zielpers. ≥{n}" },
  card_age_lfs: { fr:"📊 Tranches d'âge", nl:"📊 Leeftijdsgroepen", en:"📊 Age brackets", de:"📊 Altersgruppen" },
  card_dependency: { fr:"⚖️ Ratio de dépendance", nl:"⚖️ Afhankelijkheidsratio", en:"⚖️ Dependency ratio", de:"⚖️ Abhängigkeitsquote" },
  card_contactability: { fr:"📞 Complétude des contacts", nl:"📞 Contactgegevens", en:"📞 Contact completeness", de:"📞 Kontaktvollständigkeit" },
  lbl_has_phone: { fr:"Téléphone", nl:"Telefoon", en:"Phone", de:"Telefon" },
  lbl_has_email: { fr:"Email", nl:"E-mail", en:"Email", de:"E-Mail" },
  lbl_reachable: { fr:"Joignable", nl:"Bereikbaar", en:"Reachable", de:"Erreichbar" },
  lbl_dep_young: { fr:"Jeunes (<15)", nl:"Jongeren (<15)", en:"Young (<15)", de:"Junge (<15)" },
  lbl_dep_active: { fr:"Actifs (15–64)", nl:"Actief (15–64)", en:"Working age (15–64)", de:"Erwerbsalter (15–64)" },
  lbl_dep_old: { fr:"Âgés (65+)", nl:"Ouderen (65+)", en:"Elderly (65+)", de:"Ältere (65+)" },
  lbl_dep_ratio: { fr:"ratio dép.", nl:"afh.ratio", en:"dep. ratio", de:"Abh.quote" },
  txt_dep_ratio: { fr:"Ratio de dépendance : {n} pour 100 actifs", nl:"Afhankelijkheidsratio: {n} per 100 actieven", en:"Dependency ratio: {n} per 100 working-age", de:"Abhängigkeitsquote: {n} je 100 Erwerbstätige" },
  kpi_pct_foreign: { fr:"% né·es à l'étranger", nl:"% in buitenland geboren", en:"% born abroad", de:"% im Ausland geboren" },
  kpi_pct_minors: { fr:"% mineurs (<15)", nl:"% minderjarigen (<15)", en:"% minors (<15)", de:"% Minderjährige (<15)" },
  kpi_pct_minors_dyn: { fr:"% mineurs (<{n})", nl:"% minderjarigen (<{n})", en:"% minors (<{n})", de:"% Minderjährige (<{n})" },
  kpi_age_median: { fr:"Âge médian", nl:"Mediane leeftijd", en:"Median age", de:"Medianalter" },
  kpi_pay_potential: { fr:"Indemnité potentielle", nl:"Potentiële vergoeding", en:"Potential payment", de:"Potenzielle Vergütung" },
  kpi_pay_potential_tip: { fr:"Montant maximal payé par Statbel si toute l'enquête est réalisée : {hh} ménages × {qm} + {cib} cibles × {qp}. Quotas repris des paramètres du module Interviews.", nl:"Maximaal door Statbel betaald bedrag als de volledige enquête wordt uitgevoerd: {hh} huishoudens × {qm} + {cib} doelen × {qp}. Quota's overgenomen uit de instellingen van de Interviews-module.", en:"Maximum amount paid by Statbel if the whole survey is completed: {hh} households × {qm} + {cib} targets × {qp}. Quotas taken from the Interviews module settings.", de:"Höchstbetrag, den Statbel bei vollständiger Durchführung der Erhebung zahlt: {hh} Haushalte × {qm} + {cib} Zielpersonen × {qp}. Quoten aus den Einstellungen des Interviews-Moduls." },
  kpi_pay_no_quota: { fr:"Définissez les quotas de paiement (par ménage et par personne ≥15) dans les paramètres du module Interviews pour estimer l'indemnité.", nl:"Stel de betalingsquota in (per huishouden en per persoon ≥15) in de instellingen van de Interviews-module om de vergoeding te schatten.", en:"Set the payment quotas (per household and per person ≥15) in the Interviews module settings to estimate the payment.", de:"Legen Sie die Zahlungsquoten (pro Haushalt und pro Person ≥15) in den Einstellungen des Interviews-Moduls fest, um die Vergütung zu schätzen." },
  btn_customize_kpi: { fr:"Personnaliser les KPI", nl:"KPI aanpassen", en:"Customize KPIs", de:"KPIs anpassen" },
  perso_title: { fr:"Personnaliser les KPI", nl:"KPI aanpassen", en:"Customize KPIs", de:"KPIs anpassen" },
  perso_hint: { fr:"Cochez et réordonnez les indicateurs de la vue Statistiques.", nl:"Vink aan en herschik de indicatoren van de Statistiek-weergave.", en:"Toggle and reorder the indicators of the Statistics view.", de:"Indikatoren der Statistik-Ansicht aus-/einblenden und neu ordnen." },
  perso_reset: { fr:"↺ Réinitialiser", nl:"↺ Herstellen", en:"↺ Reset", de:"↺ Zurücksetzen" },
  perso_title2: { fr:"Personnaliser l'affichage", nl:"Weergave aanpassen", en:"Customize display", de:"Anzeige anpassen" },
  perso_tab_kpi: { fr:"KPI", nl:"KPI", en:"KPIs", de:"KPIs" },
  perso_tab_blocs: { fr:"Blocs d'analyse", nl:"Analyseblokken", en:"Analysis blocks", de:"Analyseblöcke" },
  perso_hint_blocs: { fr:"Cochez et réordonnez les graphiques & tableaux de la vue Statistiques.", nl:"Vink aan en herschik de grafieken & tabellen van de Statistiek-weergave.", en:"Toggle and reorder the charts & tables of the Statistics view.", de:"Diagramme & Tabellen der Statistik-Ansicht aus-/einblenden und neu ordnen." },
  perso_tab_cols: { fr:"Colonnes", nl:"Kolommen", en:"Columns", de:"Spalten" },
  perso_hint_cols: { fr:"Cochez et réordonnez les colonnes du tableau de l'Aperçu.", nl:"Vink aan en herschik de kolommen van de Overzicht-tabel.", en:"Toggle and reorder the columns of the Overview table.", de:"Spalten der Übersicht-Tabelle aus-/einblenden und neu ordnen." },
  perso_tab_hh: { fr:"Ménage", nl:"Huishouden", en:"Household", de:"Haushalt" },
  perso_hint_hh: { fr:"Cochez et réordonnez les colonnes du détail du ménage (accordéon).", nl:"Vink aan en herschik de kolommen van het huishouddetail (accordeon).", en:"Toggle and reorder the columns of the household detail (accordion).", de:"Spalten des Haushaltsdetails (Akkordeon) aus-/einblenden und neu ordnen." },
  perso_hint_cols_group: { fr:"Cochez et réordonnez les colonnes du tableau de l'Aperçu et du détail du ménage (accordéon).", nl:"Vink aan en herschik de kolommen van de Overzicht-tabel en van het huishouddetail (accordeon).", en:"Toggle and reorder the columns of the Overview table and of the household detail (accordion).", de:"Spalten der Übersicht-Tabelle und des Haushaltsdetails (Akkordeon) aus-/einblenden und neu ordnen." },
  perso_sub_apercu: { fr:"Tableau (Aperçu)", nl:"Tabel (Overzicht)", en:"Table (Overview)", de:"Tabelle (Übersicht)" },
  perso_sub_menage: { fr:"Détail du ménage (accordéon)", nl:"Huishouddetail (accordeon)", en:"Household detail (accordion)", de:"Haushaltsdetail (Akkordeon)" },
  hh_firstname: { fr:"Prénom", nl:"Voornaam", en:"First name", de:"Vorname" },
  hh_lastname: { fr:"Nom", nl:"Naam", en:"Last name", de:"Name" },
  hh_age: { fr:"Âge", nl:"Leeftijd", en:"Age", de:"Alter" },
  hh_birthdate: { fr:"Date de naissance", nl:"Geboortedatum", en:"Birth date", de:"Geburtsdatum" },
  hh_gender: { fr:"Sexe", nl:"Geslacht", en:"Gender", de:"Geschlecht" },
  hh_country_birth: { fr:"Pays de naissance", nl:"Geboorteland", en:"Country birth", de:"Geburtsland" },
  hh_municipality_birth: { fr:"Commune de naissance", nl:"Geboortegemeente", en:"Municipality birth", de:"Geburtsgemeinde" },
  hh_nationality: { fr:"Nationalité", nl:"Nationaliteit", en:"Nationality", de:"Staatsangehörigkeit" },
  hh_marital: { fr:"État civil", nl:"Burgerlijke staat", en:"Marital status", de:"Familienstand" },
  col_num: { fr:"N° (ordre)", nl:"Nr. (volgorde)", en:"# (order)", de:"Nr. (Reihenfolge)" },
  btn_customize: { fr:"Personnaliser", nl:"Aanpassen", en:"Customize", de:"Anpassen" },
  menu_customize: { fr:"🎛️ Personnaliser l'affichage", nl:"🎛️ Weergave aanpassen", en:"🎛️ Customize display", de:"🎛️ Anzeige anpassen" },
  bloc_hide: { fr:"Masquer ce bloc (réaffichable via Personnaliser)", nl:"Dit blok verbergen (opnieuw tonen via Aanpassen)", en:"Hide this block (restore via Customize)", de:"Diesen Block ausblenden (über Anpassen wieder einblenden)" },
  card_nationalities: { fr:"🌍 Nationalités", nl:"🌍 Nationaliteiten", en:"🌍 Nationalities", de:"🌍 Nationalitäten" },
  hint_area_headcount: { fr:"(surface ∝ effectif)", nl:"(oppervlakte ∝ aantal)", en:"(area ∝ headcount)", de:"(Fläche ∝ Anzahl)" },
  card_by_continent: { fr:"🌐 Par continent", nl:"🌐 Per continent", en:"🌐 By continent", de:"🌐 Nach Kontinent" },
  card_eu_noneu: { fr:"🇪🇺 UE / hors UE", nl:"🇪🇺 EU / niet-EU", en:"🇪🇺 EU / non-EU", de:"🇪🇺 EU / Nicht-EU" },
  card_marital: { fr:"💍 État civil", nl:"💍 Burgerlijke staat", en:"💍 Marital status", de:"💍 Familienstand" },
  card_gender: { fr:"⚧ Sexe", nl:"⚧ Geslacht", en:"⚧ Gender", de:"⚧ Geschlecht" },
  card_birthplace: { fr:"🏙️ Lieu de naissance", nl:"🏙️ Geboorteplaats", en:"🏙️ Place of birth", de:"🏙️ Geburtsort" },
  hint_born_be: { fr:"(nés en Belgique, toute nationalité)", nl:"(geboren in België, ongeacht nationaliteit)", en:"(born in Belgium, any nationality)", de:"(geboren in Belgien, unabhängig von der Nationalität)" },
  card_age_pyramid: { fr:"📊 Pyramide des âges", nl:"📊 Leeftijdspiramide", en:"📊 Age pyramid", de:"📊 Alterspyramide" },
  card_household_dist: { fr:"👥 Répartition par taille de ménage", nl:"👥 Verdeling naar gezinsgrootte", en:"👥 Household size distribution", de:"👥 Verteilung nach Haushaltsgröße" },
  card_targets_per_hh: { fr:"🎯 Personnes à interroger par ménage", nl:"🎯 Te ondervragen personen per huishouden", en:"🎯 Persons to survey per household", de:"🎯 Zu befragende Personen pro Haushalt" },
  card_targets_per_hh_dyn: { fr:"🎯 Personnes à interroger (≥{n}) par ménage", nl:"🎯 Te ondervragen personen (≥{n}) per huishouden", en:"🎯 Persons to survey (≥{n}) per household", de:"🎯 Zu befragende Personen (≥{n}) pro Haushalt" },
  card_hh_composition: { fr:"🏠 Composition des ménages", nl:"🏠 Samenstelling huishoudens", en:"🏠 Household composition", de:"🏠 Haushaltszusammensetzung" },
  word_targets_unit: { fr:"personne(s) à interroger", nl:"te ondervragen pers.", en:"person(s) to survey", de:"zu befragende Pers." },
  word_targets_per_hh_unit: { fr:"à interroger/ménage", nl:"te ondervragen/huish.", en:"to survey/hh", de:"zu befragen/HH" },
  lbl_hh_mono: { fr:"Mono-personne", nl:"Eenpersoons", en:"Single-person", de:"Einpersonen" },
  lbl_hh_with_minor: { fr:"Multi, avec mineur", nl:"Multi, met minderjarige", en:"Multi, with minor", de:"Multi, mit Minderj." },
  lbl_hh_no_minor: { fr:"Multi, sans mineur", nl:"Multi, zonder minderj.", en:"Multi, no minor", de:"Multi, ohne Minderj." },
  card_sankey: { fr:"🔀 Flux Nationalité → Sexe → Âge", nl:"🔀 Stroom Nationaliteit → Geslacht → Leeftijd", en:"🔀 Nationality → Gender → Age flow", de:"🔀 Fluss Nationalität → Geschlecht → Alter" },
  card_sankey_hh: { fr:"🔀 Ménages : taille → à interroger → âge dominant", nl:"🔀 Huishoudens: grootte → te ondervragen → dominante leeftijd", en:"🔀 Households: size → to survey → dominant age", de:"🔀 Haushalte: Größe → zu befragen → dominantes Alter" },

  // ── Statistics — libellés dynamiques (graphiques) ────────────────
  gender_men: { fr:"Hommes", nl:"Mannen", en:"Men", de:"Männer" },
  gender_women: { fr:"Femmes", nl:"Vrouwen", en:"Women", de:"Frauen" },
  gender_other: { fr:"Autre", nl:"Ander", en:"Other", de:"Andere" },
  nlty_others: { fr:"Autres", nl:"Overige", en:"Others", de:"Andere" },
  crumb_belgium: { fr:"🇧🇪 Belgique", nl:"🇧🇪 België", en:"🇧🇪 Belgium", de:"🇧🇪 Belgien" },
  txt_nobody_born_be: { fr:"Personne née en Belgique dans ce périmètre.", nl:"Niemand geboren in België binnen deze selectie.", en:"Nobody born in Belgium in this scope.", de:"Niemand in diesem Bereich in Belgien geboren." },
  txt_all_nationalities: { fr:"Toutes nationalités ({n})", nl:"Alle nationaliteiten ({n})", en:"All nationalities ({n})", de:"Alle Nationalitäten ({n})" },
  txt_bracket: { fr:"Tranche {lbl}", nl:"Leeftijdsgroep {lbl}", en:"Bracket {lbl}", de:"Altersgruppe {lbl}" },
  txt_by_nationality: { fr:", par nationalité", nl:", per nationaliteit", en:", by nationality", de:", nach Nationalität" },
  txt_by_nationality_hh: { fr:", par nationalité (réf. du ménage)", nl:", per nationaliteit (referentiepersoon huishouden)", en:", by nationality (household reference)", de:", nach Nationalität (Referenzperson des Haushalts)" },
  txt_drill_hint: { fr:"Cliquez une catégorie pour la répartition par nationalité :", nl:"Klik op een categorie voor de verdeling per nationaliteit:", en:"Click a category for the breakdown by nationality:", de:"Auf eine Kategorie klicken für die Aufschlüsselung nach Nationalität:" },
  word_person: { fr:["personne","personnes"], nl:["persoon","personen"], en:["person","people"], de:["Person","Personen"] },
  word_member: { fr:["membre","membres"], nl:["lid","leden"], en:["member","members"], de:["Mitglied","Mitglieder"] },
  txt_households_of_size: { fr:"Ménages de {n} membre(s)", nl:"Huishoudens van {n} lid/leden", en:"Households of {n} member(s)", de:"Haushalte mit {n} Mitglied(ern)" },
  pyr_men_tpl: { fr:"♂ Hommes ({n})", nl:"♂ Mannen ({n})", en:"♂ Men ({n})", de:"♂ Männer ({n})" },
  pyr_women_tpl: { fr:"Femmes ({n}) ♀", nl:"Vrouwen ({n}) ♀", en:"Women ({n}) ♀", de:"Frauen ({n}) ♀" },
  age_years: { fr:"ans", nl:"jaar", en:"yrs", de:"Jahre" },
  title_zoom_bracket: { fr:"Cliquer : répartition par nationalité de cette tranche", nl:"Klikken: verdeling naar nationaliteit van deze leeftijdsgroep", en:"Click: breakdown by nationality of this bracket", de:"Klicken: Aufschlüsselung nach Nationalität dieser Altersgruppe" },
  word_men_unit: { fr:["homme","hommes"], nl:["man","mannen"], en:["man","men"], de:["Mann","Männer"] },
  word_women_unit: { fr:["femme","femmes"], nl:["vrouw","vrouwen"], en:["woman","women"], de:["Frau","Frauen"] },

  // ── Planning ──────────────────────────────────────────────────────
  plan_title: { fr:"📅 Planning enquêtes terrain", nl:"📅 Planning veldwerk", en:"📅 Field survey planning", de:"📅 Planung der Felderhebung" },
  plan_intro: { fr:"Plannings d'enquêtes (LFS/EFT, EU-SILC, HBS, TIC, Voyages, Santé, recensements…). Importe un fichier de planning (Excel/CSV) puis associe ses colonnes. Sélectionne une province/commune pour voir les missions et localiser les quartiers/adresses sur la carte.",
    nl:"Enquêteplannings (LFS/EFT, EU-SILC, HBS, TIC, Reizen, Gezondheid, volkstellingen…). Importeer een planningbestand (Excel/CSV) en koppel de kolommen. Selecteer een provincie/gemeente om de opdrachten te zien en de wijken/adressen op de kaart te lokaliseren.",
    en:"Survey plannings (LFS, EU-SILC, HBS, TIC, Travel, Health, censuses…). Import a planning file (Excel/CSV) then map its columns. Select a province/municipality to see the assignments and locate the quartiers/addresses on the map.",
    de:"Erhebungsplanungen (LFS, EU-SILC, HBS, TIC, Reisen, Gesundheit, Volkszählungen…). Importieren Sie eine Planungsdatei (Excel/CSV) und ordnen Sie deren Spalten zu. Wählen Sie eine Provinz/Gemeinde, um die Einsätze zu sehen und die Viertel/Adressen auf der Karte zu lokalisieren." },
  lbl_planning_colon: { fr:"Planning :", nl:"Planning:", en:"Planning:", de:"Planung:" },
  btn_import_planning: { fr:"📥 Importer un planning", nl:"📥 Planning importeren", en:"📥 Import a planning", de:"📥 Planung importieren" },
  btn_delete: { fr:"🗑️ Supprimer", nl:"🗑️ Verwijderen", en:"🗑️ Delete", de:"🗑️ Löschen" },
  chk_upcoming_only: { fr:"À venir uniquement", nl:"Alleen komende", en:"Upcoming only", de:"Nur bevorstehende" },
  ph_search_group_quartier: { fr:"Rechercher groupe / quartier…", nl:"Zoeken op groep / wijk…", en:"Search group / quartier…", de:"Suche nach Gruppe / Viertel…" },
  lbl_check_address: { fr:"📍 Vérifier une adresse :", nl:"📍 Adres controleren:", en:"📍 Check an address:", de:"📍 Adresse prüfen:" },
  ph_check_address: { fr:"ex. Grande Rue au Bois 12, Schaerbeek", nl:"bv. Grande Rue au Bois 12, Schaarbeek", en:"e.g. Grande Rue au Bois 12, Schaerbeek", de:"z. B. Grande Rue au Bois 12, Schaerbeek" },
  btn_locate: { fr:"Localiser", nl:"Lokaliseren", en:"Locate", de:"Lokalisieren" },
  title_recalc: { fr:"Vider le cache et recalculer la position des quartiers affichés", nl:"Cache wissen en de positie van de weergegeven wijken herberekenen", en:"Clear the cache and recompute the position of the displayed quartiers", de:"Cache leeren und die Position der angezeigten Viertel neu berechnen" },
  btn_recalc: { fr:"🔄 Recalculer", nl:"🔄 Herberekenen", en:"🔄 Recompute", de:"🔄 Neu berechnen" },
  map_intro: { fr:"Fichier : <strong id=\"mapFichier\"></strong> — <span id=\"mapNbLignes\"></span> ligne(s). Associe chaque information à une colonne du fichier (1 ligne = 1 mission/interrogation).",
    nl:"Bestand: <strong id=\"mapFichier\"></strong> — <span id=\"mapNbLignes\"></span> regel(s). Koppel elk gegeven aan een kolom van het bestand (1 regel = 1 opdracht/interview).",
    en:"File: <strong id=\"mapFichier\"></strong> — <span id=\"mapNbLignes\"></span> row(s). Map each piece of information to a column of the file (1 row = 1 assignment/interview).",
    de:"Datei: <strong id=\"mapFichier\"></strong> — <span id=\"mapNbLignes\"></span> Zeile(n). Ordnen Sie jede Information einer Spalte der Datei zu (1 Zeile = 1 Einsatz/Interview)." },
  map_lbl_name: { fr:"Nom du planning", nl:"Naam van de planning", en:"Planning name", de:"Name der Planung" },
  map_lbl_type: { fr:"Type d'enquête", nl:"Type enquête", en:"Survey type", de:"Umfragetyp" },
  map_opt_travel: { fr:"Voyages & Vacances", nl:"Reizen & Vakanties", en:"Travel & Holidays", de:"Reisen & Urlaub" },
  map_opt_health: { fr:"Santé", nl:"Gezondheid", en:"Health", de:"Gesundheit" },
  map_opt_census: { fr:"Recensement / spéciale", nl:"Volkstelling / speciaal", en:"Census / special", de:"Volkszählung / Sonder" },
  map_opt_other: { fr:"Autre", nl:"Andere", en:"Other", de:"Andere" },
  map_lbl_commune: { fr:"Commune", nl:"Gemeente", en:"Municipality", de:"Gemeinde" },
  map_lbl_quartier: { fr:"Quartier / adresse", nl:"Wijk / adres", en:"Quartier / address", de:"Viertel / Adresse" },
  map_lbl_province: { fr:"Province", nl:"Provincie", en:"Province", de:"Provinz" },
  map_lbl_group: { fr:"Groupe / code", nl:"Groep / code", en:"Group / code", de:"Gruppe / Code" },
  map_lbl_wave: { fr:"Vague", nl:"Golf", en:"Wave", de:"Welle" },
  map_lbl_refweek: { fr:"Semaine de réf.", nl:"Refweek", en:"Ref. week", de:"Referenzwoche" },
  map_lbl_start: { fr:"Date début", nl:"Startdatum", en:"Start date", de:"Startdatum" },
  map_lbl_stop: { fr:"Date fin", nl:"Einddatum", en:"End date", de:"Enddatum" },
  btn_import_confirm: { fr:"✅ Importer", nl:"✅ Importeren", en:"✅ Import", de:"✅ Importieren" },
  planning_none_option: { fr:"(aucun planning — importez-en un)", nl:"(geen planning — importeer er een)", en:"(no planning — import one)", de:"(keine Planung — importieren Sie eine)" },
  opt_none: { fr:"aucune", nl:"geen", en:"none", de:"keine" },
  txt_planning_count: { fr:"{n} groupe(s) · {m} interro.", nl:"{n} groep(en) · {m} interview(s)", en:"{n} group(s) · {m} interview(s)", de:"{n} Gruppe(n) · {m} Interview(s)" },
  th_group: { fr:"Groupe", nl:"Groep", en:"Group", de:"Gruppe" },
  th_commune: { fr:"Commune", nl:"Gemeente", en:"Commune", de:"Gemeinde" },
  th_quartier: { fr:"Quartier", nl:"Wijk", en:"Quartier", de:"Viertel" },
  th_precision: { fr:"Précision", nl:"Nauwkeurigheid", en:"Precision", de:"Genauigkeit" },
  th_next: { fr:"Prochaine", nl:"Volgende", en:"Next", de:"Nächste" },
  geo_prec_high: { fr:"élevée", nl:"hoog", en:"high", de:"hoch" },
  geo_prec_medium: { fr:"moyenne", nl:"gemiddeld", en:"medium", de:"mittel" },
  geo_prec_low: { fr:"commune", nl:"gemeente", en:"municipality-level", de:"Gemeindeebene" },
  geo_prec_low_approx: { fr:"commune (approx.)", nl:"gemeente (bij benadering)", en:"municipality-level (approx.)", de:"Gemeindeebene (ungefähr)" },
  geo_prec_fail: { fr:"échec", nl:"mislukt", en:"failed", de:"fehlgeschlagen" },
  geo_prec_pending: { fr:"…", nl:"…", en:"…", de:"…" },
  src_centre: { fr:"centre commune", nl:"gemeentecentrum", en:"municipality centre", de:"Gemeindezentrum" },
  txt_precision_word: { fr:"localisation", nl:"locatie", en:"location", de:"Standort" },
  txt_map_not_ready: { fr:"Carte non prête.", nl:"Kaart niet klaar.", en:"Map not ready.", de:"Karte nicht bereit." },
  txt_searching: { fr:"Recherche…", nl:"Zoeken…", en:"Searching…", de:"Suche läuft…" },
  txt_address_not_found: { fr:"❌ adresse introuvable", nl:"❌ adres niet gevonden", en:"❌ address not found", de:"❌ Adresse nicht gefunden" },
  txt_approx: { fr:"⚠️ approximatif (hors commune ?)", nl:"⚠️ bij benadering (buiten de gemeente?)", en:"⚠️ approximate (outside the municipality?)", de:"⚠️ ungefähr (außerhalb der Gemeinde?)" },
  txt_geocoded_n: { fr:"{n} quartier(s) localisé(s).", nl:"{n} wijk(en) gelokaliseerd.", en:"{n} quartier(s) located.", de:"{n} Viertel lokalisiert." },
  txt_geocoding_progress: { fr:"Géocodage… {i}/{n}", nl:"Geocoderen… {i}/{n}", en:"Geocoding… {i}/{n}", de:"Geokodierung… {i}/{n}" },
  txt_geocoding_done: { fr:"{n} quartier(s) — localisation terminée.", nl:"{n} wijk(en) — lokalisatie voltooid.", en:"{n} quartier(s) — locating complete.", de:"{n} Viertel — Lokalisierung abgeschlossen." },
  txt_debug_analyzing: { fr:"🐞 {code} — analyse en cours…", nl:"🐞 {code} — analyse bezig…", en:"🐞 {code} — analyzing…", de:"🐞 {code} — Analyse läuft…" },
  txt_debug_trials: { fr:"{n} essai(s) (détail dans la console F12)", nl:"{n} poging(en) (detail in de F12-console)", en:"{n} attempt(s) (details in the F12 console)", de:"{n} Versuch(e) (Details in der F12-Konsole)" },

  // ── Alertes / confirmations ───────────────────────────────────────
  al_no_file_loaded: { fr:"Aucun fichier chargé.", nl:"Geen bestand geladen.", en:"No file loaded.", de:"Keine Datei geladen." },
  al_no_source_file: { fr:"Aucun fichier source chargé.", nl:"Geen bronbestand geladen.", en:"No source file loaded.", de:"Keine Quelldatei geladen." },
  cf_remove_source: { fr:"Retirer « {name} » des fichiers chargés ?", nl:"« {name} » uit de geladen bestanden verwijderen?", en:"Remove “{name}” from loaded files?", de:"„{name}“ aus den geladenen Dateien entfernen?" },
  cf_delete_planning: { fr:"Supprimer le planning « {name} » ?", nl:"De planning « {name} » verwijderen?", en:"Delete planning “{name}”?", de:"Die Planung „{name}“ löschen?" },
  al_empty_file: { fr:"Fichier vide ou sans données.", nl:"Leeg bestand of zonder gegevens.", en:"Empty file or no data.", de:"Leere Datei oder keine Daten." },
  al_read_error: { fr:"Lecture impossible : {err}", nl:"Kan niet worden gelezen: {err}", en:"Unable to read: {err}", de:"Lesen nicht möglich: {err}" },
  al_no_lfs_group: { fr:"Aucun groupe lisible dans ce fichier LFS.", nl:"Geen leesbare groep in dit LFS-bestand.", en:"No readable group in this LFS file.", de:"Keine lesbare Gruppe in dieser LFS-Datei." },
  al_commune_required: { fr:"La colonne « Commune » est obligatoire.", nl:"De kolom « Gemeente » is verplicht.", en:"The “Municipality” column is required.", de:"Die Spalte „Gemeinde“ ist erforderlich." },
  al_no_row_with_commune: { fr:"Aucune ligne avec une commune.", nl:"Geen enkele regel met een gemeente.", en:"No row with a municipality.", de:"Keine Zeile mit einer Gemeinde." },
  al_unexpected_structure: { fr:"Structure de fichier inattendue — colonnes STATBEL requises absentes : {cols}. S'agit-il bien d'un export GRP ?", nl:"Onverwachte bestandsstructuur — vereiste STATBEL-kolommen ontbreken: {cols}. Is dit wel een GRP-export?", en:"Unexpected file structure — required STATBEL columns missing: {cols}. Is this really a GRP export?", de:"Unerwartete Dateistruktur — erforderliche STATBEL-Spalten fehlen: {cols}. Handelt es sich wirklich um einen GRP-Export?" },
  al_empty_or_invalid: { fr:"Fichier vide ou invalide", nl:"Leeg of ongeldig bestand", en:"Empty or invalid file", de:"Leere oder ungültige Datei" },
  al_no_rows_parsed: { fr:"Aucune ligne exploitable", nl:"Geen bruikbare regels", en:"No rows parsed", de:"Keine Zeilen erkannt" },
  al_xlsx_lib_missing: { fr:"Bibliothèque Excel non chargée (vérifiez votre connexion)", nl:"Excel-bibliotheek niet geladen (controleer uw verbinding)", en:"Excel library not loaded (check your connection)", de:"Excel-Bibliothek nicht geladen (Verbindung prüfen)" },
  al_no_sheet: { fr:"Aucune feuille trouvée dans le classeur", nl:"Geen werkblad gevonden in het bestand", en:"No sheet found in the workbook", de:"Kein Arbeitsblatt in der Arbeitsmappe gefunden" },
  al_generic_error: { fr:"❌ Erreur : {msg}", nl:"❌ Fout: {msg}", en:"❌ Error: {msg}", de:"❌ Fehler: {msg}" },
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
// Lecture défensive de localStorage['statbel_settings'] — paramètres partagés
// avec l'app enquête (index.html) : langue, quotas de paiement…
function lireSettings() {
  try { return JSON.parse(localStorage.getItem('statbel_settings') || '{}') || {}; } catch (e) { return {}; }
}
// Langue partagée avec l'app enquête (index.html) via localStorage['statbel_settings'].lang
function chargerLangueInitiale() {
  const raw = lireSettings();
  if (LANGS.includes(raw.lang)) return raw.lang;
  return detecterLangueNavigateur();
}
let uiLang = chargerLangueInitiale();

// Applique la langue courante à tout le DOM balisé (data-i18n[-ph|-tip|-title])
function appliquerLangue() {
  document.documentElement.lang = uiLang || 'fr';
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.getAttribute('data-i18n-ph')); });
  document.querySelectorAll('[data-i18n-tip]').forEach(el => { el.setAttribute('data-tip', t(el.getAttribute('data-i18n-tip'))); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.getAttribute('data-i18n-title')); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
  const sel = document.getElementById('setLangConv'); if (sel) sel.value = uiLang;
  if (typeof majLabelCible === 'function') majLabelCible();   // bouton « Cibles (N+) » (pas de data-i18n)
}

// Changement de langue : persiste dans localStorage['statbel_settings'] (fusion — partagé avec index.html)
// puis ré-applique le balisage et ré-rend les vues dynamiques (stats / planning / tableaux).
function changerLangue(v) {
  uiLang = LANGS.includes(v) ? v : 'fr';
  const raw = lireSettings();
  raw.lang = uiLang;
  try { localStorage.setItem('statbel_settings', JSON.stringify(raw)); } catch (e) {}
  appliquerLangue();
  rafraichirVuesLangue();
}

// Ré-affiche le contenu dépendant de la langue (libellés générés en JS, pas couverts par data-i18n)
function rafraichirVuesLangue() {
  try {
    if (typeof refreshSourceSelect === 'function') refreshSourceSelect();
    if (_resultat) {
      if (typeof afficherPlanning === 'function') afficherPlanning(_resultat.adminCols, _resultat);
      if (typeof afficher === 'function') afficher(_resultat);
    }
    const modalParams = document.getElementById('modalParams');
    if (modalParams && modalParams.classList.contains('open') && typeof initPays === 'function') {
      initPays(); initCommunes();
    }
  } catch (e) { /* pas bloquant */ }
}
