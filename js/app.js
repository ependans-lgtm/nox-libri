// =====================================================================
// L'APPLICATION : la navigation, le mode cuir, le lancement
// (ce fichier est chargé en dernier : il met tout en route)
// =====================================================================

const VOLETS = {
  aujourdhui: afficherAujourdhui,
  calendrier: afficherCalendrier,
  taches: afficherTaches,
  bibliotheque: afficherBibliotheque,
  notes: afficherNotes
};
let voletActuel = "aujourdhui";

// Redessiner le volet affiché (après chaque changement)
function rafraichir() {
  const contenu = document.getElementById("contenu");
  const defilement = window.scrollY;
  contenu.innerHTML = "";
  VOLETS[voletActuel](contenu);
  window.scrollTo(0, defilement);
  document.querySelectorAll("#navigation button").forEach(b => b.classList.toggle("actif", b.dataset.volet === voletActuel));
}

function changerVolet(volet) {
  voletActuel = volet;
  if (volet === "bibliotheque") etatBiblio.vue = null;
  fermerToutesLesFenetres();
  rafraichir();
  window.scrollTo(0, 0);
}

document.querySelectorAll("#navigation button").forEach(bouton => {
  bouton.addEventListener("click", () => changerVolet(bouton.dataset.volet));
});


// ===== Le mode cuir (nuit) =====
// "auto" : selon l'heure ; mais on peut l'allumer ou l'éteindre à la main jusqu'au prochain changement d'heure.
function nuitSelonLHeure() {
  const r = donnees.reglages;
  const m = minutesMaintenant(), debut = enMinutes(r.nuitDebut), fin = enMinutes(r.nuitFin);
  return debut > fin ? (m >= debut || m < fin) : (m >= debut && m < fin);
}

// Le prochain moment où le mode automatique change (le soir ou le matin)
function prochainChangement() {
  const r = donnees.reglages;
  const maintenant = new Date();
  const candidats = [r.nuitDebut, r.nuitFin].map(h => {
    const d = new Date();
    d.setHours(...h.split(":").map(Number), 0, 0);
    if (d <= maintenant) d.setDate(d.getDate() + 1);
    return d;
  });
  return new Date(Math.min(...candidats)).toISOString();
}

function appliquerTheme() {
  const r = donnees.reglages;
  let nuit;
  if (r.modeNuit === "nuit") nuit = true;
  else if (r.modeNuit === "jour") nuit = false;
  else if (r.forcage && new Date() < new Date(r.forcage.expire)) nuit = r.forcage.nuit;
  else nuit = nuitSelonLHeure();
  document.body.classList.toggle("theme-nuit", nuit);
  document.body.classList.toggle("theme-jour", !nuit);
  document.querySelector('meta[name="theme-color"]').setAttribute("content", nuit ? "#14100b" : "#231D14");
}

// La chandelle de l'écran « Aujourd'hui » : allumer ou éteindre à la main
function basculerModeNuitALaMain() {
  const r = donnees.reglages;
  const nuitActuelle = document.body.classList.contains("theme-nuit");
  if (r.modeNuit !== "auto") r.modeNuit = nuitActuelle ? "jour" : "nuit";
  else r.forcage = { nuit: !nuitActuelle, expire: prochainChangement() };
  sauverDonnees();
  appliquerTheme();
  rafraichir();
}


// ===== Le lancement =====
chargerDonnees();
appliquerTheme();
genererTachesRecurrentes();
rafraichir();

// L'écran d'ouverture (l'ex-libris) attend qu'on le touche, puis la page se tourne
const ouverture = document.getElementById("ouverture");
function tournerLaPage() {
  if (ouverture.classList.contains("tournee")) return;   // une seule fois
  ouverture.classList.add("tournee");
  setTimeout(() => ouverture.remove(), 1400);            // une fois tournée, on la retire
  setTimeout(verifierRappels, 1800);                     // les rappels attendent que le carnet soit ouvert
}
ouverture.addEventListener("click", tournerLaPage);
ouverture.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") tournerLaPage(); });
ouverture.focus();

// L'application installable : le « service worker » garde les fichiers pour fonctionner sans internet
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(erreur => console.warn("Service worker", erreur));
}

// Toutes les minutes : le mode cuir, les rappels, et l'heure qui avance (compte à rebours, ligne rouge)
setInterval(() => {
  appliquerTheme();
  verifierRappels();
  const occupe = document.getElementById("fenetres").children.length || !document.getElementById("lecteur").hidden
    || ["INPUT", "TEXTAREA"].includes(document.activeElement && document.activeElement.tagName);
  if (!occupe && (voletActuel === "aujourdhui" || voletActuel === "calendrier")) rafraichir();
}, 60000);

// Quand on revient dans l'application après l'avoir quittée, on remet tout à l'heure
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    appliquerTheme();
    genererTachesRecurrentes();
    verifierRappels();
    if (!document.getElementById("fenetres").children.length && document.getElementById("lecteur").hidden) rafraichir();
  }
});
