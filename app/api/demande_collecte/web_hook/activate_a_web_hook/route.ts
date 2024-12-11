import { NextResponse } from "next/server";
import axios from "axios";
import { cookies } from "next/headers";

export async function POST(req: Request) {

    const token_track = cookies().get('trackdechets_token')?.value;
    let url_track = process.env.TRACKDECHETS_URL_SANDBOX;
    if(process.env.NEXT_PUBLIC_TRACK_TYPE === 'app'){
        url_track = process.env.TRACKDECHETS_URL_APP;
    }
    if (!token_track || !url_track) {
        return NextResponse.json({ 
            success: false, 
            message: 'Token ou URL TrackDéchets non trouvés',
            error: 'Token ou URL TrackDéchets non trouvés'
        }, { status: 400 });
    }

    console.log('Activation d\'un webhook');
    const { webhook } = await req.json();
    console.log('webhook : ', webhook);
    return activateWebhook(webhook, token_track, url_track);
}

const activateWebhook = async (webhook: {id: string, endpointUri: string, token: string}, token_track: string, url_track: string) => {
    console.log('Activation du webhook : ', webhook);
    
    const mutation = `
    mutation UpdateWebHookSettings($id: ID!, $input: WebhookSettingUpdateInput!){
    updateWebhookSetting(id:$id, input:$input){
        id
        endpointUri
        orgId
        activated
    }
    }
    `;

    //Attention si on change faut changer le webhook (encore lié à mon ancienne adresse ngrok)

    const variables = {
                "id": webhook.id,
                "input": {
                "endpointUri": webhook.endpointUri,
                "token": webhook.token,
                "activated": true
                }
            }

    const response = await axios.post(
        url_track, 
        {
            query: mutation,
            variables: variables
        }, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token_track}`
            }
        }
    );

    if (response.status !== 200) {
        console.log('Erreur lors de l\'activation du webhook');
        return NextResponse.json({ status: 500, message: 'Erreur lors de l\'activation du webhook' }, { status: 500 });
    }

    console.log('Webhook activé avec succès', response.data);
    return NextResponse.json({ status: 200, message: 'Webhook activé avec succès' }, { status: 200 });

}