# Nouvelle Logique de Matching Automatique

## Vue d'ensemble

La nouvelle logique de matching automatique permet de définir des règles de correspondance flexibles via des paramètres JSON. Elle parcourt les règles dans l'ordre et s'arrête dès qu'elle trouve des candidats correspondants.

## Structure des paramètres

```typescript
interface AutoLinkParams {
  to_link: MatchingRule[]; // Règles pour lier automatiquement
  to_check_by_user: MatchingRule[]; // Règles pour vérification manuelle
  create: MatchingRule[]; // Règles pour créer un nouveau BSD
}

interface MatchingRule {
  num_bsd: boolean; // Correspondance exacte du numéro BSD
  num_bon: boolean; // Correspondance exacte du numéro de bon
  site: boolean; // Correspondance exacte du site
  presta: boolean; // Correspondance du prestataire (destinataire OU transporteur)
  ced: boolean; // Correspondance exacte du CED (chiffres uniquement)
  nom_dechet_tresh: number; // Seuil de similarité pour le nom de déchet (0-100)
  nom_dechet: boolean; // Activer le matching fuzzy du nom de déchet
  date: boolean; // Activer la vérification de date
  date_tresh: number; // Écart maximum en jours pour la date
}
```

## Logique de fonctionnement

1. **Parcours séquentiel** : Les règles sont testées dans l'ordre `to_link` → `to_check_by_user` → `create`
2. **Arrêt au premier match** : Dès qu'une règle trouve ≥1 candidat, le processus s'arrête
3. **Retour du résultat** :
   - `{result: 'to_link', id: 'bsd_id', pluto: 'link'}` si candidat unique trouvé
   - `{result: 'to_check_by_user', id: 'bsd_id', pluto: 'link'|'create'}` selon le nombre de candidats
   - `{result: 'create', pluto: 'create'}` si aucune règle ne correspond

## Exemple d'utilisation

```typescript
import { AutoLinkWithParams } from "./utils/link";

const params: AutoLinkParams = {
  to_link: [
    {
      num_bsd: true,
      num_bon: false,
      site: true,
      presta: true,
      ced: false,
      nom_dechet_tresh: 0,
      nom_dechet: false,
      date: true,
      date_tresh: 10,
    },
  ],
  to_check_by_user: [
    {
      num_bsd: false,
      num_bon: false,
      site: true,
      presta: true,
      ced: true,
      nom_dechet_tresh: 0,
      nom_dechet: false,
      date: true,
      date_tresh: 2,
    },
  ],
  create: [
    {
      num_bsd: false,
      num_bon: false,
      site: true,
      presta: true,
      ced: false,
      nom_dechet_tresh: 0,
      nom_dechet: false,
      date: true,
      date_tresh: 10,
    },
  ],
};

const result = await AutoLinkWithParams(
  pdfInfo,
  entrepriseId,
  dechetIndex,
  params
);
```

## Règles de matching

### Correspondance exacte

- **num_bsd** : Compare `readable_id_track_dechets` du BSD avec `num_bsd` du PDF
- **num_bon** : Compare `numeroBon` du BSD avec `num_bon` du PDF
- **site** : Compare `emitter.company.name` du BSD avec `site` du PDF (après mapping)
- **presta** : Compare `recipient.company.name` OU `transporter.company.name` avec `presta` du PDF
- **ced** : Compare les chiffres extraits du CED (ignore les caractères non-numériques)

### Matching fuzzy

- **nom_dechet** : Utilise la distance de Levenshtein pour calculer la similarité
- **Seuil** : `nom_dechet_tresh` en pourcentage (0-100)

### Vérification de date

- **date** : Compare `takenOverAt` ou `created_at` du BSD avec `date` du PDF
- **Écart** : `date_tresh` en jours maximum autorisé

## Intégration dans l'interface

La nouvelle logique est intégrée dans `LinkMeta.tsx` avec :

- Un bouton "Link auto (nouveau)" pour tester la nouvelle logique
- Affichage des résultats avec indication "Nouveau:" en violet
- Possibilité de lier directement au BSD suggéré

## Fichiers de test

- `test_auto_link.ts` : Contient des exemples de paramètres prédéfinis
- `AutoLinkDemo.tsx` : Composant de démonstration interactif

## Avantages

1. **Flexibilité** : Règles configurables via JSON
2. **Séquentiel** : Logique claire et prévisible
3. **Extensible** : Facile d'ajouter de nouveaux critères
4. **Testable** : Paramètres isolés et reproductibles
5. **Compatible** : Coexiste avec l'ancienne logique
