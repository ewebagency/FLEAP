import { useState } from "react";
import { useSession } from "../component/SessionProvider";

const ExportRegisterButton = () => {
    const session = useSession();
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [messageType, setMessageType] = useState<'success' | 'error' | null>(null);

    const handleExport = async () => {
        if(session && session.user && session.user.id) {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/demande_collecte/export_register?user_id=${session.user.id}`);
                if(response.ok) {
                    const filename = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'export_register.xlsx';
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);

                    setMessage('Export réussi');
                    setMessageType('success');
                    
                    // Faire disparaître le message après 3 secondes
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
        }
    };

    return (
        <div className="relative">
            <button 
                className="flex justify-between items-center bg-gray-300 rounded-xl px-2 mx-1 cursor-pointer active:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed" 
                onClick={handleExport}
                disabled={isLoading}
            >
                <div className="text-white bg-green-600 mr-2 my-[3px] rounded-full px-2 font-thin">
                    {isLoading ? (
                        <span className="inline-block animate-spin">↻</span>
                    ) : (
                        "⇪"
                    )}
                </div>
                <div className="text-black font-thin text-xs">
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