import { NextResponse } from "next/server";
import axios from "axios";

const token_sandbox = "tCJJTq0Da55LuoJMc35QEqwomMRDwl10xT1hI2UV"
const url_sandbox = "https://api.sandbox.trackdechets.beta.gouv.fr"

export async function POST(req: Request) {
    console.log('Activation d\'un webhook');
    const { webhook } = await req.json();
    console.log('webhook : ', webhook);
    return activateWebhook(webhook);
}

const activateWebhook = async (webhook: {id: string, endpointUri: string, token: string}) => {
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
        url_sandbox, 
        {
            query: mutation,
            variables: variables
        }, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token_sandbox}`
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