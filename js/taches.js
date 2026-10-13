// =====================================================================
// LES TÂCHES : par date, sous-tâches, tâches qui reviennent, listes
// =====================================================================

const etatTaches = {
  onglet: "date",         // "date" ou "listes"
  filtre: "afaire",       // "afaire", "terminees" ou "importance"
  deplies: new Set()      // les tâches dont on voit les sous-tâches
};


// ===== Les tâches qui reviennent =====
// Une tâche qui revient est un "modèle". Chaque jour où elle a lieu, on fabrique
// une vraie tâche (une "instance"), seulement le jour venu.
function genererTachesRecurrentes() {
  const ajd = aujourdhui();
  let change = false;
  for (const modele of donnees.modelesTaches) {
    const rep = modele.repetition;
    const depart = rep.du || modele.dateCreation;
    let de = modele.genereJusqua ? ajouterJours(modele.genereJusqua, 1) : depart;
    if (de < depart) de = depart;
    const jusqua = rep.au && rep.au < ajd ? rep.au : ajd;
    if (de > jusqua) continue;
    if (ecartJours(de, jusqua) > 400) de = ajouterJours(jusqua, -400);   // sécurité

    // Les jours où la tâche aurait dû avoir lieu depuis la dernière fois
    const dates = [];
    for (let d = de; d <= jusqua; d = ajouterJours(d, 1)) {
      if (correspondARepetition(rep, depart, d)) dates.push(d);
    }

    if (rep.rattraper) {
      // On rattrape les oublis : une tâche pour chaque jour
      dates.forEach(d => creerInstance(modele, d));
    } else if (dates.length) {
      // Seule la dernière compte : les anciennes non faites disparaissent
      const derniere = dates[dates.length - 1];
      donnees.taches = donnees.taches.filter(t => !(t.modeleId === modele.id && !t.faite && t.date < derniere));
      creerInstance(modele, derniere);
    }
    modele.genereJusqua = jusqua;
    change = true;
  }
  if (change) sauverDonnees();
}

function creerInstance(modele, date) {
  if (donnees.taches.some(t => t.modeleId === modele.id && t.date === date)) return;
  donnees.taches.push({
    id: nouvelId(), titre: modele.titre, date, importance: modele.importance,
    faite: false, faiteLe: "", sousTaches: [], note: modele.note || "", modeleId: modele.id
  });
}


// ===== Trouver des tâches =====
// Elles sont rangées par importance seulement : une tâche cochée reste à sa place
// (elle ne descend pas sous les autres), pour ne pas faire bouger la liste sous le doigt.
function tachesDeLaDate(date) {
  return donnees.taches.filter(t => t.date === date)
    .sort((a, b) => RANG_IMPORTANCE[a.importance] - RANG_IMPORTANCE[b.importance]);
}

// Les sous-tâches qui ont leur propre date (elles apparaissent ce jour-là dans « Aujourd'hui »)
function sousTachesDeLaDate(date) {
  const resultat = [];
  donnees.taches.forEach(t => t.sousTaches.forEach(s => { if (s.date === date && t.date !== date) resultat.push({ tache: t, sous: s }); }));
  return resultat;
}

function tachesEnRetard() {
  const ajd = aujourdhui();
  return donnees.taches.filter(t => !t.faite && t.date && t.date < ajd).sort(ordreTaches);
}

// Les tâches non faites passent avant, puis la Braise avant la Flamme avant la Cendre
const RANG_IMPORTANCE = { braise: 0, flamme: 1, cendre: 2 };
function ordreTaches(a, b) {
  if (a.faite !== b.faite) return a.faite ? 1 : -1;
  return RANG_IMPORTANCE[a.importance] - RANG_IMPORTANCE[b.importance];
}

function compteurTaches(liste) {
  if (!liste.length) return "";
  return liste.filter(t => t.faite).length + " sur " + liste.length;
}


// ===== Cocher =====
function basculerTache(tache) {
  tache.faite = !tache.faite;
  tache.faiteLe = tache.faite ? aujourdhui() : "";
  // Cocher une tâche coche aussi toutes ses sous-tâches
  if (tache.faite) tache.sousTaches.forEach(s => { s.faite = true; });
  sauverDonnees();
  rafraichir();
}

