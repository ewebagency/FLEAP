import { useState, useCallback } from "react";
import { useSession } from "../component/SessionProvider";
import BoxIcon from '@/app/component/BoxIconWrapper';

const ExportRegisterButton = () => {
    const session = useSession();
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [messageType, setMessageType] = useState<'success' | 'error' | null>(null);

    const handleExport = async () => {
        if(session && session.entreprise_id) {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/demande_collecte/export_register?entreprise_id=${session.entreprise_id}`);
                if(response.ok) {
                    const filename = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'export_register.xlsx';
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    URL.revokeObjectURL(url);
                    document.body.removeChild(a);

                    setMessage('Export réussi');
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