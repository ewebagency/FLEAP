import { useState } from 'react';
import FormulaireMano from '@/app/interface_admin_2/InterfaceAdmin2/FormulaireMano';
import PdfDisplayer from '@/app/interface_admin_2/InterfaceAdmin2/PdfDisplayer';

interface ExtractDataProps {
    pdf_id: number;
    pdfUrl: string;
}

const ExtractData = ({ pdf_id, pdfUrl }: ExtractDataProps) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleNextPdf = () => {
        setIsOpen(false);
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="px-3 py-1.5 bg-blue-500 text-white rounded-md text-xs hover:bg-blue-600 w-[100px] text-center"
            >
                Extraire
            </button>

            {isOpen && (
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

                            {/* Formulaire */}
                            <div className="w-1/2 h-full overflow-y-auto">
                                <FormulaireMano 
                                    currentPdfId={pdf_id.toString()} 
                                    onNextPdf={handleNextPdf}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ExtractData;