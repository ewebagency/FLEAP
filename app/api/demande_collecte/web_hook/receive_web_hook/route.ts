import { supabase } from '@/app/database/supabaseClient';
import { NextResponse } from 'next/server';
import axios from 'axios';
import { cookies } from 'next/headers';

interface formAPI_Track {
    id: string,
    status: string,
    createdAt: string,
    emitter: {
          company: {
            mail: string,
            name: string,
            phone: string,
            siret: string,
            address: string,
            contact: string
          },
          workSite: {
            city: string,
            address: string,
            postalCode: string
          }
        },
        recipient: {
          cap: string,
          company: {
            mail: string,
            name: string,
            phone: string,
            siret: string,
            address: string,
            contact: string
          },
          processingOperation: string
        },
        transporter: {
          company: {
            mail: string,
            name: string,
            phone: string,
            siret: string,
            address: string,
            contact: string
          }
        },
        wasteDetails: {
          code: string,
          name: string,
          onuCode: string,
          quantity: number,
          consistence: string,
          quantityType: string,
          packagingInfos: []
        }
}

//On ne peut pas récupérer le token via la route token car pas côté client
//On ne peut pas récupérer le token via les cookies car pas côté client
//On regarde si la signature envoyée par trackdechet a dékà été enrigistré dans notre BDD
//Si oui, const token = signature

