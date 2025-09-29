import logging
from text import *
from new_similarity import find_closest_neighbor

# Liste des textes voisins
voisins = [sotraima, michel_recyclage_1, michel_recyclage_2, michel_recyclage_entete_differente, derichebourg_8pages, derichebourg_unipage, facture_unipage]

# Prendre le dernier comme sujet et le retirer de la liste
sujet = michel_recyclage_2
voisins.remove(sujet)

# Trouver le voisin le plus proche
resultats = find_closest_neighbor(sujet, voisins)

print("=== RÉSULTAT DE LA COMPARAISON ===")
print(f"Statut: {resultats['status']}")
print(f"Voisin trouvé: {resultats['found']}")
print(f"ID du voisin: {resultats['neighbor_id']}")
print(f"Score de similarité: {resultats['similarity_score']:.4f}")
print("=" * 50)