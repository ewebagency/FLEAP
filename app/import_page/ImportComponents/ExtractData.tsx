import { useState } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import FormulaireMano from '@/app/interface_admin_2/InterfaceAdmin2/FormulaireMano';
import PdfDisplayer from '@/app/interface_admin_2/InterfaceAdmin2/PdfDisplayer';
import DisplayInfosPython from '@/app/interface_admin_2/DisplayInfosPython';
import { toast } from 'react-hot-toast';

interface ExtractDataProps {
    pdf_id: number;
    pdf_path: string;
}

const ExtractData = ({ pdf_id, pdf_path }: ExtractDataProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleNextPdf = () => {
        setIsOpen(false);
    };

    const getPdfUrl = async () => {
        try {
            setLoading(true);
            const { data } = await supabase.storage
                .from('pdfs_bucket')
                .createSignedUrl(pdf_path, 3600);

            if (data?.signedUrl) {
                setPdfUrl(data.signedUrl);
                return data.signedUrl;
            }
            throw new Error('URL du PDF non trouvée');
        } catch (error) {
            console.error('Erreur lors de la récupération de l\'URL du PDF:', error);
            toast.error('Erreur lors du chargement du PDF');
            setIsOpen(false);
        } finally {
            setLoading(false);
        }
    };

    const loadPdfBlob = async (url: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            setPdfBlob(blob);
        } catch (error) {
            console.error('Erreur lors du chargement du PDF:', error);
            toast.error('Erreur lors du chargement du PDF');
        }
    };

    const handleOpen = async () => {
        setIsOpen(true);
        const url = await getPdfUrl();
        if (url) {
            await loadPdfBlob(url);
        }
    };

    return (
        <>
            <button
                onClick={handleOpen}
                className="px-3 py-1.5 bg-blue-500 text-white rounded-md text-xs hover:bg-blue-600 w-[100px] text-center"
                disabled={loading}
            >
                {loading ? 'Chargement...' : 'Extraire'}
            </button>

            {isOpen && pdfUrl && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg w-full h-[95vh] max-w-[95vw] relative">
                        {/* Header avec bouton de fermeture */}
                        <div className="absolute top-0 right-0 p-4 z-10">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Contenu principal */}
                        <div className="flex h-full p-4 gap-4">
                            {/* PDF Viewer */}
                            <div className="w-1/2 h-full">
                                <PdfDisplayer pdfUrl={pdfUrl} />
                            </div>

                            {/* Formulaire et DisplayInfosPython */}
                            <div className="w-1/2 h-full flex flex-col">
                                <div className="flex-1 overflow-y-auto">
                                    <FormulaireMano 
                                        currentPdfId={pdf_id.toString()} 
                                        onNextPdf={handleNextPdf}
                                    />
                                </div>
                                {pdfBlob && (
                                    <div className="mt-4 bg-gray-50 p-4 rounded-lg">
                                        <DisplayInfosPython currentPdfBlob={pdfBlob} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ExtractData;