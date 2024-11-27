import { NextResponse } from "next/server";
import { supabase } from '@/app/database/supabaseClient';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const user_id = searchParams.get('user_id');

  if (!user_id) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('facture')
    .select('id, created_at, infos_json')
    .eq('user_id', user_id);

  const factures_non_traitees = [];
  /*if (data) {
    for (const facture of data) {
      const lignes = facture.infos_json.departs;
      for (let i = 0; i < lignes.length; i++) {
        if (lignes[i].linked_to_bsd === false) {
          factures_non_traitees.push({
            factureId: facture.id,
            lineNumber: i + 1,
            created_at: facture.created_at,
            infos: {...lignes[i], ...facture.infos_json.header}
          });
        }
      }
    }
  }*/
 if(data){
    for(const facture of data){
      if(facture.infos_json.depart.linked_to_bsd === false){
        factures_non_traitees.push(facture);
      }
    }
 }
 

  if (error) {
    return NextResponse.json({ error: 'Erreur lors de la récupération des données' }, { status: 500 });
  }
  //console.log("factures non traitées", factures_non_traitees);
  return NextResponse.json({ lignes: factures_non_traitees }, { status: 200 });
}