export async function POST(req: Request) {
    // Récupérer le token via la route token
    const tokenResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth_track_dechet/token`); //Ne fonctionne pas car pas côté client
    const tokenData = await tokenResponse.json();
    let token_track = tokenData.data;  //tout façon il est undefined
    
    console.log("token_track récupéré via route token - ne fonctionne pas normalement :", token_track);
    console.log("token_track récupéré par cookies - fonctionne normalement :", cookies().get('trackdechets_token')?.value);
    let url_track = process.env.TRACKDECHETS_URL_SANDBOX;
    if(process.env.NEXT_PUBLIC_TRACK_TYPE === 'app'){
        url_track = process.env.TRACKDECHETS_URL_APP;
    }

    console.log("Notification TrackDéchet reçue !!", Date.now());
    try {
        const signature = req.headers.get('authorization')?.split('Bearer: ')[1];
        
        console.log("signature : ", signature);
        console.log("token_track : ", token_track);
        const cond_signature = await tokenAlreadyRegister(signature);

        if (!cond_signature.already_register){ //|| signature !== token_track) {
            console.log('Signature invalide');
            return NextResponse.json({ message: 'Signature invalide' }, { status: 204 });
        }
        if(signature){
            token_track = signature;
        }

        // Lire le corps de la requête
        const rawBody = await req.text();
        //console.log('Corps de la requête:', rawBody);

        try {
            const event = JSON.parse(rawBody);
            console.log('Événement parsé:', event);

            // Gérer les différents types d'événements
            const {action, id} = event[0];
            return HandleBSD_Supabase(action, id, token_track, url_track??'', cond_signature.user_id, cond_signature.entreprise_id);

        } catch (parseError) {
            console.error('Erreur de parsing JSON:', parseError);
            return NextResponse.json({ status: 200 }); //Sinon on nous désactive le webhook
        }

    } catch (error) {
        console.error('Erreur générale:', error);
        return NextResponse.json({ status: 200 }); //Sinon on nous désactive le webhook
    }
}


const HandleBSD_Supabase = async (action: string, id: string, token_track: string, url_track: string, user_id: string, entreprise_id: string) => {
    
    console.log("HandleBSD_Notification : ", action);
    
    if (action === "DELETED"){
        return deleteBSD_Supabase(id);
    }


    const past_query = `
    query Form($readableId:String!){
        form(readableId:$readableId ){
        id
        status
        createdAt
        emitter {
            company {
                mail
                name
                phone
                siret
                address
                contact
            }
            workSite {
                city
                address
                postalCode
                }
            }
            recipient {
                cap
                company {
                mail
                name
                phone
                siret
                address
                contact
                }
            processingOperation
            }
            transporter {
                company {
                    mail
                    name
                    phone
                    siret
                    address
                    contact
                }
            }
            wasteDetails {
                code
                name
                onuCode
                quantity
                consistence
                quantityType
                packagingInfos {
                    type
                    quantity
                }
            }

        }
        }`;

    const query = `
    query Form($readableId: String!) {
        form(readableId: $readableId) {
            id
            readableId
            customId
            status
            isImportedFromPaper
            createdAt
            updatedAt
            emittedAt
            emittedBy
            emittedByEcoOrganisme
            takenOverAt
            takenOverBy
            signedAt
            wasteAcceptationStatus
            wasteRefusalReason
            hasCiterneBeenWashedOut
            citerneNotWashedOutReason
            receivedBy
            receivedAt
            quantityReceived
            quantityReceivedType
            quantityAccepted
            quantityRefused
            processingOperationDone
            processingOperationDescription
            processedBy
            processedAt
            noTraceability
            
            emitter {
                type
                workSite {
                    name
                    address
                    city
                    postalCode
                    infos
                }
                company {
                    name
                    orgId
                    siret
                    address
                    country
                    contact
                    phone
                    mail
                    vatNumber
                    omiNumber
                    extraEuropeanId
                }
                isPrivateIndividual
                isForeignShip
            }
    
            recipient {
                company {
                    name
                    orgId
                    siret
                    address
                    country
                    contact
                    phone
                    mail
                }
                cap
                processingOperation
                isTempStorage
            }
    
            transporter {
                id
                company {
                    name
                    orgId
                    siret
                    address
                    country
                    contact
                    phone
                    mail
                }
                isExemptedOfReceipt
                receipt
                department
                validityLimit
                numberPlate
                customInfo
                mode
                takenOverAt
                takenOverBy
            }
            
            wasteDetails {
                code
                name
                isSubjectToADR
                onuCode
                nonRoadRegulationMention
                quantity
                quantityType
                consistence
                pop
                isDangerous
                parcelNumbers {
                    city
                    postalCode
                    prefix
                    section
                    number
                    x
                    y
                }
                analysisReferences
                landIdentifiers
                sampleNumber
                packagingInfos {
                    type
                    other
                    quantity
                }
            }
            
            ecoOrganisme {
                name
                siret
            }
            
            trader {
            company {
                name
                orgId
                siret
                address
                country
                contact
                phone
                mail
            }
            receipt
            department
            validityLimit
            }
            
            broker {
            company {
                name
                orgId
                siret
                address
                country
                contact
                phone
                mail
            }
            receipt
            department
            validityLimit
            }
            
            nextDestination {
            processingOperation
            notificationNumber
            company {
                name
                orgId
                siret
                address
                country
                contact
                phone
                mail
            }
            }
            
            temporaryStorageDetail {
            temporaryStorer {
                quantityType
                quantityReceived
                quantityRefused
                quantityAccepted
                wasteAcceptationStatus
                wasteRefusalReason
                receivedAt
                receivedBy
            }
            destination {
                cap
                processingOperation
                company {
                name
                orgId
                siret
                address
                country
                contact
                phone
                mail
                }
            }
            wasteDetails {
                code
                name
                quantity
                consistence
                quantityType
                packagingInfos {
                type
                quantity
                }
            }
            transporter {
                id
                company {
                name
                orgId
                siret
                address
                country
                contact
                phone
                mail
                }
                isExemptedOfReceipt
                receipt
                department
                validityLimit
                numberPlate
                customInfo
                mode
                takenOverAt
                takenOverBy
            }
            emittedAt
            emittedBy
            takenOverAt
            takenOverBy
            }
            
            grouping {
            form {
                id
            }
            quantity
            }
        }
        }
    `;

    const variables = {
        readableId: id
    };

    if (!url_track) {
        throw new Error('TRACKDECHETS_URL_SANDBOX environment variable is not defined');
    }
    try{
    console.log('token_track pour handleBSD_Supabases: ', token_track);
    const response = await axios.post(
        url_track, 
        {
            query,
            variables
        },
        {
            headers: {
                Authorization: `Bearer ${token_track}`,
                'Content-Type': 'application/json'
            }
        }
        );

    if(response){
        //console.log("Corps du BSD lié à la notification : ", response.data);
        
        if (action === "UPDATED"){
            return updateBSD_Supabase(id, response.data as {data: {form: formAPI_Track}}, user_id, entreprise_id);
        } else if (action === "CREATED"){
            return handleBSD_Created_on_Track(id, response.data as {data: {form: formAPI_Track}});
        }

    } else {
        console.log('Erreur de lecture de l\'id : ', id);
        return NextResponse.json({ status: 200 }); //Sinon on nous désactive le webhook
    }
} catch (error) {
        console.error('Erreur lors de la requête à TrackDéchet:');//, error.response.data.errors[0]);
    }
    
    return NextResponse.json({ status: 200 }); //Sinon on nous désactive le webhook
}


const createBSD_Supabase = async (readableId: string, data: {data: {form: formAPI_Track}}, user_ids_linked_to_its_siret: string[], entreprise_ids: string[]|null) => {
    console.log("BSD créé : ", readableId);
    console.log("User IDs liés au siret : ", user_ids_linked_to_its_siret);
    console.log("Entreprise IDs liés au siret : ", entreprise_ids);
    try{
        const {id, status, ...new_create_form_input} = data.data.form;
        const new_bsd_json_supabase = {
            formAPI: {
            createFormInput: new_create_form_input
            }
        }

        // Créer un BSD pour chaque user_id
        for (let i=0; i<user_ids_linked_to_its_siret.length; i++) {
            const result = await supabase
            .from('bsd')
            .insert({
                infos_json: new_bsd_json_supabase, 
                user_id: user_ids_linked_to_its_siret[i], // Utiliser user_id de l'objet actuel
                entreprise_id: entreprise_ids ? entreprise_ids[i] : null,
                created_on_fleap: false,
                on_track_dechets: true,
                id_track_dechets: id,
                status_track_dechets: status,
                readable_id_track_dechets: readableId,    
            })
            .select();

            console.log(`Résultat de la création du BSD pour user ${user_ids_linked_to_its_siret[i]}: `, result);
        }
    } catch (error) {
        console.error('Erreur lors de la création du BSD : ', error);
    }
    return NextResponse.json({ status: 200 });
}

const updateBSD_Supabase = async (readableId: string, data: {data: {form: formAPI_Track}}, user_id: string, entreprise_id: string) => {
    console.log("BSD mis à jour : ", readableId);
    console.log("Données reçues par le WebHook : ", data);
    //Si readable_id n'existe pas dans la BDD, on créer un nouveau BSD avec ce readable_id pour ce user (entreprise) : id FLEAP unique mais ids TRACK pas uniques

    const json_past = await supabase
    .from('bsd')
    .select('infos_json')
    .eq('readable_id_track_dechets', readableId)
    .eq('entreprise_id', entreprise_id)
    .single();

    if(!json_past.data){
        console.log("BSD encore non existant => création du BSD");
        const user_ids = [user_id];
        const entreprise_ids = [entreprise_id];
        return createBSD_Supabase(readableId, data, user_ids, entreprise_ids);
    } else {
        console.log("BSD déjà existant dans la BDD => mise à jour du BSD");
                
        const status = data.data.form.status;
        const new_formAPI = data.data.form; // NOUVEAU
        
        const past_infos_json = json_past.data?.infos_json;
        //console.log("Nouvelles Infos JSON reçus par WebHook : ", new_formAPI);
        //console.log("Infos JSON précédentes : ", past_infos_json?.formAPI.createFormInput);
        console.log("past_infos_json : ", past_infos_json);

        
        past_infos_json.formAPI.createFormInput.emitter = new_formAPI.emitter;
        past_infos_json.formAPI.createFormInput.recipient = new_formAPI.recipient;
        past_infos_json.formAPI.createFormInput.transporter = new_formAPI.transporter;
        past_infos_json.formAPI.createFormInput.wasteDetails = new_formAPI.wasteDetails;
        past_infos_json.formAPI.createFormInput = new_formAPI // NOUVEAU


        //console.log("Infos JSON qu'on va mettre à jour : ", past_infos_json);

        const response = await supabase
        .from('bsd')
        .update({
            infos_json: past_infos_json,
            status_track_dechets: status,
        }) //Gros probleme avec formData et FormAPI (tout ressortir et remapper)
        .eq('readable_id_track_dechets', readableId);

        if (response.status === 204){
            console.log("Supabase mis à jour avec le WebHook TrackDéchet");
        } else {
            console.log("Erreur lors de la mise à jour de la BDD");
        }
        //console.log("BDD mise à jour : ", response);
        //console.log("Truc modifié : ", past_infos_json.formAPI.createFormInput.emitter);

        return NextResponse.json({ status: 200 }); //Sinon on nous désactive le webhook
    }
}

const deleteBSD_Supabase = async (readableId: string) => {
    const response = await supabase
    .from('bsd')
    .delete()
    .eq('readable_id_track_dechets', readableId);

    if(response){
        console.log("BSD supprimé de la BDD");
        return NextResponse.json({ status: 200 }); //Sinon on nous désactive le webhook
    } else {
        console.log("Erreur lors de la suppression du BSD de la BDD");
        return NextResponse.json({ status: 200 }); //Sinon on nous désactive le webhook
    }
}

const BSD_AlreadyExist = async (readableId: string) => {
    const response = await supabase.from('bsd').select('id').eq('readable_id_track_dechets', readableId).single();
    const bsd_already_exist = response.data ? true : false;
    console.log("BSD already exist : ", bsd_already_exist);
    return bsd_already_exist;
}

const handleBSD_Created_on_Track = async (readableId: string, data: {data: {form: formAPI_Track}}) => {
    const bsd_already_exist = await BSD_AlreadyExist(readableId);
    if (!bsd_already_exist){
        const {user_ids, entreprise_ids} = await getUserIdsLinkedToItsSiret(data.data.form.emitter.company.siret);
        return createBSD_Supabase(readableId, data, user_ids, entreprise_ids);
    } else {
        console.log("BSD déjà existant dans la BDD");
        return NextResponse.json({ status: 200 }); //Sinon on nous désactive le webhook
    }
}

const getUserIdsLinkedToItsSiret = async (siret: string) => {
    const response = await supabase
    .from('bsd')
    .select('user_id, infos_json, entreprise_id')
    

    const user_ids_linked_to_its_siret: string[] = [];
    const entreprise_ids_linked_to_its_siret: string[] = [];
    response.data?.forEach((item) => {
        if (item.infos_json.formAPI.createFormInput.emitter.company.siret === siret){
            user_ids_linked_to_its_siret.push(item.user_id);
            entreprise_ids_linked_to_its_siret.push(item.entreprise_id);
        }
    });
    const uniqueUserIds = Array.from(new Set(user_ids_linked_to_its_siret));
    let uniqueEntrepriseIds = Array.from(new Set(entreprise_ids_linked_to_its_siret));
    console.log("User IDs liés au siret : ", siret, uniqueUserIds);
    console.log("Entreprise IDs liés au siret : ", siret, uniqueEntrepriseIds);
    uniqueEntrepriseIds = uniqueEntrepriseIds.filter((id) => id !== null);
    if(uniqueEntrepriseIds.length === uniqueUserIds.length){
        return {user_ids: uniqueUserIds, entreprise_ids: uniqueEntrepriseIds};
    } else {
        return {user_ids: uniqueUserIds, entreprise_ids: null};
    }
}


//Tester de créer un BSD depuis trackdechets uniquement et voir s'il se créer dans BDD et FLEAP
const tokenAlreadyRegister = async (signature: string | undefined) => {
    if(!signature){
        console.log("Pas de signature envoyé par trackdechet");
        return {already_register: false};
    }else{
        const response = await supabase
        .from('token_track')
        .select('*')
        .eq('token', signature)
        .single();
        if(response.data){
            console.log("Signature trouvée dans notre BDD");
            const entreprise_id = await supabase
                .from('profiles')
                .select('entreprise_id')
                .eq('user_id', response.data.user_id)
                .single();
            return {already_register: true, user_id: response.data.user_id, entreprise_id: entreprise_id.data?.entreprise_id};
        } else {
            console.log("Signature non trouvée dans notre BDD");
            return {already_register: false};
        }
    }
}

