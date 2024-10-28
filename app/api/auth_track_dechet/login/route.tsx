// app/api/auth/login/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  console.log("GET AUTH LOGIN");
  const clientId = process.env.NEXT_PUBLIC_TRACKDECHETS_CLIENT_ID;
  const redirectUri = encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth_track_dechet/callback`);
  const authUrl = `https://app.trackdechets.beta.gouv.fr/oauth2/authorize/dialog?response_type=code&redirect_uri=${redirectUri}&client_id=${clientId}`;

  return NextResponse.redirect(authUrl);
}
