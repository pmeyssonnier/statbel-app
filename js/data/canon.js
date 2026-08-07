/*
 * js/data/canon.js — Canonicalisation + libellés i18n des valeurs métier :
 * état civil (MARITAL_*), pays/nationalité (PAYS_*), statuts (STATUT_*).
 * Tables de traduction FR/NL/EN/DE + fonctions de normalisation (import) et
 * d'affichage (langue courante). Extrait de js/app.js (modules ES).
 *
 * Dépendance : settings.lang (global). Réexporté/réexposé par app.js ; importé
 * par data/csv.js pour la canonicalisation à l'import.
 */


// État civil : clés = valeurs canoniques EN (langue pivot). Tableau
// [masculin, féminin] par langue ; affichage accordé au genre.
export const MARITAL_I18N = {
  "Single": { fr:["Célibataire","Célibataire"], nl:["Ongehuwd","Ongehuwd"], en:["Single","Single"], de:["Ledig","Ledig"] },
  "Married": { fr:["Marié","Mariée"], nl:["Gehuwd","Gehuwd"], en:["Married","Married"], de:["Verheiratet","Verheiratet"] },
  "Divorced/Separated": { fr:["Divorcé/Séparé","Divorcée/Séparée"], nl:["Gescheiden","Gescheiden"], en:["Divorced/Separated","Divorced/Separated"], de:["Geschieden/Getrennt","Geschieden/Getrennt"] },
  "Divorced, de facto separated": { fr:["Divorcé, séparé de fait","Divorcée, séparée de fait"], nl:["Gescheiden, feitelijk gescheiden","Gescheiden, feitelijk gescheiden"], en:["Divorced, de facto separated","Divorced, de facto separated"], de:["Geschieden, faktisch getrennt","Geschieden, faktisch getrennt"] },
  "Widowed": { fr:["Veuf","Veuve"], nl:["Weduwnaar","Weduwe"], en:["Widower","Widow"], de:["Verwitwet","Verwitwet"] },
  "Legal cohabitant": { fr:["Cohabitant légal","Cohabitante légale"], nl:["Wettelijk samenwonend","Wettelijk samenwonend"], en:["Legal cohabitant","Legal cohabitant"], de:["Gesetzlich zusammenwohnend","Gesetzlich zusammenwohnend"] },
};
// Reverse auto-dérivé de MARITAL_I18N : toute forme (FR/NL/EN/DE, M/F) + la clé
// → clé canonique EN. Évite de redupliquer les libellés déjà présents ci-dessus.
export const MARITAL_REV = {};
Object.entries(MARITAL_I18N).forEach(([en, e]) => {
  MARITAL_REV[en.toLowerCase()] = en;
  Object.values(e).forEach(arr => arr.forEach(f => { if (f) MARITAL_REV[f.toLowerCase().trim()] = en; }));
});
// Alias des formes rencontrées dans les sources (clés en minuscules ; variantes
// genrées « (e) », barres obliques, et versions sans accents pour robustesse).
export const MARITAL_ALIAS = {
  // Célibataire
  "célibataire":"Single", "celibataire":"Single",
  // Marié(e)
  "marié(e)":"Married", "marie(e)":"Married", "marié":"Married", "marie":"Married", "mariée":"Married", "mariee":"Married",
  // Divorcé(e) / séparé(e)
  "divorcé(e)":"Divorced/Separated", "divorce(e)":"Divorced/Separated", "divorcé":"Divorced/Separated", "divorce":"Divorced/Separated", "divorcée":"Divorced/Separated", "divorcee":"Divorced/Separated",
  "séparé(e)":"Divorced/Separated", "separe(e)":"Divorced/Separated", "séparé":"Divorced/Separated", "separe":"Divorced/Separated", "séparée":"Divorced/Separated", "separee":"Divorced/Separated",
  "divorcé(e)/séparé(e)":"Divorced/Separated", "divorcé/séparé":"Divorced/Separated", "divorcée/séparée":"Divorced/Separated", "divorce/separe":"Divorced/Separated",
  // Divorcé, séparé de fait
  "divorcé(e), séparé(e) de fait":"Divorced, de facto separated", "divorcé, séparé de fait":"Divorced, de facto separated", "divorcée, séparée de fait":"Divorced, de facto separated", "divorce, separe de fait":"Divorced, de facto separated",
  // Veuf / veuve
  "veuf":"Widowed", "veuve":"Widowed", "veuf(ve)":"Widowed", "veuve(f)":"Widowed", "veuve/veuf":"Widowed", "veuf/veuve":"Widowed", "veuf(ve)/veuve":"Widowed",
  // Cohabitant(e) légal(e)
  "cohabitant(e) légal(e)":"Legal cohabitant", "cohabitant légal":"Legal cohabitant", "cohabitante légale":"Legal cohabitant", "cohabitant legal":"Legal cohabitant", "cohabitant(e) legal(e)":"Legal cohabitant",
};
export function maritalCanon(v) {
  if (!v) return v;
  if (MARITAL_I18N[v]) return v;                  // déjà canonique EN
  const k = v.toLowerCase().trim();
  return MARITAL_REV[k] || MARITAL_ALIAS[k] || v; // forme connue (toutes langues) ou alias
}
export function etatCivilGenre(status, sexe) {
  if (!status) return '';
  const e = MARITAL_I18N[maritalCanon(status)];
  if (!e) return status;
  const arr = e[settings.lang] || e.en;
  return sexe === 'F' ? arr[1] : arr[0];
}

