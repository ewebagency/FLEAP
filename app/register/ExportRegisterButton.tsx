import { useState } from "react";
import { useSession } from "../component/SessionProvider";
import BoxIcon from '@/app/component/BoxIconWrapper';
import { useFilterContext } from "../FilterContext";
import Swal from 'sweetalert2';

const ExportRegisterButton = () => {
    const session = useSession();
    const { segmentDates, sites, filieres, filieres_ou_prestataires } = useFilterContext();
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [messageType, setMessageType] = useState<'success' | 'error' | null>(null);

    const calculateMonths = (start: Date | null, end: Date | null): number => {
        if (!start || !end) return 0;
        const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        return Math.max(1, months + 1); // Au moins 1 mois
    };

    const handleExport = async () => {
        if (!session?.entreprise_id) {
            setMessage('Session manquante, impossible d\'exporter.');
            setMessageType('error');
            return;
        }

        // Calculer le nombre de mois
        const startDate = segmentDates.debut;
        const endDate = segmentDates.fin;
        const monthsCount = calculateMonths(startDate, endDate);

        // Préparer le message de confirmation
        let confirmationText = '';
        if (startDate && endDate) {
            confirmationText = `Vous allez exporter les données sur ${monthsCount} mois (${startDate.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })} - ${endDate.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}).`;
        } else {
            confirmationText = 'Vous allez exporter toutes les données disponibles.';
        }
        confirmationText += ' Cela peut représenter un grand nombre de lignes.';

        const confirmation = await Swal.fire({
            title: 'Exporter le registre ?',
            text: confirmationText,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Oui, exporter',
            cancelButtonText: 'Annuler'
        });

        if (!confirmation.isConfirmed) {
            return;
        }

        setIsLoading(true);
        try {
            // Construire les paramètres de l'API avec les filtres
            const params = new URLSearchParams();
            params.append('entreprise_id', session.entreprise_id);
            
            // Ajouter les dates si disponibles
            if (startDate) {
                params.append('startDate', startDate.toISOString());
            }
            if (endDate) {
                params.append('endDate', endDate.toISOString());
            }
            
            // Ajouter les sites sélectionnés
            const selectedSites = sites.filter(s => s.checked).map(s => s.orgId);
            if (selectedSites.length > 0) {
                params.append('siteIds', selectedSites.join(','));
            }
            
            // Ajouter les filières sélectionnées
            const selectedFilieres = filieres.filter(f => f.checked).map(f => f.name);
            if (selectedFilieres.length > 0) {
                params.append('filiereNames', selectedFilieres.join(','));
            }
            
            // Ajouter le mode (ced ou nom)
            const mode = filieres_ou_prestataires?.nom === 'filiere_nom' ? 'nom' : 'ced';
            params.append('mode', mode);
            
            const response = await fetch(`/api/demande_collecte/export_register?${params.toString()}`);
            if(response.ok) {
                const filename = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'export_register.xlsx';
                const executionTime = response.headers.get('X-Execution-Time') || 'N/A';
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                URL.revokeObjectURL(url);
                document.body.removeChild(a);

                setMessage(`Export réussi (${executionTime})`);
                setMessageType('success');
                
                setTimeout(() => {
                    setMessage('');
                    setMessageType(null);
                }, 3000);
            } else {
                setMessage('Erreur lors de l\'export');
                setMessageType('error');
            }
        } catch {
            setMessage('Erreur lors de l\'export');
            setMessageType('error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative">
            <button 
                className="h-[30px] flex justify-between items-center gap-2 bg-gray-100 rounded-md px-2 pb-1 cursor-pointer active:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                onClick={handleExport}
                disabled={isLoading}
            >
                <div className="text-[var(--green-light)] rounded-full py-1 font-thin flex">
                    {isLoading ? (
                        <span className="inline-block animate-spin">↻</span>
                    ) : (
                        <BoxIcon name='export' type='solid' color='green' size="18px" />
                    )}
                </div>
                <div className="text-black font-thin text-xs mt-1">
                    {isLoading ? 'Export en cours...' : 'Exporter'}
                </div>
            </button>
            
            {message && (
                <div className={`absolute top-[-20px] left-0 w-full text-center text-xs ${
                    messageType === 'success' ? 'text-green-500' : 'text-red-500'
                }`}>
                    {message}
                </div>
            )}
        </div>
    );
};

export default ExportRegisterButton;
