import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/app/component/SessionProvider";
import { supabase } from "@/app/database/supabaseClient";
import PdfDisplayer from '@/app/interface_admin_2/InterfaceAdmin2/PdfDisplayer';
import { toast } from 'react-hot-toast';
import BoutonExtractDoc from './BoutonExtractDoc';
import BoutonSplitDoc from './BoutonSplitDoc';
import BoutonSmartSplitDoc from './BoutonSmartSplitDoc';
import Push2RAGButton from './Push2RAGButton';
import { MetaOcrResponse } from '../interface/pdf_interface';
import { 
    alerteTonnage, 
    alerteDate, 
    alerteNumBsd, 
    alerteNumBon, 
    alerteNumFacture, 
    alerteCed,
    alerteCalculFacture,
    alerteSommeFacture
} from '../utils/alerte';
// removed PushFactureButton usage in this file per requirements

// Import des interfaces depuis MetaDataInterface.ts
interface PrestaInfosAdd {
    type: "transporteur" | "destinataire" | "courtier" | "negotiant";
    adresse: string;
    tel: string;
    mail: string;
    fax: string;
    nom?: string; // V2
    infos_transporteur?: {
        recepisse: string;
        departement: string;
        limite_validite: string;
        routier: string;
        multimodal?: string; // V2
    };
}

interface DechetMetaInterface {
    date: string;
    nom: string;
    tonnage: string;
    ced: string;
    d_r?: string;
    tour?: string;
    // NOUVEAUX CHAMPS V2
    consistance?: string; // BSD
}

interface FactureInterface {
    ligne: {
        type_operation: string;
        quantite: string;
        unite: string;
        prix_unitaire: string;
        montant_ht: string;
        // NOUVEAUX CHAMPS V2
        tva_pourcentage?: string;
        avoir?: string; // "true" | "false"
        declassement?: string; // "true" | "false" - V2: déplacé de déchet vers ligne
    }[];
}

interface DocMetaInterface {
    type_doc: "bon" | "bsd" | "facture";
    site_raw: string;
    presta_raw: string;
    add_presta_raw?: PrestaInfosAdd;
    l_prestas?: [
        presta_raw2?: string,
        add_presta2_raw?: PrestaInfosAdd
    ];
    dechet: DechetMetaInterface[];
    // NOUVEAUX CHAMPS V2 - communs à tous les types
    nom_prestataire_2?: string;
    role_prestataire_2?: string; // "transporteur" | "destinataire"
}

interface DechetBonInterface extends DechetMetaInterface {
    num_bon: string;
    // NOUVEAUX CHAMPS V2
    nom_contenant?: string;
    volume_m3?: string;
    nombre_colis?: string;
    flag_rep?: string; // "true" | "false"
}

interface DechetBsdInterface extends DechetMetaInterface {
    num_bon: string;
    num_bsd?: string;
    contenant?: string;
    volume_m3?: string;
    // NOUVEAUX CHAMPS V2
    nombre_colis?: string;
    flag_rep?: string; // "true" | "false"
}

interface DechetFactureInterface extends DechetBsdInterface {
    num_bsd?: string;
    facture: FactureInterface;
    // NOUVEAUX CHAMPS V2
    nom_site?: string; // Site spécifique pour chaque collecte
    adresse_site?: string; // Adresse du site
    nombre_colis?: string;
    flag_rep?: string; // "true" | "false" - V2
}

interface DocBonInterface extends DocMetaInterface {
    type_doc: "bon";
    dechet: DechetBonInterface[];
    // NOUVEAUX CHAMPS V2
    type_bon?: string; // Brut : "livraison", "transport", etc.
    immatriculation?: string;
    recepisse?: string;
    adresse_site?: string;
}

interface DocBsdInterface extends DocMetaInterface {
    type_doc: "bsd";
    num_bsd?: string;
    conformite: {
        CAP: string;
        ADR: string;
    };
    dechet: DechetBsdInterface[];
    // NOUVEAUX CHAMPS V2
    adresse_site?: string; // V2: Adresse émetteur
    type_emetteur?: string; // V2: Type émetteur
    negociant_raw?: {
        type: string;
        nom: string;
        adresse: string;
        siren: string;
        recepisse: string;
        departement: string;
        validite: string;
    };
    exutoire?: {
        entreposage: string;
        lot_accepte: string;
        motif_refus: string;
    };
}

interface DocFactureInterface extends DocMetaInterface {
    type_doc: "facture";
    num_facture: string;
    montant_total_ht: string; // V2
    num_bsd?: string;
    dechet: DechetFactureInterface[];
    // NOUVEAUX CHAMPS V2
    type_facture?: string; // Brut : "Facture", "Avoir", "Rachat"
    date_fin_periode?: string;
    date_debut_periode?: string;
    num_contrat?: string;
    num_compte?: string;
    num_client?: string;
    total_ttc?: string;
}

interface DocInterface {
    type_doc: "bon" | "bsd" | "facture";
    site_raw: string;
    presta_raw: string;
    add_presta_raw?: PrestaInfosAdd;
    l_prestas?: [presta_raw2?: string, add_presta2_raw?: PrestaInfosAdd];
    dechet: DechetMetaInterface[];
    conformite?: { CAP: string; ADR: string };
    num_facture?: string;
    montant_total_ht?: string; // V2 facture
    num_bsd?: string;
    // Champs V2 communs
    nom_prestataire_2?: string;
    role_prestataire_2?: string;
}

interface ExtractDocProps {
    pdf_id: string | number;
    pdf_path: string;
    pdf_status?: string;
    autoOpen?: boolean;
    onClose?: () => void;
    onSave?: (formData: DocInterface) => void;
    openedFromLoopStarter?: boolean; // Pour afficher le bouton RAG
}

