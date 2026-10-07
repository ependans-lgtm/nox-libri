// =====================================================================
// LE CALENDRIER : les vues Mois, Semaine et Jour
// =====================================================================

const etatCalendrier = {
  vue: "semaine",              // "mois", "semaine" ou "jour"
  date: aujourdhui(),          // la date affichée
  jourSelectionne: aujourdhui()  // dans la vue Mois, le jour touché
};

function afficherCalendrier(conteneur) {
  const vue = etatCalendrier.vue;
  const page = el("div", { class: "page" + (vue === "mois" ? " fond-carte" : "") });

  // Le ruban : revenir à aujourd'hui
  page.append(el("button", {
    class: "ruban", title: "Revenir à aujourd'hui",
    onclick: () => { etatCalendrier.date = aujourdhui(); etatCalendrier.jourSelectionne = aujourdhui(); rafraichir(); }
  }));

  // L'en-tête : flèches et titre
  const pas = { mois: d => ajouterMois(d, 1), semaine: d => ajouterJours(d, 7), jour: d => ajouterJours(d, 1) };
  const recul = { mois: d => ajouterMois(d, -1), semaine: d => ajouterJours(d, -7), jour: d => ajouterJours(d, -1) };
  page.append(el("div", { class: "entete-calendrier" },
    el("button", { class: "fleche", "aria-label": "Précédent", onclick: () => { etatCalendrier.date = recul[vue](etatCalendrier.date); rafraichir(); } }, "‹"),
    el("p", { class: "titre-calendrier" }, titreCalendrier()),
    el("button", { class: "fleche", "aria-label": "Suivant", onclick: () => { etatCalendrier.date = pas[vue](etatCalendrier.date); rafraichir(); } }, "›")));

  // Le choix de la vue
  page.append(el("div", { class: "onglets", style: { justifyContent: "center", marginBottom: "12px" } },
    [["jour", "Jour"], ["semaine", "Semaine"], ["mois", "Mois"]].map(([cle, nom]) => el("button", {
      class: vue === cle ? "actif" : "",
      onclick: () => { etatCalendrier.vue = cle; rafraichir(); }
    }, nom))));

  if (vue === "mois") dessinerMois(page);
  if (vue === "semaine") dessinerSemaine(page);
  if (vue === "jour") dessinerJour(page);

  conteneur.append(page);

  // Le bouton « + » : un nouveau rendez-vous
  const dateParDefaut = vue === "mois" ? etatCalendrier.jourSelectionne : vue === "jour" ? etatCalendrier.date : aujourdhui();
  conteneur.append(el("button", { class: "bouton-plus", "aria-label": "Nouveau rendez-vous",
    onclick: () => ouvrirFormulaireRendezVous(null, "nouveau", { date: dateParDefaut }) }, "+"));
}

function titreCalendrier() {
  const d = versDate(etatCalendrier.date);
  if (etatCalendrier.vue === "mois") {
    return avecInitiale(capitaliser(NOMS_MOIS[d.getMonth()]) + " " + d.getFullYear(), "initiale");
  }
  if (etatCalendrier.vue === "semaine") {
    const lundi = lundiDe(etatCalendrier.date);
    const dimanche = ajouterJours(lundi, 6);
    const l = versDate(lundi), di = versDate(dimanche);
    const texte = l.getMonth() === di.getMonth()
      ? "Semaine du " + l.getDate() + " au " + di.getDate() + " " + NOMS_MOIS[di.getMonth()]
      : "Semaine du " + l.getDate() + " " + MOIS_COURTS[l.getMonth()] + " au " + di.getDate() + " " + MOIS_COURTS[di.getMonth()];
    return avecInitiale(texte, "initiale");
  }
  return avecInitiale(capitaliser(dateLongue(etatCalendrier.date)), "initiale");
}


