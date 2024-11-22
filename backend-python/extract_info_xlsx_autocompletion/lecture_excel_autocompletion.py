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
            "fulladdress": address,
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

    path = os.path.join(os.getcwd(), "extract_info_xlsx_autocompletion", "wienerberger_table_parametrage_3.xlsx")
    df = pd.read_excel(path, sheet_name="Template_App")
    df.columns = df.iloc[6]
    df = df.iloc[7:]
    df = df.ffill().infer_objects(copy=False)
    df = df.replace({np.nan: None})
    df = df.where(pd.notna(df), None)

    dechet_cond = dechet is not None
    filiere_cond = filiere is not None
    site_cond = site is not None

    print(site, filiere, dechet)
    if (dechet_cond and filiere_cond and site_cond):
        df_result = df[ (df["site_nom"]==site) & (df["filiere_nom"]==filiere) & (df["ced"]==dechet)]
    elif (site_cond and filiere_cond):
        df_result = df[ (df["site_nom"]==site) & (df["filiere_nom"]==filiere)]
    elif (site_cond):
        df_result = df[df["site_nom"]==site]
    else:
        print("Aucune condition remplie")
        return None

    options_filieres = list(df_result["filiere_nom"].unique())
    first_filiere = options_filieres[0]
    if filiere_cond and site_cond and not(dechet_cond):
        options_filieres = list(df[df["site_nom"]==site]["filiere_nom"].unique())
        first_filiere = filiere
    
    options_ced = list(df_result["ced"].unique())
    options_description = list(df_result["description_ced"].unique())
    options_ced_description = [{"ced":x,"description": y} for x, y in zip(options_ced, options_description)]
    print("options_ced_description", options_ced_description)
    first_ced_description = options_ced_description[0]

    options_contenant_nom = list(df_result["contenant_nom"].unique())
    options_contenant_code = list(df_result["contenant_code"].unique())
    options_contenant_volume = list(df_result["contenant_volume_unitaire"].unique())
    options_contenant_nombre = list(df_result["contenant_nombre_indicatif"].unique())
    options_contenant_proprio_ou_location = list(df_result["contenant_proprio_ou_location"].unique())
    options_contenant = [{"nom":x,"code": y,"volume": z,"nombre": w,"proprio_ou_location": v} for x, y, z, w, v in zip(options_contenant_nom, options_contenant_code, options_contenant_volume, options_contenant_nombre, options_contenant_proprio_ou_location)]
    first_contenant_nom = options_contenant_nom[0]
    first_contenant_code = options_contenant_code[0]
    first_contenant_volume = options_contenant_volume[0]
    first_contenant_nombre = options_contenant_nombre[0]
    first_contenant_proprio_ou_location = options_contenant_proprio_ou_location[0]
    options_adresse_collecte = list(df_result["site_adresse"].unique())
    first_adresse_collecte = options_adresse_collecte[0]
    options_sites = list(df["site_nom"].unique())

    options_personnes_nom = list(df_result["producteur_personne_lastname"].unique())
    options_personnes_prenom = list(df_result["producteur_personne_firstname"].unique())
    options_personnes_tel = list(df_result["producteur_personne_tel"].unique())
    options_personnes_email = list(df_result["producteur_personne_email"].unique())

    options_personne = [{"nom":x,"prenom": y,"tel": z,"email": w} for x, y, z, w in zip(options_personnes_nom, options_personnes_prenom, options_personnes_tel, options_personnes_email)]
    first_personne = options_personne[0]

    options_prestataire_final_personne_lastname = list(df_result["prestataire_final_personne_lastname"].unique())
    options_prestataire_final_personne_firstname = list(df_result["prestataire_final_personne_firstname"].unique())
    options_prestataire_final_personne_tel = list(df_result["prestataire_final_personne_tel"].unique())
    options_prestataire_final_personne_email = list(df_result["prestataire_final_personne_email"].unique())
    options_prestataire_final_personne = [{"nom":x,"prenom": y,"tel": z,"email": w} for x, y, z, w in zip(options_prestataire_final_personne_lastname, options_prestataire_final_personne_firstname, options_prestataire_final_personne_tel, options_prestataire_final_personne_email)]
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
                "code": first_contenant_code,
                "volume": first_contenant_volume,
                "nombre": first_contenant_nombre,
                "proprio_ou_location": first_contenant_proprio_ou_location
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
                    "nom": df_result["transporteur_personne_lastname"].iloc[0],
                    "prenom": df_result["transporteur_personne_firstname"].iloc[0],
                    "email": df_result["transporteur_personne_email"].iloc[0],
                    "tel": df_result["transporteur_personne_tel"].iloc[0]
                }
            },
            "options": {
                "siret": list(df_result["transporteur_siret"].unique()),
                "nom": list(df_result["transporteur_nom"].unique()),
                "adresse": list(df_result["transporteur_adresse"].unique()),
                "personne": {
                    "nom": list(df_result["transporteur_personne_lastname"].unique()),
                    "prenom": list(df_result["transporteur_personne_firstname"].unique()),
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



def data_from_excel(userId: str, site: str, filiere: str, dechet: str):
    print('dechet', dechet)
    
    path = os.path.join(os.getcwd(), "extract_info_xlsx_autocompletion", "wienerberger_table_parametrage_3.xlsx")
    df = pd.read_excel(path, sheet_name="template_code")
    df.columns = df.iloc[6]
    df = df.iloc[7:]
    df = df.ffill().infer_objects(copy=False) #Recent change !!
    df = df.replace({np.nan: None})
    df = df.where(pd.notna(df), None)

    dechet_cond = dechet is not None
    filiere_cond = filiere is not None
    site_cond = site is not None

    print(site, filiere, dechet)
    if (dechet_cond and filiere_cond and site_cond):
        df_result = df[ (df["site_nom"]==site) & (df["filiere_nom"]==filiere) & (df["ced"]==dechet)]

    elif (site_cond and filiere_cond):
        df_result = df[ (df["site_nom"]==site) & (df["filiere_nom"]==filiere)]
    elif (site_cond):
        df_result = df[df["site_nom"]==site]
    else:
        print("Aucune condition remplie")
        return None

    dic = {
        "site":["site_nom","site_siret","site_adresse","site_gerep"], 
        "filiere":["filiere_nom","ced","description_ced","denomination_ced","consistance","cap"], 
        "dechet_dangereux":["ced","onu","onu_denomination","classe_de_danger","groupe_emballage","adresse_collecte"], 
        "producteur_personne":["producteur_personne_lastname","producteur_personne_firstname","producteur_personne_tel","producteur_personne_email"],
        "operationnelle_personne":["operationelle_personne_lastname","operationelle_personne_firstname","operationelle_personne_tel","operationelle_personne_email"],
        "contenant":["contenant_nom","contenant_code","contenant_identifiant","contenant_description","contenant_volume_unitaire","contenant_nombre_indicatif","contenant_proprio_ou_location","contenant_prestataire_nom","contenant_prestataire_siret"],
        "eco_organisme":["eco_organisme_nom","eco_organisme_siret"],
        "negociant":["negociant_nom","negociant_siret","negociant_adresse","negociant_recipisse_numero","negociant_personne_lastname","negociant_personne_firstname","negociant_personne_tel","negociant_personne_email","negociant_personne_collecte_lastname","negociant_personne_collecte_firstname","negociant_personne_collecte_tel","negociant_personne_collecte_email"],
        "transporteur":["transporteur_nom","transporteur_siret","transporteur_adresse","transporteur_recipisse_numero","transporteur_personne_lastname","transporteur_personne_firstname","transporteur_personne_tel","transporteur_personne_email","transporteur_personne_collecte_lastname","transporteur_personne_collecte_firstname","transporteur_personne_collecte_tel","transporteur_personne_collecte_email"],
        "installation_intermediaire":["Installation_intermediaire_nom","Installation_intermediaire_siret","Installation_intermediaire_adresse","Installation_intermediaire_recipisse_numero","Installation_intermediaire_code_traitement","Installation_intermediaire_personne_lastname","Installation_intermediaire_personne_firstname","Installation_intermediaire_personne_tel","Installation_intermediaire_personne_email"],
        "prestataire_final":["prestataire_final_nom","prestataire_final_siret","prestataire_final_adresse","prestataire_final_recipisse_numero","prestataire_final_code_traitement","prestataire_final_traitement_qualification","prestataire_final_personne_lastname","prestataire_final_personne_firstname","prestataire_final_personne_tel","prestataire_final_personne_email"]
    }

    options_dict = {}
    for key, columns in dic.items():
        values = [list(df_result[col].unique()) for col in columns]
        
        # Créer un dictionnaire intermédiaire pour regrouper par champ
        field_dict = {}
        
        # Traiter options (toutes les valeurs uniques)
        for col, vals in zip(columns, values):
            field_name = col.split('_')[-1]
            if field_name not in field_dict:
                field_dict[field_name] = {
                    'options': vals,
                    'first': df_result[col].iloc[0] if len(df_result) > 0 else None
                }
        
        options_dict[key] = field_dict

    
    for key in options_dict.keys():
        if key == "site":
            options_dict[key]["adresse"]["first"] = parse_address(options_dict[key]["adresse"]["first"])

###################### juste pour filiere et site
    # Site
    noms_site, sirets, addresses, gereps = list(df["site_nom"].unique()), list(df["site_siret"].unique()), list(df["site_adresse"].unique()), list(df["site_gerep"].unique())
    #options_sites = [{"nom":x,"siret": y,"adresse": z,"gerep": w} for x, y, z, w in zip(noms, sirets, addresses, gereps)]

    # Filiere
    noms_filiere, ceds, description_ceds, denomination_ceds, consistances, caps = list(df["filiere_nom"].unique()), list(df["ced"].unique()), list(df["description_ced"].unique()), list(df["denomination_ced"].unique()), list(df["consistance"].unique()), list(df["cap"].unique())
    #options_filieres = [{"nom":x,"ced": y,"description": z,"denomination": w,"consistance": v,"cap": u} for x, y, z, w, v, u in zip(noms_filiere, ceds, description_ceds, denomination_ceds, consistances, caps)]

    options_dict["site"]["nom"]["options"] = noms_site
    options_dict["filiere"]["nom"]["options"] = noms_filiere

######################
    # Ajout de date de collecte pour plus tard
    options_dict["date"] = {"collecte":{"first": ''}}

    #result = convert_numpy_types(options_dict)
    print('---------', convert_numpy_types(options_dict["site"]["nom"]["options"]))
    #return result
    return convert_numpy_types(options_dict)



"""
    options_filieres = list(df_result["filiere_nom"].unique())
    first_filiere = options_filieres[0]
    if filiere_cond and site_cond and not(dechet_cond):
        options_filieres = list(df[df["site_nom"]==site]["filiere_nom"].unique())
        first_filiere = filiere
    
    options_ced = list(df_result["ced"].unique())
    options_description = list(df_result["description_ced"].unique())
    options_ced_description = [{"ced":x,"description": y} for x, y in zip(options_ced, options_description)]
    print("options_ced_description", options_ced_description)
    first_ced_description = options_ced_description[0]
"""


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

"""
    # Site
    noms, sirets, addresses, gereps = list(df["site_nom"].unique()), list(df["site_siret"].unique()), list(df["site_adresse"].unique()), list(df["site_gerep"].unique())
    options_sites = [{"nom":x,"siret": y,"adresse": z,"gerep": w} for x, y, z, w in zip(noms, sirets, addresses, gereps)]
    first_site = options_sites[0]

    # Filiere
    noms, ceds, description_ceds, denomination_ceds, consistances, caps = list(df["filiere_nom"].unique()), list(df["ced"].unique()), list(df["description_ced"].unique()), list(df["denomination_ced"].unique()), list(df["consistance"].unique()), list(df["cap"].unique())
    options_filieres = [{"nom":x,"ced": y,"description": z,"denomination": w,"consistance": v,"cap": u} for x, y, z, w, v, u in zip(noms, ceds, description_ceds, denomination_ceds, consistances, caps)]
    first_filiere = options_filieres[0]

    # Déchet dangereux
    adrs, onus, onu_denominations, classe_de_dangers, groupe_emballages, adresse_collectes = list(df["ced"].unique()), list(df["onu"].unique()), list(df["onu_denomination"].unique()), list(df["classe_de_danger"].unique()), list(df["groupe_emballage"].unique()), list(df["adresse_collecte"].unique())
    options_dechets_dangereux = [{"ced":x,"onu": y,"onu_denomination": z,"classe_de_danger": v,"groupe_emballage": w,"adresse_collecte": u} for x, y, z, v, w, u in zip(adrs, onus, onu_denominations, classe_de_dangers, groupe_emballages, adresse_collectes)]
    first_dechet_dangereux = options_dechets_dangereux[0]
"""


