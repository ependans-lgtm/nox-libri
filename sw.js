// =====================================================================
// LE SERVICE WORKER : un petit programme qui garde une copie de l'application
// pour qu'elle s'ouvre même sans internet.
// - les fichiers de l'application : on donne tout de suite la copie gardée dans le téléphone
//   (l'application s'ouvre donc instantanément, même avec un mauvais réseau), et pendant ce temps
//   on va chercher la dernière version sur internet : elle servira à l'ouverture suivante
// - les polices et les outils de lecture font partie de ces fichiers : aucun autre site n'est contacté
// =====================================================================

const VERSION = "nox-libri-v4";
const FICHIERS_APPLICATION = [
  "./", "index.html", "manifest.json", "css/style.css", "css/documents.css", "confidentialite.html", "licences.html",
  "js/outils.js", "js/donnees.js", "js/fenetres.js", "js/rendezvous.js", "js/calendrier.js",
  "js/taches.js", "js/notes.js", "js/aujourdhui.js", "js/bibliotheque.js", "js/lecteur.js",
  "js/rappels.js", "js/app.js", "icones/icone-192.png", "icones/icone-512.png",
  // les polices, et les outils qui affichent les livres : tout est dans l'application
  "css/polices.css",
  "polices/Cutive-normal-1-latin-ext.woff2",
  "polices/Cutive-normal-2-latin.woff2",
  "polices/EBGaramond-italic-3-latin-ext.woff2",
  "polices/EBGaramond-italic-4-latin.woff2",
  "polices/EBGaramond-normal-5-latin-ext.woff2",
  "polices/EBGaramond-normal-6-latin.woff2",
  "polices/NewsCycle-normal-10-latin.woff2",
  "polices/NewsCycle-normal-7-latin-ext.woff2",
  "polices/NewsCycle-normal-8-latin.woff2",
  "polices/NewsCycle-normal-9-latin-ext.woff2",
  "bibliotheques/pdf.min.js", "bibliotheques/pdf.worker.min.js", "bibliotheques/jszip.min.js", "bibliotheques/epub.min.js"
];

// À l'installation : on range une copie de tous les fichiers
self.addEventListener("install", evenement => {
  evenement.waitUntil(caches.open(VERSION).then(cache => cache.addAll(FICHIERS_APPLICATION)).then(() => self.skipWaiting()));
});

// À l'activation : on jette les copies des anciennes versions
self.addEventListener("activate", evenement => {
  evenement.waitUntil(caches.keys()
    .then(cles => Promise.all(cles.filter(cle => cle !== VERSION).map(cle => caches.delete(cle))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", evenement => {
  const demande = evenement.request;
  if (demande.method !== "GET") return;
  const adresse = new URL(demande.url);

  if (adresse.origin === location.origin) {
    // Nos propres fichiers : la copie d'abord (c'est immédiat)…
    evenement.respondWith(caches.open(VERSION).then(cache => cache.match(demande, { ignoreSearch: true }).then(copie => {
      // …et, en même temps, on demande la dernière version à internet pour la prochaine ouverture
      const miseAJour = fetch(demande, { cache: "no-cache" })
        .then(reponse => {
          if (reponse.ok) cache.put(demande, reponse.clone());
          return reponse;
        })
        .catch(() => copie || cache.match("index.html"));
      evenement.waitUntil(miseAJour.catch(() => {}));
      return copie || miseAJour;       // pas encore de copie (première visite) : on attend internet
    })));
  }
});

// Toucher une notification ouvre l'application
self.addEventListener("notificationclick", evenement => {
  evenement.notification.close();
  evenement.waitUntil(self.clients.matchAll({ type: "window" }).then(fenetres => {
    if (fenetres.length) return fenetres[0].focus();
    return self.clients.openWindow("./");
  }));
});