function basculerSousTache(tache, sous) {
  sous.faite = !sous.faite;
  // La tâche se coche toute seule quand toutes ses sous-tâches sont faites (et se décoche sinon)
  const toutesFaites = tache.sousTaches.length > 0 && tache.sousTaches.every(s => s.faite);
  tache.faite = toutesFaites;
  tache.faiteLe = toutesFaites ? aujourdhui() : "";
  sauverDonnees();
  rafraichir();
}


// ===== Une ligne de tâche =====
function ligneTache(tache, options) {
  options = options || {};
  const ajd = aujourdhui();
  const nbSous = tache.sousTaches.length;
  const nbFaites = tache.sousTaches.filter(s => s.faite).length;
  const deplie = etatTaches.deplies.has(tache.id);
  const bloc = el("div");

  bloc.append(el("div", { class: "tache" + (tache.faite ? " faite" : "") },
    nbSous ? el("button", {
      class: "deplier", "aria-label": deplie ? "Replier" : "Déplier",
      onclick: () => { deplie ? etatTaches.deplies.delete(tache.id) : etatTaches.deplies.add(tache.id); rafraichir(); }
    }, deplie ? "▾" : "▸") : null,
    el("button", { class: "case" + (tache.faite ? " cochee" : ""), "aria-label": "Cocher", onclick: () => basculerTache(tache) }, tache.faite ? "✓" : ""),
    el("span", { class: "texte", onclick: () => ouvrirFicheTache(tache) }, tache.titre + (tache.modeleId ? " ↻" : "")),
    nbSous ? el("span", { class: "petit" }, nbFaites + " / " + nbSous) : null,
    options.montrerDate && tache.date && tache.date !== ajd ? el("span", { class: "petit" }, dateCourte(tache.date)) : null,
    el("span", { class: "point " + tache.importance })));

  if (nbSous && !tache.faite) {
    bloc.append(el("div", { class: "progres" }, el("span", { style: { width: (nbFaites / nbSous * 100) + "%" } })));
  }
  if (nbSous && deplie) {
    const zone = el("div", { class: "sous-taches" });
    tache.sousTaches.forEach(s => zone.append(el("div", { class: "tache" + (s.faite ? " faite" : "") },
      el("button", { class: "case" + (s.faite ? " cochee" : ""), onclick: () => basculerSousTache(tache, s) }, s.faite ? "✓" : ""),
      el("span", { class: "texte" }, s.titre),
      s.date ? el("span", { class: "petit" }, dateCourte(s.date)) : null)));
    zone.append(champAjoutRapide("sous-tâche…", texte => {
      tache.sousTaches.push({ id: nouvelId(), titre: texte, faite: false, date: "" });
      tache.faite = false;
      sauverDonnees();
      rafraichir();
    }));
    bloc.append(zone);
  }
  return bloc;
}

// Une sous-tâche datée, affichée seule (dans « Aujourd'hui » et la vue Jour)
function ligneSousTacheDatee(tache, sous) {
  return el("div", { class: "tache" + (sous.faite ? " faite" : "") },
    el("button", { class: "case" + (sous.faite ? " cochee" : ""), onclick: () => basculerSousTache(tache, sous) }, sous.faite ? "✓" : ""),
    el("span", { class: "texte", onclick: () => ouvrirFicheTache(tache) }, sous.titre, el("span", { class: "petit" }, "  · " + tache.titre)),
    el("span", { class: "point " + tache.importance }));
}

// Le champ « Écrire une tâche… » pour ajouter en deux secondes
function champAjoutRapide(indication, quandValide) {
  const champ = el("input", { type: "text", placeholder: indication });
  function valider() {
    const texte = champ.value.trim();
    if (texte) quandValide(texte);
  }
  champ.addEventListener("keydown", e => { if (e.key === "Enter") valider(); });
  return el("div", { class: "ajout-rapide" }, champ, el("button", { "aria-label": "Ajouter", onclick: valider }, "+"));
}


