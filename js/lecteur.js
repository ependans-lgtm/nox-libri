// =====================================================================
// LE LECTEUR : ouvrir les PDF (avec PDF.js) et les EPUB (avec epub.js)
// Ces deux outils gratuits sont chargés seulement quand on en a besoin.
// =====================================================================

const OUTILS_LECTURE = {
  pdf: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
  pdfTravailleur: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js",
  zip: "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
  epub: "https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js"
};

// Charger un fichier de code depuis internet (une seule fois)
const scriptsCharges = {};
function chargerScript(adresse) {
  if (!scriptsCharges[adresse]) {
    scriptsCharges[adresse] = new Promise((reussite, echec) => {
      const script = el("script", { src: adresse });
      script.onload = reussite;
      script.onerror = () => echec(new Error("Impossible de charger l'outil de lecture (êtes-vous connecté à internet ?)"));
      document.head.append(script);
    });
  }
  return scriptsCharges[adresse];
}

// PDF.js a besoin d'un "travailleur" (comme Stockfish dans le jeu d'échecs).
// Un travailleur doit venir de la même adresse que l'application : on le recopie donc dans un "blob".
let pdfPret = null;
function chargerPdfJs() {
  if (!pdfPret) {
    pdfPret = chargerScript(OUTILS_LECTURE.pdf)
      .then(() => fetch(OUTILS_LECTURE.pdfTravailleur))
      .then(reponse => reponse.text())
      .then(code => {
        const blob = new Blob([code], { type: "text/javascript" });
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
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
    const pdf = await pdfjs.getDocument({ data: donneesFichier }).promise;
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

async function ouvrirLecteur(livre, cible) {
  const lecteur = document.getElementById("lecteur");
  lecteur.innerHTML = "";
  lecteur.hidden = false;

  const indicateur = el("span", { class: "petit", style: { color: "var(--or)" } }, "");
  const zone = el("div", { class: "zone-lecture" }, el("p", { style: { color: "var(--parchemin)", fontStyle: "italic", marginTop: "40px" } }, "Ouverture du livre…"));
  const boutonSurligner = el("button", { class: "bouton-surligner", hidden: true }, "✎ Surligner");

  lecteur.append(
    el("div", { class: "barre-lecteur" },
      el("button", { onclick: fermerLecteur }, "‹ fermer"),
      el("span", { class: "titre-lecture" }, livre.titre),
      indicateur),
    zone,
    el("div", { class: "barre-lecteur", style: { justifyContent: "space-between" } },
      el("button", { onclick: () => lectureEnCours && lectureEnCours.precedente() }, "‹ page précédente"),
      el("button", { onclick: () => lectureEnCours && lectureEnCours.suivante() }, "page suivante ›")),
    boutonSurligner);

  // Glisser le doigt vers la gauche ou la droite pour tourner la page
  let departX = null;
  zone.addEventListener("touchstart", e => { departX = e.touches[0].clientX; }, { passive: true });
  zone.addEventListener("touchend", e => {
    if (departX === null || !lectureEnCours) return;
    const ecart = e.changedTouches[0].clientX - departX;
    departX = null;
    if (window.getSelection().toString()) return;
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

function fermerLecteur() {
  if (lectureEnCours && lectureEnCours.fermer) lectureEnCours.fermer();
  lectureEnCours = null;
  const lecteur = document.getElementById("lecteur");
  lecteur.hidden = true;
  lecteur.innerHTML = "";
  sauverDonnees();
  rafraichir();
}

// Enregistrer une citation surlignée
function ajouterCitation(livre, texte, page, position, rectangles) {
  texte = texte.replace(/\s+/g, " ").trim();
  if (!texte) return;
  livre.citations.push({ id: nouvelId(), texte, page, position, rectangles: rectangles || [], ajouteeLe: aujourdhui() });
  sauverDonnees();
  afficherMessage("Citation ajoutée au livre");
}


// ===== Lire un PDF =====
async function lecturePdf(livre, fichier, zone, indicateur, boutonSurligner, cible) {
  const pdfjs = await chargerPdfJs();
  const pdf = await pdfjs.getDocument({ data: await fichier.arrayBuffer() }).promise;
  const total = pdf.numPages;
  let numero = cible && cible.page ? cible.page : Math.min(Math.max(1, livre.progression.page || 1), total);
  let rendu = 0;   // pour ignorer un ancien dessin si on tourne vite les pages

  async function dessinerPage() {
    const monRendu = ++rendu;
    const page = await pdf.getPage(numero);
    const largeurDispo = Math.min(zone.clientWidth - 20, 900);
    const echelle = largeurDispo / page.getViewport({ scale: 1 }).width;
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
  rendu.hooks.content.register(contenu => contenu.addStylesheet("https://fonts.googleapis.com/css2?family=EB+Garamond:ital@0;1&display=swap"));

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
  livre.citations.forEach(c => { if (c.position && c.position.cfi) rendu.annotations.highlight(c.position.cfi, {}, null, "surligne", { fill: "#B58550", "fill-opacity": "0.35" }); });

  return {
    suivante: () => rendu.next(),
    precedente: () => rendu.prev(),
    fermer: () => ouvrage.destroy()
  };
}
