import { useState } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { toast } from 'react-hot-toast';
import { BonCerfa } from './utils';
import useSWR from 'swr';
import { useSession } from '@/app/component/SessionProvider';

interface OCRThisBonProps {
    pdf_id: number;
    pdf_path: string;
    pdf_status?: string;
    onDataExtracted?: (data: Partial<BonCerfa>, perfect_extract?: boolean) => void;
}

// Types pour les données connues
interface Site {
    nom: string;
    siret: string;
    adresse: string;
    contact?: string;
    telephone?: string;
    email?: string;
}

interface Prestataire {
    nomBoite: string;
    nomPrenom: string;
    adresse: string;
    siret: string;
    email: string;
    telephone?: string;
    transporteur_ou_destinataire: 'transporteur' | 'destinataire';
}

interface Dechet {
    nom: string;
    codeCED: string;
}

interface KnownData {
    sites: Site[];
    prestataires: Prestataire[];
    dechets: Dechet[];
}

// Fonction pour récupérer les données depuis Supabase
const fetchKnownData = async (entreprise_id: string): Promise<KnownData> => {
    const { data, error } = await supabase
        .from('table_autocompletion')
        .select('*')
        .eq('entreprise_id', entreprise_id);

    if (error) {
        throw new Error(`Erreur lors de la récupération des données: ${error.message}`);
    }

    const sites: Site[] = [];
    const prestataires: Prestataire[] = [];
    const dechets: Dechet[] = [];

    data?.forEach(record => {
        // Sites
        if (record.site) {
            sites.push({
                nom: record.site.nom || '',
                siret: record.site.siret || '',
                adresse: record.site.pointsCollecte?.[0]?.adresse || '',
                contact: record.site.contacts?.[0]?.nom || '',
                telephone: record.site.contacts?.[0]?.telephone || '',
                email: record.site.contacts?.[0]?.email || ''
            });
        }

        // Transporteurs
        if (record.transporteur) {
            prestataires.push({
                nomBoite: record.transporteur.nomBoite || '',
                nomPrenom: record.transporteur.nomPrenom || '',
                adresse: record.transporteur.adresse || '',
                siret: record.transporteur.siret || '',
                email: record.transporteur.email || '',
                telephone: record.transporteur.telephone || '',
                transporteur_ou_destinataire: 'transporteur'
            });
        }

        // Destinataires
        if (record.destinataire) {
            prestataires.push({
                nomBoite: record.destinataire.nomBoite || '',
                nomPrenom: record.destinataire.nomPrenom || '',
                adresse: record.destinataire.adresse || '',
                siret: record.destinataire.siret || '',
                email: record.destinataire.email || '',
                telephone: record.destinataire.telephone || '',
                transporteur_ou_destinataire: 'destinataire'
            });
        }

        // Déchets
        if (record.dechet) {
            dechets.push({
                nom: record.dechet.nom || '',
                codeCED: record.dechet.codeCED || ''
            });
        }
    });

    return {
        sites,
        prestataires,
        dechets
    };
};

