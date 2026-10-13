// =====================================================================
// LES FENÊTRES : les pages qui s'ouvrent par-dessus l'écran
// (fiches, formulaires, questions)
// =====================================================================

// Ouvrir une fenêtre contenant "contenu" (un élément HTML).
// Renvoie une fonction pour la fermer.
function ouvrirFenetre(contenu, options) {
  options = options || {};

  // La fenêtre a deux parties : une barre fixe en haut (avec la croix pour fermer),
  // et le corps, qui défile si le contenu est long. La croix reste donc toujours visible.
  const corps = el("div", { class: "fenetre-corps" + (options.classe ? " " + options.classe : "") }, contenu);
  const barre = options.petite ? null : el("div", { class: "fenetre-barre" },
    el("button", { class: "fermer-fenetre", "aria-label": "Fermer", onclick: () => fermer() }, "✕"));
  const page = el("div", { class: "page fenetre" + (options.petite ? " petite" : "") }, barre, corps);
  const voile = el("div", { class: "voile" }, page);
  let ouverte = true;

  // Fermer sans toucher à l'historique (c'est ce que fait la flèche « retour » du téléphone)
  function fermerSimplement() {
    if (!ouverte) return;
    ouverte = false;
    voile.remove();
    if (options.quandFerme) options.quandFerme();
  }

  // Fermer depuis l'application (la croix, un bouton, le fond sombre)
  function fermer() {
    if (!ouverte) return;
    oublierRetour(fermerSimplement);
    fermerSimplement();
  }

  // Toucher le fond sombre (en dehors de la page) ferme la fenêtre
  voile.addEventListener("click", evenement => {
    if (evenement.target === voile) fermer();
  });

  voile.fermerSimplement = fermerSimplement;
  document.getElementById("fenetres").append(voile);
  retenirRetour(fermerSimplement);
  return fermer;
}

// Fermer toutes les fenêtres ouvertes (quand on change de volet)
function fermerToutesLesFenetres() {
  [...document.getElementById("fenetres").children].forEach(voile => {
    oublierRetour(voile.fermerSimplement);
    voile.remove();
  });
}


// ===== La flèche « retour » du téléphone =====
// Chaque fois qu'on ouvre quelque chose (une fiche, le lecteur…), on ajoute une étape dans
// l'historique du navigateur. La flèche « retour » revient d'une étape : on en profite pour
// refermer ce qui a été ouvert en dernier, au lieu de quitter l'application.
const pileRetour = [];          // les fonctions qui referment ce qui est ouvert, dans l'ordre
let retoursAIgnorer = 0;        // les retours qu'on a provoqués nous-mêmes

function retenirRetour(refermer) {
  pileRetour.push(refermer);
  history.pushState({ etape: pileRetour.length }, "");
}

// On a refermé nous-mêmes (avec la croix) : on retire l'étape de l'historique
function oublierRetour(refermer) {
  const rang = pileRetour.lastIndexOf(refermer);
  if (rang < 0) return;
  pileRetour.splice(rang, 1);
  retoursAIgnorer++;
  history.back();
}

window.addEventListener("popstate", () => {
  if (retoursAIgnorer > 0) { retoursAIgnorer--; return; }
  const refermer = pileRetour.pop();
  if (refermer) refermer();
});

// Poser une question avec plusieurs réponses possibles.
// choix = [{ texte: "Oui", valeur: "oui", plein: true }, …]
// Renvoie une promesse qui donne la valeur choisie (ou null si on ferme).
function demanderChoix(question, choix, detail) {
  return new Promise(reponse => {
    let repondu = false;
    const boutons = choix.map(c => el("button", {
      class: "bouton" + (c.plein ? " plein" : "") + (c.discret ? " discret" : ""),
      onclick: () => { repondu = true; fermer(); reponse(c.valeur); }
    }, c.texte));
    const contenu = el("div", null,
      el("p", { style: { fontSize: "19px", color: "var(--encre-titre)" } }, question),
      detail ? el("p", { class: "petit", style: { marginTop: "6px" } }, detail) : null,
      el("div", { class: "rangee-boutons", style: { flexWrap: "wrap" } }, boutons));
    const fermer = ouvrirFenetre(contenu, { petite: true, quandFerme: () => { if (!repondu) reponse(null); } });
  });
}

// Demander un texte (comme le nom d'une liste)
function demanderTexte(question, valeurDeDepart, indication) {
  return new Promise(reponse => {
    let repondu = false;
    const champ = el("input", { type: "text", value: valeurDeDepart || "", placeholder: indication || "" });
    function valider() {
      repondu = true;
      fermer();
      reponse(champ.value.trim());
    }
    champ.addEventListener("keydown", e => { if (e.key === "Enter") valider(); });
    const contenu = el("div", null,
      el("p", { style: { fontSize: "19px", color: "var(--encre-titre)" } }, question),
      el("div", { class: "champ" }, champ),
      el("div", { class: "rangee-boutons" },
        el("button", { class: "bouton discret", onclick: () => fermer() }, "Annuler"),
        el("button", { class: "bouton plein", onclick: valider }, "Valider")));
    const fermer = ouvrirFenetre(contenu, { petite: true, quandFerme: () => { if (!repondu) reponse(null); } });
    setTimeout(() => champ.focus(), 50);
  });
}

