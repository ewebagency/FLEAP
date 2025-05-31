# import re
# from datetime import datetime
# from fuzzywuzzy import fuzz
# from typing import List, Dict, Tuple, Optional

# # Liste des prestataires connus
# KNOWN_PROVIDERS = [
#     "PAPREC", "SUEZ", "VEOLIA", "YPREMA", "LELY", 
#     "SEPUR", "NICOLLIN", "DERICHEBOURG", "SITA"
# ]

# # Liste des types de déchets connus
# KNOWN_WASTE_TYPES = [
#     "GRAVATS", "CARTON", "PLASTIQUE", "DECHETS CHIMIQUES", "BOIS",
#     "DECHETS VERTS", "METAUX", "PAPIER", "DIB", "DID",
#     "DECHETS INDUSTRIELS", "DECHETS DANGEREUX", "HUILES USAGEES",
#     "BATTERIES", "PILES", "DEEE", "AMIANTE"
# ]

# def extract_dates(text: str) -> List[Dict]:
#     """
#     Extrait les dates du texte avec un score de confiance
#     """
#     dates = []
    
#     # Différents formats de date à rechercher
#     date_patterns = [
#         (r'\b(\d{2})[/-](\d{2})[/-](\d{4})\b', 'DD/MM/YYYY', 95),
#         (r'\b(\d{2})[/-](\d{2})[/-](\d{2})\b', 'DD/MM/YY', 90),
#         (r'\b(\d{1,2})\s*(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s*(\d{4})\b', 
#          'DD Month YYYY', 85),
#     ]
    
#     for pattern, format_type, base_score in date_patterns:
#         matches = re.finditer(pattern, text.lower())
#         for match in matches:
#             try:
#                 if format_type == 'DD/MM/YYYY':
#                     date = datetime.strptime(f"{match.group(1)}/{match.group(2)}/{match.group(3)}", "%d/%m/%Y")
#                 elif format_type == 'DD/MM/YY':
#                     date = datetime.strptime(f"{match.group(1)}/{match.group(2)}/{match.group(3)}", "%d/%m/%y")
#                 else:  # DD Month YYYY
#                     date_str = f"{match.group(1)} {match.group(2)} {match.group(3)}"
#                     date = datetime.strptime(date_str, "%d %B %Y")
                
#                 # Ajuste le score selon le contexte
#                 context_score = base_score
#                 if "date" in text[max(0, match.start()-20):match.start()].lower():
#                     context_score += 5
#                 if "facture" in text[max(0, match.start()-20):match.start()].lower():
#                     context_score += 3
                
#                 dates.append({
#                     "date": date.strftime("%Y-%m-%d"),
#                     "score": min(context_score, 100),
#                     "format": format_type,
#                     "original": match.group(0)
#                 })
#             except ValueError:
#                 continue
    
#     return dates

# def extract_provider(text: str) -> Dict:
#     """
#     Extrait le nom du prestataire avec un score de confiance
#     """
#     best_match = {"provider": None, "score": 0, "original": None}
    
#     # Normalise le texte
#     text_upper = text.upper()
    
#     for provider in KNOWN_PROVIDERS:
#         # Recherche exacte
#         if provider in text_upper:
#             score = 95
#             # Bonus si trouvé près de mots clés
#             context = text_upper[max(0, text_upper.find(provider)-30):text_upper.find(provider)+30]
#             if any(keyword in context for keyword in ["FACTURE", "SOCIETE", "ENTREPRISE"]):
#                 score += 5
#             if score > best_match["score"]:
#                 best_match = {
#                     "provider": provider,
#                     "score": score,
#                     "original": provider
#                 }
#         else:
#             # Recherche fuzzy pour les variations possibles
#             words = text_upper.split()
#             for word in words:
#                 ratio = fuzz.ratio(provider, word)
#                 if ratio > 80 and ratio/100*95 > best_match["score"]:
#                     best_match = {
#                         "provider": provider,
#                         "score": ratio/100*95,
#                         "original": word
#                     }
    
#     return best_match

