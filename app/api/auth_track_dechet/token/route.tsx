// app/api/auth/token/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  console.log("GET AUTH TOKEN");
  const token_track_dechets = await cookies().get('trackdechets_token');
  return NextResponse.json({ data: token_track_dechets }, { status: 200 });
}