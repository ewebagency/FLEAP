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
        console.log('FormData pour calcul total:', JSON.stringify(formData, null, 2));
        
        if (!formData?.departs) {
            console.log('Pas de departs trouvés');
            return 0;
        }
        
        let total = 0;
        for (const depart of formData.departs) {
            console.log('Depart:', JSON.stringify(depart, null, 2));
            
            if (!depart?.line_body) {
                console.log('Pas de line_body trouvé pour un depart');
                continue;
            }
            
            console.log('Nombre d\'opérations:', depart.line_body.length);
            
            for (const line of depart.line_body) {
                console.log(`Opération: ${line.type_operation}, Montant: ${line.montant_ht}, Prix unitaire: ${line.prix_unitaire}, Quantité: ${line.quantite}`);
                if (line.type_operation.toLowerCase() === 'rachat') {
                    total -= (line.montant_ht || 0);
                } else {
                    total += (line.montant_ht || 0);
                }
            }
        }
        
        console.log('Total calculé:', total);
        return Math.round(total * 100) / 100;
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLoading(true);

        try {
            if (!currentPdfId || !entrepriseId) return;

            // Calculer et mettre à jour le total avant la sauvegarde
            const total = calculateTotal(formData);
            const updatedFormData = {
                ...formData,
                header: {
                    ...formData.header,
                    date_facture: formData.header.date_facture 
                        ? new Date(formData.header.date_facture).toISOString()
                        : new Date().toISOString()
                },
                footer: {
                    ...formData.footer,
                    total_ht: total
                }
            };

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
                result = await supabase
                    .from('facture')
                    .update({
                        entreprise_id: entrepriseId,
                        user_id: userId,
                        infos_json: cleanFormData(updatedFormData),
                    })
                    .eq('id', existingFacture.id)
                    .select();
            } else {
                result = await supabase
                    .from('facture')
                    .insert({
                        entreprise_id: entrepriseId,
                        user_id: userId,
                        pdf_infos_id: currentPdfId,
                        infos_json: cleanFormData(updatedFormData),
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
