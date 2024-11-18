//api/demande_collecte/creation_bsdd
import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/app/database/supabaseClient';
import { cookies } from 'next/headers';

const url_sandbox = process.env.TRACKDECHETS_URL_SANDBOX;

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

interface ReponseData {
    status: number,
    data: {
        createForm: {
            id: string;
            status: string;
            readableId: string;
        }
    }
}



export async function POST(request: Request) {
    try {
        const response = await request.json();
                
        // Appel à l'API TrackDéchets
        const trackDechetsResponse = await createBSDD_API(response.data.formAPI);
        
        if (trackDechetsResponse && !trackDechetsResponse.success) {
            return NextResponse.json({ 
                success: false, 
                message: `Erreur lors de l'envoi à l'API TrackDéchets : ${trackDechetsResponse.error}`,
                error: trackDechetsResponse.error 
            }, { status: 400 });
        } else if(trackDechetsResponse && trackDechetsResponse.data){
            const {id, status, readableId} = trackDechetsResponse.data.data.createForm;
            console.error('trackDechetsRespoooonse', trackDechetsResponse);
            await createBSD_Fleap(response.user_id, response.data, id, status, readableId);
            return NextResponse.json({ 
            success: true, 
            message: 'BSD créé avec succès',
                trackDechetsData: trackDechetsResponse.data 
            });
        }

    } catch (error) {
        const response = await request.json();
        const trackDechetsResponse = await createBSDD_API(response.data.formAPI);
        console.error('Error:', error);
        return NextResponse.json({ 
            success: false, 
            message: `Erreur lors de la création du BSD : ${error}, ${trackDechetsResponse}`,
            error: error 
        }, { status: 500 });
    }
}


const createBSD_Fleap = async (user_id:string, data:DataTransfer, id_track:string, status_track:string, readableId_track:string) => {
    
    console.log("BSD number : ", readableId_track);
    //console.log("Données reçues :", data);
    //stocker le json dans la base de données
    console.log('Envoie sur BDD', id_track, status_track);
    const result = await supabase.from('bsd').insert({
        user_id: user_id,
        created_on_fleap: true,
        infos_json: data,
        on_track_dechets: true,
        id_track_dechets: id_track,
        status_track_dechets: status_track,
        readable_id_track_dechets: readableId_track
    });
    if (result.error) {
        console.error('Erreur lors de l\'insertion dans la base de données :', result.error);
    } else {
        console.log('Insertion réussie dans la base de données Supabase');
    }
}




const createBSDD_API = async (data: FormAPI) => {
    try {
        const token = 'tCJJTq0Da55LuoJMc35QEqwomMRDwl10xT1hI2UV';
        
        const mutation = `
            mutation CreateForm($createFormInput: CreateFormInput!) {
                createForm(createFormInput: $createFormInput) {
                    id
                    readableId
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
        
        console.log('----\nPrestataire Final : ',data.createFormInput.recipient.company.siret, '\nTransporteur : ',data.createFormInput.transporter.company.siret, '\nProducteur : ', data.createFormInput.emitter.company.siret);

        data.createFormInput.recipient.company.siret = (data.createFormInput.recipient.company.siret) .replaceAll(" ", "");
        data.createFormInput.transporter.company.siret = (data.createFormInput.recipient.company.siret) .replaceAll(" ", "");
        const variables = data;

        console.log("-----\nToken:", token, "\n-----\nData:", data);

        if (!url_sandbox) {
            throw new Error('TRACKDECHETS_URL_SANDBOX environment variable is not defined');
        }
        const response = await axios.post<ReponseData>(
            url_sandbox,
            { query: mutation, variables },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        if (response.status==200)  {
            //console.log("-----\nResponse :", response);
            const returned_response : ReponseData = response.data;
            return {success: true, data: returned_response, error: null};
        }
    } catch (error) {
        console.error('Erreur lors de la création du BSD :', error);
        return {
            success: false,
            error: 'An unknown error occurred',
            data: null
        };
    }
};



async function who_am_i() {
    const cookieStore = cookies();
    const token = cookieStore.get("trackdechets_token");
    const query = "query { me { name } }";
    if (!url_sandbox) {
        throw new Error('TRACKDECHETS_URL_SANDBOX environment variable is not defined');
    }
    try {
        const response = await axios.post(
        url_sandbox,
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