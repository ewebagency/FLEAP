//api/demande_collecte/creation_bsdd
import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/app/database/supabaseClient';
import { pushOnTableParametrage } from '@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new';
import { cookies } from 'next/headers';
import { OtherInfos } from "@/app/register/interface/BSD_Interface";


interface FormAPI {
    createFormInput: {
        emitter: {
            type: string,
            workSite: {
                name: string,
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
    status: number;
    data: {
        createForm?: {
            id: string;
            status: string;
            readableId: string;
        };
        errors?: Array<{
            message: string;
        }>;
    };
    errors?: Array<{
        message: string;
    }>;
}

interface AxiosErrorResponse {
    response?: {
        status?: number;
        data?: {
            errors?: Array<{
                message: string;
            }>;
        };
    };
    message: string;
}

export async function POST(request: Request) {
    const token_track = cookies().get('trackdechets_token')?.value;
    let url_track = process.env.TRACKDECHETS_URL_SANDBOX;
    if(process.env.NEXT_PUBLIC_TRACK_TYPE === 'app'){
        url_track = process.env.TRACKDECHETS_URL_APP;
    }

    const response = await request.json();
    const isDraft = response.isDraft || false;
    const nonDangereux = response.nonDangereux || false;
    const otherInfos = response.otherInfos;

    try {
        // Vérifier d'abord si l'utilisateur et l'entreprise existent
        if (!response.user_id || !response.entreprise_id) {
            return NextResponse.json({ 
                success: false, 
                message: 'Identifiants utilisateur ou entreprise manquants'
            }, { status: 400 });
        }

        // Pour les brouillons et déchets non dangereux, pas besoin de token TrackDéchets
        if (isDraft || nonDangereux) {
            console.log("isDraft : ", isDraft);
            console.log("nonDangereux : ", nonDangereux);
            const status = isDraft ? 'Brouillon Local' : 'Collecte demandée';
            const id = isDraft ? 'draft' : 'Déchet non dangereux';
            const readableId = isDraft ? 'BROUILLON LOCAL' : 'Déchet non dangereux';
            
            const continue_process = await pushOnTableParametrage(response.user_id, response.entreprise_id, response.data, otherInfos);
            if (!continue_process?.success) {
                return NextResponse.json({ success: false, message: 'problème lors de l\'envoi des données à la table de paramétrage' }, { status: 200 });
            }

            await createBSD_Fleap(
                response.user_id,
                response.data,
                id,
                status,
                readableId,
                false,
                otherInfos
            );

            return NextResponse.json({ 
                success: true, 
                message: isDraft ? 'Brouillon sauvegardé avec succès' : 'BSD non dangereux sauvegardé avec succès'
            });
        }

        // Pour les autres cas, vérifier le token TrackDéchets
        if (!token_track || !url_track) {
            return NextResponse.json({ 
                success: false, 
                message: 'Token ou URL TrackDéchets non trouvés'
            }, { status: 400 });
        }

        const continue_process = await pushOnTableParametrage(response.user_id, response.entreprise_id, response.data, otherInfos);
        if (!continue_process?.success) {
            return NextResponse.json({ success: false, message: 'problème lors de l\'envoi des données à la table de paramétrage' }, { status: 200 });
        }

        // Si ce n'est pas un brouillon, on continue avec l'envoi à TrackDéchets
        const trackDechetsResponse = await createBSDD_API(response.data.formAPI, token_track, url_track);
        
        if (!trackDechetsResponse || !trackDechetsResponse.success) {
            return NextResponse.json({ 
                success: false, 
                message: `Erreur lors de l'envoi à l'API TrackDéchets : ${trackDechetsResponse?.error || 'Réponse invalide'}`,
                error: trackDechetsResponse?.error || 'Réponse invalide'
            }, { status: 400 });
        }

        if (!trackDechetsResponse.data?.data?.createForm) {
            return NextResponse.json({ 
                success: false, 
                message: 'Réponse invalide de TrackDéchets',
                error: 'createForm not found in response'
            }, { status: 400 });
        }

        const {id, status, readableId} = trackDechetsResponse.data.data.createForm;
        await createBSD_Fleap(response.user_id, response.data, id, status, readableId, true, otherInfos);
        
        return NextResponse.json({ 
            success: true, 
            message: 'BSD créé avec succès',
            trackDechetsData: trackDechetsResponse.data 
        });

    } catch (error) {
        console.error('Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        
        return NextResponse.json({ 
            success: false, 
            message: `Erreur lors de la création du BSD : ${errorMessage}`,
            error: errorMessage 
        }, { status: 500 });
    }
}


const createBSD_Fleap = async (
    user_id: string, 
    data: DataTransfer, 
    id_track: string, 
    status_track: string, 
    readableId_track: string, 
    on_track_dechets: boolean, 
    otherInfos?: OtherInfos
) => {
    
    const entreprise_id = await getEntrepriseId(user_id);
    
    console.log("BSD number : ", readableId_track);
    //console.log("Données reçues :", data);
    //stocker le json dans la base de données
    console.log('Envoie sur BDD', id_track, status_track);
    const result = await supabase.from('bsd').insert({
        user_id: user_id,
        created_on_fleap: true,
        infos_json: data,
        on_track_dechets: on_track_dechets,
        id_track_dechets: id_track,
        status_track_dechets: status_track,
        readable_id_track_dechets: readableId_track,
        entreprise_id: entreprise_id,
        other_infos: otherInfos
    });

    if (result.error)console.error('Erreur lors de l\'insertion dans la base de données :', result.error);
    else {
        console.log('Insertion réussie dans la base de données Supabase');
        //addSiteToBDD(data, entreprise_id);
    }
}




const createBSDD_API = async (data: FormAPI, token_track: string, url_track: string) => {
    try {
        const mutation = `
            mutation CreateForm($createFormInput: CreateFormInput!) {
                createForm(createFormInput: $createFormInput) {
                    id
                    readableId
                    status
                }
            }
        `;        
      
        console.log('----\nPrestataire Final : ',data.createFormInput.recipient.company.siret, '\nTransporteur : ',data.createFormInput.transporter.company.siret, '\nProducteur : ', data.createFormInput.emitter.company.siret);

        // Correction des SIRET
        data.createFormInput.recipient.company.siret = data.createFormInput.recipient.company.siret.replaceAll(" ", "");
        data.createFormInput.transporter.company.siret = data.createFormInput.transporter.company.siret.replaceAll(" ", ""); // Correction ici
        data.createFormInput.emitter.company.siret = data.createFormInput.emitter.company.siret.replaceAll(" ", "");

        if (!url_track) {
            throw new Error('TRACKDECHETS_URL_SANDBOX environment variable is not defined');
        }

        console.log("Sending to TrackDéchets");
        /*console.log("Sending to TrackDéchets:", {
            mutation,
            variables: data,
            token: token_sandbox?.substring(0, 10) + '...'
        });*/

        const response = await axios.post<ReponseData>(
            url_track,
            { 
                query: mutation, 
                variables: data 
            },
            {
                headers: {
                    'Authorization': `Bearer ${token_track}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data?.data?.errors) {
            console.error('TrackDéchets API errors:', response.data.data.errors);
            return {
                success: false,
                error: response.data.data.errors[0]?.message || 'Erreur TrackDéchets non spécifiée',
                data: null
            };
        }

        if (!response.data?.data?.createForm) {
            console.error('TrackDéchets API response missing createForm:', response.data);
            const message = response.data.errors?.[0]?.message || 'Erreur TrackDéchets non spécifiée';
            return {
                success: false,
                error: message,
                data: null
            };
        }

        return {
            success: true,
            data: response.data,
            error: null
        };

    } catch (error: unknown) {
        console.error('Erreur lors de la création du BSD :', error);
        let errorMessage = 'Erreur inconnue';
        
        if (error && typeof error === 'object' && 'response' in error) {
            const axiosError = error as AxiosErrorResponse;
            errorMessage = axiosError.response?.data?.errors?.[0]?.message || axiosError.message;
            console.error('Axios error details:', {
                status: axiosError.response?.status,
                data: axiosError.response?.data
            });
        }

        return {
            success: false,
            error: errorMessage,
            data: null
        };
    }
};

const getEntrepriseId = async (user_id:string) => {
    const data_entreprise = await supabase
    .from('profiles')
    .select('entreprise_id')
    .eq('user_id', user_id)
    .single();
    if (data_entreprise.data) {
        return data_entreprise.data.entreprise_id;
    }
    return null;
}

/*const addSiteToBDD = async (data: DataTransfer, entreprise_id: string) => {
    // Vérifier si le site existe déjà
    const { data: existingSite } = await supabase
        .from('site')
        .select('*')
        .eq('entreprise_id', entreprise_id)
        .eq('name', data.formAPI.createFormInput.emitter.workSite?.name)
        .single();

    // Si le site n'existe pas, on l'ajoute
    if (!existingSite) {
        const result = await supabase.from('site').insert({
            entreprise_id: entreprise_id,
            name: data.formAPI.createFormInput.emitter.workSite?.name,
            address_json: data.formAPI.createFormInput.emitter.workSite
        });
        
        if (result.error) console.error('Erreur lors de l\'insertion dans la base de données :', result.error);
        else console.log('Insertion réussie dans la base de données Supabase');
    } else {
        console.log('Site déjà existant dans la base de données');
    }
}*/

/*
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
}*/

  