// Demander une date (comme « envoyer cet élément vers quel jour ? »)
function demanderDate(question, dateDeDepart) {
  return new Promise(reponse => {
    let repondu = false;
    const champ = el("input", { type: "date", value: dateDeDepart || aujourdhui() });
    const contenu = el("div", null,
      el("p", { style: { fontSize: "19px", color: "var(--encre-titre)" } }, question),
      el("div", { class: "champ" }, champ),
      el("div", { class: "rangee-boutons" },
        el("button", { class: "bouton discret", onclick: () => fermer() }, "Annuler"),
        el("button", { class: "bouton plein", onclick: () => { repondu = true; fermer(); reponse(champ.value || null); } }, "Valider")));
    const fermer = ouvrirFenetre(contenu, { petite: true, quandFerme: () => { if (!repondu) reponse(null); } });
  });
}

// Les boutons de choix d'importance (Braise, Flamme, Cendre).
// "quandChange" est appelée avec la nouvelle valeur.
function choixImportance(valeur, quandChange) {
  const zone = el("div", { class: "onglets" });
  function dessiner() {
    zone.innerHTML = "";
    for (const cle of ["braise", "flamme", "cendre"]) {
      zone.append(el("button", {
        type: "button",
        class: "choix imp-" + cle + (valeur === cle ? " actif" : ""),
        onclick: () => { valeur = cle; dessiner(); quandChange(cle); }
      }, IMPORTANCES[cle].reperes + " " + IMPORTANCES[cle].nom));
    }
  }
  dessiner();
  return zone;
}

// Le choix d'une répétition : jamais, chaque jour, chaque semaine (avec les jours), chaque mois, du… au…
// "repetition" est modifiée directement. "avecSansFin" ajoute la mention « sans fin » pour le champ « au ».
function choixRepetition(repetition, dateDeReference, options) {
  options = options || {};
  const zone = el("div");
  function dessiner() {
    zone.innerHTML = "";
    const types = [["aucune", "Jamais"], ["jour", "Chaque jour"], ["semaine", "Chaque semaine"], ["mois", "Chaque mois"]];
    zone.append(el("div", { class: "onglets" }, types.map(([cle, nom]) => el("button", {
      type: "button",
      class: "choix" + (repetition.type === cle ? " actif" : ""),
      onclick: () => {
        repetition.type = cle;
        if (cle === "semaine" && (!repetition.jours || repetition.jours.length === 0)) {
          repetition.jours = [jourSemaine(dateDeReference())];
        }
        dessiner();
      }
    }, nom))));

    if (repetition.type === "semaine") {
      zone.append(el("div", { class: "onglets" }, ["L", "M", "M", "J", "V", "S", "D"].map((lettre, i) => el("button", {
        type: "button",
        class: "choix jour-choix" + (repetition.jours.includes(i) ? " actif" : ""),
        title: NOMS_JOURS[i],
        onclick: () => {
          if (repetition.jours.includes(i)) repetition.jours = repetition.jours.filter(j => j !== i);
          else repetition.jours.push(i);
          if (repetition.jours.length === 0) repetition.jours = [i];
          dessiner();
        }
      }, lettre))));
    }

    if (repetition.type !== "aucune") {
      const du = el("input", { type: "date", value: repetition.du || dateDeReference(), onchange: e => { repetition.du = e.target.value; } });
      const au = el("input", { type: "date", value: repetition.au || "", onchange: e => { repetition.au = e.target.value; } });
      if (!repetition.du) repetition.du = dateDeReference();
      zone.append(el("div", { class: "deux-colonnes" },
        el("div", { class: "champ" }, el("label", null, "Du"), du),
        el("div", { class: "champ" }, el("label", null, "Au (vide = sans fin)"), au)));
      if (options.avecRattrapage) {
        const coche = el("input", { type: "checkbox", onchange: e => { repetition.rattraper = e.target.checked; } });
        coche.checked = !!repetition.rattraper;
        zone.append(el("label", { class: "case-texte" }, coche, "Rattraper les oublis"));
      }
    }
  }
  dessiner();
  return zone;
}

// Une répétition en langage clair : « chaque mercredi, du 1er octobre au 17 décembre »
function repetitionLisible(rep) {
  if (!rep || rep.type === "aucune") return "";
  let texte = "";
  if (rep.type === "jour") texte = "Chaque jour";
  if (rep.type === "mois") texte = "Chaque mois";
  if (rep.type === "semaine") {
    const jours = [...rep.jours].sort();
    if (jours.length === 5 && jours.join() === "0,1,2,3,4") texte = "Chaque jour de semaine";
    else texte = "Chaque " + jours.map(j => NOMS_JOURS[j]).join(", ").replace(/, ([^,]*)$/, " et $1");
  }
  const d = rep.du ? versDate(rep.du) : null;
  const a = rep.au ? versDate(rep.au) : null;
  if (d && a) texte += ", du " + premierOuNombre(d.getDate()) + " " + NOMS_MOIS[d.getMonth()] + " au " + premierOuNombre(a.getDate()) + " " + NOMS_MOIS[a.getMonth()];
  else if (a) texte += ", jusqu'au " + premierOuNombre(a.getDate()) + " " + NOMS_MOIS[a.getMonth()];
  return texte;
}

// Une date correspond-elle à une répétition ? (pour les rendez-vous et les tâches qui reviennent)
function correspondARepetition(rep, dateDeDepart, date) {
  if (!rep || rep.type === "aucune") return date === dateDeDepart;
  const debut = rep.du || dateDeDepart;
  if (date < debut) return false;
  if (rep.au && date > rep.au) return false;
  if (rep.type === "jour") return true;
  if (rep.type === "semaine") return rep.jours.includes(jourSemaine(date));
  if (rep.type === "mois") return versDate(date).getDate() === versDate(dateDeDepart).getDate();
  return false;
}
