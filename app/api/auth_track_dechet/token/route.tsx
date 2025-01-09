// app/api/auth_track_dechet/token/route.ts
import { supabase } from "@/app/database/supabaseClient";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Désactiver le cache de la route
export const dynamic = 'force-dynamic';

export async function GET() {
  //console.log("GET AUTH TOKEN ------------");
  try {
    const token_cookie = cookies().get('trackdechets_token');

    //console.log('cookie stocké:', token_cookie?.value);
    const response = NextResponse.json({ data: token_cookie?.value }, { status: 200 });
    
    // Ajouter des headers pour empêcher la mise en cache
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    console.log('Erreur lors de la récupération du token TrackDéchet :', error);
    return NextResponse.json({ data: 'pas de token' }, { status: 400 });
  }
}

const getTokenOnSupabase = async () => {
  const user_id = (await supabase.auth.getUser()).data.user?.id;
  console.log("user_id dans getTokenOnSupabase : ", user_id);
  const { data, error } = await supabase
  .from('token_track')
  .select('*')
  .eq('user_id', user_id)
  .single();

  if(data){
    return data.token;
  }
  return null;
}

