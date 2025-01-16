// components/FormulaireMano.tsx

import { useState } from 'react';
import { useFormData } from './hooks/useFormData';
import { usePrestataires } from './hooks/usePrestataires';
import { useSites } from './hooks/useSites';
import { useEntrepriseId } from './hooks/useEntrepriseId';
import { useWasteData } from './hooks/useWasteData';
import { HeaderSection } from './components/HeaderSection';
import { DepartSection } from './components/DepartSection';
import { FooterSection } from './components/FooterSection';
import { FormulaireManoProps } from './types/interfaces';
import { supabase } from '@/app/database/supabaseClient';
import { useAccessOtherAccount } from '../AccessOtherAccounts/AccessOtherAccountContext';
import { cleanFormData } from './utils/cleanData';

export default function FormulaireMano({ currentPdfId, onNextPdf }: FormulaireManoProps) {
    const [loading, setLoading] = useState(false);
    const entrepriseId = useEntrepriseId();
    const { selectedAccounts } = useAccessOtherAccount();
    const userId = selectedAccounts[0]?.user_id;
    const { formData, setFormData } = useFormData(currentPdfId);
    const { prestataires, prestataireType, setPrestataireType } = usePrestataires(entrepriseId);
    const { sites } = useSites(entrepriseId);
    const { wasteTypes, wasteCodes, filieres } = useWasteData(entrepriseId);


    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLoading(true);

        try {
            if (!currentPdfId) return;

            // Mettre à jour le status de pdf_infos
            await supabase
                .from('pdf_infos')
                .update({
                    status: 'read'
                })
                .eq('id', currentPdfId);

            // Vérifier si une facture existe déjà
            const { data: existingFacture } = await supabase
                .from('facture')
                .select('id')
                .eq('pdf_infos_id', currentPdfId)
                .single();

            let result;
            if (existingFacture) {
                // Mise à jour si la facture existe
                result = await supabase
                    .from('facture')
                    .update({
                        entreprise_id: entrepriseId,
                        user_id: userId,
                        infos_json: cleanFormData(formData),
                    })
                    .eq('id', existingFacture.id)
                    .select();
            } else {
                // Création si la facture n'existe pas
                result = await supabase
                    .from('facture')
                    .insert({
                        entreprise_id: entrepriseId,
                        user_id: userId,
                        pdf_infos_id: currentPdfId,
                        infos_json: cleanFormData(formData),
                    })
                    .select();
            }

            if (result.error) {
                console.error('Erreur lors de la sauvegarde:', result.error);
            } else {
                console.log('Sauvegarde réussie:', result.data);
                onNextPdf();
            }
        } catch (error) {
            console.error('Erreur lors de la sauvegarde:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSkip = async () => {
        if (!currentPdfId) return;
        setLoading(true);

        try {
            await supabase
                .from('facture')
                .upsert({
                    pdf_infos_id: currentPdfId,
                    status: 'skipped'
                });

            onNextPdf();
        } catch (error) {
            console.error('Erreur lors du skip:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleResetSkipped = async () => {
        setLoading(true);

        try {
            await supabase
                .from('facture')
                .update({ status: 'pending' })
                .eq('status', 'skipped');

            onNextPdf();
        } catch (error) {
            console.error('Erreur lors de la réinitialisation:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full p-2">
            <h2 className="text-lg font-bold mb-3">Formulaire de facture</h2>

            <form onSubmit={handleSubmit} className="space-y-3">
                <HeaderSection 
                    formData={formData}
                    prestataireType={prestataireType}
                    setPrestataireType={setPrestataireType}
                    prestataires={prestataires}
                    onUpdate={setFormData}
                />

                <DepartSection 
                    formData={formData}
                    sites={sites}
                    wasteTypes={wasteTypes}
                    wasteCodes={wasteCodes}
                    filieres={filieres}
                    onUpdate={setFormData}
                />

                <FooterSection 
                    total={formData.footer.total_ht}
                    onSkip={handleSkip}
                    onReset={handleResetSkipped}
                    loading={loading}
                />
            </form>
        </div>
    );
}
