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
    const response_ids_company = await GetIdsCompany(token_track, url_track); //Id de la companie lié au token
    if(response_ids_company.status === 200){
        for(const id_company of response_ids_company.ids_company){
            createWebHook(token_track, url_track, id_company);
        }
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

        if (response.data) {
            console.log('WebHook créé avec succès:', response.data);
            return {status: 200};
        } else  {
            console.error('Erreur création webhook:');
            return {status: 500};
        }
        
    } catch (error) {
        console.error("Erreur complète:", error);
        return {status: 500};
    }
}

const GetIdsCompany = async (token_track:string, url_track:string) => {
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
        const ids_company = response.data.data.myCompanies.edges.map(edge => edge.node.id);
        return {status: 200, ids_company: ids_company};

    } catch (error) {
        console.error('Error details:', error);
        return {status: 500, ids_company: []};
    }
}