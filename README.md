# Yas Live

Diffusion YouTube privée aux couleurs de [Yas Comores](https://www.yas.km) — un lien secret pour les invités, une régie pour l'équipe.

## Démarrer

```bash
node server.js
```

Aucune dépendance. Au premier lancement, le serveur crée `config.json` (mot de passe admin par défaut : `dis-yas-2026` — changez-le) et affiche :

- **Régie** : `http://localhost:4173/admin` — choisir le lien YouTube, le titre, activer/couper le direct, copier ou régénérer le lien privé.
- **Lien invités** : `http://localhost:4173/live/<token>` — le seul lien à partager.

## Fonctionnement

- Serveur Node sans dépendances (`server.js`), état persisté dans `config.json` (ignoré par git).
- La page invités interroge le serveur toutes les 12 s : elle démarre, change de flux ou repasse en attente automatiquement selon la régie.
- Anti-partage : clic droit bloqué, lecteur piloté par l'API IFrame YouTube (`controls=0`) sous un calque transparent, contrôles Yas maison — aucun lien YouTube cliquable. Hors ligne, l'API ne renvoie pas l'ID de la vidéo.
- Côté YouTube, diffusez en **non répertorié** pour que le direct reste introuvable sur la plateforme.

## Pages

| URL | Rôle |
|---|---|
| `/admin` | Régie protégée par mot de passe |
| `/live/<token>` | Page invités (mobile-first) |
| autre chemin | Écran « Diffusion privée » |