// Nom de pays traduit à partir d'un code ISO-3 (issu de l'import). Liste des
// nationalités les plus fréquentes en Belgique ; repli sur le code si absent.
export const PAYS_I18N = {
  "AFG": { nis:"251", iso2:"AF", fr:"Afghanistan", nl:"Afghanistan", en:"Afghanistan", de:"Afghanistan" },
  "AGO": { nis:"341", iso2:"AO", fr:"Angola", nl:"Angola", en:"Angola", de:"Angola" },
  "AIA": { nis:"490", iso2:"AI", fr:"Anguilla(R.U.)", nl:"Anguilla(V.K.)", en:"Anguilla", de:"Anguilla(V.K.)" },
  "ALB": { nis:"101", iso2:"AL", fr:"Albanie", nl:"Albanië", en:"Albania", de:"Albanien" },
  "AND": { nis:"102", iso2:"AD", fr:"Andorre", nl:"Andorra", en:"Andorra", de:"Andorra" },
  "ARE": { nis:"260", iso2:"AE", fr:"Emirats arabes unis", nl:"Verenigde Arabische Emiraten", en:"United Arab Emirates", de:"Vereinigten Arabischen Emiraten" },
  "ARG": { nis:"511", iso2:"AR", fr:"Argentine", nl:"Argentinië", en:"Argentina", de:"Argentinien" },
  "ARM": { nis:"249", iso2:"AM", fr:"Arménie ( Rép. )", nl:"Armenië ( Rep. )", en:"Armenia", de:"Armenien ( Rep. )" },
  "ASM": { nis:"690", iso2:"AS", fr:"Samoa américaines", nl:"Amerik.Samoaeilanden", en:"American Samoa Isles", de:"Amerik.Samoainseln" },
  "ATG": { nis:"403", iso2:"AG", fr:"Antigua", nl:"Antigua", en:"Antigua and Barbuda", de:"Antigua" },
  "AUS": { nis:"611", iso2:"AU", fr:"Australie", nl:"Australië", en:"Australia", de:"Australien" },
  "AUT": { nis:"105", iso2:"AT", fr:"Autriche", nl:"Oostenrijk", en:"Austria", de:"Oesterreich" },
  "AZE": { nis:"250", iso2:"AZ", fr:"Azerbaïdjan ( Rép. )", nl:"Azerbeidzjan ( Rep. )", en:"Azerbaijan", de:"Azerbaidschan ( Rep. )" },
  "BDI": { nis:"303", iso2:"BI", fr:"Burundi", nl:"Burundi", en:"Burundi", de:"Burundi" },
  "BEL": { nis:"150", iso2:"BE", fr:"Belgique", nl:"België", en:"Belgium", de:"Belgien" },
  "BEN": { nis:"310", iso2:"BJ", fr:"Bénin(Rép. pop. du)", nl:"Benin(Volksrepubliek)", en:"Benin", de:"Benin(Volksrepublik)" },
  "BFA": { nis:"308", iso2:"BF", fr:"Burkina Faso", nl:"Burkina Faso", en:"Burkina Faso", de:"Burkina Faso" },
  "BGD": { nis:"237", iso2:"BD", fr:"Bangladesh", nl:"Bangladesh", en:"Bangladesh", de:"Bangla-Desh" },
  "BGR": { nis:"106", iso2:"BG", fr:"Bulgarie", nl:"Bulgarije", en:"Bulgaria", de:"Bulgarien" },
  "BHR": { nis:"268", iso2:"BH", fr:"Bahrein", nl:"Bahrein", en:"Bahrain", de:"Bahrein" },
  "BHS": { nis:"425", iso2:"BS", fr:"Bahamas", nl:"Bahamas", en:"Bahamas", de:"Bahamas" },
  "BIH": { nis:"149", iso2:"BA", fr:"Bosnie-Herzégovine (Rép. de)", nl:"Bosnië-Herzegovina (Rep.)", en:"Bosnia and Herzegovina", de:"Bosnien-Herczegowina (Rep.)" },
  "BLM": { nis:"481", iso2:"BL", fr:"Antilles françaises", nl:"Franse Antillen", en:"French West Indies", de:"Franzosische Antillen" },
  "BLR": { nis:"142", iso2:"BY", fr:"Biélorussie ( Rép. )", nl:"Bielorusland ( Rep. )", en:"Belarus", de:"Weissrussland" },
  "BLZ": { nis:"430", iso2:"BZ", fr:"Belize", nl:"Belize", en:"Belize", de:"Belize" },
  "BMU": { nis:"485", iso2:"BM", fr:"Bermudes", nl:"Bermuda's", en:"Bermuda", de:"Bermudas" },
  "BOL": { nis:"512", iso2:"BO", fr:"Bolivie", nl:"Bolivië", en:"Bolivia (Plurinational State of)", de:"Bolivien" },
  "BRA": { nis:"513", iso2:"BR", fr:"Brésil", nl:"Brazilië", en:"Brazil", de:"Brasilien" },
  "BRB": { nis:"423", iso2:"BB", fr:"Barbade", nl:"Barbados", en:"Barbados", de:"Barbados" },
  "BRN": { nis:"224", iso2:"BN", fr:"Brunei", nl:"Brunei", en:"Brunei Darussalam", de:"Brunei" },
  "BTN": { nis:"223", iso2:"BT", fr:"Bhoutan", nl:"Bhutan", en:"Bhutan", de:"Bhutan" },
  "BWA": { nis:"302", iso2:"BW", fr:"Botswana", nl:"Botswana", en:"Botswana", de:"Botswana" },
  "CAF": { nis:"305", iso2:"CF", fr:"République Centrafricaine", nl:"Centraalafrikaanse Republiek", en:"Central African Republic", de:"Zentralafrikanische Republik" },
  "CAN": { nis:"401", iso2:"CA", fr:"Canada", nl:"Canada", en:"Canada", de:"Kanada" },
  "CHE": { nis:"127", iso2:"CH", fr:"Suisse", nl:"Zwitserland", en:"Switzerland", de:"Schweiz" },
  "CHL": { nis:"514", iso2:"CL", fr:"Chili", nl:"Chili", en:"Chile", de:"Chile" },
  "CHN": { nis:"218", iso2:"CN", fr:"Chine", nl:"China", en:"China", de:"China" },
  "CIV": { nis:"309", iso2:"CI", fr:"Côte d'Ivoire", nl:"Ivoorkust", en:"Côte d'Ivoire", de:"Elfenbeinküste" },
  "CMR": { nis:"304", iso2:"CM", fr:"Cameroun", nl:"Kameroen", en:"Cameroon", de:"Kamerun" },
  "COD": { nis:"306", iso2:"CD", fr:"RD Congo", nl:"DR Congo", en:"DR Congo", de:"DR Kongo" },
  "COG": { nis:"307", iso2:"CG", fr:"Congo", nl:"Congo", en:"Congo", de:"Kongo" },
  "COK": { nis:"605", iso2:"CK", fr:"Cook", nl:"Cook", en:"Cook", de:"Cook" },
  "COL": { nis:"515", iso2:"CO", fr:"Colombie", nl:"Colombia", en:"Colombia", de:"Kolumbien" },
  "COM": { nis:"343", iso2:"KM", fr:"Archipel des Comores", nl:"Archipel van de Comoren", en:"Comoros", de:"Komoren - Archipel" },
  "CPV": { nis:"339", iso2:"CV", fr:"Cap Vert/Iles du/", nl:"Kaapverdische Eilanden", en:"Cabo Verde", de:"Kapverdische Inseln" },
  "CRI": { nis:"411", iso2:"CR", fr:"Costa Rica", nl:"Costa Rica", en:"Costa Rica", de:"Costa Rica" },
  "CUB": { nis:"412", iso2:"CU", fr:"Cuba", nl:"Cuba", en:"Cuba", de:"Kuba" },
  "CYM": { nis:"492", iso2:"KY", fr:"Caïmanes(R.U.)", nl:"Caïmanes(V.K.)", en:"Cayman Islands", de:"Kaiman - Inseln(V.K.)" },
  "CYP": { nis:"107", iso2:"CY", fr:"Chypre", nl:"Cyprus", en:"Cyprus", de:"Zypern" },
  "CZE": { nis:"140", iso2:"CZ", fr:"Tchéquie", nl:"Tsjechië", en:"Czechia", de:"Tschechien" },
  "DEU": { nis:"103", iso2:"DE", fr:"Allemagne", nl:"Duitsland", en:"Germany", de:"Deutschland" },
  "DJI": { nis:"345", iso2:"DJ", fr:"République de Djibouti", nl:"Republiek Djibouti", en:"Djibouti", de:"Republik Djibouti" },
  "DMA": { nis:"427", iso2:"DM", fr:"Dominique (République)", nl:"Dominica (Republiek)", en:"Dominica", de:"Dominica (Republik)" },
  "DNK": { nis:"108", iso2:"DK", fr:"Danemark", nl:"Denemarken", en:"Denmark", de:"Dänemark" },
  "DOM": { nis:"420", iso2:"DO", fr:"Dominicaine /Rép./", nl:"Dominikaanse Republiek", en:"Dominican Republic", de:"Dominikanische Republik" },
  "DZA": { nis:"351", iso2:"DZ", fr:"Algérie", nl:"Algerije", en:"Algeria", de:"Algerien" },
  "ECU": { nis:"516", iso2:"EC", fr:"Equateur", nl:"Ecuador", en:"Ecuador", de:"Ekuador" },
  "EGY": { nis:"352", iso2:"EG", fr:"Rép. Arabe d'Egypte", nl:"Arabische Republiek Egypte", en:"Egypt", de:"Arabische Republik von Ägypten" },
  "ERI": { nis:"349", iso2:"ER", fr:"Erythrée", nl:"Erithrea", en:"Eritrea", de:"Erythräen" },
  "ESH": { nis:"388", iso2:"EH", fr:"Sahara", nl:"Sahara", en:"Western Sahara", de:"Sahara" },
  "ESP": { nis:"109", iso2:"ES", fr:"Espagne", nl:"Spanje", en:"Spain", de:"Spanien" },
  "EST": { nis:"136", iso2:"EE", fr:"Estonie", nl:"Estland", en:"Estonia", de:"Estland" },
  "ETH": { nis:"311", iso2:"ET", fr:"Ethiopie", nl:"Ethiopië", en:"Ethiopia", de:"Äthiopien" },
  "FIN": { nis:"110", iso2:"FI", fr:"Finlande", nl:"Finland", en:"Finland", de:"Finnland" },
  "FJI": { nis:"617", iso2:"FJ", fr:"Fidji", nl:"Fiji", en:"Fiji", de:"Fidschi" },
  "FLK": { nis:"580", iso2:"FK", fr:"Iles Falkland", nl:"Falkland Eilanden", en:"Falkland Islands (Malvinas)", de:"Falklandinseln" },
  "FRA": { nis:"111", iso2:"FR", fr:"France", nl:"Frankrijk", en:"France", de:"Frankreich" },
  "FSM": { nis:"602", iso2:"FM", fr:"Micronésie", nl:"Micronisia", en:"Micronesia (Federated States of)", de:"Micronisia" },
  "GAB": { nis:"312", iso2:"GA", fr:"Gabon", nl:"Gabon", en:"Gabon", de:"Gabun" },
  "GBR": { nis:"112", iso2:"GB", fr:"Royaume-Uni", nl:"Verenigd Koninkrijk", en:"United Kingdom", de:"Vereinigtes Königreich" },
  "GEO": { nis:"253", iso2:"GE", fr:"Géorgie ( Rép. )", nl:"Georgië ( Rep. )", en:"Georgia", de:"Georgien" },
  "GHA": { nis:"314", iso2:"GH", fr:"Ghana", nl:"Ghana", en:"Ghana", de:"Ghana" },
  "GIB": { nis:"180", iso2:"GI", fr:"Gibraltar", nl:"Gibraltar", en:"Gibraltar", de:"Gibraltar" },
  "GIN": { nis:"315", iso2:"GN", fr:"Guinée", nl:"Guinea", en:"Guinea", de:"Guinea" },
  "GLP": { nis:"496", iso2:"GP", fr:"La Guadeloupe(F.)", nl:"La Guadeloupe(F.)", en:"Guadeloupe", de:"La Guadeloupe(F.)" },
  "GMB": { nis:"313", iso2:"GM", fr:"Gambie", nl:"Gambia", en:"Gambia", de:"Gambia" },
  "GNB": { nis:"338", iso2:"GW", fr:"Guinée-Bissau", nl:"Guinea-Bissau", en:"Guinea-Bissau", de:"Guinea-Bissau" },
  "GNQ": { nis:"337", iso2:"GQ", fr:"Guinée équatoriale", nl:"Equatoriaal-Guinea", en:"Equatorial Guinea", de:"Äquatoriales Guinea" },
  "GRC": { nis:"114", iso2:"GR", fr:"Grèce", nl:"Griekenland", en:"Greece", de:"Griechenland" },
  "GRD": { nis:"426", iso2:"GD", fr:"Grenade", nl:"Grenada", en:"Grenada", de:"Granada" },
  "GRL": { nis:"498", iso2:"GL", fr:"Le Groenland(D.K.)", nl:"Groenland(D.K.)", en:"Greenland", de:"Grönland(D.K.)" },
  "GTM": { nis:"413", iso2:"GT", fr:"Guatémala", nl:"Guatemala", en:"Guatemala", de:"Guatemala" },
  "GUF": { nis:"581", iso2:"GF", fr:"Guyane Française", nl:"Frans Guyana", en:"French Guiana", de:"Französisch-Guyana" },
  "GUM": { nis:"681", iso2:"GU", fr:"Guam", nl:"Guam", en:"Guam", de:"Guam" },
  "GUY": { nis:"521", iso2:"GY", fr:"Guyane", nl:"Guyana", en:"Guyana", de:"Guyana" },
  "HKG": { nis:"230", iso2:"HK", fr:"Chine (Hong-Kong SAR)", nl:"China (Hongkong SAR)", en:"Hong Kong SAR, China", de:"China (Hong Kong SAR)" },
  "HND": { nis:"414", iso2:"HN", fr:"Honduras", nl:"Honduras", en:"Honduras", de:"Honduras" },
  "HRV": { nis:"146", iso2:"HR", fr:"Croatie", nl:"Kroatië", en:"Croatia", de:"Kroatien" },
  "HTI": { nis:"419", iso2:"HT", fr:"Haïti", nl:"Haïti", en:"Haiti", de:"Haiti" },
  "HUN": { nis:"115", iso2:"HU", fr:"Hongrie", nl:"Hongarije", en:"Hungary", de:"Ungarn" },
  "IDN": { nis:"208", iso2:"ID", fr:"Indonésie", nl:"Indonesië", en:"Indonesia", de:"Indonesien" },
  "IND": { nis:"207", iso2:"IN", fr:"Inde", nl:"India", en:"India", de:"Indien" },
  "IRL": { nis:"116", iso2:"IE", fr:"Irlande", nl:"Ierland", en:"Ireland", de:"Irland" },
  "IRN": { nis:"255", iso2:"IR", fr:"Iran", nl:"Iran", en:"Iran", de:"Iran" },
  "IRQ": { nis:"254", iso2:"IQ", fr:"Irak", nl:"Irak", en:"Iraq", de:"Irak" },
  "ISL": { nis:"117", iso2:"IS", fr:"Islande", nl:"Ijsland", en:"Iceland", de:"Island" },
  "ISR": { nis:"256", iso2:"IL", fr:"Israël", nl:"Israël", en:"Israel", de:"Israel" },
  "ITA": { nis:"128", iso2:"IT", fr:"Italie", nl:"Italië", en:"Italy", de:"Italien" },
  "JAM": { nis:"415", iso2:"JM", fr:"Jamaïque", nl:"Jamaica", en:"Jamaica", de:"Jamaika" },
  "JOR": { nis:"257", iso2:"JO", fr:"Jordanie", nl:"Jordanië", en:"Jordan", de:"Jordanien" },
  "JPN": { nis:"209", iso2:"JP", fr:"Japon", nl:"Japan", en:"Japan", de:"Japan" },
  "KAZ": { nis:"225", iso2:"KZ", fr:"Kazakhstan ( Rép. )", nl:"Kazachstan ( Rep. )", en:"Kazakhstan", de:"Kasachstan ( Rep. )" },
  "KEN": { nis:"336", iso2:"KE", fr:"Kenya", nl:"Kenya", en:"Kenya", de:"Kenia" },
  "KGZ": { nis:"226", iso2:"KG", fr:"Kirghizie ( Rep. )", nl:"Kirgizstan ( Rep. )", en:"Kyrgyzstan", de:"Kirgistan ( Rep. )" },
  "KHM": { nis:"216", iso2:"KH", fr:"Cambodge (Royaume du)", nl:"Cambodja (Koninkrijk)", en:"Kingdom of Cambodia", de:"Kambodscha (Königreich)" },
  "KIR": { nis:"622", iso2:"KI", fr:"Iles Gilbert", nl:"Gilberteilanden", en:"Kiribati", de:"Gilbertinseln" },
  "KNA": { nis:"431", iso2:"KN", fr:"St. Kitts et Nevis", nl:"St. Kitts en Nevis", en:"St. Kitts en Nevis", de:"St. Kitts und Nevis" },
  "KOR": { nis:"206", iso2:"KR", fr:"Corée du Sud ( Rép. de )", nl:"Zuid-Korea ( Rep. )", en:"Korea (Republic of)", de:"Südkorea ( Rep. )" },
  "KWT": { nis:"264", iso2:"KW", fr:"Koweit/Principauté de/", nl:"Koeweit/Vorstendom/", en:"Kuwait", de:"Kuwait/Fürstentum/" },
  "LAO": { nis:"210", iso2:"LA", fr:"Laos", nl:"Laos", en:"Lao People's Democratic Republic", de:"Laos" },
  "LBN": { nis:"258", iso2:"LB", fr:"Liban", nl:"Libanon", en:"Lebanon", de:"Libanon" },
  "LBR": { nis:"318", iso2:"LR", fr:"Libéria", nl:"Liberia", en:"Liberia", de:"Liberia" },
  "LBY": { nis:"353", iso2:"LY", fr:"Libye", nl:"Libië", en:"Libya", de:"Libyen" },
  "LCA": { nis:"428", iso2:"LC", fr:"République de Sainte Lucie", nl:"Republiek Sint-Lucia", en:"Saint Lucia", de:"Republik Sankt-Luzia" },
  "LIE": { nis:"118", iso2:"LI", fr:"Liechtenstein", nl:"Liechtenstein", en:"Liechtenstein", de:"Liechtenstein" },
  "LKA": { nis:"203", iso2:"LK", fr:"Sri Lanka", nl:"Sri Lanka", en:"Sri Lanka", de:"Sri Lanka" },
  "LSO": { nis:"301", iso2:"LS", fr:"Lesotho", nl:"Lesotho", en:"Lesotho", de:"Lesotho" },
  "LTU": { nis:"137", iso2:"LT", fr:"Lituanie", nl:"Litouwen", en:"Lithuania", de:"Litauen" },
  "LUX": { nis:"113", iso2:"LU", fr:"Luxembourg", nl:"Luxemburg", en:"Luxembourg", de:"Luxemburg" },
  "LVA": { nis:"135", iso2:"LV", fr:"Lettonie", nl:"Letland", en:"Latvia", de:"Lettland" },
  "MAC": { nis:"231", iso2:"MO", fr:"Chine (Macao SAR)", nl:"China (Macau SAR)", en:"Macao SAR, China", de:"China (Macau SAR)" },
  "MAR": { nis:"354", iso2:"MA", fr:"Maroc", nl:"Marokko", en:"Morocco", de:"Marokko" },
  "MCO": { nis:"120", iso2:"MC", fr:"Monaco /Principauté/", nl:"Monaco /Vorstendom/", en:"Monaco", de:"Monako/Fürstentum/" },
  "MDA": { nis:"144", iso2:"MD", fr:"Moldavie ( Rép. )", nl:"Moldavië ( Rep. )", en:"Moldova (Republic of)", de:"Moldawien ( Rep. )" },
  "MDG": { nis:"324", iso2:"MG", fr:"Rép.démocrat. de Madagascar", nl:"Democratische Republ. Madagascar", en:"Madagascar", de:"Demokratische Republ. Madagaskar" },
  "MDV": { nis:"222", iso2:"MV", fr:"Maldives", nl:"Malediven", en:"Maldives", de:"Malediven" },
  "MEX": { nis:"416", iso2:"MX", fr:"Mexique", nl:"Mexico", en:"Mexico", de:"Mexiko" },
  "MHL": { nis:"603", iso2:"MH", fr:"Iles Marshall (République des)", nl:"Marshalleilanden (Republiek der)", en:"Marshall Islands", de:"Marshallinseln (Republik)" },
  "MKD": { nis:"148", iso2:"MK", fr:"Macédoine (Ex-Rép. yougoslave de)", nl:"Macedonië (Ex-Joegoslavische Rep.)", en:"Macedonia (former Yugoslav Rep of)", de:"Makedonien (Ex-Jugoslawischen Rep.)" },
  "MLI": { nis:"319", iso2:"ML", fr:"Mali", nl:"Mali", en:"Mali", de:"Mali" },
  "MLT": { nis:"119", iso2:"MT", fr:"Malte", nl:"Malta", en:"Malta", de:"Malta" },
  "MMR": { nis:"201", iso2:"MM", fr:"Myanmar (Union de)", nl:"Myanmar (Unie van)", en:"Myanmar", de:"Myanmar (Union)" },
  "MNE": { nis:"151", iso2:"ME", fr:"Monténégro", nl:"Montenegro", en:"Montenegro", de:"Montenegro" },
  "MNG": { nis:"221", iso2:"MN", fr:"Mongolie(Rép.pop.de.)", nl:"Mongolië(Volksrepubliek)", en:"Mongolia", de:"Mongolei(Volksrepublik)" },
  "MNP": { nis:"620", iso2:"MP", fr:"Pacifique/Iles du/", nl:"Stille Oceaan /Eilanden/", en:"Northern Mariana Islands", de:"Inseln des pazif. Ozeans" },
  "MOZ": { nis:"340", iso2:"MZ", fr:"Mozambique", nl:"Mozambique", en:"Mozambique", de:"Mozambik" },
  "MRT": { nis:"355", iso2:"MR", fr:"Mauritanie /Rép. Islamique de/", nl:"Mauritanië(Islamit. Rep.)", en:"Mauritania", de:"Mauretanien(Islamitische Rep.)" },
  "MSR": { nis:"493", iso2:"MS", fr:"Montserrat(R.U.)", nl:"Montserrat(V.K.)", en:"Montserrat", de:"Montserrat(V.K.)" },
  "MTQ": { nis:"497", iso2:"MQ", fr:"La Martinique(F.)", nl:"La Martinique(F.)", en:"Martinique", de:"La Martinique(F.)" },
  "MUS": { nis:"317", iso2:"MU", fr:"Maurice /Ile/", nl:"Mauritius /Eiland/", en:"Mauritius", de:"Mauritius /Insel/" },
  "MWI": { nis:"358", iso2:"MW", fr:"Malawi", nl:"Malawi", en:"Malawi", de:"Malawi" },
  "MYS": { nis:"212", iso2:"MY", fr:"Malaisie", nl:"Maleisië", en:"Malaysia", de:"Malaya" },
  "NAM": { nis:"384", iso2:"NA", fr:"Namibie", nl:"Namibie", en:"Namibia", de:"Namibia" },
  "NCL": { nis:"683", iso2:"NC", fr:"Nouvelle-Calédonie", nl:"Nieuw-Caledonië", en:"New Caledonia", de:"Neukaledonien" },
  "NER": { nis:"321", iso2:"NE", fr:"Niger", nl:"Niger", en:"Niger", de:"Niger" },
  "NGA": { nis:"322", iso2:"NG", fr:"Nigéria(Rép. Féder.)", nl:"Nigeria (Fed.Rep.)", en:"Nigeria", de:"Nigeria(Bundesrep.)" },
  "NIC": { nis:"417", iso2:"NI", fr:"Nicaragua", nl:"Nicaragua", en:"Nicaragua", de:"Nikaragua" },
  "NIU": { nis:"604", iso2:"NU", fr:"Niue", nl:"Niue", en:"Niue", de:"Niue" },
  "NLD": { nis:"129", iso2:"NL", fr:"Pays-Bas", nl:"Nederland", en:"Netherlands", de:"Niederlande" },
  "NOR": { nis:"121", iso2:"NO", fr:"Norvège", nl:"Noorwegen", en:"Norway", de:"Norwegen" },
  "NPL": { nis:"213", iso2:"NP", fr:"Nepal", nl:"Nepal", en:"Nepal", de:"Nepal" },
  "NRU": { nis:"615", iso2:"NR", fr:"Nauru", nl:"Nauru", en:"Nauru", de:"Nauru" },
  "NZL": { nis:"613", iso2:"NZ", fr:"Nouvelle-Zélande", nl:"Nieuw-Zeeland", en:"New Zealand", de:"Neuseeland" },
  "OMN": { nis:"266", iso2:"OM", fr:"Sultanat d'Oman", nl:"Sultanaat Oman", en:"Oman", de:"Sultanat Oman" },
  "PAK": { nis:"259", iso2:"PK", fr:"Pakistan", nl:"Pakistan", en:"Pakistan", de:"Pakistan" },
  "PAN": { nis:"418", iso2:"PA", fr:"Panama", nl:"Panama", en:"Panama", de:"Panama" },
  "PCN": { nis:"692", iso2:"PN", fr:"Pitcairn(terr.dép.du R.U.)", nl:"Pitcairn(Gebied.afh.van het V.K.)", en:"Pitcairn", de:"Pitcairn(vom V.K. abhängiges Gebiet)" },
  "PER": { nis:"518", iso2:"PE", fr:"Pérou", nl:"Peru", en:"Peru", de:"Peru" },
  "PHL": { nis:"214", iso2:"PH", fr:"Philippines", nl:"Filippijnen", en:"Philippines", de:"Philippinen" },
  "PNG": { nis:"619", iso2:"PG", fr:"Papouasie-Nouvelle-Guinée", nl:"Nieuw-Guinea-Papoua", en:"Papua New Guinea", de:"Neu-Guinea-Papua" },
  "POL": { nis:"122", iso2:"PL", fr:"Pologne", nl:"Polen", en:"Poland", de:"Polen" },
  "PRI": { nis:"487", iso2:"PR", fr:"Porto-Rico(Ile de)", nl:"Porto Rico Eiland", en:"Puerto Rico", de:"Portoriko" },
  "PRK": { nis:"219", iso2:"KP", fr:"Corée du Nord ( Rép. de )", nl:"Noord-Korea ( Volksrep. )", en:"Korea (Democratic People's Republic of)", de:"Nordkorea ( Volksrep. )" },
  "PRT": { nis:"123", iso2:"PT", fr:"Portugal", nl:"Portugal", en:"Portugal", de:"Portugal" },
  "PRY": { nis:"517", iso2:"PY", fr:"Paraguay", nl:"Paraguay", en:"Paraguay", de:"Paraguay" },
  "PSE": { nis:"271", iso2:"PS", fr:"Palestine", nl:"Palestina", en:"Palestine", de:"Palästina" },
  "PYF": { nis:"684", iso2:"PF", fr:"Polynésie", nl:"Polynesië", en:"French Polynesia", de:"Polynesien" },
  "QAT": { nis:"267", iso2:"QA", fr:"Qatar", nl:"Qatar", en:"Qatar", de:"Qatar" },
  "REU": { nis:"387", iso2:"RE", fr:"Réunion", nl:"Réunion", en:"Réunion", de:"Réunion" },
  "ROU": { nis:"124", iso2:"RO", fr:"Roumanie", nl:"Roemenië", en:"Romania", de:"Rumänien" },
  "RUS": { nis:"145", iso2:"RU", fr:"Russie", nl:"Rusland", en:"Russia", de:"Russland" },
  "RWA": { nis:"327", iso2:"RW", fr:"Rwanda", nl:"Rwanda", en:"Rwanda", de:"Ruanda" },
  "SAU": { nis:"252", iso2:"SA", fr:"Arabie Saoudite", nl:"Saoedi-Arabië", en:"Saudi Arabia", de:"Saudi-Arabien" },
  "SDN": { nis:"356", iso2:"SD", fr:"Soudan", nl:"Soedan", en:"Sudan", de:"Sudan" },
  "SEN": { nis:"320", iso2:"SN", fr:"Sénégal", nl:"Senegal", en:"Senegal", de:"Senegal" },
  "SGP": { nis:"205", iso2:"SG", fr:"Singapour", nl:"Singapore", en:"Singapore", de:"Singapur" },
  "SHN": { nis:"389", iso2:"SH", fr:"Sainte-Hélène(Ile)", nl:"Sint-Helena(Eiland)", en:"St Helena, Ascension, Tristan da Cunha", de:"Sankt-Helena-Insel" },
  "SLB": { nis:"623", iso2:"SB", fr:"Iles Salomon", nl:"Salomoneilanden", en:"Solomon Islands", de:"Salomoninseln" },
  "SLE": { nis:"328", iso2:"SL", fr:"Sierra Leone", nl:"Sierra Leone", en:"Sierra Leone", de:"Sierra Leone" },
  "SLV": { nis:"421", iso2:"SV", fr:"El Salvador", nl:"El Salvador", en:"El Salvador", de:"El Salvador" },
  "SMR": { nis:"125", iso2:"SM", fr:"Saint-Marin", nl:"San Marino", en:"San Marino", de:"San Marino" },
  "SOM": { nis:"329", iso2:"SO", fr:"Somalie /Rép./", nl:"Somalië(Rep.)", en:"Somalia", de:"Somaliland /Rep./" },
  "SPM": { nis:"495", iso2:"PM", fr:"Saint-Pierre et Miquelon(F.)", nl:"Saint-Pierre et Miquelon(F.)", en:"Saint Pierre and Miquelon", de:"Saint-Pierre et Miquelon(F.)" },
  "SRB": { nis:"152", iso2:"RS", fr:"Serbie", nl:"Servië", en:"Serbia", de:"Serbien" },
  "SSD": { nis:"365", iso2:"SS", fr:"Soudan du Sud", nl:"Zuid-Soedan", en:"South Sudan", de:"Südsudan" },
  "STP": { nis:"346", iso2:"ST", fr:"Sao Tomé et Principe (Rép. dém. de)", nl:"Sao Tomé en Principe (Dem. Rep.)", en:"Sao Tome and Principe", de:"Sao Tomé und Principe (Dem. Rep.)" },
  "SUR": { nis:"522", iso2:"SR", fr:"Surinam", nl:"Suriname", en:"Suriname", de:"Surinam" },
  "SVK": { nis:"141", iso2:"SK", fr:"Slovaquie", nl:"Slowakije", en:"Slovakia", de:"Slowakei" },
  "SVN": { nis:"147", iso2:"SI", fr:"Slovénie ( Rép. de )", nl:"Slovenië ( Rep. )", en:"Slovenia", de:"Slowenien ( Rep. )" },
  "SWE": { nis:"126", iso2:"SE", fr:"Suède", nl:"Zweden", en:"Sweden", de:"Schweden" },
  "SWZ": { nis:"331", iso2:"SZ", fr:"Ngwane (Royaume du Swaziland)", nl:"Ngwane (Koninkrijk Swaziland)", en:"Swaziland", de:"Ngwane (Königreich Swaziland)" },
  "SYC": { nis:"342", iso2:"SC", fr:"Seychelles(Iles)", nl:"Seychellen(Eilanden)", en:"Seychelles", de:"Seychellen" },
  "SYR": { nis:"261", iso2:"SY", fr:"Syrie", nl:"Syrië", en:"Syria", de:"Syrien" },
  "TCA": { nis:"488", iso2:"TC", fr:"Iles Turks et Caicos", nl:"Turks en Caicos Eilanden", en:"Turks and Caicos Islands", de:"Turks und Caicos Inseln" },
  "TCD": { nis:"333", iso2:"TD", fr:"Tchad", nl:"Tsjaad", en:"Chad", de:"Tschad" },
  "TGO": { nis:"334", iso2:"TG", fr:"Togo", nl:"Togo", en:"Togo", de:"Togo" },
  "THA": { nis:"235", iso2:"TH", fr:"Thaïlande", nl:"Thailand", en:"Thailand", de:"Thailand" },
  "TJK": { nis:"228", iso2:"TJ", fr:"Tadjikistan ( Rép. )", nl:"Tadzjikistan ( Rep. )", en:"Tajikistan", de:"Tadschikistan ( Rep. )" },
  "TKL": { nis:"686", iso2:"TK", fr:"Tokelau(N-Z.)", nl:"Tokelau(N-Z.)", en:"Tokelau", de:"Tokelau(N-Z.)" },
  "TKM": { nis:"229", iso2:"TM", fr:"Turkménistan ( Rép. )", nl:"Turkmenistan ( Rep. )", en:"Turkmenistan", de:"Turkmenistan ( Rep. )" },
  "TLS": { nis:"215", iso2:"TL", fr:"Timor-Leste (République démocratique)", nl:"Oost-Timor (Democratische Republiek)", en:"Timor-Leste", de:"Timor-Leste (Demokratische Republik)" },
  "TON": { nis:"616", iso2:"TO", fr:"Tonga", nl:"Tonga", en:"Tonga", de:"Tonga" },
  "TTO": { nis:"422", iso2:"TT", fr:"Trinidad et Tobago", nl:"Trinidad en Tobago", en:"Trinidad and Tobago", de:"Trinidad und Tobago" },
  "TUN": { nis:"357", iso2:"TN", fr:"Tunisie", nl:"Tunesië", en:"Tunisia", de:"Tunesien" },
  "TUR": { nis:"262", iso2:"TR", fr:"Turquie", nl:"Turkije", en:"Turkey", de:"Türkei" },
  "TUV": { nis:"621", iso2:"TV", fr:"Tuvalu", nl:"Tuvalu", en:"Tuvalu", de:"Tuvalu" },
  "TWN": { nis:"204", iso2:"TW", fr:"Chine-Taïwan ( Rép. de )", nl:"China-Taïwan ( Rep. )", en:"Taiwan, Province of China", de:"China-Taïwan ( Rep. )" },
  "TZA": { nis:"332", iso2:"TZ", fr:"Tanzanie(Rép.Unie de)", nl:"Tanzania /Verenigde Rep./", en:"Tanzania, United Republic of", de:"Tansania(Vereinigte Rep.)" },
  "UGA": { nis:"323", iso2:"UG", fr:"Ouganda", nl:"Uganda", en:"Uganda", de:"Uganda" },
  "UKR": { nis:"143", iso2:"UA", fr:"Ukraine", nl:"Oekraïne", en:"Ukraine", de:"Ukraine" },
  "URY": { nis:"519", iso2:"UY", fr:"Uruguay", nl:"Uruguay", en:"Uruguay", de:"Uruguay" },
  "USA": { nis:"402", iso2:"US", fr:"États-Unis", nl:"Verenigde Staten", en:"United States", de:"Vereinigte Staaten" },
  "UZB": { nis:"227", iso2:"UZ", fr:"Ouzbékistan ( Rép. )", nl:"Oezbekistan ( Rep. )", en:"Uzbekistan", de:"Uzbekistan ( Rep. )" },
  "VAT": { nis:"133", iso2:"VA", fr:"Saint-Siège", nl:"Heilige Stoel", en:"Holy See", de:"Päpstlicher Stuhl" },
  "VCT": { nis:"429", iso2:"VC", fr:"Saint-Vincent", nl:"Saint Vincent", en:"Saint Vincent and the Grenadines", de:"Saint Vincent" },
  "VEN": { nis:"520", iso2:"VE", fr:"Vénézuéla", nl:"Venezuela", en:"Venezuela (Bolivarian Republic of)", de:"Venezuela" },
  "VGB": { nis:"486", iso2:"VG", fr:"Iles Vierges", nl:"Maagdeneilanden", en:"Virgin Islands (British)", de:"Jungferninseln" },
  "VIR": { nis:"483", iso2:"VI", fr:"Antilles américaines", nl:"Amerikaanse Antillen", en:"Virgin Islands (U.S.)", de:"Antillen(U.S.A.)" },
  "VNM": { nis:"220", iso2:"VN", fr:"République socialiste du Vietnam", nl:"Socialistische Republiek Vietnam", en:"Viet Nam", de:"Sozialistische Republik Vietnam" },
  "VUT": { nis:"624", iso2:"VU", fr:"Vanuatu", nl:"Vanuatu", en:"Vanuatu", de:"Vanuatu" },
  "WLF": { nis:"689", iso2:"WF", fr:"Wallis et Futuna(F.)", nl:"Wallis en Futuna(F.)", en:"Wallis and Futuna (F.)", de:"Wallis und Futuna(F.)" },
  "WSM": { nis:"614", iso2:"WS", fr:"Samoa occidentales", nl:"West-Samoa", en:"Samoa", de:"West-Samoa" },
  "XKX": { nis:"153", iso2:"XK", fr:"Kosovo", nl:"Kosovo", en:"Kosovo", de:"Kosovo" },
  "YEM": { nis:"270", iso2:"YE", fr:"Yemen(Rép.du)", nl:"Jemen(Rep.)", en:"Yemen", de:"Jemen(Rep.)" },
  "ZAF": { nis:"325", iso2:"ZA", fr:"Afrique du Sud /Rép. d'/", nl:"Zuid-Afrika /Rep./", en:"South Africa", de:"Südafrikanische Republik" },
  "ZMB": { nis:"335", iso2:"ZM", fr:"Zambie", nl:"Zambia", en:"Zambia", de:"Sambia" },
  "ZWE": { nis:"344", iso2:"ZW", fr:"Zimbabwe", nl:"Zimbabwe", en:"Zimbabwe", de:"Zimbabwe" },
};
export function paysNom(code) {
  if (!code) return '';
  const e = PAYS_I18N[String(code).trim().toUpperCase()];
  return e ? (e[settings.lang] || e.fr) : code;
}

