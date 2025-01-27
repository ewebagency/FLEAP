export const jsonDefaultData = {
    facture_form: {
        header: {
            prestataire_nom: "Nom du prestataire",
        },
        footer: {
            total_ht: 0,
        },
        departs: [
            {
                line_header: {
                    type_dechet: "Type de déchet",
                    code_dechet: "Code CED si possible",
                    date_collecte: "JJ/MM/AAAA",
                    lieu_collecte: "Lieu de collecte",
                },
                line_body: [
                    { type_operation: "préparation", montant_ht: 0 },
                    { type_operation: "transport", montant_ht: 0 },
                    { type_operation: "traitement", montant_ht: 0 },
                    { type_operation: "gestion globale", montant_ht: 0 },
                    { type_operation: "TGAP", montant_ht: 0 },
                    { type_operation: "déclassement", montant_ht: 0 },
                    { type_operation: "rachat", montant_ht: 0, is_expanded: true },
                    { type_operation: "contenant", montant_ht: 0, is_expanded: true },
                    { type_operation: "non expliqué", montant_ht: 0, is_expanded: true }
                ]
            }
        ],
    },
    bsd_formulaire: {
        "formData": {
            "date": {
                "collecte": {
                    "first": ""
                }
            },
            "site": {
                "nom": {
                    "first": "Usine Achenheim"
                },
                "gouv": {
                    "raison": {
                        "first": "WIENERBERGER"
                    },
                    "adresse": {
                        "first": "5 RUE DU CANAL 67204 ACHENHEIM"
                    }
                },
                "gerep": {
                    "first": null
                },
                "siret": {
                    "first": 54850098200044
                },
                "adresse": {
                    "first": {
                        "city": "Achenheim",
                        "street": "5 rue du Canal",
                        "fulladdress": "5 rue du Canal 67204 Achenheim",
                        "postal_code": "67204"
                    }
                }
            },
            "volume": {
                "first": 5000
            },
            "filiere": {
                "cap": {
                    "first": "WEE2838942"
                },
                "ced": {
                    "first": "16 05 04*"
                },
                "nom": {
                    "first": "Aérosols et Gaz"
                },
                "consistance": {
                    "first": "Liquide"
                }
            },
            "contenant": {
                "nom": {
                    "first": "GRV"
                },
                "code": {
                    "first": "GRV"
                },
                "gouv": {
                    "raison": {
                        "first": ""
                    },
                    "adresse": {
                        "first": ""
                    }
                },
                "siret": {
                    "first": null
                },
                "location": {
                    "first": "Propriétaire"
                },
                "unitaire": {
                    "first": "1000L"
                },
                "indicatif": {
                    "first": 5
                },
                "description": {
                    "first": "Grand Récipient Pour Vrac"
                },
                "identifiant": {
                    "first": null
                }
            },
            "negociant": {
                "nom": {
                    "first": null
                },
                "tel": {
                    "first": null
                },
                "gouv": {
                    "raison": {
                        "first": ""
                    },
                    "adresse": {
                        "first": ""
                    }
                },
                "email": {
                    "first": null
                },
                "siret": {
                    "first": null
                },
                "numero": {
                    "first": null
                },
                "adresse": {
                    "first": null
                },
                "lastname": {
                    "first": null
                },
                "firstname": {
                    "first": null
                }
            },
            "transporteur": {
                "nom": {
                    "first": "Chimirec Est"
                },
                "tel": {
                    "first": "05 44 44 44 44"
                },
                "gouv": {
                    "raison": {
                        "first": "CHIMIREC-EST"
                    },
                    "adresse": {
                        "first": "ZI LA HAIE SORETTE 54450 DOMJEVIN"
                    }
                },
                "email": {
                    "first": "l.c@transpo.fr"
                },
                "siret": {
                    "first": 39933934000016
                },
                "numero": {
                    "first": "TR547592024"
                },
                "adresse": {
                    "first": "ZI La Haie Sorette 54450 Domjevin"
                },
                "lastname": {
                    "first": "Camion"
                },
                "firstname": {
                    "first": "Luc"
                }
            },
            "eco_organisme": {
                "nom": {
                    "first": "non concerné"
                },
                "gouv": {
                    "raison": {
                        "first": ""
                    },
                    "adresse": {
                        "first": ""
                    }
                },
                "siret": {
                    "first": "non concerné"
                }
            },
            "dechet_dangereux": {
                "ced": {
                    "first": "16 05 04*"
                },
                "onu": {
                    "first": 1789
                },
                "danger": {
                    "first": 7
                },
                "collecte": {
                    "first": null
                },
                "emballage": {
                    "first": "II"
                },
                "denomination": {
                    "first": "acide chlorhydrique"
                }
            },
            "estimated_weight": {
                "first": 5
            },
            "prestataire_final": {
                "nom": {
                    "first": "Autorisation par arrêté préfectoral, à une rupture de traçabilité pour ce déchet"
                },
                "tel": {
                    "first": "87 56 76 87 98"
                },
                "gouv": {
                    "raison": {
                        "first": ""
                    },
                    "adresse": {
                        "first": ""
                    }
                },
                "email": {
                    "first": "lepoint@outlook.fr"
                },
                "siret": {
                    "first": null
                },
                "numero": {
                    "first": null
                },
                "adresse": {
                    "first": null
                },
                "lastname": {
                    "first": "Lepoint"
                },
                "firstname": {
                    "first": "Martin"
                },
                "traitement": {
                    "first": "R4"
                },
                "qualification": {
                    "first": "Recyclage"
                }
            },
            "producteur_personne": {
                "tel": {
                    "first": "06 12 33 76 40"
                },
                "email": {
                    "first": "laura.baumert@wienerberger.com"
                },
                "lastname": {
                    "first": "Baumert"
                },
                "firstname": {
                    "first": "Laura"
                }
            },
            "operationnelle_personne": {
                "tel": {
                    "first": "06 44 44 44 44"
                },
                "email": {
                    "first": "carinne.bauvier@wienerberger.com"
                },
                "lastname": {
                    "first": "Bauvier"
                },
                "firstname": {
                    "first": "Carinne"
                }
            },
            "installation_intermediaire": {
                "nom": {
                    "first": "Chimirec Est"
                },
                "tel": {
                    "first": "33 33 33 33 33"
                },
                "gouv": {
                    "raison": {
                        "first": ""
                    },
                    "adresse": {
                        "first": ""
                    }
                },
                "email": {
                    "first": "legrand@marcel.fr"
                },
                "siret": {
                    "first": "#############"
                },
                "numero": {
                    "first": null
                },
                "adresse": {
                    "first": "ZI La Haie Sorette 54450 Domjevin"
                },
                "lastname": {
                    "first": "Legrand"
                },
                "firstname": {
                    "first": "Marcel"
                },
                "traitement": {
                    "first": "R12"
                }
            }
        }
    }
};