// ===== Le volet Tâches =====
function afficherTaches(conteneur) {
  genererTachesRecurrentes();
  const page = el("div", { class: "page" });
  page.append(el("p", { class: "titre-page" }, el("span", { class: "lettrine", style: { fontSize: "1.6em" } }, "T"), "âches"));
  page.append(el("div", { class: "clair" }));
  page.append(el("div", { class: "onglets", style: { borderBottom: "1px solid var(--or)", paddingBottom: "8px" } },
    el("button", { class: etatTaches.onglet === "date" ? "actif" : "", onclick: () => { etatTaches.onglet = "date"; rafraichir(); } }, "Par date"),
    el("button", { class: etatTaches.onglet === "listes" ? "actif" : "", onclick: () => { etatTaches.onglet = "listes"; rafraichir(); } }, "Listes")));

  if (etatTaches.onglet === "date") dessinerTachesParDate(page);
  else dessinerListes(page);

  conteneur.append(page);
  if (etatTaches.onglet === "date") {
    conteneur.append(el("button", { class: "bouton-plus", "aria-label": "Nouvelle tâche", onclick: () => ouvrirFicheTache(null) }, "+"));
  }
}

function dessinerTachesParDate(page) {
  const ajd = aujourdhui();
  const demain = ajouterJours(ajd, 1);
  const nonFaites = donnees.taches.filter(t => !t.faite);
  page.append(el("div", { class: "onglets" },
    [["afaire", "À faire · " + nonFaites.length], ["terminees", "Terminées"], ["importance", "Par importance"]].map(([cle, nom]) => el("button", {
      class: etatTaches.filtre === cle ? "actif" : "",
      onclick: () => { etatTaches.filtre = cle; rafraichir(); }
    }, nom))));

  function groupe(titre, liste, detail, options) {
    if (!liste.length) return;
    page.append(el("p", { class: "rubrique" }, titre, detail ? el("span", { class: "petit" }, detail) : null));
    liste.forEach(t => page.append(ligneTache(t, options)));
  }

  if (etatTaches.filtre === "afaire") {
    groupe("En retard", tachesEnRetard(), "reportées", { montrerDate: true });
    const duJour = tachesDeLaDate(ajd);
    groupe("Aujourd'hui", duJour, compteurTaches(duJour));
    groupe("Demain", nonFaites.filter(t => t.date === demain).sort(ordreTaches));
    groupe("Plus tard", nonFaites.filter(t => t.date && t.date > demain).sort((a, b) => a.date.localeCompare(b.date)), null, { montrerDate: true });
    groupe("Sans date", nonFaites.filter(t => !t.date).sort(ordreTaches));
    if (!nonFaites.length && !duJour.length) page.append(el("p", { class: "vide" }, "Rien à faire pour l'instant. Profitez-en pour lire !"));
    page.append(champAjoutRapide("Écrire une tâche pour aujourd'hui…", texte => {
      donnees.taches.push({ id: nouvelId(), titre: texte, date: ajd, importance: "flamme", faite: false, faiteLe: "", sousTaches: [], note: "", modeleId: null });
      sauverDonnees();
      rafraichir();
    }));
  }

  if (etatTaches.filtre === "terminees") {
    const faites = donnees.taches.filter(t => t.faite).sort((a, b) => (b.faiteLe || "").localeCompare(a.faiteLe || ""));
    if (!faites.length) page.append(el("p", { class: "vide" }, "Aucune tâche terminée."));
    faites.forEach(t => page.append(ligneTache(t, { montrerDate: true })));
    if (faites.length) page.append(el("button", { class: "lien", style: { marginTop: "14px" }, onclick: async () => {
      const ok = await demanderChoix("Effacer toutes les tâches terminées ?", [{ texte: "Annuler", valeur: null, discret: true }, { texte: "Effacer", valeur: true, plein: true }]);
      if (!ok) return;
      donnees.taches = donnees.taches.filter(t => !t.faite);
      sauverDonnees();
      rafraichir();
    } }, "Effacer les tâches terminées"));
  }

  if (etatTaches.filtre === "importance") {
    for (const cle of ["braise", "flamme", "cendre"]) {
      groupe(IMPORTANCES[cle].nom, nonFaites.filter(t => t.importance === cle), IMPORTANCES[cle].reperes, { montrerDate: true });
    }
    if (!nonFaites.length) page.append(el("p", { class: "vide" }, "Rien à faire pour l'instant."));
  }
}


