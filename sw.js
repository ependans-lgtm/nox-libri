// =====================================================================
// LE SERVICE WORKER : un petit programme qui garde une copie de l'application
// pour qu'elle s'ouvre même sans internet.
// - les fichiers de l'application : on essaie internet d'abord (pour avoir la dernière version),
//   et sinon on prend la copie gardée
// - les polices et les outils de lecture : on garde la copie et on ne les retélécharge plus
// =====================================================================

const VERSION = "ex-libris-v1";
const FICHIERS_APPLICATION = [
  "./", "index.html", "manifest.json", "css/style.css",
  "js/outils.js", "js/donnees.js", "js/fenetres.js", "js/rendezvous.js", "js/calendrier.js",
  "js/taches.js", "js/notes.js", "js/aujourdhui.js", "js/bibliotheque.js", "js/lecteur.js",
  "js/rappels.js", "js/app.js", "icones/icone-192.png", "icones/icone-512.png"
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
    // Nos propres fichiers : internet d'abord, la copie si on est hors ligne
    evenement.respondWith(fetch(demande)
      .then(reponse => {
        const copie = reponse.clone();
        caches.open(VERSION).then(cache => cache.put(demande, copie));
        return reponse;
      })
      .catch(() => caches.match(demande).then(r => r || caches.match("index.html"))));
  } else if (/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(adresse.hostname)) {
    // Les polices et les outils de lecture : la copie d'abord
    evenement.respondWith(caches.match(demande).then(copie => copie || fetch(demande).then(reponse => {
      const double = reponse.clone();
      caches.open(VERSION).then(cache => cache.put(demande, double));
      return reponse;
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
