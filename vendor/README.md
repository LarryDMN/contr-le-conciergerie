# Bibliothèques PDF locales

Ces fichiers sont servis localement et mis en cache hors connexion. Aucun CDN,
police distante ou serveur de génération PDF n'est utilisé.

| Bibliothèque | Version | Licence | Fichier distribué |
| --- | --- | --- | --- |
| [jsPDF](https://github.com/parallax/jsPDF) | 4.2.1 | MIT, voir `jspdf.LICENSE` | `dist/jspdf.umd.min.js` |
| [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) | 5.0.8 | MIT, voir `jspdf-autotable.LICENSE` | `dist/jspdf.plugin.autotable.min.js` |

Provenance : archives officielles `jspdf@4.2.1` et `jspdf-autotable@5.0.8` du
registre npm, téléchargées avec `npm pack`. Le SHA-512 de chaque archive a été
vérifié indépendamment contre `dist.integrity` du registre avant extraction.
Les distributions et licences sont copiées sans modification.

Intégrités des archives :

```text
jspdf@4.2.1
sha512-YyAXyvnmjTbR4bHQRLzex3CuINCDlQnBqoSYyjJwTP2x9jDLuKDzy7aKUl0hgx3uhcl7xzg32agn5vlie6HIlQ==

jspdf-autotable@5.0.8
sha512-Hy05N86yBO7CXBrnSLOge7i1ZYpKH2DjQ94iybaP7vBhSInjvRBgDc99ngKzSbSO8Jc98ZCally8I6n0tj2RJQ==
```

Pour une mise à jour, vérifier les nouvelles intégrités et licences, remplacer
les deux distributions, actualiser ce document et la version du cache dans
`sw.js`, puis tester la génération, l'archivage et le téléchargement hors connexion.
