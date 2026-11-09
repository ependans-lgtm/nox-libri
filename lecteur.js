// =====================================================================
// LE LECTEUR : ouvrir les PDF (avec PDF.js) et les EPUB (avec epub.js)
// Ces outils gratuits sont rangés dans le dossier "bibliotheques" de l'application :
// aucun autre site n'est contacté, et la lecture fonctionne sans internet.
// Ils sont chargés seulement quand on en a besoin (à l'ouverture du premier livre).
// =====================================================================

const OUTILS_LECTURE = {
  pdf: "bibliotheques/pdf.min.js",                       // PDF.js 3.11.174
  pdfTravailleur: "bibliotheques/pdf.worker.min.js",
  zip: "bibliotheques/jszip.min.js",                     // JSZip 3.10.1
  epub: "bibliotheques/epub.min.js"                      // epub.js 0.3.93
};

// Charger un fichier de code (une seule fois)
const scriptsCharges = {};
function chargerScript(adresse) {
  if (!scriptsCharges[adresse]) {
    scriptsCharges[adresse] = new Promise((reussite, echec) => {
      const script = el("script", { src: adresse });
      script.onload = reussite;
      script.onerror = () => echec(new Error("Impossible de charger l'outil de lecture. Fermez puis rouvrez l'application."));
      document.head.append(script);
    });
  }
  return scriptsCharges[adresse];
}

// Le réglage de sécurité pour ouvrir un PDF.
// Cette version de PDF.js (3.11.174) a une faille connue : un PDF piégé pouvait faire exécuter du code
// dans l'application (référence CVE-2024-4367). Interdire à PDF.js d'utiliser "eval" la bloque :
// c'est la solution indiquée par les auteurs de PDF.js. Les PDF s'affichent exactement pareil.
const OPTIONS_PDF_SURES = { isEvalSupported: false };

// PDF.js a besoin d'un "travailleur" (comme Stockfish dans le jeu d'échecs).
// Un travailleur doit venir de la même adresse que l'application : c'est le cas, puisqu'il est dans notre dossier.
let pdfPret = null;
function chargerPdfJs() {
  if (!pdfPret) {
    pdfPret = chargerScript(OUTILS_LECTURE.pdf).then(() => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = OUTILS_LECTURE.pdfTravailleur;
      return window.pdfjsLib;
    });
  }
  return pdfPret;
}

function chargerEpubJs() {
  return chargerScript(OUTILS_LECTURE.zip).then(() => chargerScript(OUTILS_LECTURE.epub)).then(() => window.ePub);
}


// ===== Lire le titre, l'auteur et le nombre de pages d'un nouveau livre =====
async function lireInfosLivre(fichier, type) {
  const donneesFichier = await fichier.arrayBuffer();
  if (type === "pdf") {
    const pdfjs = await chargerPdfJs();
    const pdf = await pdfjs.getDocument({ data: donneesFichier, ...OPTIONS_PDF_SURES }).promise;
    let titre = "", auteur = "";
    try {
      const meta = await pdf.getMetadata();
      titre = (meta.info && meta.info.Title) || "";
      auteur = (meta.info && meta.info.Author) || "";
    } catch (e) { /* pas de métadonnées : tant pis */ }
    const pages = pdf.numPages;
    pdf.destroy();
    return { titre: titre.trim(), auteur: auteur.trim(), pages };
  }
  const ePub = await chargerEpubJs();
  const livre = ePub(donneesFichier);
  const meta = await livre.loaded.metadata;
  await livre.ready;
  const pages = Math.round(livre.spine.length * 12);   // une estimation, pour l'épaisseur de la reliure
  const infos = { titre: (meta.title || "").trim(), auteur: (meta.creator || "").trim(), pages: 0, estimation: pages };
  // epub.js finit de préparer ses feuilles de style juste après : on le laisse terminer avant de fermer
  setTimeout(() => livre.destroy(), 3000);
  return { ...infos, pages: infos.estimation };
}


// ===== Ouvrir le lecteur =====
// "cible" est facultative : la position d'une citation où aller directement
let lectureEnCours = null;
let carnetOuvert = null;      // la fonction qui redessine le carnet, quand il est ouvert

// Les réglages de lecture (taille du texte et luminosité), gardés d'un livre à l'autre
function reglagesLecture() {
  if (!donnees.reglages.lecture) donnees.reglages.lecture = { taille: 100, luminosite: 100 };
  return donnees.reglages.lecture;
}

