import { NextResponse } from "next/server";
import { supabase } from "@/app/database/supabaseClient";

export async function POST(request: Request) {
    try {
        const { factureId, lineNumber, bsdId } = await request.json();

        // GET FACTURE_JSON
        // 1. Récupérer l'infos_json de la facture
        // 1.1 Récupérer la facture dans la BDD
        const { data: factureData, error: factureError } = await supabase
            .from('facture')
            .select('infos_json')
            .eq('id', factureId)
            .single();

        if (factureError) throw factureError;

        // GET FACTURE_JSON_LINE
        // 1.2 Récupérer la ligne de l'infos_json de la facture

        console.log("factureDataaaa", factureData);
        const factureLineData = factureData.infos_json.departs[lineNumber - 1];
        console.log("factureLineDataaaa", factureLineData);

        // UPDATE BSD_INFOS_COUTS - OK !
        // 2. Mettre à jour le BSD avec les nouvelles infos
        const { error: updateError } = await supabase
            .from('bsd')
            .update({ 
                facture_infos: factureLineData,
                facture_treated: true 
            })
            .eq('id', bsdId);

        if (updateError) throw updateError;

        // 3. Marquer la facture comme traitée
        
        // UPDATE FACTURE_JSON_LINE EN LOCAL
        // 3.1 Mettre à jour le futur json du BSD en ne touchant qu'à la ligne concernée

        const updatedInfosJson = factureData.infos_json;
        updatedInfosJson.departs[lineNumber - 1].infos_pour_filtrer.bsd_id = bsdId;
        updatedInfosJson.departs[lineNumber - 1].infos_pour_filtrer.linked_to_bsd = true;

        console.log("factureDataLine222", factureData.infos_json.departs[lineNumber - 1].infos_pour_filtrer);

        // UPDATE FACTURE_JSON
        // 3.2 Mettre à jour le json-ligne de la facture dans la BDD en changeant tout le json (une seule ligne est réellement modifiée)
        const { error: factureUpdateError } = await supabase
            .from('facture')
            .update({ 
                infos_json: updatedInfosJson
            })
            .eq('id', factureId);

        if (factureUpdateError) throw factureUpdateError;

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error linking documents:', error);
        return NextResponse.json(
            { error: 'Failed to link documents' },
            { status: 500 }
        );
    }
}