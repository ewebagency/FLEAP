//api/demande_collecte/creation_bsdd
import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/app/database/supabaseClient';


const url = 'https://api.sandbox.trackdechets.beta.gouv.fr';
const token = 'tCJJTq0Da55LuoJMc35QEqwomMRDwl10xT1hI2UV';

interface FormAPI {
    createFormInput: {
        emitter: {
            type: string,
            workSite: {
                address: string,
                postalCode: string,
                city: string,
                infos: null
            },
            company: {
                siret: string,
                name: string,
                address: string,
                contact: string,
                phone: string,
                mail: string
            }
        },
        recipient: {
            processingOperation: string,
            cap: string,
            company: {
                siret: string,
                name: string,
                address: string,
                contact: string,
                phone: string,
                mail: string
            }
        },
        transporter: {
            company: {
                siret: string,
                name: string,
                address: string,
                contact: string,
                mail: string,
                phone: string
            }
        },
        wasteDetails: {
            code: string,
            onuCode: string,
            name: string,
            packagingInfos: [
                {
                    type: string, //FUT, GRV, CITERNE, BENNE, PIPELINE, AUTRE
                    quantity: number // il faut un nmbre //parseInt(formData.contenant.first.nombre)
                }
            ],
            quantity: number, //tonnes
            quantityType: string,
            consistence: string
        }
    }
};

interface FormData {
    filiere: {
        options: string[];
        first: string;
    };
    dechet: {
        options: {
            ced: string;
            description: string;
        }[];
        first: {
            ced: string;
            description: string;
        };
    };
    contenant: {
        options: {
            nom: string;
            volume: string;
            nombre: string;
        }[];
        first: {
            nom: string;
            volume: string;
            nombre: string;
        };
    };
    site: {
        options: {
            nom : string[];
            adresse: {
                street: string[];
                postal_code: string;
                city: string;
            };
            siret: string;
        }[];
        first: {
            nom: string;
            adresse: {
                street: string;
                postal_code: string;
                city: string;
            };
            siret: string;
        };
    };
    adresse_collecte: {
        options: string[];
        first: string;
    };
    personne_producteur: {
        first: {
            nom: string;
            prenom: string;
            tel: string;
            email: string;
        };
        options: {
            nom: string;
            prenom: string;
            telephone: string;
            email: string;
        }[];
    };
    site_details: {
        first: {
            adresse: string;
            siret: string;
            nom: string;
        };
        options: {
            adresse: string[];
            siret: string[];
            nom: string[];
        };
    };
    prestataire_final: {
        first: {
            code_traitement: string;
            cap: string;
            siret: string;
            nom: string;
            adresse: string;
            personne: {
                nom: string;
                prenom: string;
                tel: string;
                email: string;
            };
        };
        options: {
            code_traitement: string[];
            cap: string[];
            siret: string[];
            nom: string[];
            adresse: string[];
            personne: {
                nom: string[];
                prenom: string[];
                tel: string[];
                email: string[];
            };
        };
    };
    transporteur: {
        first: {
            siret: string;
            nom: string;
            adresse: string;
            personne: {
                nom: string;
                prenom: string;
                email: string;
                tel: string;
            };
        };
        options: {
            siret: string[];
            nom: string[];
            adresse: string[];
            personne: {
                nom: string[];
                prenom: string[];
                email: string[];
                tel: string[];
            };
        };
    };
    dechet_details: {
        first: {
            ced: string;
            onu: string;
            description: string;
        };
        options: {
            ced: string[];
            onu: string[];
            description: string[];
        };
    };
    mail?: {
        destinataire: string;
        cc: string[];
        sujet: string;
        message: string;
    };
}

interface DataTransfer {
    formAPI: FormAPI;
    formData: FormData;
}

export async function POST(request: Request) {
    //const token_sandbox = "tCJJTq0Da55LuoJMc35QEqwomMRDwl10xT1hI2UV";
    const response = await request.json();
    console.log("Données reçues :", response);
    //who_am_i();
    //createBSDD_API(response.data.formAPI);
    createBSD_Fleap(response.user_id, response.data);


    return NextResponse.json({ message: 'Données reçues avec succès', response });
}


const createBSD_Fleap = async (user_id:string, data:DataTransfer) => {
    console.log("Données reçues :", data);
    //stocker le json dans la base de données
    const result = await supabase.from('bsd').insert({
        user_id: user_id,
        created_on_fleap: true,
        infos_json: data
    });
    if (result.error) {
        console.error('Erreur lors de l\'insertion dans la base de données :', result.error);
    } else {
        console.log('Insertion réussie dans la base de données');
    }
}


const createBSDD_API = async (data:FormAPI) => {
    const mutation = `
        mutation CreateForm($createFormInput: CreateFormInput!) {
            createForm(createFormInput: $createFormInput) {
                id
                status
            }
        }
    `;
        
    /*const variables = {
        createFormInput: {
            emitter: {
                type: "PRODUCER",
                workSite: {
                    address: "5 rue du chantier",
                    postalCode: "75010",
                    city: "Paris",
                    //infos: "Site de stockage de boues" //Infos optionnel askip
                },
                company: {
                    siret: "00000063963334",
                    name: "FLEAP",
                    address: "1 rue de paradis, 75010 PARIS",
                    contact: "Jean Dupont",
                    phone: "01 00 00 00 00",
                    mail: "test.blabla@dechets.org"
                }
            },
            recipient: {
                processingOperation: "D 10",
                cap: "CAP",
                company: {
                    siret: "57202552610945",
                    name: "Veolia - entreprise de traitement de déchet",
                    address: "1 avenue de l'incinérateur 67100 Strasbourg",
                    contact: "Thomas Largeron",
                    phone: "03 00 00 00 00",
                    mail: "thomas.largeron@incinerateur.fr"
                }
            },
            transporter: {
                company: {
                    siret: "30832792300014",
                    name: "Transport & Co trouvé sur internet",
                    address: "1 rue des 6 chemins, 07100 ANNONAY",
                    contact: "Claire Dupuis",
                    mail: "claire.dupuis@transportco.fr",
                    phone: "04 00 00 00 00"
                }
            },
            wasteDetails: {
                code: "06 05 02*",
                //onuCode: "Non Soumis", //Askip optionnel
                name: "Boues",
                packagingInfos: [
                    {
                        type: "CITERNE",
                        quantity: 1
                    }
                ],
                quantity: 1,
                quantityType: "ESTIMATED",
                consistence: "LIQUID"
            }
        }
    };*/
    const variables = data;
  
    try {
        const response = await axios.post(
            url,
            { 
                query: mutation, // Changer 'mutation' en 'query'
                variables 
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`, // Authentification par jeton
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log(response.data);
    } catch (error) {
        console.error('Erreur lors de la création du BSD :', error);
    }
};



  async function who_am_i() {
    const query = "query { me { name } }";
    try {
      const response = await axios.post(
        url,
        { query },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      console.log(response.data);
      return response.data;
    } catch (error) {
      console.error('Error:', error);
    }
  }