// =====================================================================
// MA BIBLIOTHÈQUE : les étagères, les reliures, la pièce
// =====================================================================

const NB_ETAGERES = 5;
const CAPACITE_ETAGERE = 290;   // la largeur utile d'une étagère, en pixels

const etatBiblio = {
  vue: null,            // "piece" ou "etagere" (null = choisir automatiquement)
  bibliotheque: 0,      // la bibliothèque ouverte
  livreSouleve: null,   // le livre qu'on est en train de déplacer
  entree: false         // pour l'animation quand on s'approche d'une bibliothèque
};

const CHIFFRES_ROMAINS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
function romain(n) { return CHIFFRES_ROMAINS[n] || String(n + 1); }


// ===== Ranger les livres =====
function livresDeLEtagere(b, e) {
  return donnees.livres.filter(l => l.bibliotheque === b && l.etagere === e).sort((x, y) => x.ordre - y.ordre);
}

function placeOccupee(b, e, sauf) {
  return livresDeLEtagere(b, e).filter(l => l !== sauf).reduce((total, l) => total + l.largeur + 2, 0);
}

// Un nouveau livre va à la première place libre ; si tout est plein, une nouvelle bibliothèque apparaît
function placerNouveauLivre(livre) {
  for (let b = 0; b < donnees.bibliotheques.length; b++) {
    for (let e = 0; e < NB_ETAGERES; e++) {
      if (placeOccupee(b, e) + livre.largeur + 2 <= CAPACITE_ETAGERE) {
        Object.assign(livre, { bibliotheque: b, etagere: e, ordre: livresDeLEtagere(b, e).length });
        return;
      }
    }
  }
  donnees.bibliotheques.push({ nomsEtageres: Array(NB_ETAGERES).fill("") });
  Object.assign(livre, { bibliotheque: donnees.bibliotheques.length - 1, etagere: 0, ordre: 0 });
}

// Déplacer un livre : avant un autre livre, ou à la fin d'une étagère
function deplacerLivre(livre, b, e, avantLivre) {
  if (placeOccupee(b, e, livre) + livre.largeur + 2 > CAPACITE_ETAGERE) {
    afficherMessage("Cette étagère est pleine");
    return false;
  }
  const rangee = livresDeLEtagere(b, e).filter(l => l !== livre);
  const position = avantLivre ? rangee.indexOf(avantLivre) : rangee.length;
  rangee.splice(position < 0 ? rangee.length : position, 0, livre);
  livre.bibliotheque = b;
  livre.etagere = e;
  rangee.forEach((l, i) => { l.ordre = i; });
  sauverDonnees();
  return true;
}


// ===== Le volet Bibliothèque =====
function afficherBibliotheque(conteneur) {
  // Avec plusieurs bibliothèques, on arrive dans la pièce ; avec une seule, devant les étagères
  if (!etatBiblio.vue) etatBiblio.vue = donnees.bibliotheques.length > 1 ? "piece" : "etagere";
  if (etatBiblio.bibliotheque >= donnees.bibliotheques.length) etatBiblio.bibliotheque = 0;
  if (etatBiblio.vue === "piece") dessinerPiece(conteneur);
  else dessinerEtageres(conteneur);
}

// Le bouton pour ajouter des livres (PDF ou EPUB)
function boutonAjouterLivre(classe) {
  return el("label", { class: classe || "ajouter-livre" }, "+ ajouter un livre",
    el("input", { type: "file", accept: ".pdf,.epub,application/pdf,application/epub+zip", multiple: true, style: { display: "none" },
      onchange: e => importerLivres([...e.target.files]) }));
}

