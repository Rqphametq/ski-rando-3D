# SkiRando Explorer 🏔️🎿

**SkiRando Explorer** est une application web cartographique 3D 100% Front-End conçue pour la préparation de sorties en ski de randonnée dans les Alpes françaises. Elle regroupe les données topographiques, nivologiques et d'itinéraires sur une interface moderne et fluide.

🌍 **[Découvrir l'application en direct](METS_TON_LIEN_GITHUB_PAGES_ICI)** *(Remplacez par votre lien GitHub Pages)*

---

## ✨ Fonctionnalités Principales

### 🗺️ Cartographie 3D & Calques IGN
*   **Vue 3D immersive** : Basée sur le modèle d'élévation mondial (DEM) avec fond satellite.
*   **Itinéraires Ski de Rando** : Superposition dynamique du calque officiel de la Fondation Petzl / IGN.
*   **Zones Avalancheuses** : Affichage des pentes supérieures à 30° (données IGN Géoplateforme).
*   **Cabanes et Refuges** : Importation en temps réel des abris depuis *Refuges.info*.

### 📍 Sonde Virtuelle & Analyse Nivologique (BERA)
En cliquant n'importe où sur un versant, l'outil calcule et affiche instantanément :
*   **Topographie locale** : Altitude exacte, Versant (orientation) et Inclinaison de la pente.
*   **Météo & Neige** : Détection du massif (Vanoise, Mont-Blanc, Belledonne...), température et épaisseur du manteau neigeux (modèle global Open-Meteo).
*   **Historique de neige** : Analyse des 10 derniers jours pour trouver la date et la quantité de la dernière chute de neige.

### ✍️ Outils GPX (Création & Importation)
*   **Créateur d'itinéraire** : Dessinez votre propre trace à la souris sur le relief 3D et téléchargez-la au format `.gpx`.
*   **Import et Statistiques** : Chargez un fichier `.gpx` existant pour visualiser la trace sur la carte. L'application calcule automatiquement :
    *   La distance totale.
    *   Le dénivelé positif (D+) et négatif (D-).
*   **Profil Altimétrique Interactif** : Une courbe de dénivelé se génère à l'import. Survolez le graphique pour voir votre position exacte avancer sur la carte 3D.

### 🚁 Vol 3D & Recherche
*   Recherchez un sommet ou un col via la barre de recherche (API Nominatim) et laissez la caméra vous y emmener grâce à un vol 3D cinématique.

---

## 🛠️ Technologies Utilisées

Ce projet est conçu pour être léger, sans backend complexe, fonctionnant entièrement dans le navigateur :
*   **Frontend** : HTML5, CSS3 (Flexbox, Glassmorphism), Vanilla JavaScript.
*   **Moteur Cartographique** : [MapLibre GL JS](https://maplibre.org/) pour le rendu 3D.
*   **Graphiques** : [Chart.js](https://www.chartjs.org/) pour le profil altimétrique.
*   **Tracé GPX** : `@mapbox/mapbox-gl-draw` et `togpx / togeojson`.
*   **Icônes** : [Lucide Icons](https://lucide.dev/).

### 📡 APIs et Sources de données
*   **IGN (Géoplateforme)** : Flux WMTS pour les pentes >30° et les itinéraires hivernaux.
*   **Open-Meteo API** : Élévation de précision, données météo historiques et prévisions.
*   **Refuges.info API** : Cartographie des abris de montagne.
*   **OpenStreetMap (Nominatim)** : Géocodage pour la barre de recherche.

---

## 🚀 Installation Globale (Pour les développeurs)

Puisque ce projet est 100% Front-End, aucune installation serveur n'est requise.
1. Clonez ce dépôt : `git clone https://github.com/VOTRE_PSEUDO/VOTRE_DEPOT.git`
2. Ouvrez simplement le fichier `index.html` dans un navigateur web moderne, ou utilisez une extension comme *Live Server* sur VS Code.
3. Pour la mise en ligne, le dépôt est configuré pour être déployé nativement via **GitHub Pages**.

---
*Créé avec passion pour les amoureux de la montagne et de la peuf.* ❄️
