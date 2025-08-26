from utils_enrich import find_best_names_in_text, extract_entities_from_text

# Texte d'exemple (bon de pesée)
text = """
 sotraima Fax:
Email:Contact@sotraima.fr
SIRET4427926850002NAF 3811Z
10doDs 89510E
038686.5248 INTRACOM: FR24442792685
LE 21/07/2025 A 14:54
DSD No 16364
TICKET 23303601 DSD
CAMION : FQ 070 QB RECEPTION
CLIENT MICO MICHEL SAS
:
57 RUE GUYNEMER
B.P.347
89006AUXERRE CEDEX
CHANTIER .. CH23120008PRYSMIANGRON
PRODUIT .. DGRB DÉCHETSGRAVATSBÉTON
CODEDECHET .. 170101
N°DAP .. 2411051
CODE TRAITEMENTDECHET . R5
TRANSPORTEUR .. TPERSO VOUS MEME
LIEU .. GRON 89100
BON DE PESEE
PROVENANCE ..
LOCALISATIONDECHARGE .. BÉTON NONFERAILL SIGNATURE:
COMMANDE : GRATUIT
Tout chauffeur prenant livraison de matériaux est tenu de vérifier,lors
du passage sur la bascule,le poids de son chargement et de faire le
necessaire en cas de surcharge. Le chargeur décline toute
responsabilite en cas de depassement du poids total autorise du
véhicule ci-dessus vise
Ce bon de pesée ne tient pas lieu de facture.
BRUT: 34,780 T
TARE : 15,600 T
NET .. 19,180T
Heures d'ouvertures: 8h-12h/13h30-17h-du lundi au jeudiHeures d'ouvertures: 8h-12h/13h30-16h- le vendredi
"""

# Données connues au format attendu par utils_enrich.py
known_data = {
    'sites': [
        {'nom': 'FOYER ENFANCE AUXERRE', 'siret': '250055'},
        {'nom': 'ST SAVINIEN SENS', 'siret': '250056'},
        {'nom': 'LOGEMENTS GENDARMERIE CHABLIS', 'siret': '250057'},
        {'nom': 'CITE JUDICIAIRE NEVERS', 'siret': '250058'},
        {'nom': 'PRYSMIAN GRON', 'siret': '240048'},
        {'nom': "SENS GROUPE SCOLAIRE CHAMPS D'ALOUP", 'siret': '240049'},
        {'nom': 'TOUR LES ORMES SUR VOULZIE', 'siret': '240050'},
        {'nom': 'MOUVEX 2019', 'siret': '190096'},
        {'nom': 'ACCESSIBILITE COLLEGES JOIGNY', 'siret': '240051'},
        {'nom': 'COLLEGE MARIE NOEL JOIGNY', 'siret': '240052'},
    ],
    'prestataires': [
        {'nomBoite': 'MICHEL RECYCLAGE', 'nomPrenom': 'Contact Michel', 'siret': '51943737000017', 'email': 'contact@michel-recyclage.fr', 'adresse': 'Route de Chablis, 89290 VENOY'},
        {'nomBoite': 'MICHEL SAS', 'nomPrenom': 'Contact SAS', 'siret': '51943737000018', 'email': 'contact@michel-sas.fr', 'adresse': 'Route de Chablis, 89290 VENOY'},
        {'nomBoite': 'RECYCLAGE PLUS', 'nomPrenom': 'Contact Plus', 'siret': '51943737000019', 'email': 'contact@recyclage-plus.fr', 'adresse': 'Avenue du Recyclage, 89000 AUXERRE'},
        {'nomBoite': 'SOTRAIMA', 'nomPrenom': 'Contact SAS', 'siret': '51943737000018', 'email': 'contact@michel-sas.fr', 'adresse': 'Route de Chablis, 89290 VENOY'},
    ]
}

# Test avec les fonctions à la racine pour voir les scores
site_names = [site['nom'] for site in known_data['sites'] if site.get('nom')]
site_matches = find_best_names_in_text(text, site_names)

prestataire_names = [p['nomBoite'] for p in known_data['prestataires'] if p.get('nomBoite')]
prestataire_matches = find_best_names_in_text(text, prestataire_names)

print("Sites trouvés avec scores:")
for match in site_matches:
    print(f"- {match['name']}: {match['score']:.2f}")

print("\nPrestataires trouvés avec scores:")
for match in prestataire_matches:
    print(f"- {match['name']}: {match['score']:.2f}")