// ===== Vue MOIS =====
function dessinerMois(page) {
  const premier = versDate(etatCalendrier.date);
  premier.setDate(1);
  const premierTexte = versTexte(premier);
  const moisAffiche = premier.getMonth();
  let jour = lundiDe(premierTexte);
  const grille = el("div", { class: "mois-grille" });
  NOMS_JOURS_COURTS.forEach(nom => grille.append(el("span", { class: "nom-jour" }, nom.charAt(0))));

  // 6 semaines au maximum, mais on s'arrête dès que le mois est fini
  for (let semaine = 0; semaine < 6; semaine++) {
    if (semaine > 0 && versDate(jour).getMonth() !== moisAffiche) break;
    for (let i = 0; i < 7; i++) {
      const date = jour;
      const rdv = rendezVousDuJour(date);
      const classes = ["jour-mois"];
      if (versDate(date).getMonth() !== moisAffiche) classes.push("hors-mois");
      if (date === aujourdhui()) classes.push("aujourdhui");
      if (date === etatCalendrier.jourSelectionne) classes.push("selectionne");
      grille.append(el("button", {
        class: classes.join(" "),
        onclick: () => { etatCalendrier.jourSelectionne = date; rafraichir(); }
      },
        el("span", { class: "numero" }, versDate(date).getDate()),
        el("span", { class: "points" }, rdv.slice(0, 3).map(r => el("span", { class: "point " + r.importance })))));
      jour = ajouterJours(jour, 1);
    }
  }
  page.append(grille);

  // La rose des vents de la carte ancienne
  page.append(roseDesVents());

  // Le détail du jour touché
  const choisi = etatCalendrier.jourSelectionne;
  page.append(el("p", { class: "rubrique" }, capitaliser(dateLongue(choisi)),
    el("button", { class: "lien", onclick: () => { etatCalendrier.vue = "jour"; etatCalendrier.date = choisi; rafraichir(); } }, "ouvrir la journée →")));
  const rdvDuJour = rendezVousDuJour(choisi);
  if (rdvDuJour.length === 0) page.append(el("p", { class: "vide" }, "Aucun rendez-vous."));
  rdvDuJour.forEach(r => page.append(ligneRendezVous(r)));
  const tachesDuJour = tachesDeLaDate(choisi);
  if (tachesDuJour.length) {
    page.append(el("p", { class: "rubrique" }, "À faire"));
    tachesDuJour.forEach(t => page.append(ligneTache(t)));
  }
}

function roseDesVents() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 80 80");
  svg.setAttribute("class", "rose-des-vents");
  svg.innerHTML = '<circle cx="40" cy="40" r="30" fill="none" stroke="currentColor"/><circle cx="40" cy="40" r="24" fill="none" stroke="currentColor" stroke-width=".5"/>'
    + '<path d="M40 4 L44 40 L40 76 L36 40 Z" fill="currentColor" opacity=".8"/><path d="M4 40 L40 36 L76 40 L40 44 Z" fill="currentColor" opacity=".55"/>'
    + '<path d="M15 15 L41 39 L65 65 L39 41 Z M65 15 L41 41 L15 65 L39 39 Z" fill="currentColor" opacity=".3"/>'
    + '<text x="40" y="3" font-size="7" text-anchor="middle" fill="currentColor" font-family="EB Garamond">N</text>';
  return svg;
}

// Une ligne de rendez-vous : « 14 h – 15 h 30 ● Bibliothèque »
function ligneRendezVous(r, barrerSiPasse) {
  const passe = barrerSiPasse && r.date === aujourdhui() && enMinutes(r.fin) <= minutesMaintenant();
  return el("div", { class: "ligne-programme" + (passe ? " passe" : ""), onclick: () => ouvrirFicheRendezVous(r) },
    el("span", { class: "petit" }, heureLisible(r.debut) + (barrerSiPasse ? "" : " – " + heureLisible(r.fin))),
    el("span", { class: "point " + r.importance }),
    el("span", null, r.titre + (r.recurrent ? " ↻" : "")));
}


// ===== Les grilles d'heures (semaine et jour) =====
// Les heures affichées : de 7 h à 22 h, élargies si un rendez-vous déborde
function plageHoraire(listeRdv) {
  let debut = 7, fin = 22;
  for (const r of listeRdv) {
    debut = Math.min(debut, Math.floor(enMinutes(r.debut) / 60));
    fin = Math.max(fin, Math.ceil(enMinutes(r.fin) / 60));
  }
  return { debut, fin };
}

// Placer un bloc : sa position verticale dépend de l'heure, sa hauteur de la durée
function blocRendezVous(r, plage, hauteurHeure, detaille) {
  const haut = (enMinutes(r.debut) - plage.debut * 60) / 60 * hauteurHeure;
  const hauteur = Math.max(18, (enMinutes(r.fin) - enMinutes(r.debut)) / 60 * hauteurHeure - 2);
  return el("div", {
    class: "bloc imp-" + r.importance + (r.recurrent ? " recurrent" : ""),
    style: { top: (haut + 1) + "px", height: hauteur + "px" },
    onclick: e => { e.stopPropagation(); ouvrirFicheRendezVous(r); }
  },
    r.titre,
    detaille ? el("div", { class: "petit" }, heureLisible(r.debut) + " – " + heureLisible(r.fin) + (r.lieu ? " · " + r.lieu : "")) : null);
}

