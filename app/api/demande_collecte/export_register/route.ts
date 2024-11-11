import { supabase } from "@/app/database/supabaseClient";
import { BSD_Data_Interface_WithoutOptions } from "@/app/register/interface/BSD_Interface";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

interface BSD_Export_Interface {
    "Code déchet": string | number | null,
    "Nom du déchet": string | number | null,
    "Volume estimé": string | number | null,
    "Code de convention Bâle": string | number | null,
    "Date de collecte": string | number | null,
    "N° BSD": string | number | null,
    "N° TrackDéchet": string | number | null,
    "Date de confirmation par le transporteur": string,

    "Adresse de collecte": string | number | null,
    
    "N° Siret du Producteur": string | number | null,
    "Raison sociale du Producteur": string | number | null,
    "Adresse du siège social du Producteur": string | number | null,

    "N° SIRET du transporteur": string|number|null,
    "Raison sociale du transporteur": string | number | null,
    "N° de récipissé du transporteur": string | number | null,

    "N° SIRET du prestataire final": string |number | null,
    "Raison sociale du prestataire final": string |number | null,
    "Adresse du prestataire final": string | number | null,
    "N° de récipissé du prestataire final": string | number | null,
    "Qualification de traitement": string | number | null,
    "Code de traitement": string | number | null,
    
    "N° SIRET de l'installation intermédiaire": string | number | null,
    "Raison sociale de l'installation intermédiaire": string | number | null,
    "N° de récipissé de l'installation intermédiaire": string | number | null,

    "N° SIRET de l'Eco-organisme": string | number | null,
    "Raison sociale de l'Eco-organisme": string | number | null,
    "Adresse de l'Eco-organisme": string | number | null,

    // Informations financières
    "Montant TTC": string | number | null,
    "Coûts de préparation HT": string | number | null,
    "Coûts de transport HT": string | number | null,
    "Coûts de traitement HT": string | number | null,
    "Coûts HT/tonne": string | number | null,
    "TVA": string | number | null,
    "Coûts TTC": string | number | null
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');
    console.log('laaaaa');
    const {data, error} = await supabase
    .from('bsd')
    .select('infos_json')
    .eq('user_id', user_id); //Attention à terme filtrer sur la  boite et pas le user id !!!! ⚠⚠⚠⚠⚠

    if(error) {
        return NextResponse.json({ message: 'Erreur lors de l\'export' }, {status: 500});
    } else {
        return exportToExcel(formatBSDData(data), 'export_register');
        //return NextResponse.json({ message: 'Export réussi' }, {status: 200});
    }
}

const formatBSDData = (data: {infos_json: {formData: BSD_Data_Interface_WithoutOptions}}[]) => {
    return data.map((item) => {
        const getValue = (accessor: () => string|number|null, defaultValue: string = 'Non trouvé') => {
            try {
                const value = accessor()
                return value ?? defaultValue;
            } catch {
                return defaultValue;
            }
        };

        return {
            "Code déchet": getValue(() => item.infos_json.formData.filiere.ced.first),
            "Nom du déchet": getValue(() => item.infos_json.formData.dechet_dangereux.denomination.first),
            "Volume estimé": getValue(() => item.infos_json.formData.volume.first.toString()),
            "Code de convention Bâle": getValue(() => null, 'Pas encore disponible'),
            "Date de collecte": getValue(() => String(item.infos_json.formData.date.collecte.first)),
            "N° BSD": getValue(() => null, 'Pas encore disponible'),
            "N° TrackDéchet": getValue(() => null, 'Pas encore disponible'),
            "Date de confirmation par le transporteur": getValue(() => null, 'Pas encore disponible').toString(),

            "Adresse de collecte": getValue(() => item.infos_json.formData.dechet_dangereux.collecte.first),
            
            "N° Siret du Producteur": getValue(() => item.infos_json.formData.site.siret.first),
            "Raison sociale du Producteur": getValue(() => item.infos_json.formData.site.gouv.raison.first),
            "Adresse du siège social du Producteur": getValue(() => item.infos_json.formData.site.gouv.adresse.first),

            "N° SIRET du transporteur": getValue(() => item.infos_json.formData.transporteur.siret.first.toString()),
            "Raison sociale du transporteur": getValue(() => item.infos_json.formData.transporteur.gouv.raison.first),
            "N° de récipissé du transporteur": getValue(() => item.infos_json.formData.transporteur.numero.first),

            "N° SIRET du prestataire final": getValue(() => item.infos_json.formData.prestataire_final.siret.first),
            "Raison sociale du prestataire final": getValue(() => item.infos_json.formData.prestataire_final.gouv.raison.first),
            "Adresse du prestataire final": getValue(() => item.infos_json.formData.prestataire_final.gouv.adresse.first),
            "N° de récipissé du prestataire final": getValue(() => item.infos_json.formData.prestataire_final.numero.first),
            "Qualification de traitement": getValue(() => item.infos_json.formData.prestataire_final.qualification.first),
            "Code de traitement": getValue(() => item.infos_json.formData.prestataire_final.traitement.first),
            
            "N° SIRET de l'installation intermédiaire": getValue(() => item.infos_json.formData.installation_intermediaire.siret.first),
            "Raison sociale de l'installation intermédiaire": getValue(() => item.infos_json.formData.installation_intermediaire.gouv.raison.first),
            "N° de récipissé de l'installation intermédiaire": getValue(() => item.infos_json.formData.installation_intermediaire.numero.first),

            "N° SIRET de l'Eco-organisme": getValue(() => item.infos_json.formData.eco_organisme.siret.first),
            "Raison sociale de l'Eco-organisme": getValue(() => item.infos_json.formData.eco_organisme.nom.first),
            "Adresse de l'Eco-organisme": getValue(() => item.infos_json.formData.eco_organisme.gouv.adresse.first),

            // Informations financières
            "Montant TTC": getValue(() => null, 'Pas encore disponible'),
            "Coûts de préparation HT": getValue(() => null, 'Pas encore disponible'),
            "Coûts de transport HT": getValue(() => null, 'Pas encore disponible'),
            "Coûts de traitement HT": getValue(() => null, 'Pas encore disponible'),
            "Coûts HT/tonne": getValue(() => null, 'Pas encore disponible'),
            "TVA": getValue(() => null, 'Pas encore disponible'),
            "Coûts TTC": getValue(() => null, 'Pas encore disponible')
        };
    });
};

export const exportToExcel = (data : BSD_Export_Interface[], fileName: string) => {
    // Convertir le JSON en feuille de calcul
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  
    // Générer le fichier Excel en mémoire
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  // Configurer la réponse HTTP pour le téléchargement
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Disposition': `attachment; filename="${fileName}.xlsx"`,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
    });
};

/*
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
}*/