// ===== La fiche d'une tâche (création et modification) =====
function ouvrirFicheTache(tache) {
  const nouvelle = !tache;
  const modele = tache && tache.modeleId ? donnees.modelesTaches.find(m => m.id === tache.modeleId) : null;
  const brouillon = {
    titre: tache ? tache.titre : "",
    date: tache ? (tache.date || "") : aujourdhui(),
    importance: tache ? tache.importance : "flamme",
    note: tache ? tache.note : "",
    sousTaches: tache ? structuredClone(tache.sousTaches) : [],
    repetition: modele ? structuredClone(modele.repetition) : { type: "aucune", jours: [], du: "", au: "", rattraper: false }
  };

  const champTitre = el("input", { type: "text", value: brouillon.titre, placeholder: "Préparer l'exposé" });
  const champDate = el("input", { type: "date", value: brouillon.date });
  const champNote = el("textarea", { rows: 3 }, brouillon.note);
  const zoneSous = el("div");

  function dessinerSousTaches() {
    zoneSous.innerHTML = "";
    brouillon.sousTaches.forEach((s, i) => {
      const texte = el("input", { type: "text", value: s.titre, oninput: e => { s.titre = e.target.value; } });
      const date = el("input", { type: "date", value: s.date || "", style: { fontSize: "13px" }, onchange: e => { s.date = e.target.value; } });
      zoneSous.append(el("div", { class: "ligne-sous-tache" },
        el("button", { class: "case" + (s.faite ? " cochee" : ""), onclick: () => { s.faite = !s.faite; dessinerSousTaches(); } }, s.faite ? "✓" : ""),
        texte, date,
        el("button", { class: "mini", "aria-label": "Monter", onclick: () => { if (i > 0) { brouillon.sousTaches.splice(i - 1, 0, brouillon.sousTaches.splice(i, 1)[0]); dessinerSousTaches(); } } }, "↑"),
        el("button", { class: "mini", "aria-label": "Descendre", onclick: () => { if (i < brouillon.sousTaches.length - 1) { brouillon.sousTaches.splice(i + 1, 0, brouillon.sousTaches.splice(i, 1)[0]); dessinerSousTaches(); } } }, "↓"),
        el("button", { class: "mini", "aria-label": "Retirer", onclick: () => { brouillon.sousTaches.splice(i, 1); dessinerSousTaches(); } }, "✕")));
    });
    zoneSous.append(champAjoutRapide("Ajouter une sous-tâche…", texte => {
      brouillon.sousTaches.push({ id: nouvelId(), titre: texte, faite: false, date: "" });
      dessinerSousTaches();
      const champs = zoneSous.querySelectorAll(".ajout-rapide input");
      champs[champs.length - 1].focus();
    }));
  }
  dessinerSousTaches();

  const contenu = el("div", null,
    el("button", { class: "lien", onclick: () => fermer() }, "‹ tâches"),
    el("p", { class: "titre-page", style: { marginTop: "10px" } }, avecInitiale(nouvelle ? "Nouvelle tâche" : "La tâche", "initiale")),
    el("div", { class: "champ" }, el("label", null, "Titre"), champTitre),
    el("div", { class: "champ" }, el("label", null, "Pour le (vide = sans date)"), champDate),
    el("div", { class: "champ" }, el("span", { class: "etiquette-champ" }, "Importance"), choixImportance(brouillon.importance, v => { brouillon.importance = v; })),
    el("div", { class: "champ" }, el("span", { class: "etiquette-champ" }, "Revient"),
      choixRepetition(brouillon.repetition, () => champDate.value || aujourdhui(), { avecRattrapage: true })),
    el("div", { class: "champ" }, el("span", { class: "etiquette-champ" }, "Sous-tâches"), zoneSous),
    el("div", { class: "champ" }, el("label", null, "Note"), champNote),
    el("div", { class: "rangee-boutons" },
      nouvelle ? el("button", { class: "bouton discret", onclick: () => fermer() }, "Annuler")
               : el("button", { class: "bouton", onclick: supprimer }, "Supprimer"),
      el("button", { class: "bouton plein", onclick: enregistrer }, "Enregistrer")));
  const fermer = ouvrirFenetre(contenu);
  if (nouvelle) setTimeout(() => champTitre.focus(), 50);

  function enregistrer() {
    const titre = champTitre.value.trim();
    if (!titre) { afficherMessage("Donnez un titre à la tâche"); return; }
    const sousTaches = brouillon.sousTaches.filter(s => s.titre.trim());
    const rep = brouillon.repetition;
    const revient = rep.type !== "aucune";

    if (revient && !modele) {
      // Une nouvelle tâche qui revient : on crée le modèle, et les tâches viendront le jour venu
      const nouveauModele = {
        id: nouvelId(), titre, importance: brouillon.importance, note: champNote.value.trim(),
        repetition: { ...nettoyerRepetition(rep), du: rep.du || champDate.value || aujourdhui(), rattraper: !!rep.rattraper },
        dateCreation: aujourdhui(), genereJusqua: ""
      };
      donnees.modelesTaches.push(nouveauModele);
      if (tache) donnees.taches = donnees.taches.filter(t => t.id !== tache.id);
      genererTachesRecurrentes();
    } else {
      const valeurs = { titre, date: champDate.value || "", importance: brouillon.importance, note: champNote.value.trim(), sousTaches };
      if (tache) Object.assign(tache, valeurs);
      else donnees.taches.push({ id: nouvelId(), ...valeurs, faite: false, faiteLe: "", modeleId: null });
      const cible = tache || donnees.taches[donnees.taches.length - 1];
      if (cible.sousTaches.length) {
        cible.faite = cible.sousTaches.every(s => s.faite);
        cible.faiteLe = cible.faite ? aujourdhui() : "";
      }
      if (modele) {
        if (!revient) {
          // On arrête la répétition : le modèle disparaît, cette tâche reste
          donnees.modelesTaches = donnees.modelesTaches.filter(m => m.id !== modele.id);
          tache.modeleId = null;
        } else {
          // Les prochaines fois reprendront le titre, l'importance, la note et la répétition
          Object.assign(modele, { titre, importance: brouillon.importance, note: valeurs.note, repetition: { ...nettoyerRepetition(rep), du: rep.du || modele.repetition.du, rattraper: !!rep.rattraper } });
        }
      }
    }
    sauverDonnees();
    fermer();
    rafraichir();
    afficherMessage("Tâche enregistrée");
  }

  async function supprimer() {
    let choix = "celle";
    if (modele) {
      choix = await demanderChoix("Supprimer cette tâche", [
        { texte: "Seulement celle-ci", valeur: "celle" },
        { texte: "Arrêter la répétition", valeur: "arreter", plein: true }
      ], repetitionLisible(modele.repetition));
      if (!choix) return;
    }
    donnees.taches = donnees.taches.filter(t => t.id !== tache.id);
    if (choix === "arreter") {
      donnees.modelesTaches = donnees.modelesTaches.filter(m => m.id !== modele.id);
      donnees.taches = donnees.taches.filter(t => !(t.modeleId === modele.id && !t.faite));
    }
    sauverDonnees();
    fermer();
    rafraichir();
    afficherMessage("Tâche supprimée");
  }
}