// ===== Les étagères (vue rapprochée) =====
function dessinerEtageres(conteneur) {
  const b = etatBiblio.bibliotheque;
  const salle = el("div", { class: "salle" + (etatBiblio.entree ? " entree" : "") });
  etatBiblio.entree = false;

  salle.append(el("div", { class: "salle-entete" },
    el("button", { class: "lien", onclick: () => { etatBiblio.vue = "piece"; etatBiblio.livreSouleve = null; rafraichir(); } }, "‹ la pièce"),
    el("span", { class: "titre-salle" }, "Bibliothèque " + romain(b)),
    el("span", { style: { width: "50px" } })));

  // Le bandeau qui apparaît pendant un déplacement
  if (etatBiblio.livreSouleve) {
    salle.append(el("div", { class: "bandeau-deplacement" },
      el("span", null, "Touchez la place où ranger « " + etatBiblio.livreSouleve.titre + " »"),
      el("button", { class: "lien", onclick: () => { etatBiblio.livreSouleve = null; rafraichir(); } }, "Annuler")));
  }

  for (let e = 0; e < NB_ETAGERES; e++) {
    const etagere = el("div", { class: "etagere" });
    etagere.addEventListener("click", evenement => {
      // Toucher une place vide de l'étagère pendant un déplacement : le livre va au bout
      if (evenement.target === etagere && etatBiblio.livreSouleve) {
        if (deplacerLivre(etatBiblio.livreSouleve, b, e, null)) { etatBiblio.livreSouleve = null; rafraichir(); }
      }
    });
    livresDeLEtagere(b, e).forEach(livre => etagere.append(reliure(livre, b, e)));

    // Le nom facultatif de l'étagère, gravé sur sa tranche
    const nom = donnees.bibliotheques[b].nomsEtageres[e];
    etagere.append(el("button", {
      class: "plaque" + (nom ? "" : " vide-plaque"),
      title: "Nommer cette étagère",
      onclick: async ev => {
        ev.stopPropagation();
        const nouveau = await demanderTexte("Nom de l'étagère (facultatif)", nom, "Poésie");
        if (nouveau === null) return;
        donnees.bibliotheques[b].nomsEtageres[e] = nouveau;
        sauverDonnees();
        rafraichir();
      }
    }, nom || "✎"));
    salle.append(etagere);
  }

  if (!donnees.livres.length) {
    salle.append(el("p", { style: { position: "relative", zIndex: "3", color: "var(--parchemin)", fontStyle: "italic", textAlign: "center", marginTop: "18px", lineHeight: "1.5" } },
      "Vos étagères attendent leurs premiers livres.", el("br"),
      el("span", { class: "petit", style: { color: "var(--or)" } }, "Ajoutez des fichiers PDF ou EPUB (sans verrou DRM) téléchargés sur votre téléphone.")));
  }

  salle.append(el("div", { class: "chandelle-salle" }, el("span", { class: "cire" }), el("span", { class: "flamme" })));
  salle.append(boutonAjouterLivre());
  conteneur.append(salle);
}

// Une reliure : toucher l'ouvre, appuyer longuement la soulève pour la déplacer
function reliure(livre, b, e) {
  const element = el("div", {
    class: "reliure" + (etatBiblio.livreSouleve === livre ? " souleve" : ""),
    style: { width: livre.largeur + "px", height: livre.hauteur + "px", background: livre.couleur },
    title: livre.titre
  }, el("span", null, livre.titre));

  let minuteur = null, appuiLong = false, departX = 0, departY = 0;
  element.addEventListener("pointerdown", ev => {
    appuiLong = false;
    departX = ev.clientX; departY = ev.clientY;
    minuteur = setTimeout(() => {
      appuiLong = true;
      etatBiblio.livreSouleve = livre;
      if (navigator.vibrate) navigator.vibrate(30);
      rafraichir();
    }, 550);
  });
  const annuler = () => clearTimeout(minuteur);
  element.addEventListener("pointerup", annuler);
  element.addEventListener("pointerleave", annuler);
  element.addEventListener("pointermove", ev => { if (Math.abs(ev.clientX - departX) + Math.abs(ev.clientY - departY) > 12) annuler(); });
  element.addEventListener("contextmenu", ev => ev.preventDefault());
  element.addEventListener("click", ev => {
    ev.stopPropagation();
    if (appuiLong) return;
    const souleve = etatBiblio.livreSouleve;
    if (souleve && souleve !== livre) {
      if (deplacerLivre(souleve, b, e, livre)) { etatBiblio.livreSouleve = null; rafraichir(); }
    } else if (souleve === livre) {
      etatBiblio.livreSouleve = null;
      rafraichir();
    } else {
      ouvrirLivre(livre);
    }
  });
  return element;
}


