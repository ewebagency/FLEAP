//api/demande_collecte/creation_bsdd
import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/app/database/supabaseClient';
import { FormInput } from '@/app/register/interface/BSD_Interface';

const url_sandbox = process.env.TRACKDECHETS_URL_SANDBOX;
const token_sandbox = process.env.TRACKDECHETS_TOKEN_SANDBOX;

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
    const response = await request.json();
    const isDraft = response.isDraft || false;

    const continue_process = await pushOnTableParametrage(response.user_id, response.entreprise_id, response.data);
    if (!continue_process?.success) {
        return NextResponse.json({ success: false, message: 'problème lors de l\'envoi des données à la table de paramétrage' }, { status: 200 });
    }

    try {
        if (isDraft) {
            // Si c'est un brouillon, on sauvegarde uniquement dans Fleap
            await createBSD_Fleap(
                response.user_id, 
                response.data, 
                'draft', // id_track temporaire pour brouillon
                'Brouillon Local', // status spécial pour brouillon
                'BROUILLON LOCAL' // readable_id pour brouillon
            );
            return NextResponse.json({ 
                success: true, 
                message: 'Brouillon sauvegardé avec succès'
            });
        }

        // Si ce n'est pas un brouillon, on continue avec l'envoi à TrackDéchets
        const trackDechetsResponse = await createBSDD_API(response.data.formAPI);
        
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
        await createBSD_Fleap(response.user_id, response.data, id, status, readableId);
        
        return NextResponse.json({ 
            success: true, 
            message: 'BSD créé avec succès',
            trackDechetsData: trackDechetsResponse.data 
        });

    } catch (error) {       
        console.error('Error:', error);
        let error_message = 'Erreur inconnue';
        
        if (error instanceof Error) {
            error_message = error.message;
        }

        return NextResponse.json({ 
            success: false, 
            message: `Erreur lors de la création du BSD : ${error_message}`,
            error: error_message 
        }, { status: 500 });
    }
}


const createBSD_Fleap = async (user_id:string, data:DataTransfer, id_track:string, status_track:string, readableId_track:string) => {
    
    const entreprise_id = await getEntrepriseId(user_id);
    
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
        readable_id_track_dechets: readableId_track,
        entreprise_id: entreprise_id // tester une création de bsd avec entreprise_id!!!!!
    });

    if (result.error)console.error('Erreur lors de l\'insertion dans la base de données :', result.error);
    else {
        console.log('Insertion réussie dans la base de données Supabase');
        //addSiteToBDD(data, entreprise_id);
    }
}




