import { supabase } from "@/app/database/supabaseClient";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";



export async function GET(request: Request) {
    const stockOnBDD = async (token: string, user_id: string) => {      
        const alreadyExist = await supabase
        .from('token_track')
        .select('*')
        .eq('user_id', user_id);
      
        if(alreadyExist.data && alreadyExist.data.length > 0){
          const { data, error } = await supabase
          .from('token_track')
          .update({token: token})
          .eq('user_id', user_id);
        }else{
          const { data, error } = await supabase
            .from('token_track').insert({token: token, user_id: user_id});
          }

        console.log('Nouveau token stocké !! ', token);
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