// ===== La pièce, vue de loin =====
function dessinerPiece(conteneur) {
  const zone = el("div");
  zone.append(el("div", { class: "salle-entete", style: { margin: "4px 4px 10px" } },
    el("span", { class: "titre-salle", style: { color: "var(--or-vif)", fontStyle: "italic", fontSize: "20px" } }, "Ma bibliothèque"),
    boutonAjouterLivre("lien")));

  const piece = el("div", { class: "piece" });
  const bibliotheques = donnees.bibliotheques.map((_, i) => meubleBibliotheque(i));
  // La première bibliothèque, la fenêtre au centre, puis les autres le long du mur
  piece.append(bibliotheques[0], dessinFenetre(), ...bibliotheques.slice(1));
  zone.append(piece);
  zone.append(el("p", { class: "petit", style: { color: "var(--or)", textAlign: "center", marginTop: "8px" } },
    donnees.bibliotheques.length > 1 ? "Glissez le doigt pour parcourir la pièce · touchez une bibliothèque pour vous en approcher" : "Touchez la bibliothèque pour vous en approcher"));
  conteneur.append(zone);

  // On centre la vue sur la fenêtre
  requestAnimationFrame(() => {
    // (un dessin SVG n'a pas d'offsetLeft : on mesure sa position à l'écran)
    const fenetre = piece.children[1].getBoundingClientRect();
    const cadre = piece.getBoundingClientRect();
    piece.scrollLeft += (fenetre.left + fenetre.width / 2) - (cadre.left + cadre.width / 2);
  });
}

// Une bibliothèque dessinée, avec ses vrais livres en miniature
function meubleBibliotheque(b) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 150 520");
  svg.setAttribute("class", "meuble");
  const L = 150, x = 18, w = 114, haut = 92, bas = 470;
  let dessin = '<rect width="150" height="520" fill="#1f160c"/>'
    + '<rect y="486" width="150" height="34" fill="#2a1a0c"/>'
    + `<rect x="${x - 7}" y="${haut - 26}" width="${w + 14}" height="8" fill="#2a1a0c"/>`
    + `<rect x="${x - 4}" y="${haut - 18}" width="${w + 8}" height="12" fill="#3b2512"/>`
    + `<path d="M${x + w / 2 - 22} ${haut - 26} q22 -20 44 0" fill="#3b2512" stroke="#9B7145" stroke-width=".8"/>`
    + `<circle cx="${x + w / 2}" cy="${haut - 31}" r="3" fill="#9B7145"/>`
    + `<rect x="${x}" y="${haut - 6}" width="${w}" height="${bas - haut + 6}" fill="#1a1008" stroke="#3b2512" stroke-width="5"/>`
    + `<rect x="${x - 7}" y="${haut - 6}" width="7" height="${bas - haut + 12}" fill="#3b2512"/><rect x="${x + w}" y="${haut - 6}" width="7" height="${bas - haut + 12}" fill="#3b2512"/>`
    + `<rect x="${x - 6}" y="${haut + 6}" width="5" height="${bas - haut - 18}" fill="none" stroke="#9B7145" stroke-width=".5"/><rect x="${x + w + 1}" y="${haut + 6}" width="5" height="${bas - haut - 18}" fill="none" stroke="#9B7145" stroke-width=".5"/>`
    + `<rect x="${x - 9}" y="${bas}" width="${w + 18}" height="12" fill="#3b2512"/>`
    + `<rect x="${x - 5}" y="${bas + 12}" width="9" height="6" fill="#2a1a0c"/><rect x="${x + w - 4}" y="${bas + 12}" width="9" height="6" fill="#2a1a0c"/>`;
  const h = (bas - haut) / NB_ETAGERES;
  const echelle = (w - 6) / CAPACITE_ETAGERE;
  for (let e = 0; e < NB_ETAGERES; e++) {
    const y1 = haut + (e + 1) * h - 5;
    let cx = x + 3;
    for (const livre of livresDeLEtagere(b, e)) {
      const lw = Math.max(3, livre.largeur * echelle);
      const lh = (h - 10) * livre.hauteur / 104;
      dessin += `<rect x="${cx}" y="${y1 - lh}" width="${lw}" height="${lh}" fill="${livre.couleur}"/>`
        + `<rect x="${cx + .5}" y="${y1 - lh + 3}" width="${lw - 1}" height=".8" fill="#B58550" opacity=".75"/>`
        + `<rect x="${cx + .5}" y="${y1 - 5}" width="${lw - 1}" height=".8" fill="#B58550" opacity=".75"/>`;
      cx += lw + .6;
    }
    dessin += `<rect x="${x}" y="${y1}" width="${w}" height="5" fill="#3b2512"/><rect x="${x}" y="${y1 + 5}" width="${w}" height="2" fill="#000" opacity=".35"/>`;
  }
  const nb = donnees.livres.filter(l => l.bibliotheque === b).length;
  dessin += `<text x="${L / 2}" y="505" text-anchor="middle" font-family="News Cycle, sans-serif" font-size="12" fill="#B58550">${romain(b)} · ${nb} livre${nb > 1 ? "s" : ""}</text>`;
  svg.innerHTML = dessin;
  svg.addEventListener("click", () => {
    etatBiblio.bibliotheque = b;
    etatBiblio.vue = "etagere";
    etatBiblio.entree = true;
    rafraichir();
  });
  return svg;
}

