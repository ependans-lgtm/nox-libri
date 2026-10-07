// =====================================================================
// LES RENDEZ-VOUS : calculer ceux d'un jour, les afficher, les modifier
// =====================================================================

// Un rendez-vous qui se répète est enregistré UNE seule fois.
// Pour un jour donné, on calcule ses "occurrences" : les jours où il a lieu.
// Les exceptions retiennent les jours modifiés ou supprimés un par un.

function rendezVousDuJour(date) {
  const resultat = [];
  for (const rdv of donnees.rendezVous) {
    if (!correspondARepetition(rdv.repetition, rdv.date, date)) continue;
    const exception = rdv.exceptions && rdv.exceptions[date];
    if (exception === "supprime") continue;
    resultat.push({
      ...rdv,
      date: date,
      recurrent: rdv.repetition && rdv.repetition.type !== "aucune"
    });
  }
  return resultat.sort((a, b) => a.debut.localeCompare(b.debut));
}

// Le prochain rendez-vous d'aujourd'hui (ou celui en cours)
function prochainRendezVous() {
  const maintenant = minutesMaintenant();
  return rendezVousDuJour(aujourdhui()).find(r => enMinutes(r.fin) > maintenant) || null;
}

// « dans 45 min », « dans 2 h 10 », « en cours »
function compteARebours(rdv) {
  const ecart = enMinutes(rdv.debut) - minutesMaintenant();
  if (ecart <= 0) return "en cours";
  return "dans " + dureeLisible(ecart);
}


// ===== La fiche d'un rendez-vous (en lecture) =====
function ouvrirFicheRendezVous(occurrence) {
  const imp = IMPORTANCES[occurrence.importance];
  const duree = enMinutes(occurrence.fin) - enMinutes(occurrence.debut);
  const contenu = el("div", null,
    el("button", { class: "lien", onclick: () => fermer() }, "‹ retour"),
    el("p", { class: "titre-page", style: { marginTop: "14px", fontSize: "26px" } }, occurrence.titre),
    el("p", { class: "petit", style: { marginTop: "4px" } }, imp.reperes + " " + imp.nom + " · " + imp.sens),
    el("div", { class: "filet" }),
    el("div", { class: "detail" }, el("span", null, "◷"),
      el("span", null, capitaliser(dateLongue(occurrence.date)), el("br"),
        el("span", { class: "petit" }, heureLisible(occurrence.debut) + " – " + heureLisible(occurrence.fin) + " · " + dureeLisible(duree)))),
    occurrence.recurrent ? el("div", { class: "detail" }, el("span", null, "↻"), el("span", null, repetitionLisible(occurrence.repetition))) : null,
    occurrence.lieu ? el("div", { class: "detail" }, el("span", null, "⚑"), el("span", null, occurrence.lieu)) : null,
    occurrence.note ? el("div", { class: "detail" }, el("span", null, "✎"), el("span", { style: { fontFamily: "var(--f-machine)", fontSize: "14px", whiteSpace: "pre-wrap" } }, occurrence.note)) : null,
    el("div", { class: "rangee-boutons", style: { marginTop: "28px" } },
      el("button", { class: "bouton", onclick: () => supprimerRendezVous(occurrence, fermer) }, "Supprimer"),
      el("button", { class: "bouton plein", onclick: () => modifierRendezVous(occurrence, fermer) }, "Modifier")));
  const fermer = ouvrirFenetre(contenu);
}