// ===== Les listes thématiques =====
function dessinerListes(page) {
  if (!donnees.listes.length) page.append(el("p", { class: "vide" }, "Créez une liste pour les courses, les livres à acheter, une valise…"));
  donnees.listes.forEach(liste => {
    const reste = liste.elements.filter(e => !e.fait).length;
    page.append(el("div", { class: "fiche-liste", onclick: () => ouvrirListe(liste) },
      el("span", { class: "onglet-couleur", style: { background: liste.couleur } }),
      el("b", null, liste.nom),
      el("span", { class: "petit" }, liste.elements.length ? reste + " sur " + liste.elements.length : "vide")));
  });
  page.append(el("button", { class: "ajout-rapide", style: { width: "100%", cursor: "pointer", background: "none", fontFamily: "var(--f-machine)", color: "var(--texte-discret)", padding: "9px 10px" }, onclick: async () => {
    const nom = await demanderTexte("Nom de la nouvelle liste", "", "Courses");
    if (!nom) return;
    const liste = { id: nouvelId(), nom, couleur: auHasard(COULEURS_CUIR), elements: [] };
    donnees.listes.push(liste);
    sauverDonnees();
    rafraichir();
    ouvrirListe(liste);
  } }, "+ Nouvelle liste…"));
}

function ouvrirListe(liste) {
  const contenu = el("div");
  const fermer = ouvrirFenetre(contenu, { quandFerme: rafraichir });

  function dessiner() {
    contenu.innerHTML = "";
    const aFaire = liste.elements.filter(e => !e.fait);
    const faits = liste.elements.filter(e => e.fait);
    contenu.append(
      el("button", { class: "lien", onclick: () => fermer() }, "‹ listes"),
      el("p", { class: "titre-page", style: { marginTop: "10px" } }, avecInitiale(liste.nom, "initiale")),
      el("p", { class: "petit", style: { margin: "2px 0 10px" } }, aFaire.length + " à faire · " + faits.length + (faits.length > 1 ? " cochés" : " coché")));

    // Les éléments non cochés d'abord, les cochés descendent en bas
    [...aFaire, ...faits].forEach(element => contenu.append(el("div", { class: "tache" + (element.fait ? " faite" : "") },
      el("button", { class: "case" + (element.fait ? " cochee" : ""), onclick: () => { element.fait = !element.fait; sauverDonnees(); dessiner(); } }, element.fait ? "✓" : ""),
      el("span", { class: "texte" }, element.texte),
      el("button", { class: "mini", title: "Envoyer vers une date", onclick: () => envoyerVersDate(element) }, "→ date"),
      el("button", { class: "mini", "aria-label": "Retirer", onclick: () => { liste.elements = liste.elements.filter(e => e !== element); sauverDonnees(); dessiner(); } }, "✕"))));

    contenu.append(champAjoutRapide("Ajouter…", texte => {
      liste.elements.push({ id: nouvelId(), texte, fait: false });
      sauverDonnees();
      dessiner();
      contenu.querySelector(".ajout-rapide input").focus();
    }));

    contenu.append(el("div", { class: "rangee-boutons", style: { flexWrap: "wrap" } },
      el("button", { class: "mini", style: { padding: "5px 9px" }, onclick: () => { liste.elements = liste.elements.filter(e => !e.fait); sauverDonnees(); dessiner(); } }, "Retirer les cochées"),
      el("button", { class: "mini", style: { padding: "5px 9px" }, onclick: () => { liste.elements.forEach(e => { e.fait = false; }); sauverDonnees(); dessiner(); } }, "Tout décocher")));

    contenu.append(el("div", { class: "rangee-boutons", style: { marginTop: "26px" } },
      el("button", { class: "lien", onclick: async () => {
        const nom = await demanderTexte("Renommer la liste", liste.nom);
        if (nom) { liste.nom = nom; sauverDonnees(); dessiner(); }
      } }, "Renommer"),
      el("button", { class: "lien", onclick: async () => {
        const ok = await demanderChoix("Supprimer la liste « " + liste.nom + " » ?", [{ texte: "Annuler", valeur: null, discret: true }, { texte: "Supprimer", valeur: true, plein: true }]);
        if (!ok) return;
        donnees.listes = donnees.listes.filter(l => l !== liste);
        sauverDonnees();
        fermer();
      } }, "Supprimer la liste")));
  }

  // Envoyer un élément vers une date : il devient une tâche ce jour-là
  async function envoyerVersDate(element) {
    const date = await demanderDate("Pour quel jour ?", aujourdhui());
    if (!date) return;
    donnees.taches.push({ id: nouvelId(), titre: element.texte, date, importance: "flamme", faite: false, faiteLe: "", sousTaches: [], note: "Depuis la liste « " + liste.nom + " »", modeleId: null });
    sauverDonnees();
    afficherMessage("« " + element.texte + " » ajoutée aux tâches du " + dateCourte(date));
  }

  dessiner();
}