async function ouvrirLecteur(livre, cible) {
  const lecteur = document.getElementById("lecteur");
  const reglages = reglagesLecture();
  lecteur.innerHTML = "";
  lecteur.hidden = false;

  const indicateur = el("span", { class: "petit", style: { color: "var(--or)" } }, "");
  const zone = el("div", { class: "zone-lecture" }, el("p", { style: { color: "var(--parchemin)", fontStyle: "italic", marginTop: "40px" } }, "Ouverture du livre…"));
  const boutonSurligner = el("button", { class: "bouton-surligner", hidden: true }, "✎ Surligner");
  const voileLuminosite = el("div", { class: "voile-luminosite" });

  // --- Les réglages : la taille du texte et la luminosité ---
  const affichageTaille = el("span", { style: { minWidth: "40px", textAlign: "center" } }, reglages.taille + " %");
  function changerTaille(ecart) {
    reglages.taille = Math.min(220, Math.max(60, reglages.taille + ecart));
    affichageTaille.textContent = reglages.taille + " %";
    sauverDonnees();
    if (lectureEnCours && lectureEnCours.changerTaille) lectureEnCours.changerTaille(reglages.taille);
  }
  function appliquerLuminosite() {
    // 100 % = aucun voile ; 30 % = un voile noir presque opaque
    voileLuminosite.style.opacity = (100 - reglages.luminosite) / 100 * 0.85;
  }
  const curseur = el("input", { type: "range", min: 30, max: 100, step: 5, value: reglages.luminosite, "aria-label": "Luminosité",
    oninput: e => { reglages.luminosite = Number(e.target.value); appliquerLuminosite(); },
    onchange: () => sauverDonnees() });
  const panneauReglages = el("div", { class: "reglages-lecture", hidden: true },
    el("div", { class: "groupe" }, el("span", null, "Texte"),
      el("button", { "aria-label": "Texte plus petit", onclick: () => changerTaille(-10) }, "A−"),
      affichageTaille,
      el("button", { "aria-label": "Texte plus grand", onclick: () => changerTaille(10) }, "A+")),
    el("div", { class: "groupe" }, el("span", null, "☾"), curseur, el("span", null, "☀")));
  appliquerLuminosite();

  // --- Le carnet du livre : ses citations et ses notes, sans quitter la lecture ---
  const carnet = el("div", { class: "carnet-lecture", hidden: true });
  let ongletCarnet = "citations";
  function dessinerCarnet() {
    carnet.innerHTML = "";
    const corps = el("div", { class: "corps-carnet" });
    carnet.append(
      el("div", { class: "entete-carnet" },
        el("div", { class: "onglets", style: { margin: "0" } },
          el("button", { class: ongletCarnet === "citations" ? "actif" : "", onclick: () => { ongletCarnet = "citations"; dessinerCarnet(); } }, "Citations · " + livre.citations.length),
          el("button", { class: ongletCarnet === "notes" ? "actif" : "", onclick: () => { ongletCarnet = "notes"; dessinerCarnet(); } }, "Notes de lecture")),
        el("button", { class: "fermer-fenetre", "aria-label": "Fermer le carnet", onclick: basculerCarnet }, "✕")),
      corps);

    if (ongletCarnet === "citations") {
      if (!livre.citations.length) corps.append(el("p", { class: "vide" }, "Sélectionnez un passage puis touchez « Surligner » : il apparaîtra ici."));
      [...livre.citations].sort((a, b) => (a.page || 0) - (b.page || 0)).forEach(c => corps.append(el("div", { class: "citation",
        // Toucher une citation : on y retourne dans le livre, et le carnet se referme
        onclick: () => { basculerCarnet(); if (lectureEnCours) lectureEnCours.allerA(c.position); } },
        el("p", null, "« " + c.texte + " »"),
        el("p", { class: "petit", style: { color: "var(--rubrique)" } }, (c.page ? "p. " + c.page : "") + " →"))));
    } else {
      const notes = el("textarea", { placeholder: "Vos impressions, vos idées, ce que ce livre vous inspire…" }, livre.notes);
      notes.addEventListener("input", () => { livre.notes = notes.value; sauverDonnees(); });
      corps.append(notes);
    }
  }
  function basculerCarnet() {
    carnet.hidden = !carnet.hidden;
    boutonCarnet.classList.toggle("actif", !carnet.hidden);
    carnetOuvert = carnet.hidden ? null : dessinerCarnet;
    if (!carnet.hidden) dessinerCarnet();
  }

  const boutonReglages = el("button", { "aria-label": "Taille du texte et luminosité",
    onclick: () => {
      panneauReglages.hidden = !panneauReglages.hidden;
      boutonReglages.classList.toggle("actif", !panneauReglages.hidden);
      // Le panneau prend (ou rend) de la place : le livre refait sa mise en pages
      if (lectureEnCours && lectureEnCours.ajusterTaille) lectureEnCours.ajusterTaille();
    } }, "Aa");
  const boutonCarnet = el("button", { "aria-label": "Citations et notes de lecture", onclick: basculerCarnet }, "❝ carnet");

  lecteur.append(
    el("div", { class: "barre-lecteur" },
      el("button", { onclick: fermerLecteur }, "‹ fermer"),
      el("span", { class: "titre-lecture" }, livre.titre),
      indicateur, boutonReglages, boutonCarnet),
    panneauReglages,
    el("div", { class: "cadre-lecture" }, zone, voileLuminosite, carnet),
    el("div", { class: "barre-lecteur", style: { justifyContent: "space-between" } },
      el("button", { onclick: () => lectureEnCours && lectureEnCours.precedente() }, "‹ page précédente"),
      el("button", { onclick: () => lectureEnCours && lectureEnCours.suivante() }, "page suivante ›")),
    boutonSurligner);

  // La flèche « retour » du téléphone referme le lecteur
  retenirRetour(fermerLecteurSimplement);

  // Glisser le doigt vers la gauche ou la droite pour tourner la page
  let departX = null;
  zone.addEventListener("touchstart", e => { departX = e.touches[0].clientX; }, { passive: true });
  zone.addEventListener("touchend", e => {
    if (departX === null || !lectureEnCours) return;
    const ecart = e.changedTouches[0].clientX - departX;
    departX = null;
    if (window.getSelection().toString()) return;
    if (zone.scrollWidth > zone.clientWidth + 4) return;      // page agrandie : le doigt sert à la déplacer
    if (ecart < -60) lectureEnCours.suivante();
    if (ecart > 60) lectureEnCours.precedente();
  });

  try {
    const fichier = await lireFichierLivre(livre.id);
    if (!fichier) throw new Error("Le fichier de ce livre est introuvable sur ce téléphone");
    if (livre.type === "pdf") lectureEnCours = await lecturePdf(livre, fichier, zone, indicateur, boutonSurligner, cible);
    else lectureEnCours = await lectureEpub(livre, fichier, zone, indicateur, boutonSurligner, cible);
  } catch (erreur) {
    console.error(erreur);
    zone.innerHTML = "";
    zone.append(el("p", { style: { color: "var(--parchemin)", textAlign: "center", marginTop: "40px", lineHeight: "1.6" } }, erreur.message));
  }
}

