import { NextResponse } from 'next/server';
import axios from 'axios';
import { supabase } from '@/app/database/supabaseClient';
import { BSDD_TrackDechets, DataOnSupabase_infos_json, FormInput } from '@/app/register/interface/BSD_Interface';
import { cookies } from 'next/headers';
import { OtherInfos } from '@/app/register/interface/BSD_Interface';

const updateTrackdechets = async (data: {formAPI:{createFormInput:FormInput}}, bsdId: string, token: string, url: string) => {
    try {
        const mutation = `
            mutation UpdateForm($updateFormInput: UpdateFormInput!) {
                updateForm(updateFormInput: $updateFormInput) {
                    id
                    readableId
                    status
                }
            }
        `;

        const variables = {
            updateFormInput: {
                ...data.formAPI.createFormInput,
                id: bsdId
            }
        };

        const response = await axios.post(
            url,
            { query: mutation, variables },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.status === 200) {
            console.log('BSD modifié avec succès sur Trackdéchets', response.data);
            return {
                success: true, 
                data: response.data,
                error: null
            };
        }
        
        return {
            success: false,
            error: "Erreur lors de la modification du BSD sur Trackdéchets",
            data: null
        };
    } catch (error) {
        console.error('Erreur lors de la modification du BSD sur Trackdéchets:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Une erreur inconnue est survenue',
            data: null
        };
    }
};

export async function POST(request: Request) {
    console.log("Modification du BSD -- début");
    const token_track = cookies().get('trackdechets_token')?.value;
    console.log("token_track récupéré par cookies :", token_track);
    let url_track = process.env.TRACKDECHETS_URL_SANDBOX;
    if(process.env.NEXT_PUBLIC_TRACK_TYPE === 'app'){
        url_track = process.env.TRACKDECHETS_URL_APP;
    }

    try {
        const { user_id, bsd_id, infos_json, created_at, other_infos } = await request.json();

        if (!user_id || !bsd_id || !infos_json) {
            return NextResponse.json({ 
                success: false, 
                message: "Données manquantes" 
            }, { status: 400 });
        }

        // 1. Récupérer l'ID Trackdéchets du BSD
        const { data: bsdData, error: bsdError } = await supabase
            .from('bsd')
            .select('id_track_dechets, on_track_dechets')
            .eq('id', bsd_id)
            .single();

        console.log("bsdDataaaa", bsdData);

        if (bsdError || !bsdData) {
            throw new Error("Erreur lors de la récupération de l'ID Trackdéchets");
        }
        
        //On enlève les champs qui ne sont pas modifiable sur Trackdéchets (orgId, other..)     
        const data_augmented = augmentData(infos_json);
        const data_on_track = cleanData(data_augmented);      

        if(bsdData.on_track_dechets){
            // 2. Mise à jour dans Trackdéchets
            if (!token_track || !url_track) {
                return NextResponse.json({ 
                    success: false, 
                    message: "Configuration manquante (token ou URL)" 
                }, { status: 500 });
            }

            const trackdechetsResponse = await updateTrackdechets(data_on_track, bsdData.id_track_dechets, token_track, url_track);
            
            if (!trackdechetsResponse.success) {
                return NextResponse.json({ 
                    success: false, 
                    message: `Erreur lors de la mise à jour sur Trackdéchets: ${trackdechetsResponse.error}` 
                }, { status: 400 });
            }
            // 3. Mise à jour dans Supabase
            const updateData: {infos_json: DataOnSupabase_infos_json, other_infos?: OtherInfos} = {
                infos_json,
            };

            if (other_infos !== undefined) {
                updateData.other_infos = other_infos;
            }

            const { error: supabaseError } = await supabase
                .from('bsd')
                .update(updateData)
                .eq('id', bsd_id)
                //.eq('user_id', user_id);

            if (supabaseError) {
                throw new Error(supabaseError.message);
            }

            return NextResponse.json({ 
                success: true, 
                message: "BSD modifié avec succès",
                trackdechetsData: trackdechetsResponse.data
            });
        } else {
            const updateData: {infos_json: DataOnSupabase_infos_json, other_infos?: OtherInfos, created_at?: string} = {
                infos_json,
            };

            if (other_infos !== undefined) {
                updateData.other_infos = other_infos;
            }
            if (created_at !== undefined) {
                updateData.created_at = created_at;
            }

            const { error: supabaseError } = await supabase
                .from('bsd')
                .update(updateData)
                .eq('id', bsd_id)
                //.eq('user_id', user_id);

            if (supabaseError) {
                throw new Error(supabaseError.message);
            }

            return NextResponse.json({ 
                success: true, 
                message: "BSD modifié avec succès",
                trackdechetsData: null
            });
        }

    } catch (error) {
        console.error("Erreur lors de la modification du BSD:", error);
        return NextResponse.json({ 
            success: false, 
            message: "Erreur lors de la modification du BSD",
            error: error instanceof Error ? error.message : 'Une erreur inconnue est survenue'
        }, { status: 500 });
    }
}


