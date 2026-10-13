// =====================================================================
// LES NOTES : un carnet de notes libres, avec étiquettes et épinglage
// Dans le texte d'une note, une ligne qui commence par "[ ] " devient une case à cocher,
// et "[x] " une case cochée.
// =====================================================================

const etatNotes = { recherche: "", etiquette: "" };

function afficherNotes(conteneur) {
  const page = el("div", { class: "page" });
  page.append(el("p", { class: "titre-page" }, el("span", { class: "lettrine", style: { fontSize: "1.6em" } }, "N"), "otes"));
  page.append(el("div", { class: "clair" }));

  // La recherche
  const recherche = el("input", { type: "search", value: etatNotes.recherche, placeholder: "⌕ Chercher dans mes notes…", style: { fontFamily: "var(--f-machine)", fontSize: "14px" } });
  recherche.addEventListener("input", () => { etatNotes.recherche = recherche.value; dessinerListe(); });
  page.append(el("div", { class: "champ" }, recherche));

  // Les étiquettes existantes, pour filtrer
  const toutes = [...new Set(donnees.notes.flatMap(n => n.etiquettes))].sort();
  if (toutes.length) {
    page.append(el("div", { class: "onglets" },
      el("button", { class: etatNotes.etiquette === "" ? "actif" : "", onclick: () => { etatNotes.etiquette = ""; rafraichir(); } }, "Toutes"),
      toutes.map(e => el("button", { class: etatNotes.etiquette === e ? "actif" : "", onclick: () => { etatNotes.etiquette = e; rafraichir(); } }, e))));
  }

  const zoneListe = el("div", { style: { marginTop: "10px" } });
  page.append(zoneListe);

  function dessinerListe() {
    zoneListe.innerHTML = "";
    const mot = etatNotes.recherche.trim().toLowerCase();
    const notes = donnees.notes
      .filter(n => !etatNotes.etiquette || n.etiquettes.includes(etatNotes.etiquette))
      .filter(n => !mot || (n.titre + " " + n.contenu).toLowerCase().includes(mot))
      .sort((a, b) => (b.epinglee - a.epinglee) || b.modifieeLe.localeCompare(a.modifieeLe));
    if (!notes.length) zoneListe.append(el("p", { class: "vide" }, donnees.notes.length ? "Aucune note ne correspond." : "Votre carnet est vide. Touchez + pour écrire."));
    notes.forEach(n => zoneListe.append(el("div", { class: "carte-note", onclick: () => ouvrirNote(n) },
      n.epinglee ? el("span", { class: "ruban-mini" }) : null,
      el("b", null, n.titre || "Sans titre"),
      el("p", { class: "extrait" }, extraitNote(n)),
      el("div", { class: "pied-note" },
        el("span", null, n.etiquettes.map(e => el("span", { class: "etiquette" }, e))),
        el("span", { class: "petit" }, quandModifiee(n.modifieeLe))))));
  }
  dessinerListe();

  conteneur.append(page);
  conteneur.append(el("button", { class: "bouton-plus", "aria-label": "Nouvelle note", onclick: () => {
    const note = { id: nouvelId(), titre: "", contenu: "", etiquettes: etatNotes.etiquette ? [etatNotes.etiquette] : [], epinglee: false, modifieeLe: new Date().toISOString() };
    donnees.notes.push(note);
    sauverDonnees();
    ouvrirNote(note, true);
  } }, "+"));
}

// Les premiers mots d'une note, sans les cases à cocher
function extraitNote(note) {
  return note.contenu.split("\n").map(l => l.replace(/^\[( |x)\] /, l.startsWith("[x]") ? "☑ " : "☐ ")).filter(l => l.trim()).join(" · ") || "…";
}

function quandModifiee(iso) {
  const date = versTexte(new Date(iso));
  if (date === aujourdhui()) return "aujourd'hui";
  if (date === ajouterJours(aujourdhui(), -1)) return "hier";
  return dateCourte(date);
}


