'use client';

import { useState } from 'react';
import { smart_split, apply_smart_split } from '../utils/split';
import { getPdfInfoById } from '../utils/bdd';
import Swal from 'sweetalert2';
import { toast } from 'react-hot-toast';

interface BoutonSmartSplitDocProps {
    pdfId: string | number;
    entrepriseId: number;
    onSplitComplete?: (newPdfIds: string[]) => void;
    className?: string;
}

export default function BoutonSmartSplitDoc({ 
    pdfId, 
    entrepriseId,
    onSplitComplete, 
    className = '' 
}: BoutonSmartSplitDocProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleSmartSplit = async () => {
        setIsLoading(true);

        try {
            // Phase 1: Analyser le PDF
            toast('Analyse du document en cours...', { icon: '🔍' });
            const analysisResult = await smart_split(String(pdfId), entrepriseId);

            if (!analysisResult.success) {
                toast.error(analysisResult.message || 'Erreur lors de l\'analyse');
                return;
            }

            if (!analysisResult.segments || analysisResult.segments.length === 0) {
                toast('Aucun segment détecté', { icon: 'ℹ️' });
                return;
            }

            // Phase 2: Préparer la preview
            const segments = analysisResult.segments;
            const metadata = analysisResult.metadata;
            const alerts = metadata?.alerts || [];
            const hasAlerts = alerts.length > 0;
            
            // HTML pour les alertes (compact)
            const alertsHtml = hasAlerts ? `
                <div class="mb-2 p-2 bg-orange-50 rounded border-l-2 border-orange-400">
                    <div class="font-medium text-sm text-orange-800 mb-1">⚠️ ${alerts.length} incohérence(s) Gemini/Logique</div>
                    <div class="max-h-24 overflow-y-auto text-xs text-orange-700 space-y-0.5">
                        ${alerts.map(alert => `<div>P${alert.page_idx + 1}: ${alert.gemini_type} vs ${alert.logic_type}</div>`).join('')}
                    </div>
                </div>
            ` : `
                <div class="mb-2 p-2 bg-green-50 rounded border-l-2 border-green-400">
                    <div class="text-sm text-green-800">✅ Vérification OK</div>
                </div>
            `;
            
            const segmentsHtml = segments.map((segment) => {
                const typeEmoji = segment.type === 'facture' ? '💰' : segment.type === 'bon' ? '📦' : segment.type === 'bsd' ? '📋' : '📄';
                const pagesText = segment.pages.length === 1 ? `P${segment.pages[0] + 1}` : `P${segment.pages[0] + 1}-${segment.pages[segment.pages.length - 1] + 1}`;
                return `<div class="flex items-center justify-between text-sm py-1"><span>${typeEmoji} ${segment.type}</span><span class="text-gray-500">${pagesText}</span></div>`;
            }).join('');

            // Phase 3: Afficher la preview et demander confirmation
            const confirmed = await Swal.fire({
                title: 'Smart Split',
                html: `
                    <div class="text-left">
                        <div class="mb-2 p-2 bg-blue-50 rounded text-sm">
                            <span class="font-medium">📊</span> ${segments.length} segment(s) • ${metadata?.processing_time?.toFixed(1) || 0}s
                        </div>
                        
                        ${alertsHtml}
                        
                        <div class="mb-2 p-2 bg-gray-50 rounded">
                            ${segmentsHtml}
                        </div>
                        
                        <div class="p-2 bg-yellow-50 rounded text-xs text-yellow-800">
                            ⚠️ Action irréversible - Division selon segments détectés
                        </div>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: '✅ Confirmer',
                cancelButtonText: '❌ Annuler',
                confirmButtonColor: '#3b82f6',
                cancelButtonColor: '#ef4444',
                width: '600px',
                customClass: {
                    popup: 'text-left',
                    htmlContainer: 'text-left'
                }
            });

            if (!confirmed.isConfirmed) {
                toast('Smart split annulé', { icon: '❌' });
                return;
            }

            // Phase 4: Appliquer le split
            toast('Application du smart split...', { icon: '⏳' });
            
            const { data: pdfInfo, error: pdfError } = await getPdfInfoById(String(pdfId), entrepriseId);
            
            if (pdfError || !pdfInfo) {
                toast.error('Erreur: Impossible de récupérer les informations du PDF');
                return;
            }

            const splitResult = await apply_smart_split(pdfInfo, segments);
            
            if (splitResult.success) {
                toast.success('Smart split réussi !');
                if (splitResult.newPdfIds && onSplitComplete) {
                    onSplitComplete(splitResult.newPdfIds);
                }
            } else {
                toast.error(`Erreur: ${splitResult.message}`);
            }

        } catch (error) {
            console.error('Erreur smart split:', error);
            toast.error('Erreur lors du smart split');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            onClick={handleSmartSplit}
            disabled={isLoading}
            className={`
                px-4 py-2 rounded-lg font-medium transition-all duration-200 text-xs
                ${isLoading 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-lg'
                }
                ${className}
            `}
            title="Division intelligente avec détection automatique des types de documents"
        >
            {isLoading ? (
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Smart split...
                </div>
            ) : (
                '🧠 Smart Split'
            )}
        </button>
    );
}

