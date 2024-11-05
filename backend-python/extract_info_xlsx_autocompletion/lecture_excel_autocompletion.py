import pandas as pd
import os
import numpy as np
import re

def parse_address(address):
    # Expression régulière pour détecter les parties de l'adresse avec le code postal
    match = re.match(r"^(.*)\s(\d{5})\s(.*)$", address)
    if match:
        street = match.group(1).strip()  # Ce qui précède le code postal (numéro et nom de rue)
        postal_code = match.group(2)     # Le code postal à 5 chiffres
        city = match.group(3).strip()    # Ce qui suit le code postal (la ville)
        
        return {
            "street": street,
            "postal_code": postal_code,
            "city": city
        }
    else:
        print("L'adresse ne correspond pas au format attendu.")
        return None

"""
def get_table_from_excel(userId: str, site: str, filiere: str, dechet: str):
    path = os.path.join(os.getcwd(), "extract_info_xlsx_autocompletion", "wienerberger_table_parametrage.xlsx")
    
    # Lecture des informations de base
    df_info = pd.read_excel(path, sheet_name="Site N°2")
    nom_site = df_info.iloc[2, 2]
    siret = df_info.iloc[2, 7]
    adresse_site = df_info.iloc[2, 10]

    # Lecture du DataFrame principal avec les en-têtes
    df = pd.read_excel(path, sheet_name="Site N°1", header=[5, 6])
    df = df.iloc[:, 1:]  # Supprimer la première colonne
    
    # Forward fill pour les cellules vides
    df = df.ffill()

    # Remplacer les NaN par None avant la conversion en dictionnaire
    df = df.replace({np.nan: None})
    
    # Pour les valeurs numériques NaN spécifiquement
    df = df.where(pd.notna(df), None)

    col_filiere = ('Filières de déchets', 'Nom usuel de la filière')
    col_ced = ('Filières de déchets', 'Code CED inclus dans la filières')
    col_description_ced = ('Filières de déchets', 'Description déchet')

    options_filieres = list(df[col_filiere].unique())
    
    first_filiere = filiere if filiere is not None else options_filieres[0]
    

    options_ced = list(df[df[col_filiere]==first_filiere][col_ced].unique())
    options_description = list(df[df[col_filiere]==first_filiere][col_description_ced].unique()) ##on croise les doigts pour que ce soit bijectif
    options_ced_description = [{"ced":x,"description": y} for x, y in zip(options_ced, options_description)]
    
    first_ced_description = dechet if dechet is not None else options_ced_description[0]

    options = df[df[col_ced]==first_ced_description["ced"]]

    col_contenant_nom = ('Contenants', 'Nom usuel du contenant')
    col_contenant_volume = ('Contenants', 'Volume unitaire du contenant')
    col_contenant_nombre = ('Contenants', 'Nombre de contenants (information indicative)')

    options_contenant_nom = list(options[col_contenant_nom].unique())
    options_contenant_volume = list(options[col_contenant_volume].unique())
    options_contenant_nombre = list(options[col_contenant_nombre].unique())
    options_contenant = [{"nom":x,"volume": y,"nombre": z} for x, y, z in zip(options_contenant_nom, options_contenant_volume, options_contenant_nombre)]

    first_contenant_nom = options_contenant_nom[0]
    first_contenant_volume = options_contenant_volume[0]
    first_contenant_nombre = options_contenant_nombre[0]

    adresse_collecte = adresse_site

    #def clean_value(value):
    #    if pd.isna(value) or value is np.nan:
    #         return None
    #     return value

    result = {
        "filiere": {    
            "first": first_filiere,
            "options": options_filieres
        },
        "dechet": {
            "first": {
                "ced": first_ced_description["ced"],
                "description": first_ced_description["description"]
            },
            "options": options_ced_description
        },
        "contenant": {
            "first": {
                "nom": first_contenant_nom,
                "volume": first_contenant_volume,
                "nombre": first_contenant_nombre
            },
            "options": options_contenant
        },
        "adresse_collecte": adresse_collecte
    }

    return result

    ## Format du formulaire 
    # filiere
    # dechet (ced, description)
    # contenant (nom, volume, nombre)
    # site
    # adresse_collecte (rue, code_postal, ville, pays) -> final juste string
    # personne (nom, prenom,telephone, email)  => dire à auguste de faire mieux (meme nom de colonne, j'ai besoin que tout soit unique sur 2 ligne max, et faire des mot plus court et aucune faute et pas d'espace inutile)
    ## mail
    # destinataire
    # cc []
    # sujet
    # message

"""