// Index inverse ISO-2 → ISO-3 (construit une fois depuis PAYS_I18N)
export const ISO2_TO_ISO3 = {};
for (const [iso3, e] of Object.entries(PAYS_I18N)) { if (e.iso2) ISO2_TO_ISO3[e.iso2.toUpperCase()] = iso3; }

// Alias des codes ISO-3 erronés les plus fréquents → ISO-3 officiel
export const PAYS_ALIAS = {
  GER: 'DEU',   // Allemagne
  ENG: 'GBR',   // Angleterre → Royaume-Uni
  SPA: 'ESP',   // Espagne
  POR: 'PRT',   // Portugal
  BUL: 'BGR',   // Bulgarie
};

// Normalise un code pays en ISO-3 : ISO-3 connu → tel quel ; ISO-2 connu → ISO-3 ;
// alias fréquent → ISO-3 ; inconnu → laissé tel quel (signalé par les contrôles de cohérence).
export function normaliserPays(code) {
  const v = (code == null ? '' : code).toString().trim();
  if (!v) return code;
  const u = v.toUpperCase();
  if (PAYS_I18N[u]) return u;          // déjà ISO-3
  if (ISO2_TO_ISO3[u]) return ISO2_TO_ISO3[u];  // ISO-2 → ISO-3
  if (PAYS_ALIAS[u]) return PAYS_ALIAS[u];       // alias fréquent → ISO-3
  return code;                         // inconnu : on ne touche pas
}

