// app/api/auth/callback/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/app/database/supabaseClient";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  
  let client_id = process.env.NEXT_PUBLIC_TRACK_CLIENT_ID_SANDBOX;
  let client_secret = process.env.TRACK_CLIENT_SECRET_SANDBOX;
  if (process.env.NEXT_PUBLIC_TRACK_TYPE === "app") {
    client_id = process.env.NEXT_PUBLIC_TRACK_CLIENT_ID_APP;
    client_secret = process.env.TRACK_CLIENT_SECRET_APP;
  }
  if (!code || !client_id || !client_secret) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }

  try {
    const credentials = Buffer.from(
      `${client_id}:${client_secret}`
    ).toString('base64');

    console.log("Credentials : ", credentials);
    console.log("Code : ", code);
    
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth_track_dechet/callback`;
    console.log("Redirect URI:", redirectUri);

    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${credentials}`,
    };
    
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirectUri,
      client_id: client_id || '',
    });

    console.log("Body:", body.toString());

    let url = "https://api.sandbox.trackdechets.beta.gouv.fr/oauth2/token";
    if(process.env.NEXT_PUBLIC_TRACK_TYPE === "app") {
      url = "https://api.trackdechets.beta.gouv.fr/oauth2/token";
    }
    console.log("url : ", url);
    console.log("headers : ", headers);
    console.log("body : ", body.toString());
    const tokenResponse = await fetch(url, {
      method: "POST",
      headers: headers,
      body: body.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Erreur de réponse:", {
        status: tokenResponse.status,
        body: errorText
      });
      throw new Error(`Erreur HTTP: ${tokenResponse.status} - ${errorText}`);
    }

    const { access_token } = await tokenResponse.json();

    console.log('cookie outdated', cookies().get('trackdechets_token'));
    cookies().delete("trackdechets_token"); //je sais pas si ça marche vraiment
    console.log('cookie supprimé', cookies().get('trackdechets_token'));

    cookies().set("trackdechets_token", access_token, {
      httpOnly: false,//true,
      secure: false,//process.env.NODE_ENV === "production",
      maxAge: 12 * 30 * 24 * 60 * 60, // 12 mois
      path: "/",
      sameSite: "none",
    });
    console.log('cookie mis à jour', cookies().get('trackdechets_token'));
    console.log("Token set in cookies", access_token);
    
    const response = NextResponse.redirect(new URL("/import_page?token=" + access_token, request.url));
    
    // Ajouter des headers pour empêcher la mise en cache
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    console.error("Erreur d'authentification:", error);
    return NextResponse.json({ error: "Erreur d'authentification" }, { status: 500 });
  }
}