// ===== Une note ouverte, sur papier ligné =====
function ouvrirNote(note, enEcriture) {
  let ecriture = !!enEcriture;
  const contenu = el("div");
  const fermer = ouvrirFenetre(contenu, {
    classe: "papier-ligne",
    quandFerme: () => {
      // Une note complètement vide est effacée en sortant
      if (!note.titre.trim() && !note.contenu.trim()) donnees.notes = donnees.notes.filter(n => n !== note);
      sauverDonnees();
      rafraichir();
    }
  });

  function modifiee() {
    note.modifieeLe = new Date().toISOString();
    sauverDonnees();
  }

  function dessiner() {
    contenu.innerHTML = "";
    const titre = el("input", { type: "text", value: note.titre, placeholder: "Titre", style: { fontSize: "22px", color: "var(--encre-titre)", borderBottom: "none", lineHeight: "26px" } });
    titre.addEventListener("input", () => { note.titre = titre.value; modifiee(); });

    contenu.append(
      el("button", { class: "lien", style: { lineHeight: "26px" }, onclick: () => fermer() }, "‹ notes"),
      titre,
      el("p", { class: "petit", style: { lineHeight: "26px" } },
        (note.etiquettes.length ? note.etiquettes.join(", ") + " · " : "") + "modifiée " + quandModifiee(note.modifieeLe)));

    if (ecriture) {
      const zone = el("textarea", { placeholder: "Écrivez ici… (une ligne qui commence par [ ] devient une case à cocher)" }, note.contenu);
      zone.addEventListener("input", () => { note.contenu = zone.value; modifiee(); });
      contenu.append(zone);
      setTimeout(() => zone.focus(), 50);
    } else {
      const texte = el("div", { class: "texte-note", onclick: e => { if (e.target === texte) { ecriture = true; dessiner(); } } });
      const lignes = note.contenu.split("\n");
      lignes.forEach((ligne, i) => {
        const caseCochable = ligne.match(/^\[( |x)\] (.*)$/);
        if (caseCochable) {
          const faite = caseCochable[1] === "x";
          texte.append(el("div", { class: "ligne-case" + (faite ? " faite" : "") },
            el("button", { class: "case" + (faite ? " cochee" : ""), onclick: () => {
              lignes[i] = (faite ? "[ ] " : "[x] ") + caseCochable[2];
              note.contenu = lignes.join("\n");
              modifiee();
              dessiner();
            } }, faite ? "✓" : ""),
            el("span", null, caseCochable[2])));
        } else {
          texte.append(el("div", { onclick: () => { ecriture = true; dessiner(); } }, ligne || " "));
        }
      });
      if (!note.contenu) texte.append(el("p", { class: "vide", onclick: () => { ecriture = true; dessiner(); } }, "Touchez ici pour écrire…"));
      contenu.append(texte);
    }

    contenu.append(el("div", { class: "outils-note" },
      el("button", { class: "lien", onclick: () => { ecriture = !ecriture; dessiner(); } }, ecriture ? "✓ relire" : "✎ écrire"),
      el("button", { class: "lien", onclick: () => {
        note.contenu = note.contenu.replace(/\n*$/, "") + (note.contenu.trim() ? "\n" : "") + "[ ] ";
        modifiee();
        ecriture = true;
        dessiner();
      } }, "☐ liste"),
      el("button", { class: "lien", onclick: async () => {
        const texte = await demanderTexte("Étiquettes (séparées par des virgules)", note.etiquettes.join(", "), "Cours, Idées");
        if (texte === null) return;
        note.etiquettes = [...new Set(texte.split(",").map(e => e.trim()).filter(Boolean))];
        modifiee();
        dessiner();
      } }, "⚑ étiquettes"),
      el("button", { class: "lien", onclick: () => { note.epinglee = !note.epinglee; modifiee(); dessiner(); afficherMessage(note.epinglee ? "Note épinglée" : "Note désépinglée"); } }, note.epinglee ? "✦ désépingler" : "✦ épingler"),
      el("button", { class: "lien", onclick: envoyerEnTaches }, "→ en tâches"),
      el("button", { class: "lien", onclick: async () => {
        const ok = await demanderChoix("Supprimer cette note ?", [{ texte: "Annuler", valeur: null, discret: true }, { texte: "Supprimer", valeur: true, plein: true }]);
        if (!ok) return;
        donnees.notes = donnees.notes.filter(n => n !== note);
        sauverDonnees();
        fermer();
      } }, "supprimer")));
  }

  // Envoyer une case de la note vers le volet Tâches
  async function envoyerEnTaches() {
    const cases = note.contenu.split("\n").map(l => l.match(/^\[ \] (.+)$/)).filter(Boolean).map(m => m[1]);
    if (!cases.length) {
      afficherMessage("Ajoutez d'abord une case à cocher (☐ liste) dans la note");
      return;
    }
    const choisie = await demanderChoix("Quelle case envoyer en tâche ?", cases.map(c => ({ texte: c, valeur: c })));
    if (!choisie) return;
    const date = await demanderDate("Pour quel jour ?", aujourdhui());
    if (!date) return;
    donnees.taches.push({ id: nouvelId(), titre: choisie, date, importance: "flamme", faite: false, faiteLe: "", sousTaches: [], note: "Depuis la note « " + (note.titre || "Sans titre") + " »", modeleId: null });
    sauverDonnees();
    afficherMessage("« " + choisie + " » ajoutée aux tâches du " + dateCourte(date));
  }

  dessiner();
}
