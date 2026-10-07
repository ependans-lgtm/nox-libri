// =====================================================================
// OUTILS : les petites fonctions utilisées partout dans l'application
// =====================================================================

// ===== Les dates =====
// Dans Ex Libris, une date est toujours un texte "AAAA-MM-JJ" (ex : "2026-10-07").
// C'est simple à enregistrer, à comparer ("2026-10-07" < "2026-10-08") et à lire.

const NOMS_JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const NOMS_JOURS_COURTS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const NOMS_MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
                   "août", "septembre", "octobre", "novembre", "décembre"];

// Transformer un objet Date en texte "AAAA-MM-JJ"
function versTexte(date) {
  const a = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const j = String(date.getDate()).padStart(2, "0");
  return a + "-" + m + "-" + j;
}

// Transformer un texte "AAAA-MM-JJ" en objet Date (à minuit, heure locale)
function versDate(texte) {
  const [a, m, j] = texte.split("-").map(Number);
  return new Date(a, m - 1, j);
}

// La date d'aujourd'hui
function aujourdhui() {
  return versTexte(new Date());
}

// Ajouter (ou retirer) des jours à une date
function ajouterJours(texte, n) {
  const d = versDate(texte);
  d.setDate(d.getDate() + n);
  return versTexte(d);
}

// Ajouter des mois à une date (utile pour la vue Mois)
function ajouterMois(texte, n) {
  const d = versDate(texte);
  return versTexte(new Date(d.getFullYear(), d.getMonth() + n, 1));
}

// Le jour de la semaine : 0 = lundi … 6 = dimanche (à la française)
function jourSemaine(texte) {
  return (versDate(texte).getDay() + 6) % 7;
}

// Le lundi de la semaine qui contient cette date
function lundiDe(texte) {
  return ajouterJours(texte, -jourSemaine(texte));
}

// Le nombre de jours entre deux dates
function ecartJours(de, a) {
  return Math.round((versDate(a) - versDate(de)) / 86400000);
}

// "mercredi 7 octobre"
function dateLongue(texte) {
  const d = versDate(texte);
  return NOMS_JOURS[jourSemaine(texte)] + " " + premierOuNombre(d.getDate()) + " " + NOMS_MOIS[d.getMonth()];
}

// "mer. 7 oct."
const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
function dateCourte(texte) {
  const d = versDate(texte);
  return NOMS_JOURS[jourSemaine(texte)].slice(0, 3) + ". " + d.getDate() + " " + MOIS_COURTS[d.getMonth()];
}

// "1er" pour le premier du mois, sinon le nombre
function premierOuNombre(n) {
  return n === 1 ? "1er" : String(n);
}

// ===== Les heures =====
// Une heure est un texte "HH:MM". Pour calculer, on la transforme en minutes.

function enMinutes(heure) {
  const [h, m] = heure.split(":").map(Number);
  return h * 60 + m;
}

// "14:00" → "14 h" ; "14:30" → "14 h 30"
function heureLisible(heure) {
  const [h, m] = heure.split(":").map(Number);
  return h + " h" + (m ? " " + String(m).padStart(2, "0") : "");
}

// Une durée en minutes → "1 h 30", "45 min"
function dureeLisible(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return m + " min";
  return h + " h" + (m ? " " + String(m).padStart(2, "0") : "");
}

// L'heure actuelle, en minutes depuis minuit
function minutesMaintenant() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

// ===== Les identifiants =====
// Chaque rendez-vous, tâche, note ou livre reçoit un numéro unique.
function nouvelId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ===== Fabriquer des éléments HTML =====
// el("p", { class: "petit" }, "Bonjour") fabrique <p class="petit">Bonjour</p>.
// Les textes sont toujours insérés comme du texte (jamais comme du code) : c'est plus sûr.
function el(balise, attributs, ...enfants) {
  const element = document.createElement(balise);
  for (const nom in (attributs || {})) {
    const valeur = attributs[nom];
    if (valeur === undefined || valeur === null || valeur === false) continue;
    if (nom.startsWith("on")) {
      element.addEventListener(nom.slice(2), valeur);   // onclick → l'événement "click"
    } else if (nom === "style" && typeof valeur === "object") {
      Object.assign(element.style, valeur);
    } else {
      element.setAttribute(nom, valeur === true ? "" : valeur);
    }
  }
  for (const enfant of enfants.flat()) {
    if (enfant === null || enfant === undefined || enfant === false) continue;
    element.append(enfant instanceof Node ? enfant : String(enfant));
  }
  return element;
}

// Un titre avec sa lettrine : "Mercredi" → [M] + "ercredi"
function avecInitiale(texte, classe) {
  return el("span", null,
    el("span", { class: classe || "initiale" }, texte.charAt(0)),
    texte.slice(1));
}

// Choisir un élément au hasard dans une liste
function auHasard(liste) {
  return liste[Math.floor(Math.random() * liste.length)];
}

// Afficher un petit message temporaire en haut de l'écran
function afficherMessage(texte) {
  const zone = document.getElementById("messages");
  const message = el("div", { class: "message" }, texte);
  zone.append(message);
  setTimeout(() => message.remove(), 3200);
}

// Les noms des niveaux d'importance
const IMPORTANCES = {
  braise: { nom: "Braise", reperes: "●●●", sens: "ça brûle : urgent ou important" },
  flamme: { nom: "Flamme", reperes: "●●", sens: "à garder en vue" },
  cendre: { nom: "Cendre", reperes: "●", sens: "quand on a le temps" }
};

// Les couleurs de cuir des reliures et des listes
const COULEURS_CUIR = ["#663A1D", "#53341B", "#2C291C", "#5C3A3A", "#3E4A3A", "#5C4E3A", "#6b4423", "#4a2f1a"];