// La fenêtre en arc, avec ses rideaux, la lune et une chandelle sur le rebord
function dessinFenetre() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 190 520");
  svg.innerHTML = '<defs><linearGradient id="ciel-piece" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141c2b"/><stop offset=".7" stop-color="#2b3a4f"/><stop offset="1" stop-color="#3d4a52"/></linearGradient>'
    + '<radialGradient id="halo-lune" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#d7e0e6" stop-opacity=".5"/><stop offset="1" stop-color="#d7e0e6" stop-opacity="0"/></radialGradient>'
    + '<radialGradient id="lueur-piece" cx=".5" cy=".85" r=".7"><stop offset="0" stop-color="#ffbe6e" stop-opacity=".25"/><stop offset="1" stop-color="#ffbe6e" stop-opacity="0"/></radialGradient></defs>'
    + '<rect width="190" height="520" fill="#1f160c"/>'
    + '<g stroke="#25190d" stroke-width="2">' + Array.from({ length: 16 }, (_, i) => `<path d="M${6 + i * 12} 0V486"/>`).join("") + '</g>'
    + '<rect y="486" width="190" height="34" fill="#2a1a0c"/><rect y="478" width="190" height="8" fill="#3b2512"/>'
    + '<ellipse cx="95" cy="503" rx="70" ry="11" fill="#3a1f18" stroke="#663A1D" stroke-width="1.5"/>'
    + '<path d="M40 380 V180 a55 55 0 0 1 110 0 V380 Z" fill="#2a1a0c" stroke="#3b2512" stroke-width="7"/>'
    + '<path d="M49 373 V182 a46 46 0 0 1 92 0 V373 Z" fill="url(#ciel-piece)"/>'
    + '<circle cx="118" cy="190" r="26" fill="url(#halo-lune)"/><circle cx="118" cy="190" r="8" fill="#e6ece8"/><circle cx="121" cy="188" r="7" fill="#2b3a4f" opacity=".35"/>'
    + '<g fill="#EDE3D2"><circle cx="66" cy="200" r="1"/><circle cx="80" cy="236" r=".8"/><circle cx="130" cy="252" r=".9"/><circle cx="62" cy="276" r=".8"/><circle cx="95" cy="172" r=".9"/><circle cx="136" cy="300" r=".7"/></g>'
    + '<path d="M49 340 Q70 322 95 334 T141 328 V373 H49 Z" fill="#1a2230" opacity=".85"/>'
    + '<g stroke="#3b2512" stroke-width="3.5" fill="none"><path d="M95 136 V373"/><path d="M49 240 H141"/><path d="M49 308 H141"/></g>'
    + '<g stroke="#3b2512" stroke-width="1.3" fill="none" opacity=".9"><path d="M49 274 H141 M49 341 H141 M72 182 V373 M118 182 V373"/></g>'
    + '<path d="M40 180 a55 55 0 0 1 110 0" fill="none" stroke="#9B7145" stroke-width="1.3"/>'
    + '<circle cx="95" cy="125" r="6" fill="#9B7145"/><path d="M87 125 h16" stroke="#9B7145"/>'
    + '<rect x="30" y="380" width="130" height="10" fill="#3b2512"/><rect x="26" y="389" width="138" height="5" fill="#2a1a0c"/>'
    + '<path d="M33 138 Q26 250 36 380 L18 380 Q16 250 25 138 Z" fill="#53341B"/><path d="M29 146 Q23 255 31 376" stroke="#3b2512" fill="none"/>'
    + '<path d="M157 138 Q164 250 154 380 L172 380 Q174 250 165 138 Z" fill="#53341B"/><path d="M161 146 Q167 255 159 376" stroke="#3b2512" fill="none"/>'
    + '<rect x="16" y="130" width="158" height="9" rx="2" fill="#3b2512"/><circle cx="16" cy="134.5" r="5" fill="#9B7145"/><circle cx="174" cy="134.5" r="5" fill="#9B7145"/>'
    + '<path d="M20 282 q10 5 16 -2" stroke="#B58550" stroke-width="2.4" fill="none"/><path d="M170 282 q-10 5 -16 -2" stroke="#B58550" stroke-width="2.4" fill="none"/>'
    + '<rect x="76" y="364" width="8" height="16" fill="#EDE3D2"/><ellipse cx="80" cy="358" rx="3.5" ry="6" fill="#B58550"/><circle cx="80" cy="358" r="14" fill="#ffbe6e" opacity=".18"/>'
    + '<rect width="190" height="520" fill="url(#lueur-piece)"/>';
  return svg;
}


