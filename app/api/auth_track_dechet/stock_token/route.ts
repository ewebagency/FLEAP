import { supabase } from "@/app/database/supabaseClient";
import { NextResponse } from "next/server";



export async function GET(request: Request) {
    const stockOnBDD = async (new_token: string, user_id: string) => {      
        const alreadyExistTokens = await supabase
        .from('token_track')
        .select('*')
        .eq('user_id', user_id);

        if(alreadyExistTokens.data && alreadyExistTokens.data.length > 0){
            for(const past_token of alreadyExistTokens.data.map(past_token => past_token.token)){
                console.log('deleteWebHook dans stock_token', past_token);
                await deleteWebHook(past_token);
            }

            const { data, error } = await supabase
            .from('token_track')
            .update({token: new_token})
            .eq('user_id', user_id);
        } else {
            const { data, error } = await supabase
            .from('token_track')
            .insert({token: new_token, user_id: user_id});
        }

        await createWebHook(new_token);
        console.log('Nouveau token stocké !! ', new_token);
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const user_id = searchParams.get('user_id');
    if(token && user_id){
        await stockOnBDD(token, user_id);
        return NextResponse.json({ message: "Token stocké" }, { status: 200 });
    } else {
        return NextResponse.json({ message: "Token ou user_id non trouvé" }, { status: 400 });
    }
}

const deleteWebHook = async (token: string) => {
  const app_url = process.env.NEXT_PUBLIC_APP_URL;
  const response = await fetch(`${app_url}/api/demande_collecte/web_hook/delete_webhook`, {
    method: 'POST',
    body: JSON.stringify({
      token_track: token
    })
  });
  console.log('response delete webhook dans stock_token', response);
}

const createWebHook = async (token: string) => {
  const app_url = process.env.NEXT_PUBLIC_APP_URL;
  const response = await fetch(`${app_url}/api/demande_collecte/web_hook/create_a_web_hook`, {
    method: 'POST',
    body: JSON.stringify({
      token_track: token
    })
  });
  console.log('response create webhook dans stock_token', response);
}