// Fermer le lecteur sans toucher à l'historique (la flèche « retour » du téléphone)
function fermerLecteurSimplement() {
  const lecteur = document.getElementById("lecteur");
  if (lecteur.hidden) return;
  if (lectureEnCours && lectureEnCours.fermer) lectureEnCours.fermer();
  lectureEnCours = null;
  carnetOuvert = null;
  lecteur.hidden = true;
  lecteur.innerHTML = "";
  sauverDonnees();
  rafraichir();
}

// Fermer le lecteur depuis son bouton « fermer »
function fermerLecteur() {
  oublierRetour(fermerLecteurSimplement);
  fermerLecteurSimplement();
}
// Enregistrer une citation surlignée
function ajouterCitation(livre, texte, page, position, rectangles) {
  texte = texte.replace(/\s+/g, " ").trim();
  if (!texte) return;
  livre.citations.push({ id: nouvelId(), texte, page, position, rectangles: rectangles || [], ajouteeLe: aujourdhui() });
  sauverDonnees();
  afficherMessage("Citation ajoutée au livre");
  if (carnetOuvert) carnetOuvert();          // le carnet ouvert se met à jour
}


// ===== Lire un PDF =====
async function lecturePdf(livre, fichier, zone, indicateur, boutonSurligner, cible) {
  const pdfjs = await chargerPdfJs();
  const pdf = await pdfjs.getDocument({ data: await fichier.arrayBuffer(), ...OPTIONS_PDF_SURES }).promise;
  const total = pdf.numPages;
  let numero = cible && cible.page ? cible.page : Math.min(Math.max(1, livre.progression.page || 1), total);
  let rendu = 0;   // pour ignorer un ancien dessin si on tourne vite les pages

  async function dessinerPage() {
    const monRendu = ++rendu;
    const page = await pdf.getPage(numero);
    const largeurDispo = Math.min(zone.clientWidth - 20, 900);
    // La taille choisie dans les réglages agrandit ou rétrécit la page entière
    const echelle = largeurDispo / page.getViewport({ scale: 1 }).width * (reglagesLecture().taille / 100);
    const vue = page.getViewport({ scale: echelle });
    const pixels = window.devicePixelRatio || 1;

    const toile = el("canvas");
    toile.width = Math.floor(vue.width * pixels);
    toile.height = Math.floor(vue.height * pixels);
    toile.style.width = vue.width + "px";
    toile.style.height = vue.height + "px";
    const cadre = el("div", { class: "page-pdf", style: { width: vue.width + "px", height: vue.height + "px" } }, toile);
    const coucheTexte = el("div", { class: "textLayer" });
    coucheTexte.style.setProperty("--scale-factor", echelle);
    cadre.append(coucheTexte);

    await page.render({ canvasContext: toile.getContext("2d"), viewport: vue, transform: pixels !== 1 ? [pixels, 0, 0, pixels, 0, 0] : null }).promise;
    if (monRendu !== rendu) return;

    // La couche de texte invisible, posée sur l'image de la page : c'est elle qu'on sélectionne
    const texte = await page.getTextContent();
    await pdfjs.renderTextLayer({ textContentSource: texte, container: coucheTexte, viewport: vue, textDivs: [] }).promise;
    if (monRendu !== rendu) return;

    // Les passages déjà surlignés sur cette page
    livre.citations.filter(c => c.page === numero).forEach(c => (c.rectangles || []).forEach(r => cadre.append(el("div", {
      class: "surlignage",
      style: { left: r.x * 100 + "%", top: r.y * 100 + "%", width: r.l * 100 + "%", height: r.h * 100 + "%" }
    }))));

    zone.innerHTML = "";
    zone.append(cadre);
    zone.scrollTop = 0;
    indicateur.textContent = "p. " + numero + " / " + total;
    livre.progression = { page: numero, total, pourcent: numero / total * 100, position: { page: numero } };
    sauverDonnees();
  }

  // Quand on sélectionne du texte, le bouton « Surligner » apparaît
  function surSelection() {
    const selection = window.getSelection();
    const dansLaPage = selection.rangeCount && zone.contains(selection.anchorNode);
    boutonSurligner.hidden = !(dansLaPage && selection.toString().trim());
  }
  document.addEventListener("selectionchange", surSelection);

  boutonSurligner.onclick = () => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const cadre = zone.querySelector(".page-pdf");
    const boite = cadre.getBoundingClientRect();
    // On retient la place du passage, en proportions de la page (pour le redessiner à toutes les tailles)
    const rectangles = [...selection.getRangeAt(0).getClientRects()].filter(r => r.width > 1).map(r => ({
      x: (r.left - boite.left) / boite.width, y: (r.top - boite.top) / boite.height,
      l: r.width / boite.width, h: r.height / boite.height
    }));
    ajouterCitation(livre, selection.toString(), numero, { page: numero }, rectangles);
    selection.removeAllRanges();
    boutonSurligner.hidden = true;
    dessinerPage();
  };

  await dessinerPage();
  return {
    suivante: () => { if (numero < total) { numero++; dessinerPage(); } },
    precedente: () => { if (numero > 1) { numero--; dessinerPage(); } },
    allerA: position => { if (position && position.page) { numero = Math.min(total, Math.max(1, position.page)); dessinerPage(); } },
    changerTaille: () => dessinerPage(),
    fermer: () => { document.removeEventListener("selectionchange", surSelection); pdf.destroy(); }
  };
}


