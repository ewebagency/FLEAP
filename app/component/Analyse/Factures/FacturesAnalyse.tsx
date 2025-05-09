import React, { useEffect, useState, useCallback } from "react";
import { SessionMore, useSession } from "../../SessionProvider";
import { supabase } from "@/app/database/supabaseClient";
import BoxIcon from '../../BoxIconWrapper';
import FactureBordereaux from "./FactureBordereaux";
import { useFilterContext } from "@/app/FilterContext";

interface PdfInfo {
    id: number;
    name_pdf: string;
    name_pdf_in_bucket: string;
    created_at: string;
    status: string;
    document_type?: string;
    url?: string;
    file_size?: number;
    site_siret_plus?: string[];
}

const FacturesAnalyse = ({ active }: { active: boolean }) => {
    const session = useSession() as SessionMore;
    const [pdfInfos, setPdfInfos] = useState<PdfInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const entreprise_id = session?.entreprise_id;
    const { sites: filteredSites } = useFilterContext();

    // Filtrer les pdfInfos en fonction des sites cochés
    const filteredPdfInfos = pdfInfos.filter(pdf => {
        // Si aucun site n'est défini, on garde le fichier
        if (!pdf.site_siret_plus || pdf.site_siret_plus.length === 0) return true;
        
        // On vérifie si au moins un des sites est coché dans le filtre
        return pdf.site_siret_plus.some(siret => {
            const site = filteredSites.find(s => s.orgId === siret);
            return site?.checked ?? true;
        });
    });

    const fetchPdfInfos = useCallback(async () => {
        setLoading(true);
        console.log("entreprise_id", entreprise_id, "session", session);
        const { data, error } = await supabase
            .from('pdf_infos')
            .select('*')
            .eq('entreprise_id', entreprise_id)
            .eq('document_type', 'facture')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Erreur lors de la récupération des PDFs:", error);
        } else if (data) {
            setPdfInfos(data);
        }
        setLoading(false);
    }, [entreprise_id]);

    const getSignedUrl = async (namePdfInBucket: string) => {
        const { data } = await supabase
            .storage
            .from('pdfs_bucket')
            .createSignedUrl(namePdfInBucket, 3600);
        
        return data?.signedUrl;
    };

    useEffect(() => {
        if (session) {
            fetchPdfInfos();
        }
    }, [session, fetchPdfInfos]);

    if (!active) return null;
    if (loading) return <p>Chargement des documents...</p>;
    
    if (filteredPdfInfos.length === 0) {
        return (
            <div className="space-y-4 p-2">
                <FactureBordereaux/>
                <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] p-5">
                    <BoxIcon 
                        name='file-pdf' 
                        color='gray' 
                        type='regular' 
                        size="lg"
                        className="mb-4 w-16 h-16"
                    />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Aucune facture à analyser
                    </h3>
                    <p className="text-sm text-gray-500 text-center max-w-md">
                        Importez des factures pour commencer l&apos;analyse. 
                        Les documents apparaîtront ici une fois téléchargés.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <FactureBordereaux/>
            <div className="overflow-x-auto p-5">
                <table style={{ width: '100%', borderCollapse: 'collapse' }} className="table-fixed">
                    <thead>
                        <tr style={{ backgroundColor: 'white' }}>
                            <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '5%', textAlign: 'left' }}
                                className="text-xs font-normal text-gray-500">Type</th>
                            <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '13%', textAlign: 'left', paddingLeft: '23px' }}
                                className="text-xs font-normal text-gray-500">Statut</th>
                            <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '20%', textAlign: 'left', paddingLeft: '25px' }}
                                className="text-xs font-normal text-gray-500">Nom</th>
                            <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '12%', textAlign: 'left' }}
                                className="text-xs font-normal text-gray-500">Date</th>
                            <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '25%', textAlign: 'left' }}
                                className="text-xs font-normal text-gray-500">Anomalies</th>
                            <th style={{ padding: '2px', borderBottom: '1px solid #ddd', width: '12%', textAlign: 'right', paddingRight: '3.5rem' }}
                                className="text-xs font-normal text-gray-500">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPdfInfos.map((pdf) => (
                            <tr key={pdf.id} style={{ borderBottom: '1px solid #ddd' }} 
                                className="hover:bg-gray-50 transition duration-200">
                                <td style={{ padding: '6px', height: '40px' }} className="align-middle mt-1">
                                    <BoxIcon name='file-pdf' color='red' type='solid' />
                                </td>
                                <td style={{ padding: '6px', height: '40px' }} className="align-middle">
                                    <span className="px-2 py-1 rounded-full font-semibold text-orange-600 text-xs">
                                        En attente de vérification
                                    </span>
                                </td>
                                <td style={{ padding: '6px', height: '40px' }} className="align-middle">
                                    <div className="text-xs font-medium truncate pr-4" title={pdf.name_pdf}>
                                        {pdf.name_pdf}
                                    </div>
                                </td>
                                <td style={{ padding: '6px', height: '40px' }} className="align-middle">
                                    <div className="flex justify-start items-center space-x-1">
                                        <div className="text-xs font-medium">
                                            {new Date(pdf.created_at).toLocaleDateString('fr-FR')}
                                        </div>
                                    </div>
                                </td>
                                <td style={{ padding: '6px', height: '40px' }} className="align-middle">
                                    <div className="text-xs text-gray-600">
                                        Aucune anomalie détectée
                                    </div>
                                </td>
                                <td style={{ padding: '6px', height: '40px' }} className="align-middle">
                                    <div className="flex items-center justify-end gap-2">
                                        <button 
                                            onClick={async () => {
                                                const url = await getSignedUrl(pdf.name_pdf_in_bucket);
                                                if (url) {
                                                    window.open(url, '_blank');
                                                }
                                            }}
                                            className="px-3 py-1.5 border border-[var(--green-medium)] text-[var(--green-medium)] rounded-md text-xs hover:bg-green-50 w-[100px] text-center"
                                        >
                                            Ouvrir
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default FacturesAnalyse;
