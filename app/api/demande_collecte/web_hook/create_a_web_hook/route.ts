import { NextResponse } from 'next/server';
import axios from 'axios';
import { cookies } from 'next/headers';

const ngrok = process.env.NGROK_URL;

export async function POST(req:Request) {
    
    let token_track = cookies().get('trackdechets_token')?.value;

    const req_json = await req.json();
    if(req_json.token_track){
        token_track = req_json.token_track;
    }
    console.log('token track pour create a webhook', token_track);
    
    let url_track = process.env.TRACKDECHETS_URL_SANDBOX;
    if(process.env.NEXT_PUBLIC_TRACK_TYPE === 'app'){
        url_track = process.env.TRACKDECHETS_URL_APP;
    }

    if (!token_track || !url_track || !ngrok) {
        return NextResponse.json({ 
            success: false, 
            message: "Configuration manquante (token, URL ou NGROK)" 
        }, { status: 500 });
    }

    console.log('Création d\'un webhook');
    const response_id_company = await GetIdCompany(token_track, url_track); //Id de la companie lié au token
    if(response_id_company.status === 200){
        const id_company =  response_id_company.id_company;
        createWebHook(token_track, url_track, id_company);
        return NextResponse.json({ status: 200, webhooks: "ok" }, { status: 200 });
    } else {
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }

} 

const createWebHook = async (token_track:string, url_track:string, id_company:string) => {
    
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
            token: token_track,
            activated: true
        }
    };
    console.log('----- Variables', variables);

    if (!url_track) {
        throw new Error('TRACKDECHETS_URL_SANDBOX environment variable is not defined');
    }
    try {
        const response = await axios.post(
            url_track,  // Ajout de /graphql à l'URL
            {   
                query: mutation_create_webhook_setting,
                variables: variables
            },
            {
                headers: {
                    Authorization: `Bearer ${token_track}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        /*if (!response.data.data) {
            console.log("Erreur GraphQL:", response.data.errors);
            throw new Error('Erreur GraphQL');
        }*/

        console.log('WebHook créé', response.data, uri_ngrok);
        return {status: 200};
    } catch (error) {
        console.error("Erreur complète:", error);
        return {status: 500};
    }
}

const GetIdCompany = async (token_track:string, url_track:string) => {
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

    if (!url_track) {
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
            url_track,
            {   
                query: query,
            },
            {
                headers: {
                    Authorization: `Bearer ${token_track}`,
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