const OCRThisBon = ({ pdf_id, pdf_path, pdf_status, onDataExtracted }: OCRThisBonProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const { entreprise_id, entreprise_name } = useSession();

    // Requête SWR pour récupérer les données connues
    const { data: known_data, error: knownDataError, isLoading: isLoadingKnownData } = useSWR(
        entreprise_id ? `known-data-bon-${entreprise_id}` : null,
        () => fetchKnownData(entreprise_id!),
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false
        }
    );

    const ocr_this_bon_pdf = async () => {
        if (!known_data) {
            toast.error('Données non disponibles');
            return;
        }
        setIsLoading(true);
        try {
            // Get signed URL for the PDF
            const { data: signedUrlData } = await supabase.storage
                .from('pdfs_bucket')
                .createSignedUrl(pdf_path, 3600);

            if (!signedUrlData?.signedUrl) {
                throw new Error('Failed to get signed URL');
            }

            // Download the PDF file
            const pdfResponse = await fetch(signedUrlData.signedUrl);
            if (!pdfResponse.ok) {
                throw new Error('Failed to download PDF');
            }

            const pdfBlob = await pdfResponse.blob();
            const pdfFile = new File([pdfBlob], 'document.pdf', { type: 'application/pdf' });

            console.log("known_data", known_data)
            
            // Create FormData for file upload and known_data
            const formData = new FormData();
            formData.append('file', pdfFile);
            formData.append('known_data', JSON.stringify(known_data));
            
            // Ajouter le statut du PDF s'il est disponible
            if (pdf_status) {
                formData.append('pdf_status', pdf_status);
            }
            
            // Ajouter le nom de l'entreprise pour éviter la confusion avec le site
            if (entreprise_name) {
                formData.append('entreprise_name', entreprise_name);
            }
            
            const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_PYTHON}/ocr-enrich-bon`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to process PDF with OCR');
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            // Get the extracted data and transform it to BonCerfa format
            const extractedDataRaw = data.extracted_data;
            const perfect_extract = data.perfect_extract;
            
            // Si le statut est 'splitted' ou 'splitted_extracted', récupérer et préserver les données existantes
            let existingData = null;
            if (pdf_status === 'splitted' || pdf_status === 'splitted_extracted') {
                try {
                    const { data: existingDataResult } = await supabase
                        .from('bon_pdf')
                        .select('infos')
                        .eq('pdf_id', pdf_id)
                        .single();
                    
                    if (existingDataResult?.infos) {
                        existingData = existingDataResult.infos as Partial<BonCerfa>;
                        console.log('🔍 Données existantes récupérées pour préservation:', existingData);
                    }
                } catch (error) {
                    console.warn('Erreur lors de la récupération des données existantes:', error);
                }
            }
            console.log('Extracted data raw:', extractedDataRaw);
            console.log('Type of extracted data:', typeof extractedDataRaw);
            console.log('Perfect extract:', perfect_extract);

            // Parse the extracted data if it's a string
            let extractedData;
            if (typeof extractedDataRaw === 'string') {
                try {
                    extractedData = JSON.parse(extractedDataRaw);
                    console.log('Parsed extracted data:', extractedData);
                } catch (error) {
                    console.error('Error parsing extracted data:', error);
                    extractedData = {};
                }
            } else {
                extractedData = extractedDataRaw;
            }

            // Transform extracted data to BonCerfa format
            console.log('Mapping extracted data to BonCerfa format...');
            console.log('extractedData.num_bon:', extractedData.num_bon);
            console.log('extractedData.date:', extractedData.date);
            console.log('extractedData.nom_dechet:', extractedData.nom_dechet);
            console.log('extractedData.code_ced:', extractedData.code_ced);
            console.log('extractedData.poids_net:', extractedData.poids_net);
            console.log('extractedData.code_traitement:', extractedData.code_traitement);
            console.log('extractedData.nom_site:', extractedData.nom_site);
            console.log('extractedData.nom_prestataire:', extractedData.nom_prestataire);

            // Fonction pour convertir le format de date DD/MM/YY vers YYYY-MM-DD
            const convertDateToISO = (dateStr: string): string => {
                if (!dateStr) return '';
                
                // Format attendu: DD/MM/YY ou DD/MM/YYYY
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    const day = parts[0].padStart(2, '0');
                    const month = parts[1].padStart(2, '0');
                    let year = parts[2];
                    
                    // Si l'année est sur 2 chiffres, ajouter 20
                    if (year.length === 2) {
                        year = '20' + year;
                    }
                    
                    return `${year}-${month}-${day}`;
                }
                return dateStr;
            };



            const bonCerfaData: Partial<BonCerfa> = {
                numeroBon: extractedData.num_bon || '',
                date: convertDateToISO(extractedData.date || ''),
                dechet: {
                    nom: extractedData.nom_dechet || '',
                    codeCED: extractedData.code_ced || '',
                    tonnage: extractedData.poids_net ? parseFloat(extractedData.poids_net) : 0,
                    code_traitement: extractedData.code_traitement || ''
                },
                site: {
                    nom: existingData?.site?.nom || extractedData.nom_site || '',
                    siret: existingData?.site?.siret || '',
                    adresse: existingData?.site?.adresse || '',
                    contact: existingData?.site?.contact || '',
                    tel: existingData?.site?.tel || '',
                    email: existingData?.site?.email || ''
                },
                prestataire: {
                    nom: existingData?.prestataire?.nom || extractedData.nom_prestataire || '',
                    siret: existingData?.prestataire?.siret || '',
                    adresse: existingData?.prestataire?.adresse || '',
                    contact: existingData?.prestataire?.contact || '',
                    tel: existingData?.prestataire?.tel || '',
                    email: existingData?.prestataire?.email || ''
                },
                site_raw: existingData?.site_raw || extractedData.nom_site || '',
                presta_raw: existingData?.presta_raw || extractedData.nom_prestataire || ''
            };

            console.log('Transformed BonCerfa data:', bonCerfaData);

            // Update parent component with BonCerfa data
            if (onDataExtracted) {
                onDataExtracted(bonCerfaData, perfect_extract);
            }

            // Afficher un toast différent selon le perfect_extract
            if (perfect_extract) {
                toast.success('🎯 Extraction parfaite ! Toutes les données ont été correctement identifiées et validées.', {
                    duration: 5000,
                    style: {
                        background: '#10b981',
                        color: 'white',
                        fontSize: '16px',
                        fontWeight: 'bold'
                    }
                });
            } else {
                toast('⚠️ Extraction partielle. Certaines données n\'ont pas pu être validées automatiquement. Vérifiez les informations extraites.', {
                    duration: 5000,
                    style: {
                        background: '#f59e0b',
                        color: 'white',
                        fontSize: '16px',
                        fontWeight: 'bold'
                    }
                });
            }
        } catch (error) {
            console.error('Error in OCR process:', error);
            toast.error(error instanceof Error ? error.message : 'Erreur lors de l\'extraction des données');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <button
                onClick={ocr_this_bon_pdf}
                disabled={isLoading || isLoadingKnownData}
                className={`bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 ${
                    isLoading || isLoadingKnownData ? 'opacity-50 cursor-not-allowed' : ''
                }`}
            >
                {isLoading ? (
                    <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Extraction en cours...
                    </span>
                ) : isLoadingKnownData ? (
                    <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Chargement...
                    </span>
                ) : (
                    'Extraire par OCR'
                )}
            </button>
        </div>
    );
};

export default OCRThisBon;
