// =====================================================================
// LES RAPPELS (version simple)
// Ils fonctionnent quand l'application est ouverte ou l'a été récemment.
// Plus tard, avec l'application Android (Capacitor), ils deviendront
// fiables même application fermée.
// =====================================================================

// Demander au téléphone l'autorisation d'afficher des notifications
async function activerRappels() {
  if (!("Notification" in window)) {
    afficherMessage("Ce navigateur ne sait pas afficher de notifications");
    return;
  }
  const reponse = await Notification.requestPermission();
  donnees.reglages.rappelsActifs = reponse === "granted";
  sauverDonnees();
  afficherMessage(reponse === "granted" ? "Rappels activés" : "Les notifications ont été refusées");
}

// Afficher une notification (ou, à défaut, un message dans l'application)
async function notifier(titre, texte, etiquette) {
  const permis = "Notification" in window && Notification.permission === "granted" && donnees.reglages.rappelsActifs;
  if (permis && navigator.serviceWorker) {
    try {
      const enregistrement = await navigator.serviceWorker.ready;
      await enregistrement.showNotification(titre, { body: texte, tag: etiquette, icon: "icones/icone-192.png", badge: "icones/icone-192.png" });
      return;
    } catch (e) { /* on passe au message */ }
  }
  if (document.visibilityState === "visible") afficherMessage(titre + " — " + texte);
}

// Vérifier toutes les minutes s'il faut prévenir de quelque chose
function verifierRappels() {
  const r = donnees.reglages;
  const ajd = aujourdhui();
  if (!r.rappelsEnvoyes || r.rappelsEnvoyes.jour !== ajd) r.rappelsEnvoyes = { jour: ajd, deja: [] };
  const deja = r.rappelsEnvoyes.deja;
  const maintenant = minutesMaintenant();

  // 1. Quelques minutes avant un rendez-vous
  for (const rdv of rendezVousDuJour(ajd)) {
    const avant = enMinutes(rdv.debut) - maintenant;
    const cle = "rdv-" + rdv.id;
    if (avant > 0 && avant <= r.rappelMinutes && !deja.includes(cle)) {
      deja.push(cle);
      notifier(rdv.titre, "Dans " + dureeLisible(avant) + (rdv.lieu ? " · " + rdv.lieu : ""), cle);
    }
  }

  // 2. Le résumé du jour, à la première ouverture de la journée
  if (r.dernierResume !== ajd && maintenant >= 6 * 60) {
    r.dernierResume = ajd;
    const nbRdv = rendezVousDuJour(ajd).length;
    const nbTaches = tachesDeLaDate(ajd).filter(t => !t.faite).length + tachesEnRetard().length;
    notifier("Bonjour", "Aujourd'hui : " + nbRdv + " rendez-vous et " + nbTaches + " tâche" + (nbTaches > 1 ? "s" : "") + " à faire.", "resume-" + ajd);
  }

  // 3. Le soir, s'il reste une tâche Braise
  if (maintenant >= 20 * 60 && !deja.includes("braise-soir")) {
    const braises = [...tachesDeLaDate(ajd), ...tachesEnRetard()].filter(t => !t.faite && t.importance === "braise");
    if (braises.length) {
      deja.push("braise-soir");
      notifier("Une braise brûle encore", [...new Set(braises.map(t => t.titre))].join(", "), "braise-" + ajd);
    }
  }
  sauverDonnees();
}