const ExtractDoc = ({ pdf_id, pdf_path, autoOpen = false, onClose, onSave, openedFromLoopStarter = false }: ExtractDocProps) => {
    const [isOpen, setIsOpen] = useState(autoOpen);
    const { entreprise_id } = useSession();
    const [existingData, setExistingData] = useState<DocInterface | null>(null);
    const [documentType, setDocumentType] = useState<"bon" | "bsd" | "facture" | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [confidenceData, setConfidenceData] = useState<{brute?: number, spec?: number, handwritten?: [number, boolean]} | null>(null);
    const [alerteData, setAlerteData] = useState<{stop?: boolean, message?: string} | null>(null);
    const currentFormRef = useRef<Record<string, unknown> | null>(null);
    const [showNegociant, setShowNegociant] = useState(false);
    const [forceImage, setForceImage] = useState(false);

    // Clés de persistance
    const formStorageKey = `extractDoc:form:${String(pdf_id)}`;
    const pdfUrlStorageKey = `extractDoc:pdfUrl:${pdf_path}`;

    // Fonction pour charger les données depuis la BDD
    const loadExistingData = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('pdf_infos')
                .select('*')
                .eq('id', String(pdf_id))
                .single();

            if (error) {
                if ((error as { code?: string }).code !== 'PGRST116') {
                    console.error('Error loading existing data:', error);
                }
                return;
            }

            if (data) {
                setDocumentType(data.document_type as "bon" | "bsd" | "facture" | null);

                // Charger infos_raw telle quelle, sans écraser site_raw/presta_raw ici
                if (data.infos_raw) {
                    setExistingData(data.infos_raw as DocInterface);
                }
                if (data.confidence) {
                    setConfidenceData(data.confidence as {brute?: number, spec?: number, handwritten?: [number, boolean]});
                }
                if (data.alerte) {
                    setAlerteData(data.alerte as {stop?: boolean, message?: string});
                }
            }
        } catch (error) {
            console.error('Error loading existing data:', error);
        }
    }, [pdf_id]);

    // Sauvegarde automatique du formulaire
    useEffect(() => {
        if (!isOpen) return;
        if (!existingData) return;
        try {
            localStorage.setItem(formStorageKey, JSON.stringify(existingData));
        } catch {
            // ignore storage errors
        }
    }, [existingData, formStorageKey, isOpen]);

    // Charger les données depuis la BDD à l'ouverture, puis depuis localStorage si disponible
    useEffect(() => {
        if (!isOpen) return;
        
        const loadData = async () => {
            // D'abord charger depuis la BDD
            await loadExistingData();
            
            // Puis vérifier si localStorage a un brouillon plus récent
            try {
                const raw = localStorage.getItem(formStorageKey);
                if (raw) {
                    const parsed = JSON.parse(raw) as DocInterface;
                    // Contrôles basiques
                    if (parsed && parsed.type_doc && Array.isArray(parsed.dechet)) {
                        setExistingData(parsed);
                        setDocumentType(parsed.type_doc);
                    }
                }
            } catch {
                // ignore
            }
        };
        
        loadData();
    }, [isOpen, formStorageKey, loadExistingData]);

    const handleSave = async (formData: DocInterface) => {
        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('pdf_infos')
                .update({
                    infos_raw: formData
                })
                .eq('id', String(pdf_id))
                .eq('entreprise_id', entreprise_id);

            if (error) {
                console.error('Error saving data:', error);
                toast.error('Erreur lors de la sauvegarde');
                return;
            }

            // Mettre à jour l'état local et persister
            setExistingData(formData);
            try {
                localStorage.setItem(formStorageKey, JSON.stringify(formData));
            } catch {}

            toast.success('Données sauvegardées avec succès');
            
            // Appeler le callback onSave si fourni
            if (onSave) {
                onSave(formData);
            }
            
            // Fermer le modal (on laisse le parent gérer la suite via onSave)
            setIsOpen(false);
        } catch (error) {
            console.error('Error saving data:', error);
            toast.error('Erreur lors de la sauvegarde');
        } finally {
            setIsLoading(false);
        }
    };

    const OpenExtractModalButton = () => {
        return (
            <button 
                className="bg-yellow-600 text-sm text-white px-4 py-1 w-[75px] rounded-lg hover:bg-yellow-700 transition-colors"
                onClick={() => {
                    setIsOpen(true);
                    loadExistingData();
                }}>
                Extraire
            </button>
        );
    };

    const DisplayDocPDF = ({ pdf_path }: { pdf_path: string }) => {
        const [pdfUrl, setPdfUrl] = useState<string | null>(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState<string | null>(null);
        const [urlCache, setUrlCache] = useState<Record<string, { url: string; expiresAt: number }>>({});

        const getPdfUrl = useCallback(async (forceRefresh = false) => {
            const now = Date.now();
            const expiryStorageKey = `${pdfUrlStorageKey}:expiry`;
            
            // Vérifier sessionStorage en premier (persistance inter-fenêtres)
            if (!forceRefresh) {
                const cachedInSession = sessionStorage.getItem(pdfUrlStorageKey);
                const cachedExpiry = sessionStorage.getItem(expiryStorageKey);
                
                if (cachedInSession && cachedExpiry) {
                    const expiresAt = parseInt(cachedExpiry, 10);
                    // Vérifier si l'URL n'est pas expirée (avec marge de 5 minutes)
                    if (expiresAt > now + 300000) {
                        setPdfUrl(cachedInSession);
                        setLoading(false);
                        return cachedInSession;
                    } else {
                        // URL expirée, nettoyer le cache
                        sessionStorage.removeItem(pdfUrlStorageKey);
                        sessionStorage.removeItem(expiryStorageKey);
                    }
                }

                // Vérifier le cache d'état local ensuite
                if (urlCache[pdf_path]) {
                    const cached = urlCache[pdf_path];
                    // Vérifier si l'URL n'est pas expirée (avec marge de 5 minutes)
                    if (cached.expiresAt > now + 300000) {
                        setPdfUrl(cached.url);
                        setLoading(false);
                        try { 
                            sessionStorage.setItem(pdfUrlStorageKey, cached.url);
                            sessionStorage.setItem(expiryStorageKey, cached.expiresAt.toString());
                        } catch {}
                        return cached.url;
                    }
                }
            }
            
            try {
                setLoading(true);
                setError(null);
                
                const { data } = await supabase.storage
                    .from('pdfs_bucket')
                    .createSignedUrl(pdf_path, 3600);

                if (data?.signedUrl) {
                    const signedUrl = data.signedUrl;
                    // L'URL expire dans 3600 secondes
                    const expiresAt = now + 3600000; // 3600 secondes en millisecondes
                    
                    setPdfUrl(signedUrl);
                    // Mettre en cache l'URL avec son expiration
                    setUrlCache(prev => ({ ...prev, [pdf_path]: { url: signedUrl, expiresAt } }));
                    try { 
                        sessionStorage.setItem(pdfUrlStorageKey, signedUrl);
                        sessionStorage.setItem(expiryStorageKey, expiresAt.toString());
                    } catch {}
                    return signedUrl;
                }
                throw new Error('URL du PDF non trouvée');
            } catch (error) {
                console.error('Erreur lors de la récupération de l\'URL du PDF:', error);
                setError('Erreur lors du chargement du PDF');
                toast.error('Erreur lors du chargement du PDF');
            } finally {
                setLoading(false);
            }
        }, [pdf_path, urlCache]);
        
        useEffect(() => {
            // Reset les états quand le pdf_path change
            setPdfUrl(null);
            setError(null);
            setLoading(true);
            
            if (pdf_path) {
                void getPdfUrl();
            }
        }, [pdf_path, getPdfUrl]);

        // Gérer les erreurs de chargement du PDF (JWT expiré)
        useEffect(() => {
            const handlePdfError = (event: ErrorEvent) => {
                const errorMessage = event.message || '';
                // Détecter les erreurs JWT expirées
                if (errorMessage.includes('InvalidJWT') || errorMessage.includes('exp') || errorMessage.includes('401')) {
                    console.log('JWT expiré détecté, régénération de l\'URL...');
                    void getPdfUrl(true); // Force le refresh
                }
            };

            window.addEventListener('error', handlePdfError);
            return () => window.removeEventListener('error', handlePdfError);
        }, [getPdfUrl]);

        return (
            <div className="w-full h-full">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                            <p className="text-sm text-gray-600">Chargement du PDF...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <p className="text-red-600 mb-2">{error}</p>
                            <button 
                                onClick={() => { void getPdfUrl(true); }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                                Réessayer
                            </button>
                        </div>
                    </div>
                ) : pdfUrl ? (
                    <PdfDisplayer 
                        pdfUrl={pdfUrl} 
                        onError={(error: Error | string) => {
                            // Détecter les erreurs JWT expirées
                            const errorStr = String(error);
                            if (errorStr.includes('InvalidJWT') || errorStr.includes('exp') || errorStr.includes('401') || errorStr.includes('400')) {
                                console.log('JWT expiré détecté dans PdfDisplayer, régénération...');
                                toast.error('Le lien du PDF a expiré, rechargement en cours...');
                                void getPdfUrl(true);
                            } else {
                                setError('Erreur lors du chargement du PDF');
                            }
                        }}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p>Impossible de charger le PDF</p>
                    </div>
                )}
            </div>
        );
    };

    const isDocInterface = (value: unknown): value is DocInterface => {
        if (!value || typeof value !== 'object') return false;
        const v = value as Record<string, unknown>;
        return typeof v.type_doc === 'string' && Array.isArray(v.dechet) && typeof v.site_raw === 'string' && typeof v.presta_raw === 'string';
    };

    const applyExtractionToForm = (response: MetaOcrResponse) => {
        const structured = (response as { structured_response?: unknown }).structured_response;
        if (isDocInterface(structured)) {
            setExistingData(structured);
            setDocumentType(structured.type_doc);
            try {
                localStorage.setItem(formStorageKey, JSON.stringify(structured));
            } catch {}
        }
        const conf = (response as { confidence?: { brute?: number, spec?: number, handwritten?: [number, boolean] } }).confidence;
        if (conf) setConfidenceData(conf);
        const al = (response as { alerte?: { stop?: boolean, message?: string } }).alerte;
        if (al) setAlerteData(al);
    };

    // Interface pour les erreurs de validation
    interface FormValidationErrors {
        // Erreurs générales
        num_facture?: string;
        montant_total_ht?: string;
        // Erreurs par déchet (index)
        dechets: Record<number, {
            date?: string;
            tonnage?: string;
            ced?: string;
            num_bsd?: string;
            num_bon?: string;
            // Erreurs de lignes de facture (index de ligne)
            lignes_facture?: Record<number, {
                calcul?: string;
            }>;
        }>;
        // Erreur de somme facture
        somme_facture?: string;
    }

    // Fonction de validation basée sur alerte.ts
    const validateFormData = (data: DocInterface, docType: "bon" | "bsd" | "facture" | null): FormValidationErrors => {
        const errors: FormValidationErrors = {
            dechets: {}
        };

        if (!docType) return errors;

        // Validation num_facture pour les factures
        if (docType === "facture") {
            const factureData = data as DocFactureInterface;
            if (factureData.num_facture !== undefined) {
                const result = alerteNumFacture(factureData.num_facture);
                if (result.hasError) {
                    errors.num_facture = result.message;
                }
            }
        }

        // Validation des déchets
        if (data.dechet && Array.isArray(data.dechet)) {
            data.dechet.forEach((dechet, index) => {
                const dechetErrors: FormValidationErrors['dechets'][number] = {};

                // Validation date
                if (dechet.date !== undefined) {
                    const result = alerteDate(dechet.date);
                    if (result.hasError) {
                        dechetErrors.date = result.message;
                    }
                }

                // Validation tonnage
                if (dechet.tonnage !== undefined) {
                    const result = alerteTonnage(dechet.tonnage);
                    if (result.hasError) {
                        dechetErrors.tonnage = result.message;
                    }
                }

                // Validation CED (pour BSD)
                if (docType === "bsd" && dechet.ced !== undefined) {
                    const result = alerteCed(dechet.ced);
                    if (result.hasError) {
                        dechetErrors.ced = result.message;
                    }
                }

                // Validation num_bsd (existe sur DechetBsdInterface et DechetFactureInterface)
                const dechetWithBsd = dechet as DechetBsdInterface | DechetFactureInterface;
                if (dechetWithBsd.num_bsd !== undefined) {
                    const result = alerteNumBsd(dechetWithBsd.num_bsd);
                    if (result.hasError) {
                        dechetErrors.num_bsd = result.message;
                    }
                }

                // Validation num_bon (existe sur tous les types de déchets)
                const dechetWithBon = dechet as DechetBonInterface | DechetBsdInterface | DechetFactureInterface;
                if (dechetWithBon.num_bon !== undefined) {
                    const result = alerteNumBon(dechetWithBon.num_bon);
                    if (result.hasError) {
                        dechetErrors.num_bon = result.message;
                    }
                }

                // Validation des lignes de facture
                if (docType === "facture") {
                    const dechetFacture = dechet as DechetFactureInterface;
                    if (dechetFacture.facture?.ligne && Array.isArray(dechetFacture.facture.ligne)) {
                        const lignesErrors: Record<number, { calcul?: string }> = {};
                        dechetFacture.facture.ligne.forEach((ligne, ligneIndex) => {
                            if (ligne.quantite !== undefined && 
                                ligne.prix_unitaire !== undefined && 
                                ligne.montant_ht !== undefined) {
                                const result = alerteCalculFacture(
                                    ligne.quantite,
                                    ligne.prix_unitaire,
                                    ligne.montant_ht
                                );
                                if (result.hasError) {
                                    lignesErrors[ligneIndex] = { calcul: result.message };
                                }
                            }
                        });
                        if (Object.keys(lignesErrors).length > 0) {
                            dechetErrors.lignes_facture = lignesErrors;
                        }
                    }
                }

                if (Object.keys(dechetErrors).length > 0) {
                    errors.dechets[index] = dechetErrors;
                }
            });
        }

        // Validation somme facture
        if (docType === "facture") {
            const factureData = data as DocFactureInterface;
            if (factureData.montant_total_ht !== undefined && factureData.dechet) {
                const toutesLesPrestations: Array<{ montant_ht?: number | string }> = [];
                factureData.dechet.forEach((dechet) => {
                    const dechetFacture = dechet as DechetFactureInterface;
                    const lignes = dechetFacture.facture?.ligne;
                    const prestations = Array.isArray(lignes) ? lignes : lignes ? [lignes] : [];
                    toutesLesPrestations.push(...prestations);
                });

                if (toutesLesPrestations.length > 0) {
                    const result = alerteSommeFacture(toutesLesPrestations, factureData.montant_total_ht);
                    if (result.hasError) {
                        errors.somme_facture = result.message;
                    }
                }
            }
        }

        return errors;
    };

    const FormulaireExtractDoc = ({ onSave, onChange, showRagButton, forceImage }: { onSave: (formData: DocInterface) => Promise<void>; onChange?: (formData: DocInterface) => void; showRagButton?: boolean; forceImage: boolean }) => {
        const [formData, setFormData] = useState<DocInterface>(() => {
            if (existingData) {
                return existingData;
            }
            
            // Créer un formulaire vide selon le type de document
            const baseData = {
                type_doc: documentType || "bon",
                site_raw: '',
                presta_raw: '',
                dechet: []
            };

            switch (documentType) {
                case "bsd":
                    return {
                        ...baseData,
                        type_doc: "bsd",
                        conformite: { CAP: '', ADR: '' }
                    } as DocInterface;
                case "facture":
                    return {
                        ...baseData,
                        type_doc: "facture",
                        num_facture: '',
                        montant_total_ht: ''
                    } as DocInterface;
                default:
                    return baseData as DocInterface;
            }
        });

        // Validation uniquement au blur et à la sauvegarde - pas de validation en temps réel
        const [validationErrors, setValidationErrors] = useState<FormValidationErrors>({ dechets: {} });
        const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
        const hasValidatedInitial = useRef(false);

        // Valider un champ spécifique
        const validateField = useCallback((fieldPath: string, value: unknown, dechetIndex?: number, ligneIndex?: number) => {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                
                // Validation selon le type de champ
                if (fieldPath === 'num_facture' && documentType === 'facture') {
                    const result = alerteNumFacture(value as string);
                    if (result.hasError) {
                        newErrors.num_facture = result.message;
                    } else {
                        delete newErrors.num_facture;
                    }
                } else if (fieldPath === 'montant_total_ht' && documentType === 'facture') {
                    const factureData = formData as DocFactureInterface;
                    if (factureData.dechet) {
                        const toutesLesPrestations: Array<{ montant_ht?: number | string }> = [];
                        factureData.dechet.forEach((dechet) => {
                            const dechetFacture = dechet as DechetFactureInterface;
                            const lignes = dechetFacture.facture?.ligne;
                            const prestations = Array.isArray(lignes) ? lignes : lignes ? [lignes] : [];
                            toutesLesPrestations.push(...prestations);
                        }
                        );
                        if (toutesLesPrestations.length > 0) {
                            const result = alerteSommeFacture(toutesLesPrestations, value as string | number);
                            if (result.hasError) {
                                newErrors.somme_facture = result.message;
                            } else {
                                delete newErrors.somme_facture;
                            }
                        }
                    }
                } else if (dechetIndex !== undefined) {
                    // Validation d'un champ de déchet
                    if (!newErrors.dechets[dechetIndex]) {
                        newErrors.dechets[dechetIndex] = {};
                    }
                    const dechet = formData.dechet[dechetIndex];
                    
                    if (fieldPath === 'date') {
                        const result = alerteDate(value as string);
                        if (result.hasError) {
                            newErrors.dechets[dechetIndex].date = result.message;
                        } else {
                            delete newErrors.dechets[dechetIndex].date;
                        }
                    } else if (fieldPath === 'tonnage') {
                        const result = alerteTonnage(value as string | number);
                        if (result.hasError) {
                            newErrors.dechets[dechetIndex].tonnage = result.message;
                        } else {
                            delete newErrors.dechets[dechetIndex].tonnage;
                        }
                    } else if (fieldPath === 'ced' && documentType === 'bsd') {
                        const result = alerteCed(value as string);
                        if (result.hasError) {
                            newErrors.dechets[dechetIndex].ced = result.message;
                        } else {
                            delete newErrors.dechets[dechetIndex].ced;
                        }
                    } else if (fieldPath === 'num_bsd') {
                        const result = alerteNumBsd(value as string);
                        if (result.hasError) {
                            newErrors.dechets[dechetIndex].num_bsd = result.message;
                        } else {
                            delete newErrors.dechets[dechetIndex].num_bsd;
                        }
                    } else if (fieldPath === 'num_bon') {
                        const result = alerteNumBon(value as string);
                        if (result.hasError) {
                            newErrors.dechets[dechetIndex].num_bon = result.message;
                        } else {
                            delete newErrors.dechets[dechetIndex].num_bon;
                        }
                    } else if (fieldPath.startsWith('ligne_') && ligneIndex !== undefined) {
                        // Validation ligne de facture
                        const dechetFacture = dechet as DechetFactureInterface;
                        if (dechetFacture.facture?.ligne?.[ligneIndex]) {
                            const ligne = dechetFacture.facture.ligne[ligneIndex];
                            if (ligne.quantite && ligne.prix_unitaire && ligne.montant_ht) {
                                const result = alerteCalculFacture(ligne.quantite, ligne.prix_unitaire, ligne.montant_ht);
                                if (!newErrors.dechets[dechetIndex].lignes_facture) {
                                    newErrors.dechets[dechetIndex].lignes_facture = {};
                                }
                                if (result.hasError) {
                                    newErrors.dechets[dechetIndex].lignes_facture![ligneIndex] = { calcul: result.message };
                                } else {
                                    delete newErrors.dechets[dechetIndex].lignes_facture![ligneIndex];
                                }
                            }
                        }
                    }
                    
                    // Nettoyer si plus d'erreurs pour ce déchet
                    if (Object.keys(newErrors.dechets[dechetIndex]).length === 0) {
                        delete newErrors.dechets[dechetIndex];
                    }
                }
                
                return newErrors;
            });
        }, [formData, documentType]);

        // Valider tout le formulaire (utilisé à la sauvegarde)
        const validateAll = useCallback(() => {
            const errors = validateFormData(formData, documentType);
            setValidationErrors(errors);
            return errors;
        }, [formData, documentType]);

        // Synchroniser formData avec existingData (extraction ou chargement)
        useEffect(() => {
            if (existingData) {
                setFormData(existingData);
                currentFormRef.current = existingData as unknown as Record<string, unknown>;
                onChange?.(existingData);
                // Réinitialiser le flag pour permettre la validation des nouvelles données
                hasValidatedInitial.current = false;
            }
        }, [existingData, onChange]);

        // Valider automatiquement UNE SEULE FOIS au chargement initial (pour afficher les erreurs existantes)
        useEffect(() => {
            if (formData && documentType && !hasValidatedInitial.current && existingData) {
                const errors = validateFormData(formData, documentType);
                setValidationErrors(errors);
                hasValidatedInitial.current = true;
            }
        }, [formData, documentType, existingData]);

        const handleInputChange = (field: string, value: unknown) => {
            setFormData(prev => {
                const next = { ...prev, [field]: value } as DocInterface;
                currentFormRef.current = next as unknown as Record<string, unknown>;
                onChange?.(next);
                return next;
            });
        };

        const handleDechetChange = (index: number, field: string, value: string) => {
            setFormData(prev => {
                const next = {
                    ...prev,
                    dechet: prev.dechet.map((dechet, i) => i === index ? { ...dechet, [field]: value } : dechet)
                } as unknown as DocInterface;
                currentFormRef.current = next as unknown as Record<string, unknown>;
                onChange?.(next);
                return next;
            });
        };

        // Handler pour le blur - valider seulement quand on quitte le champ
        const handleDechetBlur = (index: number, field: string, value: string) => {
            setTouchedFields(prev => new Set(prev).add(`dechet_${index}_${field}`));
            validateField(field, value, index);
        };

        const handleFieldBlur = (field: string, value: unknown) => {
            setTouchedFields(prev => new Set(prev).add(field));
            validateField(field, value);
        };

        // Handler pour valider une ligne de facture au blur
        const handleLigneBlur = (dechetIndex: number, ligneIndex: number) => {
            const dechet = formData.dechet[dechetIndex] as DechetFactureInterface;
            if (dechet.facture?.ligne?.[ligneIndex]) {
                const ligne = dechet.facture.ligne[ligneIndex];
                if (ligne.quantite && ligne.prix_unitaire && ligne.montant_ht) {
                    validateField(`ligne_${ligneIndex}`, null, dechetIndex, ligneIndex);
                }
            }
        };

        const addDechet = () => {
            const newDechet: Record<string, unknown> = {
                date: '',
                nom: '',
                tonnage: '',
                ced: '',
                d_r: '',
                tour: ''
            };

            // Ajouter les champs spécifiques selon le type
            if (documentType === "bon") {
                (newDechet as { num_bon: string }).num_bon = '';
                // Champs V2 BON
                (newDechet as { nom_contenant: string }).nom_contenant = '';
                (newDechet as { volume_m3: string }).volume_m3 = '';
                (newDechet as { nombre_colis: string }).nombre_colis = '';
                (newDechet as { flag_rep: string }).flag_rep = 'false';
            } else if (documentType === "bsd") {
                (newDechet as { num_bon: string }).num_bon = '';
                (newDechet as { contenant: string }).contenant = '';
                (newDechet as { volume_m3: string }).volume_m3 = '';
                // Champs V2 BSD
                (newDechet as { nombre_colis: string }).nombre_colis = '';
                (newDechet as { consistance: string }).consistance = '';
                (newDechet as { flag_rep: string }).flag_rep = 'false';
            } else if (documentType === "facture") {
                (newDechet as { num_bon: string }).num_bon = '';
                (newDechet as { contenant: string }).contenant = '';
                (newDechet as { volume_m3: string }).volume_m3 = '';
                // Champs V2 FACTURE
                (newDechet as { nom_site: string }).nom_site = '';
                (newDechet as { adresse_site: string }).adresse_site = '';
                (newDechet as { nombre_colis: string }).nombre_colis = '';
                (newDechet as { flag_rep: string }).flag_rep = 'false';
                (newDechet as { facture: FactureInterface }).facture = {
                    ligne: []
                };
            }

            setFormData(prev => {
                const next = {
                    ...prev,
                    dechet: [...prev.dechet, newDechet as unknown as DechetMetaInterface]
                } as unknown as DocInterface;
                currentFormRef.current = next as unknown as Record<string, unknown>;
                onChange?.(next);
                return next;
            });
        };

        const removeDechet = (index: number) => {
            setFormData(prev => {
                const next = {
                    ...prev,
                    dechet: prev.dechet.filter((_, i) => i !== index)
                } as unknown as DocInterface;
                currentFormRef.current = next as unknown as Record<string, unknown>;
                onChange?.(next);
                return next;
            });
        };

        // Fonction helper pour obtenir les classes CSS avec erreur
        const getInputClasses = (hasError: boolean, baseClasses = "w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1") => {
            if (hasError) {
                return `${baseClasses} border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50`;
            }
            return `${baseClasses} border-gray-300 focus:ring-blue-500`;
        };

        const renderDechetFields = (dechet: DechetMetaInterface, index: number) => {
            const dechetErrors = validationErrors.dechets[index];
            const hasDateError = !!dechetErrors?.date;
            const hasTonnageError = !!dechetErrors?.tonnage;
            const hasCedError = !!dechetErrors?.ced;
            const hasNumBsdError = !!dechetErrors?.num_bsd;
            const hasNumBonError = !!dechetErrors?.num_bon;

            return (
                <div key={index} className="bg-gray-50 p-2 rounded mb-2">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold text-gray-700 text-sm">Déchet {index + 1}</h4>
                        <button
                            type="button"
                            onClick={() => removeDechet(index)}
                            className="text-red-600 hover:text-red-800 text-xs"
                        >
                            Supprimer
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                            <input
                                type="date"
                                value={dechet.date || ''}
                                onChange={(e) => handleDechetChange(index, 'date', e.target.value)}
                                onBlur={(e) => handleDechetBlur(index, 'date', e.target.value)}
                                className={getInputClasses(hasDateError)}
                                title={hasDateError ? dechetErrors.date : undefined}
                            />
                            {hasDateError && (
                                <p className="text-[10px] text-red-600 mt-0.5">{dechetErrors.date}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Nom</label>
                            <input
                                type="text"
                                value={dechet.nom || ''}
                                onChange={(e) => handleDechetChange(index, 'nom', e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Tonnage</label>
                            <input
                                type="text"
                                value={dechet.tonnage || ''}
                                onChange={(e) => handleDechetChange(index, 'tonnage', e.target.value)}
                                onBlur={(e) => handleDechetBlur(index, 'tonnage', e.target.value)}
                                className={getInputClasses(hasTonnageError)}
                                title={hasTonnageError ? dechetErrors.tonnage : undefined}
                            />
                            {hasTonnageError && (
                                <p className="text-[10px] text-red-600 mt-0.5">{dechetErrors.tonnage}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Code CED</label>
                            <input
                                type="text"
                                value={dechet.ced || ''}
                                onChange={(e) => handleDechetChange(index, 'ced', e.target.value)}
                                onBlur={(e) => handleDechetBlur(index, 'ced', e.target.value)}
                                className={getInputClasses(hasCedError)}
                                title={hasCedError ? dechetErrors.ced : undefined}
                            />
                            {hasCedError && (
                                <p className="text-[10px] text-red-600 mt-0.5">{dechetErrors.ced}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">D/R</label>
                            <input
                                type="text"
                                value={dechet.d_r || ''}
                                onChange={(e) => handleDechetChange(index, 'd_r', e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Tour</label>
                            <input
                                type="text"
                                value={dechet.tour || ''}
                                onChange={(e) => handleDechetChange(index, 'tour', e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        
                                                 {/* Champs spécifiques selon le type */}
                         {documentType === "bon" && (
                             <>
                             <div>
                                 <label className="block text-xs font-medium text-gray-700 mb-1">Numéro bon</label>
                                 <input
                                     type="text"
                                     value={(dechet as DechetBonInterface).num_bon || ''}
                                     onChange={(e) => handleDechetChange(index, 'num_bon', e.target.value)}
                                     onBlur={(e) => handleDechetBlur(index, 'num_bon', e.target.value)}
                                     className={getInputClasses(hasNumBonError)}
                                     title={hasNumBonError ? dechetErrors.num_bon : undefined}
                                 />
                                 {hasNumBonError && (
                                     <p className="text-[10px] text-red-600 mt-0.5">{dechetErrors.num_bon}</p>
                                 )}
                             </div>
                                 <div>
                                     <label className="block text-xs font-medium text-gray-700 mb-1">Contenant</label>
                                     <input
                                         type="text"
                                         value={(dechet as DechetBonInterface).nom_contenant || ''}
                                         onChange={(e) => handleDechetChange(index, 'nom_contenant', e.target.value)}
                                         className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                     />
                                 </div>
                                 <div>
                                     <label className="block text-xs font-medium text-gray-700 mb-1">Volume (m³)</label>
                                     <input
                                         type="text"
                                         value={(dechet as DechetBonInterface).volume_m3 || ''}
                                         onChange={(e) => handleDechetChange(index, 'volume_m3', e.target.value)}
                                         className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                     />
                                 </div>
                                 <div>
                                     <label className="block text-xs font-medium text-gray-700 mb-1">Nombre colis</label>
                                     <input
                                         type="text"
                                         value={(dechet as DechetBonInterface).nombre_colis || ''}
                                         onChange={(e) => handleDechetChange(index, 'nombre_colis', e.target.value)}
                                         className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                     />
                                 </div>
                                 <div>
                                     <label className="flex items-center text-xs font-medium text-gray-700">
                                         <input
                                             type="checkbox"
                                             checked={(dechet as DechetBonInterface).flag_rep === 'true'}
                                             onChange={(e) => handleDechetChange(index, 'flag_rep', e.target.checked ? 'true' : 'false')}
                                             className="mr-2"
                                         />
                                         Flag REP
                                     </label>
                                 </div>
                             </>
                         )}
                         
                         {documentType === "bsd" && (
                             <>
                                 <div>
                                     <label className="block text-xs font-medium text-gray-700 mb-1">Numéro bon</label>
                                     <input
                                         type="text"
                                         value={(dechet as DechetBsdInterface).num_bon || ''}
                                         onChange={(e) => handleDechetChange(index, 'num_bon', e.target.value)}
                                         onBlur={(e) => handleDechetBlur(index, 'num_bon', e.target.value)}
                                         className={getInputClasses(hasNumBonError)}
                                         title={hasNumBonError ? dechetErrors.num_bon : undefined}
                                     />
                                     {hasNumBonError && (
                                         <p className="text-[10px] text-red-600 mt-0.5">{dechetErrors.num_bon}</p>
                                     )}
                                 </div>
                                     <div>
                                         <label className="block text-xs font-medium text-gray-700 mb-1">Numéro BSD</label>
                                         <input
                                             type="text"
                                             value={(dechet as DechetBsdInterface).num_bsd || ''}
                                             onChange={(e) => handleDechetChange(index, 'num_bsd', e.target.value)}
                                             onBlur={(e) => handleDechetBlur(index, 'num_bsd', e.target.value)}
                                             className={getInputClasses(hasNumBsdError)}
                                             title={hasNumBsdError ? dechetErrors.num_bsd : undefined}
                                         />
                                         {hasNumBsdError && (
                                             <p className="text-[10px] text-red-600 mt-0.5">{dechetErrors.num_bsd}</p>
                                         )}
                                     </div>
                                 <div>
                                     <label className="block text-xs font-medium text-gray-700 mb-1">Consistance</label>
                                     <select
                                         value={(dechet as DechetBsdInterface).consistance || ''}
                                         onChange={(e) => handleDechetChange(index, 'consistance', e.target.value)}
                                         className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                     >
                                         <option value="">--</option>
                                         <option value="solide">Solide</option>
                                         <option value="liquide">Liquide</option>
                                         <option value="gazeux">Gazeux</option>
                                     </select>
                                 </div>
                                 <div>
                                     <label className="block text-xs font-medium text-gray-700 mb-1">Nombre colis</label>
                                     <input
                                         type="text"
                                         value={(dechet as DechetBsdInterface).nombre_colis || ''}
                                         onChange={(e) => handleDechetChange(index, 'nombre_colis', e.target.value)}
                                         className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                     />
                                 </div>
                                 <div>
                                     <label className="block text-xs font-medium text-gray-700 mb-1">Contenant</label>
                                     <input
                                         type="text"
                                         value={(dechet as DechetBsdInterface).contenant || ''}
                                         onChange={(e) => handleDechetChange(index, 'contenant', e.target.value)}
                                         className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                     />
                                 </div>
                                 <div>
                                     <label className="block text-xs font-medium text-gray-700 mb-1">Volume (m³)</label>
                                     <input
                                         type="text"
                                         value={(dechet as DechetBsdInterface).volume_m3 || ''}
                                         onChange={(e) => handleDechetChange(index, 'volume_m3', e.target.value)}
                                         className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                     />
                                 </div>
                                <div className="flex items-center">
                                    <label className="flex items-center text-xs font-medium text-gray-700">
                                        <input
                                            type="checkbox"
                                            checked={(dechet as DechetBsdInterface).flag_rep === 'true'}
                                            onChange={(e) => handleDechetChange(index, 'flag_rep', e.target.checked ? 'true' : 'false')}
                                            className="mr-2"
                                        />
                                        Flag REP
                                    </label>
                                </div>
                            </>
                        )}
                         
                                 {documentType === "facture" && (
                             <>
                                     <div>
                                     <label className="block text-xs font-medium text-gray-700 mb-1">Nom site</label>
                                         <input
                                             type="text"
                                         value={(dechet as DechetFactureInterface).nom_site || ''}
                                         onChange={(e) => handleDechetChange(index, 'nom_site', e.target.value)}
                                             className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                         />
                                     <input
                                         type="text"
                                         value={(dechet as DechetFactureInterface).adresse_site || ''}
                                         onChange={(e) => handleDechetChange(index, 'adresse_site', e.target.value)}
                                         className="w-full px-2 py-0.5 text-[10px] border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1"
                                         placeholder="Adresse du site"
                                         />
                                     </div>
                                 <div>
                                     <label className="block text-xs font-medium text-gray-700 mb-1">Numéro bon</label>
                                     <input
                                         type="text"
                                         value={(dechet as DechetFactureInterface).num_bon || ''}
                                         onChange={(e) => handleDechetChange(index, 'num_bon', e.target.value)}
                                         onBlur={(e) => handleDechetBlur(index, 'num_bon', e.target.value)}
                                         className={getInputClasses(hasNumBonError)}
                                         title={hasNumBonError ? dechetErrors.num_bon : undefined}
                                     />
                                     {hasNumBonError && (
                                         <p className="text-[10px] text-red-600 mt-0.5">{dechetErrors.num_bon}</p>
                                     )}
                                 </div>
                                 <div>
                                     <label className="block text-xs font-medium text-gray-700 mb-1">Numéro BSD</label>
                                     <input
                                         type="text"
                                         value={(dechet as DechetFactureInterface).num_bsd || ''}
                                         onChange={(e) => handleDechetChange(index, 'num_bsd', e.target.value)}
                                         onBlur={(e) => handleDechetBlur(index, 'num_bsd', e.target.value)}
                                         className={getInputClasses(hasNumBsdError)}
                                         title={hasNumBsdError ? dechetErrors.num_bsd : undefined}
                                     />
                                     {hasNumBsdError && (
                                         <p className="text-[10px] text-red-600 mt-0.5">{dechetErrors.num_bsd}</p>
                                     )}
                                 </div>
                                 <div>
                                     <label className="block text-xs font-medium text-gray-700 mb-1">Contenant</label>
                                     <input
                                         type="text"
                                         value={(dechet as DechetFactureInterface).contenant || ''}
                                         onChange={(e) => handleDechetChange(index, 'contenant', e.target.value)}
                                         className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                     />
                                 </div>
                                 <div>
                                     <label className="block text-xs font-medium text-gray-700 mb-1">Volume (m³)</label>
                                     <input
                                         type="text"
                                         value={(dechet as DechetFactureInterface).volume_m3 || ''}
                                         onChange={(e) => handleDechetChange(index, 'volume_m3', e.target.value)}
                                         className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                     />
                                 </div>
                                 <div>
                                     <label className="block text-xs font-medium text-gray-700 mb-1">Nombre colis</label>
                                     <input
                                         type="text"
                                         value={(dechet as DechetFactureInterface).nombre_colis || ''}
                                         onChange={(e) => handleDechetChange(index, 'nombre_colis', e.target.value)}
                                         className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                     />
                                 </div>
                                <div>
                                    <label className="flex items-center text-xs font-medium text-gray-700">
                                        <input
                                            type="checkbox"
                                            checked={(dechet as DechetFactureInterface).flag_rep === 'true'}
                                            onChange={(e) => handleDechetChange(index, 'flag_rep', e.target.checked ? 'true' : 'false')}
                                            className="mr-2"
                                        />
                                        Flag REP
                                    </label>
                                </div>
                             </>
                         )}
                         
                         {/* Section lignes de facturation pour les factures */}
                         {documentType === "facture" && (
                             <div className="col-span-3 mt-2">
                                 <h5 className="font-semibold text-gray-700 mb-2 text-sm">Lignes de facturation</h5>
                                 <div className="space-y-2">
                                     {(dechet as DechetFactureInterface).facture?.ligne?.map((ligne, ligneIndex) => {
                                         const ligneError = dechetErrors?.lignes_facture?.[ligneIndex];
                                         const hasCalculError = !!ligneError?.calcul;
                                         return (
                                         <div key={ligneIndex} className={`bg-white p-2 rounded border ${hasCalculError ? 'border-red-500' : ''}`}>
                                            {hasCalculError && (
                                                <p className="text-[10px] text-red-600 mb-1">{ligneError.calcul}</p>
                                            )}
                                            <div className="flex gap-2 items-end">
                                                 <div className="flex-[2]">
                                                     <label className="block text-xs font-medium text-gray-600 mb-1">Type opération</label>
                                                     <input
                                                         type="text"
                                                         value={ligne.type_operation || ''}
                                                         onChange={(e) => {
                                                             const factureData = formData as unknown as DocFactureInterface;
                                                             const updatedDechet = [...factureData.dechet];
                                                             if (updatedDechet[index] && updatedDechet[index].facture) {
                                                                 const updatedLignes = [...updatedDechet[index].facture.ligne];
                                                                 updatedLignes[ligneIndex] = { ...updatedLignes[ligneIndex], type_operation: e.target.value };
                                                                 updatedDechet[index].facture.ligne = updatedLignes;
                                                                 handleInputChange('dechet', updatedDechet);
                                                             }
                                                         }}
                                                         className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                                     />
                                                 </div>
                                                 <div className="flex-1">
                                                     <label className="block text-xs font-medium text-gray-600 mb-1">Quantité</label>
                                                     <input
                                                         type="text"
                                                         value={ligne.quantite || ''}
                                                         onChange={(e) => {
                                                             const factureData = formData as unknown as DocFactureInterface;
                                                             const updatedDechet = [...factureData.dechet];
                                                             if (updatedDechet[index] && updatedDechet[index].facture) {
                                                                 const updatedLignes = [...updatedDechet[index].facture.ligne];
                                                                 updatedLignes[ligneIndex] = { ...updatedLignes[ligneIndex], quantite: e.target.value };
                                                                 updatedDechet[index].facture.ligne = updatedLignes;
                                                                 handleInputChange('dechet', updatedDechet);
                                                             }
                                                         }}
                                                         onBlur={() => handleLigneBlur(index, ligneIndex)}
                                                         className={getInputClasses(hasCalculError, "w-full px-2 py-1 text-xs border rounded")}
                                                     />
                                                 </div>
                                                 <div className="flex-1">
                                                     <label className="block text-xs font-medium text-gray-600 mb-1">Unité</label>
                                                     <input
                                                         type="text"
                                                         value={ligne.unite || ''}
                                                         onChange={(e) => {
                                                             const factureData = formData as DocFactureInterface;
                                                             const updatedDechet = [...factureData.dechet];
                                                             if (updatedDechet[index] && updatedDechet[index].facture) {
                                                                 const updatedLignes = [...updatedDechet[index].facture.ligne];
                                                                 updatedLignes[ligneIndex] = { ...updatedLignes[ligneIndex], unite: e.target.value };
                                                                 updatedDechet[index].facture.ligne = updatedLignes;
                                                                 handleInputChange('dechet', updatedDechet);
                                                             }
                                                         }}
                                                         className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                                     />
                                                 </div>
                                                 <div className="flex-1">
                                                     <label className="block text-xs font-medium text-gray-600 mb-1">PU</label>
                                                     <input
                                                         type="text"
                                                         value={ligne.prix_unitaire || ''}
                                                         onChange={(e) => {
                                                             const factureData = formData as DocFactureInterface;
                                                             const updatedDechet = [...factureData.dechet];
                                                             if (updatedDechet[index] && updatedDechet[index].facture) {
                                                                 const updatedLignes = [...updatedDechet[index].facture.ligne];
                                                                 updatedLignes[ligneIndex] = { ...updatedLignes[ligneIndex], prix_unitaire: e.target.value };
                                                                 updatedDechet[index].facture.ligne = updatedLignes;
                                                                 handleInputChange('dechet', updatedDechet);
                                                             }
                                                         }}
                                                         onBlur={() => handleLigneBlur(index, ligneIndex)}
                                                         className={getInputClasses(hasCalculError, "w-full px-2 py-1 text-xs border rounded")}
                                                     />
                                                 </div>
                                                 <div className="flex-1">
                                                     <label className="block text-xs font-medium text-gray-600 mb-1">Coût HT</label>
                                                     <input
                                                         type="text"
                                                         value={ligne.montant_ht || ''}
                                                         onChange={(e) => {
                                                             const factureData = formData as DocFactureInterface;
                                                             const updatedDechet = [...factureData.dechet];
                                                             if (updatedDechet[index] && updatedDechet[index].facture) {
                                                                 const updatedLignes = [...updatedDechet[index].facture.ligne];
                                                                 updatedLignes[ligneIndex] = { ...updatedLignes[ligneIndex], montant_ht: e.target.value };
                                                                 updatedDechet[index].facture.ligne = updatedLignes;
                                                                 handleInputChange('dechet', updatedDechet);
                                                             }
                                                         }}
                                                         onBlur={() => handleLigneBlur(index, ligneIndex)}
                                                         className={getInputClasses(hasCalculError, "w-full px-2 py-1 text-xs border rounded")}
                                                     />
                                                 </div>
                                                {/* Champs V2 */}
                                                 <div className="flex-1">
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">TVA %</label>
                                                     <input
                                                         type="text"
                                                        value={ligne.tva_pourcentage || ''}
                                                         onChange={(e) => {
                                                             const factureData = formData as DocFactureInterface;
                                                             const updatedDechet = [...factureData.dechet];
                                                             if (updatedDechet[index] && updatedDechet[index].facture) {
                                                                 const updatedLignes = [...updatedDechet[index].facture.ligne];
                                                                updatedLignes[ligneIndex] = { ...updatedLignes[ligneIndex], tva_pourcentage: e.target.value };
                                                                 updatedDechet[index].facture.ligne = updatedLignes;
                                                                 handleInputChange('dechet', updatedDechet);
                                                             }
                                                         }}
                                                         className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                                     />
                                                 </div>
                                                <div className="w-14 flex flex-col items-center">
                                                    <label className="block text-[10px] font-medium text-gray-600 mb-1 text-center">Avoir</label>
                                                    <input
                                                        type="checkbox"
                                                        checked={ligne.avoir === 'true'}
                                                        onChange={(e) => {
                                                            const factureData = formData as DocFactureInterface;
                                                            const updatedDechet = [...factureData.dechet];
                                                            if (updatedDechet[index] && updatedDechet[index].facture) {
                                                                const updatedLignes = [...updatedDechet[index].facture.ligne];
                                                                updatedLignes[ligneIndex] = { ...updatedLignes[ligneIndex], avoir: e.target.checked ? 'true' : 'false' };
                                                                updatedDechet[index].facture.ligne = updatedLignes;
                                                                handleInputChange('dechet', updatedDechet);
                                                            }
                                                        }}
                                                        className="scale-90"
                                                    />
                                                </div>
                                                <div className="w-14 flex flex-col items-center">
                                                    <label className="block text-[10px] font-medium text-gray-600 mb-1 text-center">Décl.</label>
                                                    <input
                                                        type="checkbox"
                                                        checked={ligne.declassement === 'true'}
                                                        onChange={(e) => {
                                                            const factureData = formData as DocFactureInterface;
                                                            const updatedDechet = [...factureData.dechet];
                                                            if (updatedDechet[index] && updatedDechet[index].facture) {
                                                                const updatedLignes = [...updatedDechet[index].facture.ligne];
                                                                updatedLignes[ligneIndex] = { ...updatedLignes[ligneIndex], declassement: e.target.checked ? 'true' : 'false' };
                                                                updatedDechet[index].facture.ligne = updatedLignes;
                                                                handleInputChange('dechet', updatedDechet);
                                                            }
                                                        }}
                                                        className="scale-90"
                                                    />
                                                </div>
                                                
                                                {/* Bouton supprimer ligne */}
                                                <div className="w-6">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const factureData = formData as DocFactureInterface;
                                                            const updatedDechet = [...factureData.dechet];
                                                            if (updatedDechet[index] && updatedDechet[index].facture) {
                                                                const updatedLignes = [...updatedDechet[index].facture.ligne];
                                                                updatedLignes.splice(ligneIndex, 1);
                                                                updatedDechet[index].facture.ligne = updatedLignes;
                                                                handleInputChange('dechet', updatedDechet);
                                                            }
                                                        }}
                                                        className="bg-red-500 hover:bg-red-600 text-white px-1 py-0.5 rounded text-[10px] font-bold leading-tight"
                                                        title="Supprimer cette ligne"
                                                    >
                                                        -
                                                    </button>
                                                </div>
                                             </div>
                                         </div>
                                     );
                                     })}
                                     <button
                                         type="button"
                                         onClick={() => {
                                             const factureData = formData as DocFactureInterface;
                                             const updatedDechet = [...factureData.dechet];
                                             if (updatedDechet[index] && updatedDechet[index].facture) {
                                                 updatedDechet[index].facture.ligne.push({
                                                     type_operation: '',
                                                     quantite: '',
                                                     unite: '',
                                                     prix_unitaire: '',
                                                     montant_ht: '',
                                                    // Champs V2
                                                    tva_pourcentage: '',
                                                    avoir: 'false',
                                                    declassement: 'false'
                                                 });
                                                 handleInputChange('dechet', updatedDechet);
                                             } else if (updatedDechet[index]) {
                                                 // Initialiser la facture si elle n'existe pas
                                                 updatedDechet[index].facture = {
                                                     ligne: [{
                                                         type_operation: '',
                                                         quantite: '',
                                                         unite: '',
                                                         prix_unitaire: '',
                                                         montant_ht: '',
                                                        // Champs V2
                                                        tva_pourcentage: '',
                                                        avoir: 'false',
                                                        declassement: 'false'
                                                    }]
                                                 };
                                                 handleInputChange('dechet', updatedDechet);
                                             }
                                         }}
                                         className="w-full px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                     >
                                         + Ajouter une ligne
                                     </button>
                                 </div>
                             </div>
                         )}
                    </div>
                </div>
            );
        };

        return (
            <div className="h-full overflow-y-auto p-1 bg-gray-50">
                <div className="mb-3">
                    <h2 className="text-lg font-bold text-gray-800 mb-2">
                        Extraction Document - {documentType?.toUpperCase() || 'Type inconnu'}
                    </h2>
                    
                    {/* Sélecteur de type de document */}
                    <div className="bg-white rounded-lg p-2 mb-1 shadow-sm flex items-center justify-between">
                        <h3 className="text-base font-semibold text-purple-600">Type de document</h3>
                        <div className="flex gap-4">
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    name="documentType"
                                    value="bon"
                                    checked={documentType === "bon"}
                                    onChange={(e) => {
                                        setDocumentType(e.target.value as "bon" | "bsd" | "facture");
                                        // Réinitialiser le formulaire avec le nouveau type
                                        const newFormData = {
                                            type_doc: e.target.value as "bon" | "bsd" | "facture",
                                            site_raw: formData.site_raw,
                                            presta_raw: formData.presta_raw,
                                            dechet: []
                                        };
                                        setFormData(newFormData as DocInterface);
                                    }}
                                    className="mr-2"
                                />
                                Bon de livraison
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    name="documentType"
                                    value="bsd"
                                    checked={documentType === "bsd"}
                                    onChange={(e) => {
                                        setDocumentType(e.target.value as "bon" | "bsd" | "facture");
                                        const newFormData = {
                                            type_doc: e.target.value as "bon" | "bsd" | "facture",
                                            site_raw: formData.site_raw,
                                            presta_raw: formData.presta_raw,
                                            conformite: { CAP: '', ADR: '' },
                                            dechet: []
                                        };
                                        setFormData(newFormData as DocInterface);
                                    }}
                                    className="mr-2"
                                />
                                BSD
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    name="documentType"
                                    value="facture"
                                    checked={documentType === "facture"}
                                    onChange={(e) => {
                                        setDocumentType(e.target.value as "bon" | "bsd" | "facture");
                                        const newFormData = {
                                            type_doc: e.target.value as "bon" | "bsd" | "facture",
                                            site_raw: formData.site_raw,
                                            presta_raw: formData.presta_raw,
                                            num_facture: '',
                                            dechet: []
                                        };
                                        setFormData(newFormData as DocInterface);
                                    }}
                                    className="mr-2"
                                />
                                Facture
                            </label>
                        </div>
                    </div>
                    
                    {/* Informations générales */}
                    <div className="bg-white rounded-lg p-2 mb-1 shadow-sm">
                        <h3 className="text-base font-semibold text-blue-600 mb-1">Informations générales</h3>
                        <div className="grid grid-cols-2 gap-2 mb-1">
                            {/* Colonne 1 : Site */}
                            {documentType !== "facture" && (
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Site (texte brut)</label>
                                <input
                                    type="text"
                                    value={formData.site_raw || ''}
                                    onChange={(e) => handleInputChange('site_raw', e.target.value)}
                                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="Coller ici le texte brut OCR du site"
                                    />
                                    {(documentType === "bon" || documentType === "bsd") && (
                                        <div className="flex items-center gap-1 mt-1">
                                            <label className="text-[10px] font-medium text-gray-600 whitespace-nowrap">Adresse:</label>
                                            <input
                                                type="text"
                                                value={documentType === "bon" ? (formData as DocBonInterface).adresse_site || '' : (formData as DocBsdInterface).adresse_site || ''}
                                                onChange={(e) => handleInputChange('adresse_site', e.target.value)}
                                                className="flex-1 px-2 py-0.5 text-[10px] border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                placeholder="Adresse"
                                />
                            </div>
                                    )}
                                    {documentType === "bsd" && (
                                        <div className="flex items-center gap-1 mt-1">
                                            <label className="text-[10px] font-medium text-gray-600 whitespace-nowrap">Type:</label>
                                            <input
                                                type="text"
                                                value={(formData as DocBsdInterface).type_emetteur || ''}
                                                onChange={(e) => handleInputChange('type_emetteur', e.target.value)}
                                                className="flex-1 px-2 py-0.5 text-[10px] border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                placeholder="Producteur, Collecteur..."
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {/* Colonne 2 : Prestataires */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Prestataire (texte brut)</label>
                                <input
                                    type="text"
                                    value={formData.presta_raw || ''}
                                    onChange={(e) => handleInputChange('presta_raw', e.target.value)}
                                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="Coller ici le texte brut OCR du prestataire"
                                />
                                
                                {/* Prestataire 2 et Rôle sur la même ligne */}
                                <div className="grid grid-cols-2 gap-1 mt-2">
                                    <div>
                                        <label className="block text-[10px] font-medium text-gray-600 mb-1">Prestataire 2</label>
                                        <input
                                            type="text"
                                            value={formData.nom_prestataire_2 || ''}
                                            onChange={(e) => handleInputChange('nom_prestataire_2', e.target.value)}
                                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            placeholder="Nom du 2ème prestataire"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-gray-600 mb-1">Rôle</label>
                                        <select
                                            value={formData.role_prestataire_2 || ''}
                                            onChange={(e) => handleInputChange('role_prestataire_2', e.target.value)}
                                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        >
                                            <option value="">--</option>
                                            <option value="transporteur">Transporteur</option>
                                            <option value="destinataire">Destinataire</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        
                        {/* Champs V2 spécifiques BON */}
                        {documentType === "bon" && (
                            <div className="grid grid-cols-3 gap-2 mb-1 border-t border-gray-200 pt-1 mt-1">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Type de bon</label>
                                    <input
                                        type="text"
                                        value={(formData as DocBonInterface).type_bon || ''}
                                        onChange={(e) => handleInputChange('type_bon', e.target.value)}
                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="livraison, transport, pesée..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Immatriculation</label>
                                    <input
                                        type="text"
                                        value={(formData as DocBonInterface).immatriculation || ''}
                                        onChange={(e) => handleInputChange('immatriculation', e.target.value)}
                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Récépissé</label>
                                    <input
                                        type="text"
                                        value={(formData as DocBonInterface).recepisse || ''}
                                        onChange={(e) => handleInputChange('recepisse', e.target.value)}
                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        )}
                        
                        {/* Champs V2 spécifiques FACTURE */}
                        {documentType === "facture" && (
                            <>
                                <div className="grid grid-cols-3 gap-2 mb-1 border-t border-gray-200 pt-1 mt-1">
                                <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">N° Facture</label>
                                    <input
                                        type="text"
                                            value={(formData as DocFactureInterface).num_facture || ''}
                                        onChange={(e) => handleInputChange('num_facture', e.target.value)}
                                        onBlur={(e) => handleFieldBlur('num_facture', e.target.value)}
                                        className={getInputClasses(!!validationErrors.num_facture)}
                                        title={validationErrors.num_facture}
                                    />
                                    {validationErrors.num_facture && (
                                        <p className="text-[10px] text-red-600 mt-0.5">{validationErrors.num_facture}</p>
                                    )}
                                </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Montant Total HT</label>
                                        <input
                                            type="text"
                                            value={(formData as DocFactureInterface).montant_total_ht || ''}
                                            onChange={(e) => handleInputChange('montant_total_ht', e.target.value)}
                                            onBlur={(e) => handleFieldBlur('montant_total_ht', e.target.value)}
                                            className={getInputClasses(!!validationErrors.somme_facture)}
                                            title={validationErrors.somme_facture}
                                        />
                                        {validationErrors.somme_facture && (
                                            <p className="text-[10px] text-red-600 mt-0.5">{validationErrors.somme_facture}</p>
                                        )}
                            </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Total TTC</label>
                                        <input
                                            type="text"
                                            value={(formData as DocFactureInterface).total_ttc || ''}
                                            onChange={(e) => handleInputChange('total_ttc', e.target.value)}
                                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 mb-1">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Type facture</label>
                                        <input
                                            type="text"
                                            value={(formData as DocFactureInterface).type_facture || ''}
                                            onChange={(e) => handleInputChange('type_facture', e.target.value)}
                                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            placeholder="Facture, Avoir, Rachat..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Date début période</label>
                                        <input
                                            type="date"
                                            value={(formData as DocFactureInterface).date_debut_periode || ''}
                                            onChange={(e) => handleInputChange('date_debut_periode', e.target.value)}
                                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Date fin période</label>
                                        <input
                                            type="date"
                                            value={(formData as DocFactureInterface).date_fin_periode || ''}
                                            onChange={(e) => handleInputChange('date_fin_periode', e.target.value)}
                                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 mb-1">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">N° Contrat</label>
                                        <input
                                            type="text"
                                            value={(formData as DocFactureInterface).num_contrat || ''}
                                            onChange={(e) => handleInputChange('num_contrat', e.target.value)}
                                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">N° Compte</label>
                                        <input
                                            type="text"
                                            value={(formData as DocFactureInterface).num_compte || ''}
                                            onChange={(e) => handleInputChange('num_compte', e.target.value)}
                                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">N° Client</label>
                                        <input
                                            type="text"
                                            value={(formData as DocFactureInterface).num_client || ''}
                                            onChange={(e) => handleInputChange('num_client', e.target.value)}
                                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                        
                    {/* Section BSD Acteurs */}
                    {documentType === "bsd" && (
                        <div className="bg-white rounded-lg p-2 mb-1 shadow-sm">
                            <h3 className="text-base font-semibold text-blue-600 mb-2">Acteurs et Conformité</h3>
                            
                            {/* 1. Infos Transporteur - UNE LIGNE */}
                            <div className="mb-2">
                                <h4 className="text-xs font-semibold text-gray-700 mb-1">Transporteur</h4>
                                <div className="grid grid-cols-5 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Récépissé</label>
                                        <input type="text" placeholder="Récépissé" value={formData.add_presta_raw?.infos_transporteur?.recepisse || ''} onChange={(e) => { const c = formData.add_presta_raw || { type: "transporteur", adresse: "", tel: "", mail: "", fax: "" }; const i = c.infos_transporteur || { recepisse: "", departement: "", limite_validite: "", routier: "" }; handleInputChange('add_presta_raw', { ...c, type: "transporteur", infos_transporteur: { ...i, recepisse: e.target.value } }); }} className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Département</label>
                                        <input type="text" placeholder="Dépt" value={formData.add_presta_raw?.infos_transporteur?.departement || ''} onChange={(e) => { const c = formData.add_presta_raw || { type: "transporteur", adresse: "", tel: "", mail: "", fax: "" }; const i = c.infos_transporteur || { recepisse: "", departement: "", limite_validite: "", routier: "" }; handleInputChange('add_presta_raw', { ...c, type: "transporteur", infos_transporteur: { ...i, departement: e.target.value } }); }} className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Validité</label>
                                        <input type="date" value={formData.add_presta_raw?.infos_transporteur?.limite_validite || ''} onChange={(e) => { const c = formData.add_presta_raw || { type: "transporteur", adresse: "", tel: "", mail: "", fax: "" }; const i = c.infos_transporteur || { recepisse: "", departement: "", limite_validite: "", routier: "" }; handleInputChange('add_presta_raw', { ...c, type: "transporteur", infos_transporteur: { ...i, limite_validite: e.target.value } }); }} className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Mode</label>
                                        <input type="text" placeholder="Mode" value={formData.add_presta_raw?.infos_transporteur?.routier || ''} onChange={(e) => { const c = formData.add_presta_raw || { type: "transporteur", adresse: "", tel: "", mail: "", fax: "" }; const i = c.infos_transporteur || { recepisse: "", departement: "", limite_validite: "", routier: "" }; handleInputChange('add_presta_raw', { ...c, type: "transporteur", infos_transporteur: { ...i, routier: e.target.value } }); }} className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Multimodal</label>
                                        <input type="checkbox" checked={formData.add_presta_raw?.infos_transporteur?.multimodal === 'true'} onChange={(e) => { const c = formData.add_presta_raw || { type: "transporteur", adresse: "", tel: "", mail: "", fax: "" }; const i = c.infos_transporteur || { recepisse: "", departement: "", limite_validite: "", routier: "" }; handleInputChange('add_presta_raw', { ...c, type: "transporteur", infos_transporteur: { ...i, multimodal: e.target.checked ? 'true' : 'false' } }); }} className="mt-4" />
                                    </div>
                                </div>
                            </div>

                            {/* 2. CAP / ADR */}
                            <div className="mb-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">CAP</label>
                                        <input type="text" value={(formData as unknown as DocBsdInterface).conformite?.CAP || ''} onChange={(e) => { const bsdData = formData as unknown as DocBsdInterface; handleInputChange('conformite', { ...bsdData.conformite, CAP: e.target.value }); }} className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">ADR</label>
                                        <input type="text" value={(formData as unknown as DocBsdInterface).conformite?.ADR || ''} onChange={(e) => { const bsdData = formData as unknown as DocBsdInterface; handleInputChange('conformite', { ...bsdData.conformite, ADR: e.target.value }); }} className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                    </div>
                                </div>
                            </div>

                            {/* 3. Exutoire */}
                            <div className="mb-2">
                                <h4 className="text-xs font-semibold text-gray-700 mb-1">Exutoire</h4>
                                <div className="grid grid-cols-3 gap-2">
                                    <label className="flex items-center text-xs font-medium text-gray-700"><input type="checkbox" checked={(formData as DocBsdInterface).exutoire?.entreposage === 'true'} onChange={(e) => handleInputChange('exutoire', {...(formData as DocBsdInterface).exutoire, entreposage: e.target.checked ? 'true' : 'false'})} className="mr-2" />Entreposage</label>
                                    <label className="flex items-center text-xs font-medium text-gray-700"><input type="checkbox" checked={(formData as DocBsdInterface).exutoire?.lot_accepte === 'true'} onChange={(e) => handleInputChange('exutoire', {...(formData as DocBsdInterface).exutoire, lot_accepte: e.target.checked ? 'true' : 'false'})} className="mr-2" />Lot accepté</label>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Motif refus</label>
                                        <input type="text" placeholder="Motif refus" value={(formData as DocBsdInterface).exutoire?.motif_refus || ''} onChange={(e) => handleInputChange('exutoire', {...(formData as DocBsdInterface).exutoire, motif_refus: e.target.value})} className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
                                    </div>
                                </div>
                            </div>

                            {/* 4. Négociant - TOGGLE */}
                            <div className="border-t border-gray-200 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowNegociant(!showNegociant)}
                                    className="flex items-center justify-between w-full text-xs font-semibold text-gray-700 hover:text-blue-600 transition-colors"
                                >
                                    <span>Négociant</span>
                                    <span>{showNegociant ? '▼' : '▶'}</span>
                                </button>
                                {showNegociant && (
                                    <div className="grid grid-cols-3 gap-2 mt-2">
                                        <div>
                                            <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Nom</label>
                                            <input type="text" placeholder="Nom" value={(formData as DocBsdInterface).negociant_raw?.nom || ''} onChange={(e) => handleInputChange('negociant_raw', {...(formData as DocBsdInterface).negociant_raw, nom: e.target.value})} className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-medium text-gray-600 mb-0.5">SIREN</label>
                                            <input type="text" placeholder="SIREN" value={(formData as DocBsdInterface).negociant_raw?.siren || ''} onChange={(e) => handleInputChange('negociant_raw', {...(formData as DocBsdInterface).negociant_raw, siren: e.target.value})} className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Adresse</label>
                                            <input type="text" placeholder="Adresse" value={(formData as DocBsdInterface).negociant_raw?.adresse || ''} onChange={(e) => handleInputChange('negociant_raw', {...(formData as DocBsdInterface).negociant_raw, adresse: e.target.value})} className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Récépissé</label>
                                            <input type="text" placeholder="Récépissé" value={(formData as DocBsdInterface).negociant_raw?.recepisse || ''} onChange={(e) => handleInputChange('negociant_raw', {...(formData as DocBsdInterface).negociant_raw, recepisse: e.target.value})} className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Département</label>
                                            <input type="text" placeholder="Département" value={(formData as DocBsdInterface).negociant_raw?.departement || ''} onChange={(e) => handleInputChange('negociant_raw', {...(formData as DocBsdInterface).negociant_raw, departement: e.target.value})} className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Validité</label>
                                            <input type="text" placeholder="Validité" value={(formData as DocBsdInterface).negociant_raw?.validite || ''} onChange={(e) => handleInputChange('negociant_raw', {...(formData as DocBsdInterface).negociant_raw, validite: e.target.value})} className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Section Déchets */}
                    <div className="bg-white rounded-lg p-2 mb-1 shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-base font-semibold text-green-600">Déchets</h3>
                            <div className="flex items-center gap-2">
                                {documentType === "facture" && formData.dechet.length > 1 && (
                                    <label className="flex items-center text-xs text-gray-700">
                                        <input
                                            type="checkbox"
                                            onChange={(e) => {
                                                if (e.target.checked && formData.dechet.length > 0) {
                                                    const factureData = formData as DocFactureInterface;
                                                    const firstDechet = factureData.dechet[0];
                                                    const nom_site_ref = firstDechet.nom_site || '';
                                                    const adresse_site_ref = firstDechet.adresse_site || '';
                                                    
                                                    const updatedDechet = factureData.dechet.map((d, i) => 
                                                        i === 0 ? d : {
                                                            ...d,
                                                            nom_site: nom_site_ref,
                                                            adresse_site: adresse_site_ref
                                                        }
                                                    );
                                                    handleInputChange('dechet', updatedDechet);
                                                }
                                            }}
                                            className="mr-1"
                                        />
                                        Même site pour tous
                                    </label>
                                )}
                            <button
                                type="button"
                                onClick={addDechet}
                                className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
                            >
                                Ajouter un déchet
                            </button>
                            </div>
                        </div>
                        
                        {formData.dechet.length === 0 ? (
                            <p className="text-gray-500 text-center py-2 text-sm">Aucun déchet ajouté</p>
                        ) : (
                            formData.dechet.map((dechet, index) => renderDechetFields(dechet, index))
                        )}
                    </div>

                    {/* Boutons d'action */}
                    <div className="flex justify-end gap-2">
                        {showRagButton && (
                            <Push2RAGButton 
                                pdfId={String(pdf_id)}
                                pdfPath={pdf_path}
                                docData={formData as unknown as Record<string, unknown>}
                                documentType={formData.type_doc}
                                disabled={false}
                                forceImage={forceImage}
                            />
                        )}
                        <button
                            onClick={async () => {
                                // Mettre à jour les erreurs avant de sauvegarder (pour info, mais ne bloque pas)
                                validateAll();
                                
                                setIsLoading(true);
                                try {
                                    await onSave(formData);
                                } finally {
                                    setIsLoading(false);
                                }
                            }}
                            disabled={isLoading}
                            className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? 'Sauvegarde...' : 'Sauvegarder'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const ModalExtractDoc = () => {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg w-full h-[95vh] max-w-[95vw] relative">
                    {/* Header avec bouton de fermeture */}
                    <div className="absolute top-0 right-0 p-4 z-10">
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                if (onClose) onClose();
                            }}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Boutons d'action et Scores en haut */}
                    <div className="absolute top-4 left-4 z-10 flex items-center gap-4">
                        <div className="flex gap-2 items-center">
                            {/* Checkbox Force Image */}
                            <label className="flex items-center gap-1.5 bg-white rounded-lg px-2 py-1 shadow-sm border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={forceImage}
                                    onChange={(e) => setForceImage(e.target.checked)}
                                    className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-1"
                                />
                                <span className="text-xs font-medium text-gray-700 whitespace-nowrap">Force Image</span>
                            </label>
                            
                            <BoutonExtractDoc 
                                pdfId={String(pdf_id)}
                                forceImage={forceImage}
                                onExtractSuccess={(pdfId: string, data: MetaOcrResponse) => {
                                    console.log('[ExtractDoc] Extraction success log:', { pdfId, data });
                                    applyExtractionToForm(data);
                                    toast.success('Extraction réussie');
                                }}
                                onExtractError={(pdfId: string, error: unknown) => {
                                    console.log('[ExtractDoc] Extraction error log:', { pdfId, error });
                                    console.error('Erreur extraction:', error);
                                    toast.error('Erreur extraction');
                                }}
                            />
                            <BoutonSplitDoc 
                                pdfId={pdf_id}
                                entrepriseId={Number(entreprise_id) || 0}
                                onSplitComplete={(newPdfIds) => {
                                    console.log('Split terminé:', newPdfIds);
                                    setIsOpen(false);
                                }}
                            />
                            <BoutonSmartSplitDoc 
                                pdfId={pdf_id}
                                entrepriseId={Number(entreprise_id) || 0}
                                onSplitComplete={(newPdfIds) => {
                                    console.log('Smart split terminé:', newPdfIds);
                                    setIsOpen(false);
                                }}
                            />
                            <Push2RAGButton 
                                pdfId={pdf_id}
                                pdfPath={pdf_path}
                                docData={currentFormRef.current}
                                documentType={documentType || 'inconnu'}
                                disabled={!currentFormRef.current}
                                forceImage={forceImage}
                            />
                            {/* PushFactureButton now rendered in LinkMeta.tsx */}
                        </div>
                        
                        {/* Scores de confiance et Alertes */}
                        {(confidenceData || alerteData) && (
                            <div className="flex items-center gap-4 bg-white rounded-lg p-2 shadow-sm border">
                                {/* Scores de confiance */}
                                {confidenceData && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-gray-600">Confidence:</span>
                                        {confidenceData.brute !== undefined && (
                                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                                Brute: {confidenceData.brute}%
                                            </span>
                                        )}
                                        {confidenceData.spec !== undefined && (
                                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                                Spec: {confidenceData.spec}%
                                            </span>
                                        )}
                                        {confidenceData.handwritten && (
                                            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                                Manuscrit: {confidenceData.handwritten[0]}% {confidenceData.handwritten[1] ? '(Oui)' : '(Non)'}
                                            </span>
                                        )}
                                    </div>
                                )}
                                
                                {/* Alerte */}
                                {alerteData && alerteData.stop && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-red-600">⚠️ Alerte Stop</span>
                                        <div className="relative group">
                                            <button className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded hover:bg-red-200 transition-colors">
                                                Info
                                            </button>
                                            {alerteData.message && (
                                                <div className="absolute bottom-full left-0 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                                    {alerteData.message}
                                                    <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Contenu principal */}
                    <div className="flex h-full p-4 gap-4 pt-16">
                        <div className="w-1/2 h-full">
                            <DisplayDocPDF pdf_path={pdf_path}/>
                        </div>
                        <div className="w-1/2 h-full">
                            <FormulaireExtractDoc onSave={handleSave} onChange={(fd) => { currentFormRef.current = fd as unknown as Record<string, unknown>; }} showRagButton={openedFromLoopStarter} forceImage={forceImage}/>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div>
            <OpenExtractModalButton />
            {isOpen && (
                <ModalExtractDoc />
            )}
        </div>
    );
};

export default ExtractDoc;
