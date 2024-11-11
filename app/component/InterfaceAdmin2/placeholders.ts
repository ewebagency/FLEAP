export const jsonDefaultData = {
    facture_form : {
        header : {
            siret: "SIRET prestataire",
            personne_de_reference : {
                prenom_nom : "Prénom Nom",
                tel : "06 00 00 00 00",
                mail : "mail@mail.com"
            },
            date_debut : "JJ/MM/AAAA",
            date_fin : "JJ/MM/AAAA"
          },
        departs : [
            {
              infos_pour_filtrer : {
                description_adresse_site: "Adresse site",
                description_dechet : "Cartons",
                code_ced : "Code CED si possible",
                date_collecte : "JJ/MM/AAAA"
              },
              ligne_compta_contenant: {
                  titre: "Titre contenant",
                  quantite: 0,
                  unite: "nombre",
                  pu_net: 0,
                  montant_ht: 0,
                  tva: "20%"
              },
              ligne_compta_preparation : {
                titre: "Titre preparation",
                quantite: 0,
                unite: "tonnes",
                pu_net: 0,
                montant_ht: 0,
                tva: "20%"
              },
              ligne_compta_transport : {
                titre: "Titre transport",
                quantite: 0,
                unite: "tonnes",
                pu_net: 0,
                montant_ht: 0,
                tva: "20%"
              },
              ligne_compta_traitement : {
                titre: "Titre traitement",
                quantite: 0,
                unite: "tonnes",
                pu_net: 0,
                montant_ht: 0,
                tva: "20%"
              },
              ligne_compta_tgap : {
                titre: "Titre Tgap",
                quantite: 0,
                unite: "tonnes",
                pu_net: 0,
                montant_ht: 0,
                tva: "20%"
              },
              ligne_compta_rachat_matiere : {
                titre: "Titre rachat matiere",
                quantite: 0,
                unite: "tonnes",
                pu_net: 0,
                montant_ht: 0,
                tva: "20%"
              }
            }
          ],
        couts_non_expliques : {
            titre: "Titre couts non expliques",
            quantite: 0,
            unite: "tonnes",
            pu_net: 0,
            montant_ht: 0,
            tva: "20%"
          },
        couts_tarifaires : {
            titre: "Titre couts tarifaires",
            quantite: 0,
            unite: "tonnes",
            pu_net: 0,
            montant_ht: 0,
            tva: "20%"
          },
        couts_totaux : {
            total_ht: 0,
            montant_tva: 0,
            total_ttc : 0
          }
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
