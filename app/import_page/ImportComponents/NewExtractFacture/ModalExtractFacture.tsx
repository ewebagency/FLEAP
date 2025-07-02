'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import PdfDisplayer from '../../../interface_admin_2/InterfaceAdmin2/PdfDisplayer';
import FormulaireExtractFacture from './FormulaireExtractFacture';
import { toast } from 'react-hot-toast';

interface ModalExtractFactureProps {
    isOpen: boolean;
    onClose: () => void;
    pdf_id: number;
    pdf_path: string;
    onSuccess?: () => void;
}

const ModalExtractFacture = ({ isOpen, onClose, pdf_id, pdf_path, onSuccess }: ModalExtractFactureProps) => {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Fonction pour récupérer l'URL du PDF depuis Supabase
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
            onClose();
        } finally {
            setLoading(false);
        }
    };

    // Charger le PDF quand le modal s'ouvre
    useEffect(() => {
        if (isOpen && pdf_path) {
            getPdfUrl();
        }
    }, [isOpen, pdf_path]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-7xl h-[90vh] flex flex-col">
                {/* Header du modal */}
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-semibold">Extraction de Facture - PDF : {pdf_path}</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                        ×
                    </button>
                </div>

                {/* Contenu du modal */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Colonne gauche - PDF Viewer */}
                    <div className="w-1/2 p-2">
                        {loading ? (
                            <div className="h-full flex items-center justify-center">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                                    <p className="text-sm text-gray-500">Chargement du PDF...</p>
                                </div>
                            </div>
                        ) : (
                            <PdfDisplayer pdfUrl={pdfUrl} />
                        )}
                    </div>

                    {/* Colonne droite - Formulaire */}
                    <div className="w-1/2 p-2">
                        <FormulaireExtractFacture pdf_id={pdf_id} onSuccess={onSuccess || onClose} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ModalExtractFacture;
