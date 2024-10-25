import re

async def extract_infos_json_from_text(text: str):
    fst_line = find_first_line_with_tva_total_ht_pu_unite(text)
    return {'first_line':fst_line, "text": text}


def find_first_line_with_tva_total_ht_pu_unite(text):
    # Liste des libellés à rechercher
    labels = ["TVA", "Total HT", "PU", "Unité"]
    
    # Créer une expression régulière qui correspond à l'un des libellés
    pattern = re.compile('|'.join(labels), re.IGNORECASE)
    
    # Diviser le texte en lignes
    lines = text.splitlines()
    
    # Parcourir chaque ligne pour trouver le premier match
    for line in lines:
        if pattern.search(line):
            return line.strip()  # Retourner la première ligne trouvée
    
    return None  # Retourner None si aucun libellé n'est trouvé