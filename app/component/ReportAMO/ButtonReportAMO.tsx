'use client'
import React, { useState } from 'react';
import { useAnalysis } from '../../analysis/AnalysisProvider';
import { ReportGenerator } from './ReportGenerator';
import { getFiliere } from '@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new';
import { useSession } from '../SessionProvider';
import { ReportData } from './types';

interface Site {
    orgId: string;
    givenName: string;
    address?: string;
}

export default function ButtonReportAMO() {
    const [showModal, setShowModal] = useState(false);
    const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set());
    const [showPDF, setShowPDF] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [includeFinancial, setIncludeFinancial] = useState(true);
    const { bsds, mappingTable } = useAnalysis();
    const { entreprise_name } = useSession();

    const handleGenerateReport = async () => {
        if (selectedSites.size === 0 || !entreprise_name) return;
        setLoading(true);
        try {
            console.log('Starting report generation for sites:', Array.from(selectedSites));
            
            // 1. Filtrer les BSDs pour les sites sélectionnés
            const filteredBsds = bsds.filter(bsd => 
                selectedSites.has(bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.siret || '')
            );

            // 2. Créer un seul ReportGenerator avec tous les BSDs filtrés
            const reportGenerator = new ReportGenerator(
                filteredBsds,
                {
                    orgId: Array.from(selectedSites).join(','), // On passe tous les IDs de sites
                    givenName: selectedSites.size === 1 
                        ? sites.find(s => s.orgId === Array.from(selectedSites)[0])?.givenName || ''
                        : 'Rapport Multi-Sites',
                    address: selectedSites.size === 1 
                        ? sites.find(s => s.orgId === Array.from(selectedSites)[0])?.address
                        : undefined
                },
                entreprise_name,
                mappingTable
            );

            // 3. Générer les données du rapport
            const reportData = await reportGenerator.getReportData();
            
            // 4. Supprimer les données financières si la checkbox n'est pas cochée
            if (!includeFinancial) {
                reportData.financialData = {};
            }
            
            // 5. Générer le PDF
            const response = await fetch('/api/generate-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(reportData),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erreur serveur (${response.status}): ${errorText}`);
            }

            const pdfBlob = await response.blob();
            const url = URL.createObjectURL(pdfBlob);
            setPdfUrl(url);
            setShowPDF(true);
            setShowModal(false);
        } catch (error) {
            console.error('Error generating report:', error);
            if (error instanceof Error) {
                console.error('Error details:', {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                });
            }
            alert(`Une erreur est survenue lors de la génération du rapport: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleClosePDF = () => {
        if (pdfUrl) {
            URL.revokeObjectURL(pdfUrl);
            setPdfUrl(null);
        }
        setShowPDF(false);
    };

    const toggleSite = (siteId: string) => {
        const newSelectedSites = new Set(selectedSites);
        if (newSelectedSites.has(siteId)) {
            newSelectedSites.delete(siteId);
        } else {
            newSelectedSites.add(siteId);
        }
        setSelectedSites(newSelectedSites);
    };

    // Extraire les sites uniques des BSDs
    const sites = Array.from(new Set(bsds.map(bsd => 
        bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.orgId
    )))
        .filter(orgId => orgId && orgId !== '') // Ne garder que les orgId définis et non vides
        .map(orgId => {
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
                    <div className="relative top-20 mx-auto p-5 border w-1/3 shadow-lg rounded-md bg-white">
                        <div className="mt-3">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Sélectionner les sites</h3>
                            <div className="mb-4 max-h-60 overflow-y-auto">
                                {sites.map((site) => (
                                    <div key={site.orgId} className="flex items-center mb-2">
                                        <input
                                            type="checkbox"
                                            id={site.orgId}
                                            checked={selectedSites.has(site.orgId)}
                                            onChange={() => toggleSite(site.orgId)}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <label htmlFor={site.orgId} className="ml-2 block text-sm text-gray-900">
                                            {site.givenName} - {site.orgId}
                                        </label>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-2 mb-6">
                                <div className="flex justify-end items-center gap-2">
                                    <label htmlFor="includeFinancial" className="ml-2 block text-md font-bold text-gray-900">
                                        Données financières
                                    </label>                                    
                                    <input
                                        type="checkbox"
                                        id="includeFinancial"
                                        checked={includeFinancial}
                                        onChange={(e) => setIncludeFinancial(e.target.checked)}
                                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                </div>
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
                                    disabled={selectedSites.size === 0 || loading}
                                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                                >
                                    {loading && (
                                        <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                                        </svg>
                                    )}
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

// Fonction pour agréger les données des rapports
function aggregateReportsData(reportsData: ReportData[], entrepriseName: string, selectedSitesIds: string[]): ReportData {
    // Construire la liste des noms des sites à partir des données des rapports
    const selectedSites = reportsData.map(r => r.header.siteName);
    // Si un seul site, utiliser son nom, sinon "Rapport Multi-Sites"
    const siteName = selectedSites.length === 1 ? selectedSites[0] : 'Rapport Multi-Sites';

    // Initialiser les données agrégées
    const aggregatedData: ReportData = {
        header: {
            siteName,
            firstDate: new Date(Math.min(...reportsData.map(r => new Date(r.header.firstDate).getTime()))),
            lastDate: new Date(Math.max(...reportsData.map(r => new Date(r.header.lastDate).getTime()))),
            entrepriseName,
            selectedSites
        },
        filiereStats: [],
        transporteurs: [],
        destinataires: [],
        registre: [],
        chartData: reportsData[0]?.chartData || { labels: [], datasets: [] },
        chartImage: reportsData[0]?.chartImage || '',
        treatmentChartImage: reportsData[0]?.treatmentChartImage || '',
        pieChartImage: reportsData[0]?.pieChartImage || '',
        stats: {
            totalQuantity: 0,
            sortingRate: 0,
            materialValorizationRate: 0,
            globalValorizationRate: 0
        },
        financialData: {}
    };

    // Agrégation des filières avec calcul correct des moyennes mensuelles
    const filiereMap = new Map<string, {
        filiere: string;
        filiereName: string;
        quantity: number;
        materialValorized: number;
        globalValorized: number;
        collections: number;
        months: number;
    }>();

    const transporteurMap = new Map<string, {
        name: string;
        siret: string;
        quantity: number;
    }>();

    const destinataireMap = new Map<string, {
        name: string;
        siret: string;
        quantity: number;
    }>();

    // Map pour agréger les données financières
    const financialDataMap = new Map<string, {
        preparation: number;
        transport: number;
        traitement: number;
        gestion_globale: number;
        tgap: number;
        declassement: number;
        penalites: number;
        rachat: number;
        location: number;
        maintenance: number;
        mise_a_disposition: number;
        autres_contenant: number;
        non_expliques: number;
        autres: number;
        total: number;
    }>();

    reportsData.forEach(report => {
        report.filiereStats.forEach(stat => {
            const current = filiereMap.get(stat.filiere) || {
                filiere: stat.filiere,
                filiereName: stat.filiereName,
                quantity: 0,
                materialValorized: 0,
                globalValorized: 0,
                collections: 0,
                months: 0
            };
            current.quantity += stat.quantity;
            current.materialValorized += stat.materialValorizationRate * stat.numberOfCollections / 100;
            current.globalValorized += stat.globalValorizationRate * stat.numberOfCollections / 100;
            current.collections += stat.numberOfCollections;
            // Ajout correct du nombre de mois pour chaque site/filière
            current.months += stat.averageCollectionsPerMonth > 0 ? stat.numberOfCollections / stat.averageCollectionsPerMonth : 0;
            filiereMap.set(stat.filiere, current);
        });

        // Agréger les transporteurs
        report.transporteurs.forEach(transporter => {
            const current = transporteurMap.get(transporter.siret) || {
                name: transporter.name,
                siret: transporter.siret,
                quantity: 0
            };
            current.quantity += transporter.percentage * report.filiereStats.reduce((sum, stat) => sum + stat.quantity, 0) / 100;
            transporteurMap.set(transporter.siret, current);
        });

        // Agréger les destinataires
        report.destinataires.forEach(destinataire => {
            const current = destinataireMap.get(destinataire.siret) || {
                name: destinataire.name,
                siret: destinataire.siret,
                quantity: 0
            };
            current.quantity += destinataire.percentage * report.filiereStats.reduce((sum, stat) => sum + stat.quantity, 0) / 100;
            destinataireMap.set(destinataire.siret, current);
        });

        // Agréger les données financières
        Object.entries(report.financialData || {}).forEach(([filiere, data]) => {
            const current = financialDataMap.get(filiere) || {
                preparation: 0,
                transport: 0,
                traitement: 0,
                gestion_globale: 0,
                tgap: 0,
                declassement: 0,
                penalites: 0,
                rachat: 0,
                location: 0,
                maintenance: 0,
                mise_a_disposition: 0,
                autres_contenant: 0,
                non_expliques: 0,
                autres: 0,
                total: 0
            };
            
            current.preparation += data.preparation;
            current.transport += data.transport;
            current.traitement += data.traitement;
            current.gestion_globale += data.gestion_globale;
            current.tgap += data.tgap;
            current.declassement += data.declassement;
            current.penalites += data.penalites;
            current.rachat += data.rachat;
            current.location += data.location;
            current.maintenance += data.maintenance;
            current.mise_a_disposition += data.mise_a_disposition;
            current.autres_contenant += data.autres_contenant;
            current.non_expliques += data.non_expliques;
            current.autres += data.autres;
            current.total += data.total;
            
            financialDataMap.set(filiere, current);
        });
    });

    // Calculer les totaux pour les pourcentages
    const totalQuantity = Array.from(filiereMap.values()).reduce((sum, f) => sum + f.quantity, 0);
    const totalTransporteurQuantity = Array.from(transporteurMap.values()).reduce((sum, t) => sum + t.quantity, 0);
    const totalDestinataireQuantity = Array.from(destinataireMap.values()).reduce((sum, d) => sum + d.quantity, 0);

    // Calculer les statistiques globales
    const dibQuantity = Array.from(filiereMap.values())
        .filter(f => f.filiere === 'DIB')
        .reduce((sum, f) => sum + f.quantity, 0);
    const daomQuantity = Array.from(filiereMap.values())
        .filter(f => f.filiere === 'DAOM')
        .reduce((sum, f) => sum + f.quantity, 0);

    // Mettre à jour les statistiques agrégées
    aggregatedData.stats = {
        totalQuantity,
        sortingRate: totalQuantity > 0 ? (1 - (dibQuantity + daomQuantity) / totalQuantity) * 100 : 0,
        materialValorizationRate: reportsData.reduce((sum, r) => sum + (r.stats?.materialValorizationRate || 0), 0) / reportsData.length,
        globalValorizationRate: reportsData.reduce((sum, r) => sum + (r.stats?.globalValorizationRate || 0), 0) / reportsData.length
    };

    // Convertir les maps en tableaux pour le rapport final
    aggregatedData.filiereStats = Array.from(filiereMap.values()).map(stat => ({
        filiere: stat.filiere,
        filiereName: stat.filiereName,
        quantity: stat.quantity,
        materialValorizationRate: stat.collections > 0 ? (stat.materialValorized / stat.collections) * 100 : 0,
        globalValorizationRate: stat.collections > 0 ? (stat.globalValorized / stat.collections) * 100 : 0,
        numberOfCollections: stat.collections,
        averageCollectionsPerMonth: stat.months > 0 ? stat.collections / stat.months : 0
    }));

    aggregatedData.transporteurs = Array.from(transporteurMap.values()).map(transporter => ({
        name: transporter.name,
        siret: transporter.siret,
        type: 'transporteur' as const,
        percentage: totalTransporteurQuantity > 0 ? (transporter.quantity / totalTransporteurQuantity) * 100 : 0
    }));

    aggregatedData.destinataires = Array.from(destinataireMap.values()).map(destinataire => ({
        name: destinataire.name,
        siret: destinataire.siret,
        type: 'destinataire' as const,
        percentage: totalDestinataireQuantity > 0 ? (destinataire.quantity / totalDestinataireQuantity) * 100 : 0
    }));

    // Ajouter les données financières agrégées
    aggregatedData.financialData = Object.fromEntries(financialDataMap.entries());

    // Trier les données
    aggregatedData.filiereStats.sort((a, b) => b.quantity - a.quantity);
    aggregatedData.transporteurs.sort((a, b) => b.percentage - a.percentage);
    aggregatedData.destinataires.sort((a, b) => b.percentage - a.percentage);

    return aggregatedData;
}