# def extract_rcs(text: str) -> Dict:
#     """
#     Extrait le numéro RCS avec un score de confiance
#     """
#     # Pattern pour RCS: "RCS" suivi de ville et numéro
#     rcs_pattern = r'\bRCS\s+([A-Z]+\s+)?(\d{3}\s*\d{3}\s*\d{3})\b'
    
#     matches = re.finditer(rcs_pattern, text.upper())
#     best_match = {"rcs": None, "score": 0, "original": None}
    
#     for match in matches:
#         score = 90  # Score de base pour un format valide
        
#         # Vérifie le contexte pour ajuster le score
#         context = text[max(0, match.start()-20):match.end()+20].upper()
#         if "SIRET" in context or "SIREN" in context:
#             score += 5
#         if "SOCIETE" in context or "ENTREPRISE" in context:
#             score += 3
        
#         rcs_number = match.group(2).replace(" ", "")
#         if len(rcs_number) == 9:  # Longueur correcte
#             score += 2
        
#         if score > best_match["score"]:
#             best_match = {
#                 "rcs": rcs_number,
#                 "score": min(score, 100),
#                 "original": match.group(0)
#             }
    
#     return best_match

# def extract_siret(text: str) -> Dict:
#     """
#     Extrait le numéro SIRET avec un score de confiance
#     """
#     # Pattern pour SIRET: 14 chiffres, possiblement espacés
#     siret_pattern = r'\b(?:SIRET\s*:?\s*)?(\d{3}\s*\d{3}\s*\d{3}\s*\d{5})\b'
    
#     matches = re.finditer(siret_pattern, text.upper())
#     best_match = {"siret": None, "score": 0, "original": None}
    
#     for match in matches:
#         score = 85  # Score de base pour un format valide
        
#         # Vérifie le contexte pour ajuster le score
#         context = text[max(0, match.start()-20):match.end()+20].upper()
#         if "SIRET" in context:
#             score += 10
#         if "RCS" in context or "SIREN" in context:
#             score += 5
        
#         siret_number = match.group(1).replace(" ", "")
#         if len(siret_number) == 14:  # Longueur correcte
#             score += 5
        
#         if score > best_match["score"]:
#             best_match = {
#                 "siret": siret_number,
#                 "score": min(score, 100),
#                 "original": match.group(0)
#             }
    
#     return best_match

# def extract_waste_type(text: str) -> List[Dict]:
#     """
#     Extrait les types de déchets avec des scores de confiance
#     """
#     found_types = []
#     text_upper = text.upper()
    
#     # Recherche exacte et fuzzy pour chaque type de déchet connu
#     for waste_type in KNOWN_WASTE_TYPES:
#         # Recherche exacte
#         if waste_type in text_upper:
#             score = 90
#             context = text_upper[max(0, text_upper.find(waste_type)-30):text_upper.find(waste_type)+30]
            
#             # Bonus de score pour le contexte
#             if "DECHETS" in context or "COLLECTE" in context:
#                 score += 5
#             if "TYPE" in context or "NATURE" in context:
#                 score += 3
                
#             found_types.append({
#                 "waste_type": waste_type,
#                 "score": min(score, 100),
#                 "original": waste_type
#             })
#         else:
#             # Recherche fuzzy pour les variations
#             words = text_upper.split()
#             for word in words:
#                 ratio = fuzz.ratio(waste_type, word)
#                 if ratio > 80:
#                     found_types.append({
#                         "waste_type": waste_type,
#                         "score": ratio/100*90,
#                         "original": word
#                     })
    
#     # Trie par score et élimine les doublons
#     found_types.sort(key=lambda x: x["score"], reverse=True)
#     unique_types = []
#     seen = set()
#     for item in found_types:
#         if item["waste_type"] not in seen:
#             unique_types.append(item)
#             seen.add(item["waste_type"])
    
#     return unique_types

# def extract_all_info(text: str) -> Dict:
#     """
#     Extrait toutes les informations avec leurs scores
#     """
#     return {
#         "dates": extract_dates(text),
#         "provider": extract_provider(text),
#         "rcs": extract_rcs(text),
#         "siret": extract_siret(text),
#         "waste_types": extract_waste_type(text)
#     } 