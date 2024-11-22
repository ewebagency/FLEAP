// app/api/auth/callback/route.ts
//L'Oauth de la sandbox ne fonctionne pas !
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  console.log("GET AUTH CALLBACK");
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Code manquant ou invalide" }, { status: 400 });
  }

  try {
    const tokenResponse = await fetch("https://api.trackdechets.beta.gouv.fr/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${process.env.TRACKDECHETS_CLIENT_ID}:${process.env.TRACKDECHETS_CLIENT_SECRET}`).toString("base64"),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth_track_dechet/callback`,
      }),
    });

    const tokenData = await tokenResponse.json();

    if ("error" in tokenData) {
      throw new Error(tokenData.error);
    }

    console.log("Token bien reçu ! ", tokenData);
    cookies().set("trackdechets_token", tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return NextResponse.redirect(new URL("/import_page", request.url));
  } catch (error) {
    console.error("Erreur lors de l'authentification:", error);
    return NextResponse.json({ error: "Erreur lors de l'authentification" }, { status: 500 });
  }
}
