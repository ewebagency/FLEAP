import { NextResponse } from 'next/server';
import axios from 'axios';
import { cookies } from "next/headers";

export async function GET(req:Request) {
    const token_track = cookies().get('trackdechets_token')?.value;
    console.log('cookiiiies getwebhook', cookies().get('trackdechets_token'));
    let url_track = process.env.TRACKDECHETS_URL_SANDBOX;
    if(process.env.NEXT_PUBLIC_TRACK_TYPE === 'app'){
        url_track = process.env.TRACKDECHETS_URL_APP;
    }
    const ngrok_url = process.env.NGROK_URL;

    if (!token_track || !url_track || !ngrok_url) {
        console.error('Variables d\'environnement manquantes');
        return NextResponse.json({ error: 'Variables d\'environnement non définies' }, { status: 500 });
    }

    try {
        const response_id_company = await GetIdCompany(token_track, url_track);
        if(response_id_company.status !== 200) {
            return NextResponse.json({ error: 'Erreur lors de la récupération de l\'ID de l\'entreprise' }, { status: 500 });
        }

        const id_company = response_id_company.id_company;
        const response_webhooks = await getWebHooks(token_track, id_company, url_track);
        
        const endpointUri_env = `${ngrok_url}/api/demande_collecte/web_hook/receive_web_hook`;
        const endpointUri_trackdechets = response_webhooks.webhooks.endpointUri;
        
        if(endpointUri_env !== endpointUri_trackdechets){
            const web_hook_deleted = await deleteWebHook(response_webhooks.webhooks, token_track, url_track);
            if(web_hook_deleted){
                const web_hook_created = await createWebHook(token_track, id_company, endpointUri_env, url_track);
                if(web_hook_created.status === 200){
                    return NextResponse.json({ message: 'Nouveau webhook créé'}, { status: 200 });
                }
                return NextResponse.json({ message: 'Erreur lors de la création du webhook' }, { status: 500 });
            }
        }
        return NextResponse.json(response_webhooks);
    } catch (error) {
        console.error('Erreur:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}

const GetIdCompany = async (token: string, url_track: string) => {
    const query = `query {
        myCompanies {
            edges {
            node {
                id
                name
                siret
                companyTypes
            }
            }
        }
}
    `;

    try {
        
        interface Reponse {
            data: {
                data: {
                    myCompanies: {
                        edges: Array<{
                            node: {
                                id: string;
                            };
                        }>;
                    };
                };
            };
        }

        const response : Reponse = await axios.post(
            url_track,
            {   
                query: query,
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        //console.log('Response data:', response.data.data.myCompanies.edges[0].node.id);
        const id_company = response.data.data.myCompanies.edges[0].node.id;
        return {status: 200, id_company: id_company};

    } catch (error) {
        console.error('Error details:', error);
        return {status: 500, id_company: 'null'};
    }
}

const getWebHooks = async (token:string, id_company:string, url_track: string) => {
    
    const query = `
        query WebHookSettings{
        webhooksettings {
            totalCount
            edges {
            node {
                id
                endpointUri
                orgId
                activated
            }
            }
        }
        }
    `;

    try {
        interface Reponse2 {
            status: number;
            data: {
                data: {
                    webhooksettings: {
                        edges: Array<{
                            node: {
                                id: string;
                                endpointUri: string;
                            };
                        }>;
                    };
                };
            };
        }
        const response : Reponse2 = await axios.post(
            url_track,
            {   
                query: query,
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                }
            }
        );

        if (response.status !== 200) {
            console.log('----- Erreur lors de la récupération des webhooks');
            //throw new Error('Erreur lors de la récupération des webhooks');
        }
        if (response?.data?.data?.webhooksettings?.edges?.length > 0) {
            console.log('WebHook trouvé ! : ', response?.data?.data?.webhooksettings?.edges[0]?.node);
            return {status: 200, webhooks: response?.data?.data?.webhooksettings?.edges[0]?.node};
        } else {
            console.log('Aucun webhook trouvé');
            return {status: 200, webhooks: {endpointUri: 'null', id: 'null'}};
        }
    } catch (error) {
        console.log('Erreur getwebhooks:', error);
        return {status: 500, webhooks: {endpointUri: 'null', id: 'null'}};
    }
}

const deleteWebHook = async (webhook: {id:string}, token: string, url_track: string) => {
    const mutation = `
        mutation deleteWebhookSetting($id: ID!) {
            deleteWebhookSetting(id: $id) {
                id
            }
        }`;
    
    try {
        const response = await axios.post(
            url_track,
            {
                query: mutation,
                variables: {
                    id: webhook.id
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.status == 200) {
            return true;
        }
        return false;

    } catch (error) {
        console.log('Erreur deleteWebHook:', error);
        return false;
    }
}

const createWebHook = async (token:string, id_company:string, uri:string, url_track: string) => {
    const mutation_create_webhook_setting = `
      mutation CreateWebHookSettings ($input : WebhookSettingCreateInput!){
        createWebhookSetting(input : $input){
          id
          endpointUri
          orgId
          activated
        }
      }
    `;

    
    //const uri_ngrok = `${ngrok}/api/demande_collecte/web_hook/receive_web_hook`;
    const variables = {
        input: {
            companyId: id_company,
            endpointUri: uri,
            token: token,
            activated: true
        }
    };
    console.log('----- Variables', variables);

    try {
        const response = await axios.post(
            url_track,  // Ajout de /graphql à l'URL
            {   
                query: mutation_create_webhook_setting,
                variables: variables
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        /*if (!response.data.data) {
            console.log("Erreur GraphQL:", response.data.errors);
            throw new Error('Erreur GraphQL');
        }*/

        //console.error('WebHook créé', response);
        return {status: 200};
    } catch (error) {
        console.error("Erreur complète:", error);
        return {status: 500};
    }
}