def convert_numpy_types(obj):
    if isinstance(obj, (np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.float64, np.float32)):
        return float(obj)
    elif isinstance(obj, dict):
        return {key: convert_numpy_types(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_types(item) for item in obj]
    return obj

def info_completion_from_excel(userId: str, site: str, filiere: str, dechet: str):

    path = os.path.join(os.getcwd(), "extract_info_xlsx_autocompletion", "wienerberger_table_parametrage_2.xlsx")
    df = pd.read_excel(path, sheet_name="Template_App")
    df.columns = df.iloc[6]
    df = df.iloc[7:]
    df = df.ffill()
    df = df.replace({np.nan: None})
    df = df.where(pd.notna(df), None)

    dechet_cond = dechet is not None
    filiere_cond = filiere is not None
    site_cond = site is not None

    print(site, filiere, dechet)
    if (dechet_cond and filiere_cond and site_cond):
        df_result = df[ (df["site_nom"]==site) & (df["filieres_nom"]==filiere) & (df["ced"]==dechet)]
    elif (site_cond and filiere_cond):
        df_result = df[ (df["site_nom"]==site) & (df["filieres_nom"]==filiere)]
    elif (site_cond):
        df_result = df[df["site_nom"]==site]
    else:
        print("Aucune condition remplie")
        return None

    options_filieres = list(df_result["filieres_nom"].unique())
    first_filiere = options_filieres[0]
    if filiere_cond and site_cond and not(dechet_cond):
        options_filieres = list(df[df["site_nom"]==site]["filieres_nom"].unique())
        first_filiere = filiere
    
    options_ced = list(df_result["ced"].unique())
    options_description = list(df_result["description_ced"].unique())
    options_ced_description = [{"ced":x,"description": y} for x, y in zip(options_ced, options_description)]
    print("options_ced_description", options_ced_description)
    first_ced_description = options_ced_description[0]

    options_contenant_nom = list(df_result["contenant_nom"].unique())
    options_contenant_volume = list(df_result["contenant_volume_unitaire"].unique())
    options_contenant_nombre = list(df_result["contenant_nombre_indicatif"].unique())
    options_contenant = [{"nom":x,"volume": y,"nombre": z} for x, y, z in zip(options_contenant_nom, options_contenant_volume, options_contenant_nombre)]
    first_contenant_nom = options_contenant_nom[0]
    first_contenant_volume = options_contenant_volume[0]
    first_contenant_nombre = options_contenant_nombre[0]

    options_adresse_collecte = list(df_result["site_adresse"].unique())
    first_adresse_collecte = options_adresse_collecte[0]
    options_sites = list(df["site_nom"].unique())

    options_personnes_nom = list(df_result["producteur_personne_nom"].unique())
    options_personnes_prenom = list(df_result["producteur_personne_prenom"].unique())
    options_personnes_tel = list(df_result["producteur_personne_tel"].unique())
    options_personnes_email = list(df_result["producteur_personne_email"].unique())

    options_personne = [{"nom":x,"prenom": y,"tel": z,"email": w} for x, y, z, w in zip(options_personnes_nom, options_personnes_prenom, options_personnes_tel, options_personnes_email)]
    first_personne = options_personne[0]

    options_prestataire_final_personne_nom = list(df_result["prestataire_final_personne_nom"].unique())
    options_prestataire_final_personne_prenom = list(df_result["prestataire_final_personne_prenom"].unique())
    options_prestataire_final_personne_tel = list(df_result["prestataire_final_personne_tel"].unique())
    options_prestataire_final_personne_email = list(df_result["prestataire_final_personne_email"].unique())
    options_prestataire_final_personne = [{"nom":x,"prenom": y,"tel": z,"email": w} for x, y, z, w in zip(options_prestataire_final_personne_nom, options_prestataire_final_personne_prenom, options_prestataire_final_personne_tel, options_prestataire_final_personne_email)]
    first_prestataire_final_personne = options_prestataire_final_personne[0]


    result = {
        "site": {
            "first": {
                "nom" : site,
                "adresse": {
                    "street": parse_address(df_result["site_adresse"].iloc[0])["street"],
                    "postal_code": parse_address(df_result["site_adresse"].iloc[0])["postal_code"],
                    "city": parse_address(df_result["site_adresse"].iloc[0])["city"]
                },
                "siret": df_result["site_siret"].iloc[0],
            },
            "options": {
                "nom": [x for x in list(df["site_nom"].unique())],
                "adresse": {
                    "street": [parse_address(x)["street"] for x in list(df["site_adresse"].unique())],
                    "postal_code": [parse_address(x)["postal_code"] for x in list(df["site_adresse"].unique())],
                    "city": [parse_address(x)["city"] for x in list(df["site_adresse"].unique())]
                },
                "siret": list(df["site_siret"].unique()),
            }
        },
        "filiere": {    
            "first": first_filiere,
            "options": options_filieres
        },
        "dechet": {
            "first": {
                "ced": first_ced_description["ced"],
                "description": first_ced_description["description"]
            },
            "options": options_ced_description
        },
        "contenant": {
            "first": {
                "nom": first_contenant_nom,
                "volume": first_contenant_volume,
                "nombre": first_contenant_nombre
            },
            "options": options_contenant
        },
        "adresse_collecte": {
            "first": first_adresse_collecte,
            "options": options_adresse_collecte
        },
        "personne_producteur": {
            "first": first_personne,
            "options": options_personne
        },
        "prestataire_final": {
            "first": {
                "code_traitement": df_result["prestataire_final_code_traitement"].iloc[0],
                "cap": df_result["cap"].iloc[0],
                "siret": df_result["prestataire_final_siret"].iloc[0],
                "nom": df_result["prestataire_final_nom"].iloc[0],
                "adresse": df_result["prestataire_final_adresse"].iloc[0],
                "personne": first_prestataire_final_personne
            },
            "options": {
                "code_traitement": list(df_result["prestataire_final_code_traitement"].unique()),
                "cap": list(df_result["cap"].unique()),
                "siret": list(df_result["prestataire_final_siret"].unique()),
                "nom": list(df_result["prestataire_final_nom"].unique()),
                "adresse": list(df_result["prestataire_final_adresse"].unique()),
                "personne": options_prestataire_final_personne
            }
        },
        "transporteur": {
            "first": {
                "siret": df_result["transporteur_siret"].iloc[0],
                "nom": df_result["transporteur_nom"].iloc[0],
                "adresse": df_result["transporteur_adresse"].iloc[0],
                "personne": {
                    "nom": df_result["transporteur_personne_nom"].iloc[0],
                    "prenom": df_result["transporteur_personne_prenom"].iloc[0],
                    "email": df_result["transporteur_personne_email"].iloc[0],
                    "tel": df_result["transporteur_personne_tel"].iloc[0]
                }
            },
            "options": {
                "siret": list(df_result["transporteur_siret"].unique()),
                "nom": list(df_result["transporteur_nom"].unique()),
                "adresse": list(df_result["transporteur_adresse"].unique()),
                "personne": {
                    "nom": list(df_result["transporteur_personne_nom"].unique()),
                    "prenom": list(df_result["transporteur_personne_prenom"].unique()),
                    "email": list(df_result["transporteur_personne_email"].unique()),
                    "tel": list(df_result["transporteur_personne_tel"].unique())
                }
            }
        },
        "dechet_details": {
            "first": {
                "ced": df_result["ced"].iloc[0],
                "onu": df_result["onu"].iloc[0],
                "description": df_result["description_ced"].iloc[0]
            },
            "options": {
                "ced": list(df_result["ced"].unique()),
                "onu": list(df_result["onu"].unique()),
                "description": list(df_result["description_ced"].unique())
            }
        }
    }
    
    # Convert numpy types before returning
    result = convert_numpy_types(result)
    return result


"""  
filiere: string;
    dechet: {
        ced: string;
        description: string;
    };
    contenant: {
        nom: string;
        volume: string;
        nombre: string;
    };
    site: string;
    adresse_collecte: string;
    personne: {
        nom: string;
        prenom: string;
        telephone: string;
        email: string;
    };
    mail: {
        destinataire: string;
        cc: string[];
        sujet: string;
        message: string;
    };
"""
