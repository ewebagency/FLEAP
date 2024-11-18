import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET() {

    const token_sandbox = process.env.TRACKDECHETS_TOKEN_SANDBOX;
    const url_sandbox = process.env.TRACKDECHETS_URL_SANDBOX;
    const ngrok_url = process.env.NGROK_URL;

    if (!token_sandbox || !url_sandbox || !ngrok_url) {
        console.error('Variables d\'environnement manquantes');
        return NextResponse.json({ error: 'Variables d\'environnement non définies' }, { status: 500 });
    }

    const response_id_company : {status: number, id_company: string} = await GetIdCompany(token_sandbox);
    if(response_id_company.status === 200){
        const id_company =  response_id_company.id_company;
        
        interface ResponseWebhooks {
            status: number;
            webhooks: {endpointUri: string, id: string};
        }
        const response_webhooks : ResponseWebhooks = await getWebHooks(token_sandbox, id_company);
        
        const endpointUri_env = process.env.NGROK_URL + '/api/demande_collecte/web_hook/receive_web_hook';
        const endpointUri_trackdechets = response_webhooks.webhooks.endpointUri;
        
        console.log("url trackdechet = url fleap : ", endpointUri_env == endpointUri_trackdechets);
        if(endpointUri_env !== endpointUri_trackdechets){
            const web_hook_deleted = await deleteWebHook(response_webhooks.webhooks);
            //console.log('laaa', web_hook_deleted)
            if(web_hook_deleted){
                const web_hook_created = await createWebHook(token_sandbox, id_company, endpointUri_env);
                console.log('web_hook_created', web_hook_created);
                if(web_hook_created){
                    return NextResponse.json({ message: 'Nouveau webhook créé', webhooks: web_hook_created }, { status: 200 });
                } else {
                    return NextResponse.json({ message: 'Erreur lors de la création du webhook' }, { status: 500 });
                }
            };
        }
        return NextResponse.json(response_webhooks);
    } else {
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }

} 

const GetIdCompany = async (token:string) => {
    const url_sandbox = process.env.TRACKDECHETS_URL_SANDBOX;
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

    if (!url_sandbox) {
        throw new Error('TRACKDECHETS_URL_SANDBOX environment variable is not defined');
    }
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
            url_sandbox,
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

const getWebHooks = async (token:string, id_company:string) => {
    const url_sandbox = process.env.TRACKDECHETS_URL_SANDBOX;
    const token_sandbox = process.env.TRACKDECHETS_TOKEN_SANDBOX;
    
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

    if (!url_sandbox) {
        throw new Error('TRACKDECHETS_URL_SANDBOX environment variable is not defined');
    }
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
            url_sandbox,
            {   
                query: query,
            },
            {
                headers: {
                    Authorization: `Bearer ${token_sandbox}`,
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

const deleteWebHook = async (webhook: {id:string}) => {
    const url_sandbox = process.env.TRACKDECHETS_URL_SANDBOX;
    const token_sandbox = process.env.TRACKDECHETS_TOKEN_SANDBOX;
    const mutation = `
        mutation deleteWebhookSetting($id: ID!) {
            deleteWebhookSetting(id: $id) {
                id
            }
        }`;
    
    if (!url_sandbox) {
        throw new Error('TRACKDECHETS_URL_SANDBOX environment variable is not defined');
    }

    try {
        const response = await axios.post(
            url_sandbox,
            {
                query: mutation,
                variables: {
                    id: webhook.id
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${token_sandbox}`,
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

const createWebHook = async (token:string, id_company:string, uri:string) => {
    const url_sandbox = process.env.TRACKDECHETS_URL_SANDBOX;
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

    if (!url_sandbox) {
        throw new Error('TRACKDECHETS_URL_SANDBOX environment variable is not defined');
    }
    try {
        const response = await axios.post(
            url_sandbox,  // Ajout de /graphql à l'URL
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

        console.log('WebHook créé', response.data);
        return {status: 200, data: response.data};
    } catch (error) {
        console.error("Erreur complète:", error);
        return {status: 500};
    }
}
