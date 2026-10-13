// =====================================================================
// AUJOURD'HUI : le résumé du jour, et les réglages
// =====================================================================

// Les citations par défaut, en attendant celles de vos propres lectures
const CITATIONS_DE_DEPART = [
  { texte: "Le temps s'en va, le temps s'en va, ma dame.", auteur: "Ronsard" },
  { texte: "Heureux qui, comme Ulysse, a fait un beau voyage.", auteur: "Du Bellay" },
  { texte: "Chaque homme porte la forme entière de l'humaine condition.", auteur: "Montaigne" },
  { texte: "Science sans conscience n'est que ruine de l'âme.", auteur: "Rabelais" },
  { texte: "Il faut cultiver notre jardin.", auteur: "Voltaire" },
  { texte: "Lire, c'est boire et manger. L'esprit qui ne lit pas maigrit comme le corps qui ne mange pas.", auteur: "Victor Hugo" },
  { texte: "Audaces fortuna iuvat.", auteur: "Virgile" },
  { texte: "Hâte-toi lentement.", auteur: "Festina lente" }
];

// La citation du jour : la même toute la journée, et puisée aussi dans vos citations surlignées
function citationDuJour() {
  const toutes = [...CITATIONS_DE_DEPART];
  donnees.livres.forEach(livre => livre.citations.forEach(c => toutes.push({ texte: c.texte, auteur: livre.auteur || livre.titre })));
  const numeroDuJour = Math.floor(versDate(aujourdhui()) / 86400000);
  return toutes[numeroDuJour % toutes.length];
}

// Où en est le défilement de la liste des tâches (pour le retrouver quand on coche une tâche)
let defilementTaches = 0;

function afficherAujourdhui(conteneur) {
  genererTachesRecurrentes();
  const ajd = aujourdhui();
  const page = el("div", { class: "page" });

  // Les réglages et la chandelle, en haut :
  // la nuit, on allume la chandelle pour passer au jour ; le jour, on l'éteint pour passer à la nuit
  page.append(el("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "6px", paddingRight: "40px" } },
    el("button", { class: "lien", onclick: ouvrirReglages }, "⚙ réglages"),
    el("button", { class: "lien", onclick: basculerModeNuitALaMain }, document.body.classList.contains("theme-nuit") ? "🕯 allumer la chandelle" : "☾ éteindre la chandelle")));

  // Le ruban, et la date en lettrine
  page.append(el("button", { class: "ruban", title: "Calendrier d'aujourd'hui", onclick: () => { etatCalendrier.date = ajd; etatCalendrier.jourSelectionne = ajd; changerVolet("calendrier"); } }));
  const jour = capitaliser(NOMS_JOURS[jourSemaine(ajd)]);
  const d = versDate(ajd);
  page.append(el("p", { style: { lineHeight: "1.25" } },
    el("span", { class: "lettrine" }, jour.charAt(0)),
    el("span", { style: { fontStyle: "italic", color: "var(--rubrique)" } }, jour.slice(1)), el("br"),
    el("span", { style: { fontSize: "23px", color: "var(--encre-titre)" } }, premierOuNombre(d.getDate()) + " " + NOMS_MOIS[d.getMonth()])));
  page.append(el("div", { class: "clair filet" }));

  // Le prochain rendez-vous, avec son compte à rebours
  const prochain = prochainRendezVous();
  if (prochain) {
    page.append(el("div", { class: "prochain", onclick: () => ouvrirFicheRendezVous(prochain) },
      el("p", { class: "petit", style: { letterSpacing: "1px" } }, "PROCHAIN RENDEZ-VOUS · " + compteARebours(prochain).toUpperCase()),
      el("p", { style: { fontSize: "18px" } }, prochain.titre),
      el("p", { class: "petit" }, heureLisible(prochain.debut) + " – " + heureLisible(prochain.fin) + (prochain.lieu ? " · " + prochain.lieu : ""))));
  }

  // Le programme de la journée : ce qui est passé se barre tout seul
  const programme = rendezVousDuJour(ajd);
  page.append(el("p", { class: "rubrique" }, "Au programme"));
  if (!programme.length) page.append(el("p", { class: "vide" }, "Aucun rendez-vous aujourd'hui."));
  programme.forEach(r => page.append(ligneRendezVous(r, true)));

  // Les tâches : celles d'aujourd'hui, les sous-tâches prévues ce jour, et les oubliées
  const duJour = tachesDeLaDate(ajd);
  const sousDatees = sousTachesDeLaDate(ajd);
  const enRetard = tachesEnRetard();
  page.append(el("p", { class: "rubrique" }, "À faire", el("span", { class: "petit" }, compteurTaches(duJour))));
  if (!duJour.length && !sousDatees.length && !enRetard.length) page.append(el("p", { class: "vide" }, "Aucune tâche pour aujourd'hui."));
  // Toutes les tâches sont rangées dans un cadre : s'il y en a beaucoup, c'est lui qui défile
  const cadre = el("div", { class: "zone-defilante" });
  duJour.forEach(t => cadre.append(ligneTache(t)));
  sousDatees.forEach(({ tache, sous }) => cadre.append(ligneSousTacheDatee(tache, sous)));
  if (enRetard.length) {
    cadre.append(el("p", { class: "rubrique", style: { fontSize: "14px" } }, "En retard"));
    enRetard.forEach(t => cadre.append(ligneTache(t, { montrerDate: true })));
  }
  page.append(cadre);
  // Une fois affiché : on retrouve l'endroit où on en était, et on signale s'il reste des tâches plus bas
  requestAnimationFrame(() => {
    cadre.scrollTop = defilementTaches;
    cadre.classList.toggle("pleine", cadre.scrollHeight > cadre.clientHeight + 2);
  });
  cadre.addEventListener("scroll", () => { defilementTaches = cadre.scrollTop; });

  // La citation du jour
  const citation = citationDuJour();
  page.append(el("div", { class: "citation-du-jour" },
    el("p", null, "« " + citation.texte.replace(/^«\s*|\s*»$/g, "") + " »"),
    el("p", { class: "petit" }, citation.auteur)));

  // La fleur séchée, glissée dans la page
  page.append(fleurSechee());

  conteneur.append(page);
}