// « Belgium (BE) » — nom localisé + code ISO-2 entre parenthèses.
// (Pas d'emoji drapeau : Windows/Chrome ne les affichent pas — ils sortent en « BE ».)
export function paysAffiche(code) {
  if (!code) return '';
  const e = PAYS_I18N[String(code).trim().toUpperCase()];
  const cc2 = e && e.iso2;
  const nom = paysNom(code);
  return cc2 ? `${nom} (${cc2})` : nom;
}

// Libellé de statut : clés = identifiants canoniques EN (langue pivot).
// Affichage traduit ; statuts personnalisés affichés tels quels.
export const STATUT_I18N = {
  "To do":       { fr:"À faire",     nl:"Te doen",   de:"Zu erledigen" },
  "In progress": { fr:"En cours",    nl:"Bezig",     de:"In Bearbeitung" },
  "Done":        { fr:"Fait",        nl:"Klaar",     de:"Erledigt" },
  "Absent":      { fr:"Absent",      nl:"Afwezig",   de:"Abwesend" },
  "Refusal":     { fr:"Refus",       nl:"Weigering", de:"Abgelehnt" },
  "Moved":       { fr:"A déménager", nl:"Verhuisd",  de:"Umgezogen" },
  "Impossible":  { fr:"Impossible",  nl:"Onmogelijk", de:"Unmöglich" },
};
// Migration / import : ancien libellé canonique FR → clé canonique EN
export const STATUT_FR2EN = {};
Object.entries(STATUT_I18N).forEach(([en, e]) => { if (e.fr) STATUT_FR2EN[e.fr] = en; });
export function statutCanon(label) {
  if (!label) return label;
  if (STATUT_I18N[label]) return label;     // déjà canonique EN
  return STATUT_FR2EN[label] || label;      // ancien FR → EN, sinon brut (perso)
}
export function statutLabel(label) {
  const e = STATUT_I18N[label];
  if (!e) return label;                     // statut personnalisé
  return e[settings.lang] || label;         // EN = la clé elle-même
}