function capitaliser(texte) {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

// Supprimer : pour un rendez-vous qui se répète, on demande « seulement celui-ci, ou tous ? »
async function supprimerRendezVous(occurrence, fermerFiche) {
  const base = donnees.rendezVous.find(r => r.id === occurrence.id);
  if (!base) return;
  let choix = "tous";
  if (occurrence.recurrent) {
    choix = await demanderChoix("Supprimer ce rendez-vous", [
      { texte: "Seulement celui-ci", valeur: "seul" },
      { texte: "Tous", valeur: "tous", plein: true }
    ], "Il se répète : " + repetitionLisible(base.repetition).toLowerCase() + ".");
    if (!choix) return;
  } else {
    choix = await demanderChoix("Supprimer « " + base.titre + " » ?", [
      { texte: "Annuler", valeur: null, discret: true },
      { texte: "Supprimer", valeur: "tous", plein: true }
    ]);
    if (!choix) return;
  }
  if (choix === "seul") {
    base.exceptions = base.exceptions || {};
    base.exceptions[occurrence.date] = "supprime";
  } else {
    donnees.rendezVous = donnees.rendezVous.filter(r => r.id !== base.id);
  }
  sauverDonnees();
  fermerFiche();
  rafraichir();
  afficherMessage("Rendez-vous supprimé");
}

// Modifier : même question pour un rendez-vous qui se répète
async function modifierRendezVous(occurrence, fermerFiche) {
  let mode = "tous";
  if (occurrence.recurrent) {
    mode = await demanderChoix("Modifier ce rendez-vous", [
      { texte: "Seulement celui-ci", valeur: "seul" },
      { texte: "Tous", valeur: "tous", plein: true }
    ]);
    if (!mode) return;
  }
  fermerFiche();
  ouvrirFormulaireRendezVous(occurrence, mode);
}


// ===== Le formulaire : créer ou modifier un rendez-vous =====
// occurrence = null pour un nouveau rendez-vous.
// mode = "nouveau", "tous" (modifier le rendez-vous et toutes ses répétitions) ou "seul" (seulement ce jour-là)
function ouvrirFormulaireRendezVous(occurrence, mode, valeursDeDepart) {
  mode = mode || (occurrence ? "tous" : "nouveau");
  const depart = valeursDeDepart || {};
  const base = occurrence ? donnees.rendezVous.find(r => r.id === occurrence.id) : null;

  // Une copie de travail : rien n'est enregistré tant qu'on n'a pas touché « Enregistrer »
  const brouillon = {
    titre: occurrence ? occurrence.titre : "",
    date: occurrence ? (mode === "tous" ? base.date : occurrence.date) : (depart.date || aujourdhui()),
    debut: occurrence ? occurrence.debut : (depart.debut || "09:00"),
    fin: occurrence ? occurrence.fin : (depart.fin || ajouterUneHeure(depart.debut || "09:00")),
    importance: occurrence ? occurrence.importance : "flamme",
    repetition: occurrence && mode === "tous" ? structuredClone(base.repetition) : { type: "aucune", jours: [], du: "", au: "" },
    lieu: occurrence ? occurrence.lieu : "",
    note: occurrence ? occurrence.note : ""
  };

  const champTitre = el("input", { type: "text", value: brouillon.titre, placeholder: "Bibliothèque universitaire" });
  const champDate = el("input", { type: "date", value: brouillon.date });
  const champDebut = el("input", { type: "time", value: brouillon.debut });
  const champFin = el("input", { type: "time", value: brouillon.fin });
  const champLieu = el("input", { type: "text", value: brouillon.lieu, placeholder: "Salle des manuscrits" });
  const champNote = el("textarea", { rows: 3 }, brouillon.note);

  // Si on change l'heure de début, la fin suit (en gardant la même durée)
  champDebut.addEventListener("change", () => {
    const duree = enMinutes(champFin.value) - enMinutes(brouillon.debut);
    brouillon.debut = champDebut.value;
    if (duree > 0) champFin.value = minutesEnHeure(enMinutes(champDebut.value) + duree);
  });

  const titreFenetre = mode === "nouveau" ? "Nouveau rendez-vous" : mode === "seul" ? "Modifier ce jour-là" : "Modifier le rendez-vous";

  const contenu = el("div", null,
    el("p", { class: "titre-page" }, avecInitiale(titreFenetre, "initiale")),
    el("div", { class: "champ" }, el("label", null, "Titre"), champTitre),
    el("div", { class: "colonnes" },
      el("div", { class: "champ" }, el("label", null, "Jour"), champDate),
      el("div", { class: "champ" }, el("label", null, "Début"), champDebut),
      el("div", { class: "champ" }, el("label", null, "Fin"), champFin)),
    el("div", { class: "champ" }, el("span", { class: "etiquette-champ" }, "Importance"),
      choixImportance(brouillon.importance, v => { brouillon.importance = v; })),
    mode !== "seul" ? el("div", { class: "champ" }, el("span", { class: "etiquette-champ" }, "Répétition"),
      choixRepetition(brouillon.repetition, () => champDate.value || aujourdhui())) : null,
    el("div", { class: "champ" }, el("label", null, "Lieu"), champLieu),
    el("div", { class: "champ" }, el("label", null, "Note"), champNote),
    el("div", { class: "rangee-boutons" },
      el("button", { class: "bouton discret", onclick: () => fermer() }, "Annuler"),
      el("button", { class: "bouton plein", onclick: enregistrer }, "Enregistrer")));

  const fermer = ouvrirFenetre(contenu);
  if (mode === "nouveau") setTimeout(() => champTitre.focus(), 50);

  function enregistrer() {
    const valeurs = {
      titre: champTitre.value.trim(),
      date: champDate.value,
      debut: champDebut.value,
      fin: champFin.value,
      importance: brouillon.importance,
      lieu: champLieu.value.trim(),
      note: champNote.value.trim()
    };
    if (!valeurs.titre) { afficherMessage("Donnez un titre au rendez-vous"); champTitre.focus(); return; }
    if (!valeurs.date || !valeurs.debut || !valeurs.fin) { afficherMessage("Indiquez le jour et les heures"); return; }
    if (enMinutes(valeurs.fin) <= enMinutes(valeurs.debut)) { afficherMessage("L'heure de fin doit être après l'heure de début"); return; }

    if (mode === "nouveau") {
      donnees.rendezVous.push({ id: nouvelId(), ...valeurs, repetition: nettoyerRepetition(brouillon.repetition), exceptions: {} });
    } else if (mode === "tous") {
      Object.assign(base, valeurs, { repetition: nettoyerRepetition(brouillon.repetition) });
    } else {
      // Seulement ce jour-là : on retire ce jour de la série, et on crée un rendez-vous à part
      base.exceptions = base.exceptions || {};
      base.exceptions[occurrence.date] = "supprime";
      donnees.rendezVous.push({ id: nouvelId(), ...valeurs, repetition: { type: "aucune", jours: [], du: "", au: "" }, exceptions: {} });
    }
    sauverDonnees();
    fermer();
    rafraichir();
    afficherMessage("Rendez-vous enregistré");
  }
}

function nettoyerRepetition(rep) {
  if (!rep || rep.type === "aucune") return { type: "aucune", jours: [], du: "", au: "" };
  return { type: rep.type, jours: rep.type === "semaine" ? [...rep.jours] : [], du: rep.du || "", au: rep.au || "" };
}

function minutesEnHeure(minutes) {
  minutes = Math.min(minutes, 23 * 60 + 59);
  return String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
}

function ajouterUneHeure(heure) {
  return minutesEnHeure(enMinutes(heure) + 60);
}
