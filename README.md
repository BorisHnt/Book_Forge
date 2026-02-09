# BOOK FORGE

**BOOK FORGE — Where pages are crafted**

Web-app statique desktop-first pour la mise en page longue (livres, magazines, rapports, thèses), en **HTML/CSS/JavaScript Vanilla** avec **modules ES**, conçue pour fonctionner **offline** et hébergeable sur **GitHub Pages**.

## Fonctions V1 livrées

- Éditeur multipages avec pages simples et spreads
- Panneaux gauche/droite dockables, redimensionnables, persistants
- Gestion des sections/chapitres (pagination arabe/romaine, signets, TOC, start odd)
- Gabarits (masters) avec héritage simple, application page/section
- Styles typo (paragraphe, caractère, objet)
- Grilles/colonnes/baseline avec presets
- Paramètres du livre (format, marges, bleed, safe area, couleurs overlays)
- Import multi-pages (PDF/DOCX/EPUB/HTML/TXT/MD, placeholders V1 pour formats complexes)
- Preview print (bleed/safe area/couleur CMYK/BW)
- Checklist export interactive (OK / Warning / Error)
- Export PDF print/digital via flux impression navigateur
- Sauvegarde locale (`localStorage`)
- Mode offline (`manifest.webmanifest` + `sw.js`)

## Icônes Tabler

- Intégration locale dans `assets/icons/tabler/`
- Sprite local dans `assets/icons/tabler-sprite.svg`
- Mapping centralisé dans `ui/iconMap.js`
- Aucun bitmap, SVG uniquement

## Architecture

- `core/` : document, store central, history (command), event bus (observer)
- `layout/` : pages, sections, gabarits
- `typography/` : styles
- `ui/` : settings, preview, checklist, panels, icons
- `importers/` : import multi-pages
- `exporters/` : export PDF/digital/HTML

## Lancer localement

```bash
python3 -m http.server 8080
# puis ouvrir http://localhost:8080
```

## Déploiement GitHub Pages

- Push du contenu du repo
- Activer Pages sur la branche (root)
- L'application est 100 % frontend, sans backend