const createBSDD_API = async (data: FormAPI) => {
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

        if (!url_sandbox) {
            throw new Error('TRACKDECHETS_URL_SANDBOX environment variable is not defined');
        }

        console.log("Sending to TrackDéchets:", {
            mutation,
            variables: data,
            token: token_sandbox?.substring(0, 10) + '...'
        });

        const response = await axios.post<ReponseData>(
            url_sandbox,
            { 
                query: mutation, 
                variables: data 
            },
            {
                headers: {
                    'Authorization': `Bearer ${token_sandbox}`,
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
            return {
                success: false,
                error: 'Réponse TrackDéchets invalide - createForm manquant',
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

export const pushOnTableParametrage = async (user_id: string, entreprise_id: string, data: {formAPI: {createFormInput: FormInput}}) => {

    const formData = data.formAPI.createFormInput;

    // Conditions pour vérifier les entrées de l'utilisateur
    const data_condition_1 = formData.emitter.company.siret.length >= 7;
    const data_condition_2 = formData.recipient.company.siret.length >= 7;
    const data_condition_3 = formData.transporter.company.siret.length >= 7;
    const data_condition_4 = formData.wasteDetails.code.length >= 6;
    const data_condition_5 = formData.emitter.workSite.name.length >= 2;
    const data_condition_6 = formData.recipient.company.name.length >= 2;
    const data_condition_7 = formData.transporter.company.name.length >= 2;
    const data_condition_8 = formData.wasteDetails.name.length >= 2;
    const data_condition_9 = formData.recipient.processingOperation?true:false; // Vérification du CAP
    const data_condition_10 = formData.recipient.company.mail.length > 0; // Vérification de l'email du destinataire
    const data_condition_11 = formData.transporter.company.mail.length > 0; // Vérification de l'email du transporteur
    const data_condition_12 = formData.emitter.company.mail.length > 0; // Vérification de l'email de l'émetteur
    const data_condition_13 = formData.wasteDetails.onuCode.length > 0; // Vérification du code ONU

    // Vérification que toutes les conditions sont remplies
    const condition_completude = (
        data_condition_1 && data_condition_2 && data_condition_3 &&
        data_condition_4 && data_condition_5 && data_condition_6 &&
        data_condition_7 && data_condition_8 && data_condition_9 &&
        data_condition_10 && data_condition_11 && data_condition_12 &&
        data_condition_13);

    try {
      const formData = data.formAPI.createFormInput;
      
      
      // Création des critères de filtrage basés sur les champs importants
      const filterCriteria = {
        'formAPI.createFormInput.emitter.workSite.name': formData.emitter.workSite.name,
        'formAPI.createFormInput.emitter.company.siret': formData.emitter.company.siret,
        'formAPI.createFormInput.recipient.company.siret': formData.recipient.company.siret,
        'formAPI.createFormInput.transporter.company.siret': formData.transporter.company.siret,
        'formAPI.createFormInput.wasteDetails.code': formData.wasteDetails.code,
      };

      /*
      const test = await supabase
      .from('table_parametrage')
      .select('json_row->emitter->company->>siret, json_row->recipient->company->>siret, json_row->wasteDetails->>code')
      .eq('entreprise_id', entreprise_id);

      console.log('test', test);
      console.log('filterCriteria', filterCriteria);*/

      const { data: existingForm, error: searchError } = await supabase
        .from('table_parametrage')
        .select('json_row')
        .eq('entreprise_id', entreprise_id)
        .eq('json_row->emitter->workSite->>name', filterCriteria['formAPI.createFormInput.emitter.workSite.name'])
        .eq('json_row->emitter->company->>siret', filterCriteria['formAPI.createFormInput.emitter.company.siret'])
        .eq('json_row->recipient->company->>siret', filterCriteria['formAPI.createFormInput.recipient.company.siret'])
        .eq('json_row->transporter->company->>siret', filterCriteria['formAPI.createFormInput.transporter.company.siret'])
        .eq('json_row->wasteDetails->>code', filterCriteria['formAPI.createFormInput.wasteDetails.code'])
        .single();

      if (searchError && searchError.code !== 'PGRST116') {
        console.error('Erreur lors de la recherche:', searchError);
        return {success: false, message: 'Erreur lors de la recherche dans la table de paramétrage'};
      }
      
      // Si le formulaire n'existe pas, on l'ajoute
      if (!existingForm && condition_completude) {
        const { error: insertError } = await supabase
          .from('table_parametrage')
          .insert({user_id: user_id, entreprise_id: entreprise_id, json_row: formData});
  
        if (insertError) {
          console.error('Erreur lors de l\'insertion:', insertError);
          return {success: false, message: 'Erreur lors de l\'insertion dans la table de paramétrage'};
        } else {
            console.log('Nouveau formulaire détecté, table de paramétrage mise à jour');
          return {success: true, message: 'Nouveau formulaire détecté, table de paramétrage mise à jour'};
        }
      }
  
      if(existingForm){
        console.log('Formulaire déjà existant dans la table de paramétrage');
        return {success: true, message: 'Formulaire déjà existant dans la table de paramétrage'};
      }
      if(!condition_completude){
        return {success: true, message: 'Les données du formulaire ne sont pas complètes'};
      }
  
    } catch (error) {
      console.error('Erreur générale:', error);
      return {success: false, message: 'Erreur inconnue'};
    }
  }
  