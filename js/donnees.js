// =====================================================================
// LES DONNÉES : tout ce qu'Ex Libris doit retenir
// - les rendez-vous, tâches, listes, notes et réglages : dans localStorage
// - les fichiers des livres (PDF, EPUB), trop gros : dans IndexedDB
// =====================================================================

const CLE_STOCKAGE = "exlibris";

// La forme des données au tout premier lancement
function donneesDeDepart() {
  return {
    version: 1,
    rendezVous: [],     // { id, titre, date, debut, fin, importance, repetition, lieu, note, exceptions }
    taches: [],         // { id, titre, date, importance, faite, sousTaches, note, modeleId }
    modelesTaches: [],  // les tâches qui reviennent : { id, titre, importance, note, repetition, rattraper, genereJusqua }
    listes: [],         // { id, nom, couleur, elements: [{ id, texte, fait }] }
    notes: [],          // { id, titre, contenu, etiquettes, epinglee, modifieeLe }
    livres: [],         // { id, titre, auteur, type, couleur, largeur, hauteur, bibliotheque, etagere, ordre, progression, citations, notes }
    bibliotheques: [{ nomsEtageres: ["", "", "", "", ""] }],
    reglages: {
      modeNuit: "auto",       // "auto" (selon l'heure), "jour" ou "nuit"
      nuitDebut: "20:00",
      nuitFin: "07:00",
      rappelMinutes: 15,
      rappelsActifs: false,
      dernierResume: ""
    }
  };
}

// Les données en mémoire, utilisées par toute l'application
let donnees = donneesDeDepart();

// Lire les données enregistrées sur le téléphone
function chargerDonnees() {
  try {
    const texte = localStorage.getItem(CLE_STOCKAGE);
    if (texte) {
      const lu = JSON.parse(texte);
      // On complète avec les valeurs de départ, au cas où une version plus ancienne manque d'un champ
      donnees = Object.assign(donneesDeDepart(), lu);
      donnees.reglages = Object.assign(donneesDeDepart().reglages, lu.reglages || {});
    }
  } catch (erreur) {
    console.error("Lecture des données impossible", erreur);
  }
}

// Enregistrer les données (à appeler après chaque changement)
function sauverDonnees() {
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(donnees));
  } catch (erreur) {
    afficherMessage("Impossible d'enregistrer : la mémoire du téléphone est peut-être pleine.");
  }
}

// ===== La sauvegarde de sécurité (export et import) =====
function exporterSauvegarde() {
  const texte = JSON.stringify(donnees, null, 2);
  const fichier = new Blob([texte], { type: "application/json" });
  const lien = el("a", { href: URL.createObjectURL(fichier), download: "nox-libri-sauvegarde-" + aujourdhui() + ".json" });
  document.body.append(lien);
  lien.click();
  lien.remove();
}

function importerSauvegarde(fichier) {
  return fichier.text().then(texte => {
    const lu = JSON.parse(texte);
    if (!lu || !Array.isArray(lu.rendezVous)) throw new Error("Ce fichier n'est pas une sauvegarde de Nox Libri");
    donnees = Object.assign(donneesDeDepart(), lu);
    sauverDonnees();
  });
}


// ===== IndexedDB : le coffre-fort des fichiers de livres =====
// IndexedDB peut garder de gros fichiers, contrairement à localStorage.
// Ses fonctions répondent "plus tard" : on utilise donc des promesses (then).

let baseLivres = null;

function ouvrirBaseLivres() {
  if (baseLivres) return Promise.resolve(baseLivres);
  return new Promise((reussite, echec) => {
    const demande = indexedDB.open("exlibris-livres", 1);
    demande.onupgradeneeded = () => demande.result.createObjectStore("fichiers");
    demande.onsuccess = () => { baseLivres = demande.result; reussite(baseLivres); };
    demande.onerror = () => echec(demande.error);
  });
}

function enregistrerFichierLivre(id, fichier) {
  return ouvrirBaseLivres().then(base => new Promise((reussite, echec) => {
    const transaction = base.transaction("fichiers", "readwrite");
    transaction.objectStore("fichiers").put(fichier, id);
    transaction.oncomplete = () => reussite();
    transaction.onerror = () => echec(transaction.error);
  }));
}

function lireFichierLivre(id) {
  return ouvrirBaseLivres().then(base => new Promise((reussite, echec) => {
    const demande = base.transaction("fichiers").objectStore("fichiers").get(id);
    demande.onsuccess = () => reussite(demande.result);
    demande.onerror = () => echec(demande.error);
  }));
}

function supprimerFichierLivre(id) {
  return ouvrirBaseLivres().then(base => new Promise(reussite => {
    const transaction = base.transaction("fichiers", "readwrite");
    transaction.objectStore("fichiers").delete(id);
    transaction.oncomplete = () => reussite();
  }));
}

// ===== Tout effacer : les rendez-vous, les tâches, les notes, les réglages et les fichiers des livres =====
function effacerToutesLesDonnees() {
  localStorage.removeItem(CLE_STOCKAGE);
  if (baseLivres) {
    baseLivres.close();                      // il faut refermer le coffre avant de pouvoir le détruire
    baseLivres = null;
  }
  return new Promise(fini => {
    const demande = indexedDB.deleteDatabase("exlibris-livres");
    demande.onsuccess = demande.onerror = demande.onblocked = () => fini();
  });
}

// Demander au téléphone de ne pas effacer nos données s'il manque de place
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist();
}