// ===== Ajouter des livres =====
async function importerLivres(fichiers) {
  for (const fichier of fichiers) {
    const nom = fichier.name.toLowerCase();
    const type = nom.endsWith(".pdf") ? "pdf" : nom.endsWith(".epub") ? "epub" : null;
    if (!type) { afficherMessage("« " + fichier.name + " » n'est ni un PDF ni un EPUB"); continue; }
    afficherMessage("Reliure de « " + fichier.name + " »…");
    try {
      const infos = await lireInfosLivre(fichier, type);
      const livre = {
        id: nouvelId(),
        titre: infos.titre || fichier.name.replace(/\.(pdf|epub)$/i, ""),
        auteur: infos.auteur || "",
        type,
        couleur: auHasard(COULEURS_CUIR),
        largeur: Math.round(Math.min(30, Math.max(13, 12 + (infos.pages || 150) / 22))),
        hauteur: Math.round(84 + Math.random() * 20),
        progression: { page: 1, total: infos.pages || 0, pourcent: 0, position: null },
        citations: [],
        notes: "",
        ajouteLe: aujourdhui()
      };
      await enregistrerFichierLivre(livre.id, fichier);
      placerNouveauLivre(livre);
      donnees.livres.push(livre);
      sauverDonnees();
      etatBiblio.bibliotheque = livre.bibliotheque;
      etatBiblio.vue = "etagere";
      afficherMessage("« " + livre.titre + " » a rejoint la bibliothèque " + romain(livre.bibliotheque));
    } catch (erreur) {
      console.error(erreur);
      afficherMessage("Impossible d'ouvrir « " + fichier.name + " » (fichier abîmé ou protégé par un verrou DRM)");
    }
  }
  rafraichir();
}


