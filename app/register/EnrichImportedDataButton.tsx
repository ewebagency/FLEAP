import { useState } from "react";
import { useSession } from "../component/SessionProvider";
import toast from "react-hot-toast";
import Swal from 'sweetalert2';

const EnrichImportedDataButton = () => {
    const session = useSession();
    const [isLoading, setIsLoading] = useState(false);

    const handleEnrich = async () => {
        // Afficher la confirmation SweetAlert2
        const result = await Swal.fire({
            title: 'Confirmation d\'enrichissement',
            html: `
                <p>Êtes-vous sûr de vouloir enrichir les données ?</p>
                <p style="color: #dc2626; font-size: 0.875rem; margin-top: 0.5rem;">
                    Cette action est irréversible.
                </p>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#22c55e',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Confirmer',
            cancelButtonText: 'Annuler',
            customClass: {
                popup: 'rounded-lg',
                confirmButton: 'rounded-lg',
                cancelButton: 'rounded-lg'
            }
        });

        if (!result.isConfirmed) {
            return;
        }
        
        if(session && session.user_id) {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/enrich_imported_data?user_id=${session.user_id}`);
                if('success' in response && response.success) {
                    toast.success('Enrichissement réussi');
                } else if ("message" in response) {
                    toast.error('Erreur lors de l\'enrichissement : ' + response.message);
                }
            } catch {
                toast.error('Erreur inconnue lors de l\'enrichissement');
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div>
        {/*<div className="relative">
            <button 
                className="flex justify-between items-center bg-gray-300 rounded-xl px-2 mx-1 cursor-pointer active:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed" 
                onClick={handleEnrich}
                disabled={isLoading}
            >
                <div className="text-white bg-green-600 mr-2 my-[3px] rounded-full px-2 font-thin">
                    {isLoading ? (
                        <span className="inline-block animate-spin">↻</span>
                    ) : (
                        "🔥"
                    )}
                </div>
                <div className="text-black font-thin text-xs">
                    {isLoading ? 'Enrichissement en cours...' : 'Enrichir'}
                </div>
            </button>
        </div>*/}
        </div>
    );
};

export default EnrichImportedDataButton;