// ===== Lire un EPUB =====
async function lectureEpub(livre, fichier, zone, indicateur, boutonSurligner, cible) {
  const ePub = await chargerEpubJs();
  const ouvrage = ePub(await fichier.arrayBuffer());
  zone.innerHTML = "";
  const surface = el("div", { class: "zone-epub" });
  zone.append(surface);
  zone.style.padding = "0";

  const rendu = ouvrage.renderTo(surface, { width: "100%", height: "100%", flow: "paginated", spread: "none" });

  // Quand la zone de lecture change de taille (le panneau des réglages s'ouvre, le téléphone tourne…),
  // le livre doit refaire sa mise en pages, sinon le bas du texte dépasse et se retrouve coupé.
  let attenteTaille = null;
  let livreAffiche = false;                   // on attend que le livre soit en place avant de toucher à sa taille
  let derniereTaille = "";                    // la dernière taille connue de la zone ("largeur x hauteur")
  function ajusterTaille() {
    const taille = surface.clientWidth + "x" + surface.clientHeight;
    if (!livreAffiche || !surface.clientWidth || !surface.clientHeight || taille === derniereTaille) return;
    derniereTaille = taille;
    rendu.resize(surface.clientWidth, surface.clientHeight);
    if (positionActuelle) rendu.display(positionActuelle);       // on reste à la même page
  }
  const observateurTaille = new ResizeObserver(() => {
    clearTimeout(attenteTaille);
    attenteTaille = setTimeout(ajusterTaille, 150);
  });
  observateurTaille.observe(surface);

  // Le style des pages : le parchemin et l'encre d'Ex Libris
  const nuit = document.body.classList.contains("theme-nuit");
  rendu.themes.default({
    body: {
      background: nuit ? "#2C291C !important" : "#CCBDA9 !important",
      color: nuit ? "#CCBDA9 !important" : "#231D14 !important",
      "font-family": "'EB Garamond', Georgia, serif !important",
      "line-height": "1.6 !important",
      padding: "0 8px !important"
    },
    "::selection": { background: "rgba(181, 133, 80, .5)" }
  });
  surface.style.background = nuit ? "#2C291C" : "#CCBDA9";
  rendu.themes.fontSize(reglagesLecture().taille + "%");
  // Les pages du livre s'affichent dans un cadre à part : on lui donne l'adresse complète de nos polices
  const adressePolices = new URL("css/polices.css", location.href).href;
  rendu.hooks.content.register(contenu => contenu.addStylesheet(adressePolices));

  let selectionEnCours = null;
  let positionActuelle = null;

  // Les numéros de page d'un EPUB sont calculés (ils dépendent de la taille de l'écran)
  ouvrage.ready.then(() => ouvrage.locations.generate(1200)).then(() => {
    if (positionActuelle) majProgression(positionActuelle);
  });

  function numeroDePage(cfi) {
    if (!ouvrage.locations.length()) return null;
    return ouvrage.locations.locationFromCfi(cfi) + 1;
  }

  function majProgression(cfi) {
    positionActuelle = cfi;
    const total = ouvrage.locations.length();
    const page = numeroDePage(cfi);
    const pourcent = total ? ouvrage.locations.percentageFromCfi(cfi) * 100 : livre.progression.pourcent;
    indicateur.textContent = page ? "p. " + page + " / " + total : "";
    livre.progression = { page: page || 1, total: total || livre.progression.total, pourcent, position: { cfi } };
    sauverDonnees();
  }

  rendu.on("relocated", lieu => majProgression(lieu.start.cfi));

  // Sélectionner un passage → bouton « Surligner »
  rendu.on("selected", (cfi, contenu) => {
    ouvrage.getRange(cfi).then(plage => {
      selectionEnCours = { cfi, texte: plage ? plage.toString() : "", contenu };
      boutonSurligner.hidden = !selectionEnCours.texte.trim();
    });
  });
  rendu.on("click", () => { setTimeout(() => { if (!selectionEnCours) boutonSurligner.hidden = true; selectionEnCours = null; }, 300); });

  boutonSurligner.onclick = () => {
    if (!selectionEnCours) return;
    const { cfi, texte, contenu } = selectionEnCours;
    ajouterCitation(livre, texte, numeroDePage(cfi), { cfi });
    rendu.annotations.highlight(cfi, {}, null, "surligne", { fill: "#B58550", "fill-opacity": "0.35" });
    if (contenu && contenu.window) contenu.window.getSelection().removeAllRanges();
    selectionEnCours = null;
    boutonSurligner.hidden = true;
  };

  // Tourner les pages en glissant le doigt sur le texte
  let departX = null;
  rendu.on("touchstart", e => { departX = e.changedTouches[0].screenX; });
  rendu.on("touchend", e => {
    if (departX === null) return;
    const ecart = e.changedTouches[0].screenX - departX;
    departX = null;
    if (ecart < -60) rendu.next();
    if (ecart > 60) rendu.prev();
  });

  // Les citations déjà surlignées
  await rendu.display((cible && cible.cfi) || (livre.progression.position && livre.progression.position.cfi) || undefined);
  derniereTaille = surface.clientWidth + "x" + surface.clientHeight;
  livreAffiche = true;
  livre.citations.forEach(c => { if (c.position && c.position.cfi) rendu.annotations.highlight(c.position.cfi, {}, null, "surligne", { fill: "#B58550", "fill-opacity": "0.35" }); });

  return {
    suivante: () => rendu.next(),
    precedente: () => rendu.prev(),
    allerA: position => { if (position && position.cfi) rendu.display(position.cfi); },
    ajusterTaille,
    changerTaille: taille => {
      rendu.themes.fontSize(taille + "%");
      // Le texte a changé de taille : on réaffiche l'endroit où l'on était, pour que les pages soient recalculées
      if (positionActuelle) rendu.display(positionActuelle);
    },
    fermer: () => { observateurTaille.disconnect(); clearTimeout(attenteTaille); ouvrage.destroy(); }
  };
}
