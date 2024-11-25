import { useState } from "react";
import { useSession } from "../component/SessionProvider";
import toast from "react-hot-toast";


const EnrichImportedDataButton = () => {
    const session = useSession();
    const [isLoading, setIsLoading] = useState(false);

    const handleEnrich = async () => {
        if(session && session.user && session.user.id) {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/enrich_imported_data?user_id=${session.user.id}`);
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
        <div className="relative">
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
        </div>
    );
};

export default EnrichImportedDataButton;