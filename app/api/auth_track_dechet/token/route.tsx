// app/api/auth_track_dechet/token/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  console.log("GET AUTH TOKEN");
  try {
    const result = cookies().get('trackdechets_token');
    if (!result) {
      return NextResponse.json({ data: 'pas de token' }, { status: 400 });
    }
    console.log(result.value);
    return NextResponse.json({ data: result.value }, { status: 200 });
  } catch (error) {
    console.log('Erreur lors de la récupération du token TrackDéchet :', error);
    return NextResponse.json({ data: 'pas de token' }, { status: 400 });
  }
}