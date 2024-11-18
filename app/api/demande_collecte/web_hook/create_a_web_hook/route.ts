import { NextResponse } from 'next/server';
import axios from 'axios';

const url_sandbox = process.env.TRACKDECHETS_URL_SANDBOX;
const token_sandbox = process.env.TRACKDECHETS_TOKEN_SANDBOX;
const ngrok = process.env.NGROK_URL;


export async function POST(req:Request) {
    if (!token_sandbox) {
        throw new Error('TRACKDECHETS_TOKEN_SANDBOX environment variable is not defined');
    }
    console.log('Création d\'un webhook');
    const { url, id_company_reçu } = await req.json(); // inutile car id lié au token
    //console.log('id_company_reçu', id_company_reçu);
    const response_id_company = await GetIdCompany(token_sandbox); //Id de la companie lié au token
    if(response_id_company.status === 200){
        const id_company =  response_id_company.id_company;
        //const uri = encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL}/api/demande_collecte/get_webhooks`);
        //const uri = `${process.env.NEXT_PUBLIC_APP_URL}/api/demande_collecte/get_webhooks`;
        const uri = 'https://localhost:3000/api/demande_collecte/get_webhooks/';
        createWebHook(token_sandbox, id_company, uri);
        return NextResponse.json({ status: 200, webhooks: "ok" }, { status: 200 });
    } else {
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }

} 

const createWebHook = async (token:string, id_company:string, uri:string) => {
    
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

    
    const uri_ngrok = `${ngrok}/api/demande_collecte/web_hook/receive_web_hook`;
    const variables = {
        input: {
            companyId: id_company,
            endpointUri: uri_ngrok,
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
        return {status: 200};
    } catch (error) {
        console.error("Erreur complète:", error);
        return {status: 500};
    }
}

const GetIdCompany = async (token:string) => {
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