const cleanData = (data: {formAPI:{createFormInput:BSDD_TrackDechets}}) => {
   const data_clean = {
    formAPI: {
        createFormInput: {
            emitter: data.formAPI.createFormInput.emitter,
            recipient: data.formAPI.createFormInput.recipient,
            transporter: data.formAPI.createFormInput.transporter,
            wasteDetails: data.formAPI.createFormInput.wasteDetails,
        }
    }
   };

   if(data_clean.formAPI.createFormInput?.wasteDetails?.packagingInfos[0]?.type && data_clean.formAPI.createFormInput.wasteDetails.packagingInfos[0].type !== 'AUTRE'){
    delete data_clean.formAPI.createFormInput.wasteDetails.packagingInfos[0].other;
   }
   delete data_clean.formAPI.createFormInput.transporter.takenOverBy;
   delete data_clean.formAPI.createFormInput.transporter.takenOverAt;
   delete data_clean.formAPI.createFormInput.transporter.id;
   delete data_clean.formAPI.createFormInput.emitter.company.orgId;
   delete data_clean.formAPI.createFormInput.recipient.company.orgId;
   delete data_clean.formAPI.createFormInput.transporter.company.orgId;

   return data_clean;
}


const augmentData = (data: {formAPI:{createFormInput:FormInput}}) => {
    const vierge_data: FormInput = {
        emitter: {
          type: "PRODUCER",
          workSite: { name: "", address: "", postalCode: "", city: "", infos: "" },
          company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
          isPrivateIndividual: false,
          isForeignShip: false,
        },
        recipient: {
          company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
          cap: "",
          processingOperation: "",
          isTempStorage: false,
        },
        transporter: {
          company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
          isExemptedOfReceipt: false,
          receipt: "",
          numberPlate: "",
          customInfo: "",
        },
        wasteDetails: {
          code: "",
          name: "",
          isSubjectToADR: false,
          onuCode: "",
          packagingInfos: [{ type: "AUTRE", quantity: 0, other: "" }],
          quantity: 0,
          quantityType: "ESTIMATED",
          consistence: "",
          pop: false,
          isDangerous: false,
          parcelNumbers: { city: "", postalCode: "", prefix: "", section: "", number: "" },
          analysisReferences: "",
          landIdentifiers: "",
          sampleNumber: "",
        },
        trader: {
          receipt: "",
          department: "",
          validityLimit: "",
          company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
        },
        broker: {
          receipt: "",
          department: "",
          validityLimit: "",
          company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
        },
        //grouping: { form: { id: "" }, quantity: 0 },//Pour l'instant on va dire qu'on ne permet pas de grouper les déchets
        ecoOrganisme: { name: "", siret: "" },
        temporaryStorageDetail: {
          company: { name: "", siret: "", address: "", country: "", contact: "", phone: "", mail: "" },
          cap: "",
          processingOperation: "",
        }, //Si le recipient est un stockage provisoire, on va mettre les infos du destinataire final pour le traitement 
        //intermediaries: [],
      }
    if(data.formAPI.createFormInput?.emitter?.company){
      vierge_data.emitter.company = data.formAPI.createFormInput.emitter.company;
    }
    if(data.formAPI.createFormInput?.emitter?.workSite){
        vierge_data.emitter.workSite = data.formAPI.createFormInput.emitter.workSite;
    }
    if(data.formAPI.createFormInput?.recipient){
        vierge_data.recipient = data.formAPI.createFormInput.recipient;
    }
    if(data.formAPI.createFormInput?.recipient?.company){
      vierge_data.recipient.company = data.formAPI.createFormInput.recipient.company;
    }
    if(data.formAPI.createFormInput?.transporter?.company){
      vierge_data.transporter.company = data.formAPI.createFormInput.transporter.company;
    }
    if(data.formAPI.createFormInput?.wasteDetails){
        vierge_data.wasteDetails = data.formAPI.createFormInput.wasteDetails;
    }
    return {formAPI:{createFormInput:vierge_data}} as {formAPI:{createFormInput:BSDD_TrackDechets}};
}
