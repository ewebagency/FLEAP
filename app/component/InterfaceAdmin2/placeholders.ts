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
        dechet_et_conditionnement : {
            code_ced : "Code CED",
            dechet_dangereux_facultatif : {
                code_adr : "ADR",
                code_onu : "Code ONU"
            },
            contenant : {
                nom_contenant : "Nom contenant",
                nombre_contenant : 0,
                reference_contenant : "Reference contenant",
                volume_unitaire_contenant : 0,
            },
            quantite : {
                collectee : 0,
                reception : 0
            }
        },
        acteurs : {
            site_emeteur : {
                siret : "SIRET site emetteur",
                adresse_collecte : "Adresse collecte",
                personne_de_reference : {
                    prenom_nom : "Prénom Nom",
                    tel : "06 00 00 00 00",
                    mail : "mail@mail.com"
                },
            },
            transporteurs : [
                {
                    siret : "SIRET",
                    num_recepisse : "Nunméro récépissé",
                    personne_de_reference : {
                        prenom_nom : "Prénom Nom",
                        tel : "06 00 00 00 00",
                        mail : "mail@mail.com"
                    },
                    date_de_prise_en_charge : "JJ/MM/AAAA",
                    mode_de_transport : "Mode de transport",
                    immatriculation : "Immatriculation"
                }
            ],
            traitement : {
                siret : "SIRET",
                num_recepisse : "Nunméro récépissé",
                num_cap : "Numéro CAP",
                personne_de_reference : {
                    prenom_nom : "Prénom Nom",
                    tel : "06 00 00 00 00",
                    mail : "mail@mail.com"
                },
                date_de_presentation : "JJ/MM/AAAA",
                accepte_refuse : "Accepté/Refusé",
                motif_de_refus : "Motif de refus/RAS",
                code_d_r : "Code D/R",
                date_traitement : "JJ/MM/AAAA"
            }
        },
    }
};
