// components/FormulaireMano.tsx

import { useState } from 'react';
import { useFormData } from './hooks/useFormData';

import { useEntrepriseId } from './hooks/useEntrepriseId';

import { HeaderSection } from './components/HeaderSection';
import { DepartSection } from './components/DepartSection';
import { FooterSection } from './components/FooterSection';
import { FormulaireManoProps } from './types/interfaces';
import { supabase } from '@/app/database/supabaseClient';
import { useAccessOtherAccount } from '../AccessOtherAccounts/AccessOtherAccountContext';
import { cleanFormData } from './utils/cleanData';
import { FactureLine } from './types/interfaces';

export default function FormulaireMano({ currentPdfId, onNextPdf }: FormulaireManoProps) {
    const [loading, setLoading] = useState(false);
    const entrepriseId = useEntrepriseId(currentPdfId);
    const { selectedAccounts } = useAccessOtherAccount();
    const userId = selectedAccounts[0]?.user_id;
    
    const { 
        formData, 
        setFormData,
        allOptions,
        filteredOptionsByDepart,
        departFilters,
        resetFilteredFields
    } = useFormData(currentPdfId, entrepriseId);

    const calculateTotal = (formData: FactureLine): number => {
        return formData.departs.reduce((departAcc, depart) => {
            return departAcc + depart.line_body.reduce((lineAcc, line) => {
                return lineAcc + (line.montant_ht || 0);
            }, 0);
        }, 0);
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLoading(true);

        try {
            if (!currentPdfId || !entrepriseId) return;

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

    const handleFormUpdate = (newData: FactureLine, departIndex?: number) => {
        setFormData(newData, departIndex);
    };

    return (
        <div className="w-full p-2">
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-bold">Formulaire de facture</h2>
                <button
                    type="button"
                    onClick={resetFilteredFields}
                    className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                    Réinitialiser les filtres
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
                <HeaderSection 
                    formData={formData}
                    
                    onUpdate={setFormData}
                    allOptions={allOptions}
                    filteredOptionsByDepart={filteredOptionsByDepart}
                />

                <DepartSection 
                    formData={formData}
                    onUpdate={setFormData}
                    allOptions={allOptions}
                    filteredOptionsByDepart={filteredOptionsByDepart}
                    departFilters={departFilters}
                    entrepriseId={entrepriseId}
                    sites={[]}
                    wasteTypes={[]}
                    wasteCodes={[]}
                    filieres={[]}
                />

                <FooterSection 
                    total={calculateTotal(formData)}
                    onSkip={handleSkip}
                    onReset={handleResetSkipped}
                    loading={loading}
                />
            </form>
        </div>
    );
}