function fleurSechee() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 60 90");
  svg.setAttribute("class", "fleur-sechee");
  svg.innerHTML = '<path d="M30 88 C 29 70, 31 55, 30 34" stroke="#5C4E3A" stroke-width="1.6" fill="none"/>'
    + '<path d="M30 60 C 22 56, 18 50, 16 44 C 24 46, 28 52, 30 60 Z" fill="#4E6B55" opacity=".8"/>'
    + '<path d="M30 70 C 38 66, 42 60, 44 54 C 36 56, 32 62, 30 70 Z" fill="#4E6B55" opacity=".7"/>'
    + '<g transform="translate(30 22)">'
    + [0, 72, 144, 216, 288].map(a => '<ellipse cx="0" cy="-10" rx="6" ry="11" fill="#7a2e26" opacity=".75" transform="rotate(' + a + ')"/>').join("")
    + '<circle r="5" fill="#B58550"/><circle r="2.5" fill="#9B7145"/></g>';
  return svg;
}


// ===== Les réglages =====
function ouvrirReglages() {
  const r = donnees.reglages;
  const contenu = el("div");
  const fermer = ouvrirFenetre(contenu, { quandFerme: rafraichir });

  function dessiner() {
    contenu.innerHTML = "";
    contenu.append(
      el("p", { class: "titre-page" }, avecInitiale("Réglages", "initiale")),

      el("p", { class: "rubrique" }, "Le mode cuir (nuit)"),
      el("div", { class: "onglets" }, [["auto", "Selon l'heure"], ["jour", "Toujours le jour"], ["nuit", "Toujours la nuit"]].map(([cle, nom]) =>
        el("button", { class: r.modeNuit === cle ? "actif" : "", onclick: () => { r.modeNuit = cle; sauverDonnees(); appliquerTheme(); dessiner(); } }, nom))),
      el("div", { class: "deux-colonnes" },
        el("div", { class: "champ" }, el("label", null, "La nuit commence à"),
          el("input", { type: "time", value: r.nuitDebut, onchange: e => { r.nuitDebut = e.target.value; sauverDonnees(); appliquerTheme(); } })),
        el("div", { class: "champ" }, el("label", null, "Et finit à"),
          el("input", { type: "time", value: r.nuitFin, onchange: e => { r.nuitFin = e.target.value; sauverDonnees(); appliquerTheme(); } }))),

      el("p", { class: "rubrique" }, "Les rappels"),
      el("p", { class: "petit", style: { lineHeight: "1.5" } }, "Nox Libri vous prévient avant vos rendez-vous, le matin avec le résumé du jour, et le soir s'il reste une tâche Braise. Pour l'instant, les rappels fonctionnent quand l'application a été ouverte récemment."),
      el("div", { class: "onglets" },
        el("button", { class: r.rappelsActifs ? "actif" : "", onclick: async () => { await activerRappels(); dessiner(); } }, r.rappelsActifs ? "Rappels activés" : "Activer les rappels"),
        r.rappelsActifs ? el("button", { onclick: () => { r.rappelsActifs = false; sauverDonnees(); dessiner(); } }, "Désactiver") : null),
      el("div", { class: "champ" }, el("label", null, "Prévenir avant un rendez-vous"),
        el("div", { class: "onglets" }, [5, 10, 15, 30, 60].map(m => el("button", { class: r.rappelMinutes === m ? "actif" : "", onclick: () => { r.rappelMinutes = m; sauverDonnees(); dessiner(); } }, m + " min")))),

      el("p", { class: "rubrique" }, "La sauvegarde"),
      el("p", { class: "petit", style: { lineHeight: "1.5" } }, "Vos rendez-vous, tâches et notes sont enregistrés sur ce téléphone. Gardez une copie de temps en temps (les fichiers des livres n'y sont pas inclus)."),
      el("div", { class: "rangee-boutons", style: { justifyContent: "flex-start" } },
        el("button", { class: "bouton", onclick: exporterSauvegarde }, "Exporter"),
        el("label", { class: "bouton", style: { display: "inline-block" } }, "Importer",
          el("input", { type: "file", accept: ".json,application/json", style: { display: "none" }, onchange: async e => {
            const fichier = e.target.files[0];
            if (!fichier) return;
            try {
              await importerSauvegarde(fichier);
              afficherMessage("Sauvegarde importée");
              fermer();
            } catch (erreur) {
              afficherMessage(erreur.message);
            }
          } }))),

      el("p", { class: "rubrique" }, "Vos données"),
      el("p", { class: "petit", style: { lineHeight: "1.5" } }, "Tout ce que vous écrivez reste sur ce téléphone : rien n'est envoyé ailleurs. Vous pouvez tout effacer d'un coup (rendez-vous, tâches, notes, livres, réglages)."),
      el("div", { class: "rangee-boutons", style: { justifyContent: "flex-start", marginTop: "8px" } },
        el("button", { class: "bouton", onclick: async () => {
          const ok = await demanderChoix("Effacer toutes vos données ?", [{ texte: "Annuler", valeur: null, discret: true }, { texte: "Tout effacer", valeur: true, plein: true }],
            "Vos rendez-vous, tâches, listes, notes, livres, citations et réglages seront effacés de ce téléphone, définitivement. Pensez à exporter une sauvegarde avant si vous voulez en garder une copie.");
          if (!ok) return;
          await effacerToutesLesDonnees();
          location.reload();                 // l'application repart de zéro
        } }, "Effacer toutes mes données")),

      el("p", { class: "rubrique" }, "À propos"),
      el("p", { style: { lineHeight: "1.9" } },
        el("a", { href: "confidentialite.html", style: { color: "var(--rubrique)" } }, "Politique de confidentialité"), el("br"),
        el("a", { href: "licences.html", style: { color: "var(--rubrique)" } }, "Mentions et licences")),

      el("div", { class: "citation-du-jour", style: { marginTop: "30px" } },
        el("p", null, "Nox Libri — carnet d'heures et de lectures"),
        el("p", { class: "petit" }, "Audaces fortuna iuvat")));
  }
  dessiner();
}
