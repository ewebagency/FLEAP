'use client'
import React, { useState } from 'react';
import { useAnalysis } from '../../analysis/AnalysisProvider';
import { ReportGenerator } from './ReportGenerator';
import { getFiliere } from '@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new';
import { useSession } from '../SessionProvider';

interface Site {
    orgId: string;
    givenName: string;
    address?: string;
}

interface ReportData {
    header: {
        siteName: string;
        firstDate: Date;
        lastDate: Date;
        siteAddress?: string;
        entrepriseName: string;
    };
    filiereStats: Array<{
        filiere: string;
        filiereName: string;
        quantity: number;
        materialValorizationRate: number;
        globalValorizationRate: number;
    }>;
    transporteurs: Array<{
        name: string;
        siret: string;
        address?: string;
        type: 'transporteur';
    }>;
    destinataires: Array<{
        name: string;
        siret: string;
        address?: string;
        type: 'destinataire';
    }>;
    registre: Array<{
        wasteName: string;
        wasteCode: string;
        quantity: number;
        date: string;
        processingCode: string;
    }>;
}

export default function ButtonReportAMO() {
    const [showModal, setShowModal] = useState(false);
    const [selectedSite, setSelectedSite] = useState<Site | null>(null);
    const [showPDF, setShowPDF] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const { bsds, mappingTable } = useAnalysis();
    const { entreprise_name } = useSession();

    const handleGenerateReport = async () => {
        if (!selectedSite || !entreprise_name) return;

        try {
            const reportGenerator = new ReportGenerator(
                bsds,
                selectedSite,
                entreprise_name,
                mappingTable
            );

            const pdfBlob = await reportGenerator.generateReportData();
            const url = URL.createObjectURL(pdfBlob);
            setPdfUrl(url);
            setShowPDF(true);
            setShowModal(false);
        } catch (error) {
            console.error('Error generating report:', error);
            alert('Une erreur est survenue lors de la génération du rapport.');
        }
    };

    const handleClosePDF = () => {
        if (pdfUrl) {
            URL.revokeObjectURL(pdfUrl);
            setPdfUrl(null);
        }
        setShowPDF(false);
    };

    // Extraire les sites uniques des BSDs
    const sites = Array.from(new Set(bsds.map(bsd => 
        bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.orgId
    ))).map(orgId => {
        const bsd = bsds.find(b => 
            b.infos_json?.formAPI?.createFormInput?.emitter?.company?.orgId === orgId
        );
        return {
            orgId: orgId || '',
            givenName: bsd?.infos_json?.formAPI?.createFormInput?.emitter?.company?.name || '',
            address: bsd?.infos_json?.formAPI?.createFormInput?.emitter?.company?.address
        };
    });

    return (
        <div className="mb-8">
            <button
                onClick={() => setShowModal(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded shadow-sm transition-colors"
            >
                Générer un rapport
            </button>

            {showModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                        <div className="mt-3">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Sélectionner un site</h3>
                            <div className="mb-4">
                                <select
                                    className="w-full p-2 border rounded shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={selectedSite?.orgId || ''}
                                    onChange={(e) => {
                                        const site = sites.find(s => s.orgId === e.target.value);
                                        setSelectedSite(site || null);
                                    }}
                                >
                                    <option value="">Sélectionner un site</option>
                                    {sites.map((site) => (
                                        <option key={site.orgId} value={site.orgId}>
                                            {site.givenName} - {site.orgId}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleGenerateReport}
                                    disabled={!selectedSite}
                                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Générer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showPDF && pdfUrl && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-11/12 h-5/6 shadow-lg rounded-md bg-white">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-medium text-gray-900">Rapport PDF</h3>
                            <button
                                onClick={handleClosePDF}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                            >
                                Fermer
                            </button>
                        </div>
                        <iframe
                            src={pdfUrl}
                            className="w-full h-full border-0"
                            title="PDF Report"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
