// app/api/store-info-mano/route.ts
import { NextResponse } from "next/server";
import { supabase } from '@/app/database/supabaseClient';


export async function POST(request: Request) {
  const { pdfId, session_user_id, formValues } = await request.json(); // Récupérer les données du corps de la requête

  // Vérifier si formValues est un tableau
  if (Array.isArray(formValues)) {
    // Insérer chaque élément dans la table 'facture'
    const insertPromises = formValues.map(async (formValue) => {
      const { error } = await supabase
        .from('facture')
        .insert([
          {
            user_id: session_user_id, // Utiliser session_user_id
            pdf_infos_id: pdfId, // Utiliser pdfId
            infos_json: formValue, // Stocker les informations du PDF
          },
        ]);

      if (error) {
        console.error('Erreur lors de l\'insertion dans Supabase:', error);
        throw new Error('Erreur lors de l\'insertion des données');
      }
    });

    // Attendre que toutes les insertions soient terminées
    try {
        await Promise.all(insertPromises);
      } catch (error) {
        // Assertion de type pour indiquer que error est de type Error
        if (error instanceof Error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        } else {
          return NextResponse.json({ error: 'Une erreur inconnue est survenue.' }, { status: 500 });
        }
      }
  } else {
    // Si formValues n'est pas un tableau, insérer directement
    const { error } = await supabase
      .from('facture')
      .insert([
        {
          user_id: session_user_id, // Utiliser session_user_id
          pdf_infos_id: pdfId, // Utiliser pdfId
          infos_json: formValues, // Stocker les informations du PDF
        },
      ]);

    if (error) {
      console.error('Erreur lors de l\'insertion dans Supabase:', error);
      return NextResponse.json({ error: 'Erreur lors de l\'insertion des données' }, { status: 500 });
    }
  }

  return NextResponse.json({ message: 'Données enregistrées avec succès' }, { status: 200 });
}
