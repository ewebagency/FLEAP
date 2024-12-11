// app/api/auth_track_dechet/login/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  console.log("GET AUTH LOGIN");
  let clientId = process.env.NEXT_PUBLIC_TRACK_CLIENT_ID_SANDBOX;
  if (process.env.NEXT_PUBLIC_TRACK_TYPE === "app") {
    clientId = process.env.NEXT_PUBLIC_TRACK_CLIENT_ID_APP;
  }
  const redirectUri = encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth_track_dechet/callback`);
  //CHANGER
  let authUrl = `https://sandbox.trackdechets.beta.gouv.fr/oauth2/authorize/dialog?response_type=code&redirect_uri=${redirectUri}&client_id=${clientId}`;
  if (process.env.NEXT_PUBLIC_TRACK_TYPE === "app") {
    authUrl = `https://app.trackdechets.beta.gouv.fr/oauth2/authorize/dialog?response_type=code&redirect_uri=${redirectUri}&client_id=${clientId}`;
  }

  return NextResponse.redirect(authUrl);
}
