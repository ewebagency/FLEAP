import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(req: Request) {
    try {
        const req_json = await req.json();
        const token_track = req_json.token_track;
        let url_track = process.env.TRACKDECHETS_URL_SANDBOX;
        if(process.env.NEXT_PUBLIC_TRACK_TYPE === 'app'){
            url_track = process.env.TRACKDECHETS_URL_APP;
        }
        console.log('url_traaaack', url_track);

        if(!token_track || !url_track){
            return NextResponse.json({ message: "Token ou url_track non trouvé" }, { status: 400 });
        }

        const webhook = await getWebHooks(token_track, url_track);
        const delete_webhook = await deleteWebHook(webhook.webhooks, token_track, url_track);
        if(delete_webhook){
            return NextResponse.json({ message: "Webhook supprimé" }, { status: 200 });
        } else {
            return NextResponse.json({ message: "Erreur lors de la suppression du webhook" }, { status: 500 });
        }
    } catch (error) {
        console.error('Error in DELETE webhook route:', error);
        return NextResponse.json({ message: "Erreur interne du serveur" }, { status: 500 });
    }
}


//Renvoie l'id du 1er webhook lié à ce token track
const getWebHooks = async (token:string, url_track: string) => {
    
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

//Si tu as le token et l'id du webhook correspondant, supprime le webhook
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