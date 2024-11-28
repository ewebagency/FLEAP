// app/interface_admin_2/fetch_current_pdf/route.ts
// Va chercher tous les pdfs, demande un par un à check_if_pdf_already_treated_in_facture 
// si il est traité ou pas et renvoie le premier qui n'est pas traité
import { supabase } from '@/app/database/supabaseClient';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  const data_with_user_ids = await request.json(); // Récupère les données envoyées
  const user_ids = data_with_user_ids.user_ids;

  const { data, error } = await supabase
  .from('pdf_infos')
  .select('id, name_pdf_in_bucket')
  .eq('status', 'unread')
  .in('user_id', user_ids); //on prend les pdfs des utilisateurs sélectionnés dans AccessOtherAccount
  
  if (error) {
    console.error("Erreur lors de la récupération des PDF du bucket:", error);
    return NextResponse.json({ pdfIds: [], pdfPaths: [] }); // Ensure this returns a NextResponse
  }
  
  if (data.length === 0) {
    return NextResponse.json({ something_to_treat: false, pdf_id: '', pdf_path: '' }); // Handle case with no PDFs
  }

  for(let i = 0; i < data.length; i++){
      const pdf_id = data[i].id;
      const pdf_path = data[i].name_pdf_in_bucket;
      const is_treated_in_facture = await check_if_pdf_already_treated_in_facture(pdf_id);
      const is_treated_in_bsd = await check_if_pdf_already_treated_in_bsd(pdf_id); 
      console.log("is_treated_in_facture : ", is_treated_in_facture);
      console.log("is_treated_in_bsd : ", is_treated_in_bsd);
      if(!is_treated_in_facture && !is_treated_in_bsd){
        return NextResponse.json({ something_to_treat: true, pdf_id: pdf_id, pdf_path: pdf_path }); // Ensure this returns a NextResponse
      }
  }
  
  console.log("all pdfs already treated");
  return NextResponse.json({ something_to_treat: false, pdf_id: '', pdf_path: '' }); // Ensure this returns a NextResponse
}

const check_if_pdf_already_treated_in_facture = async (pdf_id: string) => {
  const { data, error } = await supabase
  .from('facture')
  .select('id')
  .eq('pdf_infos_id', pdf_id)
  .limit(1)
  .maybeSingle();

  if(error){
    console.error("Erreur lors de la vérification de l'existence du PDF dans la table facture:", error);
    return false;
  }
  console.log("data retrieved : ", data);
  if(data===null){
    return false; //pdf not treated
  } else {
    return true; //pdf treated
  }
}

const check_if_pdf_already_treated_in_bsd = async (pdf_id: string) => {
    const { data, error } = await supabase
    .from('bsd')
    .select('id')
    .eq('pdf_infos_id', pdf_id)
    .limit(1)
    .maybeSingle();
  
    if(error){
      console.error("Erreur lors de la vérification de l'existence du PDF dans la table bsd:", error);
      return false;
    }
    console.log("data retrieved : ", data);
    if(data===null){
      return false; //pdf not treated
    } else {
      return true; //pdf treated
    }
  }