// Toucher un endroit vide de la grille : nouveau rendez-vous à cette heure
function creerALHeureTouchee(evenement, colonne, date, plage, hauteurHeure) {
  const y = evenement.clientY - colonne.getBoundingClientRect().top;
  const demiHeures = Math.floor(y / (hauteurHeure / 2));
  const debut = minutesEnHeure(plage.debut * 60 + demiHeures * 30);
  ouvrirFormulaireRendezVous(null, "nouveau", { date, debut });
}

function etiquettesHeures(plage, hauteurHeure) {
  const zone = el("div", { style: { position: "relative" } });
  for (let h = plage.debut; h <= plage.fin; h++) {
    zone.append(el("span", { class: "heure", style: { top: (h - plage.debut) * hauteurHeure + "px" } }, h + " h"));
  }
  return zone;
}

function ligneMaintenant(plage, hauteurHeure) {
  const m = minutesMaintenant();
  if (m < plage.debut * 60 || m > plage.fin * 60) return null;
  return el("div", { class: "maintenant", style: { top: (m - plage.debut * 60) / 60 * hauteurHeure + "px" } });
}


// ===== Vue SEMAINE =====
function dessinerSemaine(page) {
  const H = 36;   // hauteur d'une heure, en pixels
  const lundi = lundiDe(etatCalendrier.date);
  const jours = [0, 1, 2, 3, 4, 5, 6].map(i => ajouterJours(lundi, i));
  const rdvParJour = jours.map(d => rendezVousDuJour(d));
  const plage = plageHoraire(rdvParJour.flat());
  const hauteurTotale = (plage.fin - plage.debut) * H;

  page.append(el("div", { class: "semaine-entete" },
    el("span"),
    jours.map((d, i) => el("span", { class: d === aujourdhui() ? "ajd" : "" }, NOMS_JOURS_COURTS[i], el("b", null, versDate(d).getDate())))));

  const corps = el("div", { class: "semaine-corps grille-heures", style: { height: hauteurTotale + "px", "--h": H + "px" } });
  corps.style.setProperty("--h", H + "px");
  corps.append(etiquettesHeures(plage, H));
  jours.forEach((date, i) => {
    const colonne = el("div", { class: "colonne-jour" + (date === aujourdhui() ? " ajd" : "") });
    colonne.addEventListener("click", e => creerALHeureTouchee(e, colonne, date, plage, H));
    rdvParJour[i].forEach(r => colonne.append(blocRendezVous(r, plage, H, false)));
    if (date === aujourdhui()) { const l = ligneMaintenant(plage, H); if (l) colonne.append(l); }
    corps.append(colonne);
  });
  page.append(corps);
}


// ===== Vue JOUR =====
function dessinerJour(page) {
  const H = 50;
  const date = etatCalendrier.date;
  const rdv = rendezVousDuJour(date);
  const plage = plageHoraire(rdv);

  const corps = el("div", { class: "grille-heures vue-jour", style: { height: (plage.fin - plage.debut) * H + "px", marginLeft: "34px", position: "relative" } });
  corps.style.setProperty("--h", H + "px");
  const etiquettes = etiquettesHeures(plage, H);
  etiquettes.style.position = "absolute";
  etiquettes.style.left = "-34px";
  corps.append(etiquettes);
  corps.addEventListener("click", e => creerALHeureTouchee(e, corps, date, plage, H));
  rdv.forEach(r => corps.append(blocRendezVous(r, plage, H, true)));
  if (date === aujourdhui()) { const l = ligneMaintenant(plage, H); if (l) corps.append(l); }
  page.append(corps);

  const taches = tachesDeLaDate(date);
  page.append(el("p", { class: "rubrique" }, "Tâches du jour", el("span", { class: "petit" }, compteurTaches(taches))));
  if (taches.length === 0) page.append(el("p", { class: "vide" }, "Aucune tâche ce jour-là."));
  taches.forEach(t => page.append(ligneTache(t)));
}
