// app/interface_admin_2/fetch_current_pdf/route.ts
// Va chercher tous les pdfs, demande un par un à check_if_pdf_already_treated 
// si il est traité ou pas et renvoie le premier qui n'est pas traité
import { supabase } from '@/app/database/supabaseClient';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const data_with_user_id = await request.json(); // Récupère les données envoyées
  const user_id = data_with_user_id.user_id;

  const { data, error } = await supabase //get all pdfs from this user , (id, name_pdf_in_bucket)
  .from('pdf_infos')
  .select('id, name_pdf_in_bucket')
  .eq('user_id', user_id);
  if (error) {
    console.error("Erreur lors de la récupération des PDF du bucket:", error);
    return { pdfIds: [], pdfPaths: [] }; // Retourne un objet avec des tableaux vides
    }
  if (data.length === 0) {
    return NextResponse.json({ something_to_treat: false, pdf_id: '', pdf_path: '' }); // Handle case with no PDFs
  }

  for(let i = 0; i < data.length; i++){
      const pdf_id = data[i].id;
      const pdf_path = data[i].name_pdf_in_bucket;
      const is_treated = await check_if_pdf_already_treated(user_id, pdf_id);
      console.log("is_treated : ", is_treated);
      if(!is_treated){
        return NextResponse.json({ something_to_treat: true, pdf_id:pdf_id, pdf_path:pdf_path });;
      }
    }
    console.log("all pdfs already treated");
    return NextResponse.json({ something_to_treat: false, pdf_id:'', pdf_path:'' });

}

const check_if_pdf_already_treated = async (user_id: string, pdf_id: string) => {
  const { data, error } = await supabase
  .from('facture')
  .select('id')
  .eq('pdf_infos_id', pdf_id)
  .limit(1)
  .maybeSingle();

  if(error){
    console.error("Erreur lors de la vérification de l'existence du PDF :", error);
    return false;
  }
  console.log("data retrieved : ", data);
  if(data===null){
    return false; //pdf not treated
  } else {
    return true; //pdf treated
  }
}