// ===== Un livre ouvert : progression, citations, notes de lecture =====
function ouvrirLivre(livre) {
  let onglet = "citations";
  const contenu = el("div");
  const fermer = ouvrirFenetre(contenu, { quandFerme: rafraichir });

  function dessiner() {
    contenu.innerHTML = "";
    const p = livre.progression;
    const dejaCommence = p.pourcent > 0 || p.page > 1;
    contenu.append(
      el("button", { class: "lien", onclick: () => fermer() }, "‹ ma bibliothèque"),
      el("div", { class: "livre-entete" },
        el("div", { class: "reliure", style: { width: "28px", height: "100px", background: livre.couleur, flex: "none" } }, el("span", null, livre.titre)),
        el("div", null,
          el("p", { class: "titre-page" }, livre.titre),
          el("p", { style: { fontStyle: "italic", color: "var(--texte-discret)" } }, livre.auteur || "auteur inconnu"),
          el("p", { class: "petit", style: { marginTop: "4px" } }, livre.type.toUpperCase()),
          el("button", { class: "lien", style: { marginTop: "6px" }, onclick: modifierInfos }, "✎ titre et auteur"))),
      el("p", { class: "petit" }, p.total ? "page " + p.page + " sur " + p.total + " · " + Math.round(p.pourcent) + " %" : Math.round(p.pourcent) + " %"),
      el("div", { class: "barre-progres" }, el("span", { style: { width: Math.min(100, p.pourcent) + "%" } })),
      el("button", { class: "bouton plein", style: { width: "100%" }, onclick: () => { fermer(); ouvrirLecteur(livre); } }, dejaCommence ? "Reprendre la lecture" : "Commencer la lecture"),
      el("div", { class: "onglets", style: { marginTop: "16px", borderBottom: "1px solid var(--or)", paddingBottom: "8px" } },
        el("button", { class: onglet === "citations" ? "actif" : "", onclick: () => { onglet = "citations"; dessiner(); } }, "Citations · " + livre.citations.length),
        el("button", { class: onglet === "notes" ? "actif" : "", onclick: () => { onglet = "notes"; dessiner(); } }, "Notes de lecture")));

    if (onglet === "citations") {
      if (!livre.citations.length) contenu.append(el("p", { class: "vide" }, "Pendant la lecture, sélectionnez un passage puis touchez « Surligner » : il apparaîtra ici."));
      [...livre.citations].sort((a, b) => (a.page || 0) - (b.page || 0)).forEach(c => contenu.append(el("div", { class: "citation", onclick: () => { fermer(); ouvrirLecteur(livre, c.position); } },
        el("p", null, "« " + c.texte + " »"),
        el("p", { class: "petit", style: { display: "flex", justifyContent: "space-between" } },
          el("span", { style: { color: "var(--rubrique)" } }, (c.page ? "p. " + c.page : "") + " →"),
          el("button", { class: "lien", onclick: async ev => {
            ev.stopPropagation();
            const ok = await demanderChoix("Retirer cette citation ?", [{ texte: "Annuler", valeur: null, discret: true }, { texte: "Retirer", valeur: true, plein: true }]);
            if (!ok) return;
            livre.citations = livre.citations.filter(x => x !== c);
            sauverDonnees();
            dessiner();
          } }, "retirer")))));
    } else {
      const zone = el("textarea", { rows: 9, placeholder: "Vos impressions, vos idées, ce que ce livre vous inspire…" }, livre.notes);
      zone.addEventListener("input", () => { livre.notes = zone.value; sauverDonnees(); });
      contenu.append(zone);
    }

    contenu.append(el("div", { class: "rangee-boutons", style: { marginTop: "26px", flexWrap: "wrap" } },
      donnees.bibliotheques.length > 1 ? el("button", { class: "lien", onclick: changerDeBibliotheque }, "Ranger dans une autre bibliothèque") : el("span"),
      el("button", { class: "lien", onclick: retirerLivre }, "Retirer de la bibliothèque")));
  }

  async function modifierInfos() {
    const titre = await demanderTexte("Titre du livre", livre.titre);
    if (titre) livre.titre = titre;
    const auteur = await demanderTexte("Auteur", livre.auteur);
    if (auteur !== null) livre.auteur = auteur;
    sauverDonnees();
    dessiner();
  }

  async function changerDeBibliotheque() {
    const choix = await demanderChoix("Dans quelle bibliothèque ?", donnees.bibliotheques.map((_, i) => ({ texte: "Bibliothèque " + romain(i), valeur: String(i) })));
    if (choix === null) return;
    const b = Number(choix);
    for (let e = 0; e < NB_ETAGERES; e++) {
      if (placeOccupee(b, e, livre) + livre.largeur + 2 <= CAPACITE_ETAGERE) {
        deplacerLivre(livre, b, e, null);
        afficherMessage("Rangé dans la bibliothèque " + romain(b));
        dessiner();
        return;
      }
    }
    afficherMessage("Cette bibliothèque est pleine");
  }

  async function retirerLivre() {
    const ok = await demanderChoix("Retirer « " + livre.titre + " » ?", [{ texte: "Annuler", valeur: null, discret: true }, { texte: "Retirer", valeur: true, plein: true }],
      "Le livre, ses citations et ses notes seront effacés de l'application.");
    if (!ok) return;
    donnees.livres = donnees.livres.filter(l => l !== livre);
    await supprimerFichierLivre(livre.id);
    sauverDonnees();
    fermer();
  }

  dessiner();
}
