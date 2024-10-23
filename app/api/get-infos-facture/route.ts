import { NextResponse } from "next/server";
import { supabase } from '@/app/database/supabaseClient';

export async function POST(request: Request) {
  const { user_id } = await request.json(); // Récupérer l'ID de l'utilisateur depuis la requête

  const { data, error } = await supabase
    .from('facture') // Remplacez par le nom de votre table
    .select('*')
    .eq('user_id', user_id); // Filtrer par user_id

  if (error) {
    console.error('Erreur lors de la récupération des informations de la facture:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des données' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 200 });
}
