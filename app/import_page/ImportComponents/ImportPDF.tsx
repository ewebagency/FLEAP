'use client'
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { SessionMore, useSession } from '../../component/SessionProvider';
import { useImport } from './ImportContext';
import BoxIcon from '@/app/component/BoxIconWrapper';
import { handleExcelUpload } from './ImportExcel';
import {ExcelIcon} from './TableImportedFiles';
import { cofounders_user_id } from '@/app/component/SideBar';

const sanitizeFileName = (fileName: string): string => {
    return fileName
        .replace(/[^a-zA-Z0-9.-]/g, '_') // Remplace les caractères spéciaux par des underscores
        .replace(/_+/g, '_'); // Évite les underscores multiples
};

// Types pour autocomplétion (issus de ButtonImportExcels)
interface PointCollecteInterface {
  nom: string;
  adresse: string;
}
interface ContactInterface {
  nom: string;
  email: string;
  telephone: string;
  respoTerrain: boolean;
}
interface SiteInterface {
  table_id: number;
  value: {
    nom: string;
    siret: string;
    adresseSiege: string;
    pointsCollecte: PointCollecteInterface[];
    contacts: ContactInterface[];
  }
}
interface TransporteurInterface {
  table_id: number;
  value: {
    nomBoite?: string;
    adresse?: string;
    siret?: string;
    nomPrenom?: string;
    email?: string;
    telephone?: string;
  }
}
interface DestinataireInterface {
  table_id: number;
  value: {
    nomBoite?: string;
    adresse?: string;
    siret?: string;
    nomPrenom?: string;
    email?: string;
    telephone?: string;
    mention?: boolean;
  }
}
interface AutocompletionData {
  sites: SiteInterface[];
  transporteurs: TransporteurInterface[];
  destinataires: DestinataireInterface[];
}
interface Prestataire {
  id: number;
  type: 'transporteur' | 'destinataire';
  nom: string;
  siret?: string;
  email?: string;
  nomBoite?: string;
  nomPrenom?: string;
  adresse?: string;
  telephone?: string;
}

const ImportPDF = () => {
    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
    const [selectedFileType, setSelectedFileType] = useState<'pdf' | 'excel'>('pdf');
    const [showFileTypeMenu, setShowFileTypeMenu] = useState(false);
    const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
    const [duplicateFiles, setDuplicateFiles] = useState<string[]>([]);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const session = useSession() as SessionMore;
    const user_id = session?.user_id;
    const entreprise_id = session?.entreprise_id;
    const { triggerReload } = useImport();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Ajout pour autocomplétion et sélection site/presta par fichier
    const [autocompletionData, setAutocompletionData] = useState<AutocompletionData>({
      sites: [],
      transporteurs: [],
      destinataires: []
    });
    const [showPDFMetaModal, setShowPDFMetaModal] = useState(false);
    const [selectedSite, setSelectedSite] = useState<SiteInterface | null>(null);
    const [selectedPresta, setSelectedPresta] = useState<Prestataire | null>(null);
    const [selectedDocumentType, setSelectedDocumentType] = useState<'bsd' | 'facture' | 'bon'>('bsd');
    const [filesToImport, setFilesToImport] = useState<File[]>([]);

    // Charger les données d'autocomplétion (comme dans l'import Excel)
    useEffect(() => {
      const fetchAutocompletionData = async () => {
        if (!entreprise_id) return;
        try {
          const { data, error } = await supabase
            .from('table_autocompletion')
            .select('*')
            .eq('entreprise_id', entreprise_id);
          if (error) throw error;
          if (data) {
            const sites: SiteInterface[] = [];
            const transporteurs: TransporteurInterface[] = [];
            const destinataires: DestinataireInterface[] = [];
            data.forEach((item: { id: number; site?: SiteInterface['value']; transporteur?: TransporteurInterface['value']; destinataire?: DestinataireInterface['value']; }) => {
              if (item.site) {
                sites.push({ table_id: item.id, value: item.site });
              }
              if (item.transporteur) {
                transporteurs.push({ table_id: item.id, value: item.transporteur });
              }
              if (item.destinataire) {
                destinataires.push({ table_id: item.id, value: item.destinataire });
              }
            });
            setAutocompletionData({ sites, transporteurs, destinataires });
          }
        } catch (error) {
          console.error('Erreur lors du chargement des données d\'autocomplétion:', error);
        }
      };
      fetchAutocompletionData();
    }, [entreprise_id]);

    // Liste des prestataires (transporteurs + destinataires)
    const prestataires: Prestataire[] = [
      ...autocompletionData.transporteurs.map(t => ({
        id: t.table_id,
        type: 'transporteur' as const,
        nom: t.value.nomBoite || t.value.nomPrenom || 'Transporteur sans nom',
        nomBoite: t.value.nomBoite,
        nomPrenom: t.value.nomPrenom,
        siret: t.value.siret,
        email: t.value.email,
        adresse: t.value.adresse,
        telephone: t.value.telephone
      })),
      ...autocompletionData.destinataires.map(d => ({
        id: d.table_id,
        type: 'destinataire' as const,
        nom: d.value.nomBoite || d.value.nomPrenom || 'Destinataire sans nom',
        nomBoite: d.value.nomBoite,
        nomPrenom: d.value.nomPrenom,
        siret: d.value.siret,
        email: d.value.email,
        adresse: d.value.adresse,
        telephone: d.value.telephone
      }))
    ];

    // Fermer le menu si on clique en dehors
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowFileTypeMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Fonction pour vérifier les doublons
    const checkDuplicates = async (files: File[]): Promise<string[]> => {
        if (!entreprise_id) return [];

        // Récupérer tous les PDFs existants de l'entreprise
        const { data: existingPdfs, error } = await supabase
            .from('pdf_infos')
            .select('name_pdf')
            .eq('entreprise_id', entreprise_id);

        if (error) {
            console.error('Erreur lors de la récupération des PDFs existants:', error);
            return [];
        }

        const existingFileNames = existingPdfs?.map(pdf => pdf.name_pdf) || [];
        const newFileNames = files.map(file => file.name);
        
        // Trouver les doublons
        const duplicates = newFileNames.filter(fileName => 
            existingFileNames.includes(fileName)
        );

        return duplicates;
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            if (selectedFileType === 'pdf') {
                const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
                if (pdfFiles.length > 0) {
                    handleFilesSelection(pdfFiles);
                } else {
                    alert("Veuillez sélectionner des fichiers PDF.");
                }
            } else if (selectedFileType === 'excel') {
                const excelFiles = Array.from(files).filter(file => 
                    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    file.type === 'application/vnd.ms-excel'
                );
                if (excelFiles.length > 0) {
                    handleFilesUpload(excelFiles);
                } else {
                    alert("Veuillez sélectionner des fichiers Excel.");
                }
            }
        }
        if (event.target) {
            event.target.value = '';
        }
    };

    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const files = Array.from(event.dataTransfer.files);
        if (selectedFileType === 'pdf') {
            const pdfFiles = files.filter(file => file.type === 'application/pdf');
            if (pdfFiles.length > 0) {
                handleFilesSelection(pdfFiles);
            } else {
                alert("Veuillez déposer des fichiers PDF.");
            }
        } else if (selectedFileType === 'excel') {
            const excelFiles = files.filter(file => 
                file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                file.type === 'application/vnd.ms-excel'
            );
            if (excelFiles.length > 0) {
                handleFilesUpload(excelFiles);
            } else {
                alert("Veuillez déposer des fichiers Excel.");
            }
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [selectedFileType]);

    // Nouvelle fonction pour gérer la sélection de fichiers
    const handleFilesSelection = async (files: File[]) => {
        if (!user_id) {
            alert("Veuillez vous connecter pour importer des fichiers.");
            return;
        }
        if (!entreprise_id) {
            alert("Vous devez être associé à une entreprise pour importer des fichiers.");
            return;
        }
        // Vérifier les doublons
        const duplicates = await checkDuplicates(files);
        if (duplicates.length > 0) {
            setDuplicateFiles(duplicates);
            setPendingFiles(files);
            setShowDuplicateAlert(true);
        } else {
            // Pas de doublons, ouvrir la modale de sélection site/presta
            setFilesToImport(files);
            // Initialiser la sélection pour chaque fichier
            const initialSelections: Record<string, { site: SiteInterface | null; presta: Prestataire | null }> = {};
            files.forEach(file => {
              initialSelections[file.name] = { site: null, presta: null };
            });
            // setPdfMetaSelections(initialSelections); // This state is no longer used
            setShowPDFMetaModal(true);
        }
    };

    // Handler pour valider la sélection site/presta et lancer l'import
    const handleConfirmPDFMeta = async () => {
      setShowPDFMetaModal(false);
      await handleFilesUpload(filesToImport, { site: selectedSite, presta: selectedPresta, documentType: selectedDocumentType });
      setFilesToImport([]);
      setSelectedSite(null);
      setSelectedPresta(null);
      setSelectedDocumentType('bsd');
    };

    // Handler pour annuler la sélection
    const handleCancelPDFMeta = () => {
      setShowPDFMetaModal(false);
      setFilesToImport([]);
      setSelectedSite(null);
      setSelectedPresta(null);
      setSelectedDocumentType('bsd');
    };

    // Fonction pour confirmer l'import malgré les doublons
    const confirmImportWithDuplicates = () => {
        setShowDuplicateAlert(false);
        handleFilesUpload(pendingFiles);
        setPendingFiles([]);
        setDuplicateFiles([]);
    };

    // Fonction pour annuler l'import
    const cancelImport = () => {
        setShowDuplicateAlert(false);
        setPendingFiles([]);
        setDuplicateFiles([]);
    };

    // Modifie la signature pour accepter les sélections site/presta
    const handleFilesUpload = async (files: File[], metaSelections?: { site: SiteInterface | null; presta: Prestataire | null; documentType: 'bsd' | 'facture' | 'bon' }) => {
        if (!user_id) {
            alert("Veuillez vous connecter pour importer des fichiers.");
            return;
        }
        if (!entreprise_id) {
            alert("Vous devez être associé à une entreprise pour importer des fichiers.");
            return;
        }

        setLoading(true);
        const uploadPromises = files.map(async (file) => {
            try {
                if (selectedFileType === 'excel') {
                    return await handleExcelUpload(file, user_id, entreprise_id);
                }

                // Traitement PDF existant
                if (file.size > 50 * 1024 * 1024) {
                    return { 
                        success: false, 
                        file: file.name, 
                        error: 'Le fichier dépasse la taille maximale autorisée (50MB)' 
                    };
                }

                setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
                const sanitizedName = sanitizeFileName(file.name);
                const filePath = `${sanitizedName}_${Date.now()}_${user_id}`;

                const fileTypeCheck = await getFileType(file);
                if (!fileTypeCheck.isPDF) {
                    return { 
                        success: false, 
                        file: file.name, 
                        error: 'Le fichier n\'est pas un PDF valide' 
                    };
                }

                const { data, error: uploadError } = await supabase.storage
                    .from('pdfs_bucket')
                    .upload(filePath, file, {
                        upsert: false,
                        contentType: 'application/pdf'
                    });

                if (uploadError) {
                    console.error(`Erreur lors du téléchargement de ${file.name}:`, uploadError);
                    return { success: false, file: file.name, error: uploadError.message };
                }

                setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));

                const fileSizeInMB = (file.size / (1024 * 1024)).toFixed(2);
                // Récupérer la sélection site/presta pour ce fichier
                let site_siret_plus: string[] | null = null;
                let provider: { name: string; siret: string; is_destination: boolean; is_transporter: boolean } | null = null;
                if (metaSelections) {
                  const { site, presta } = metaSelections;
                  if (site) site_siret_plus = [site.value.siret];
                  if (presta) provider = {
                    name: presta.nom,
                    siret: presta.siret || '',
                    is_destination: presta.type === 'destinataire',
                    is_transporter: presta.type === 'transporteur',
                  };
                }
                const { error: insertError } = await supabase
                    .from('pdf_infos')
                    .insert([{
                        user_id: user_id,
                        entreprise_id: entreprise_id,
                        name_pdf: file.name,
                        name_pdf_in_bucket: filePath,
                        pdf_path: data.fullPath,
                        file_size: parseFloat(fileSizeInMB),
                        site_siret_plus,
                        provider,
                        document_type: metaSelections?.documentType || 'bsd'
                    }]);

                if (insertError) {
                    return { success: false, file: file.name, error: insertError.message };
                }

                return { success: true, file: file.name };
            } catch (error: unknown) {
                console.error(`Erreur détaillée pour ${file.name}:`, error);
                const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue';
                return { 
                    success: false, 
                    file: file.name, 
                    error: errorMessage 
                };
            }
        });

        const results = await Promise.all(uploadPromises);

        // Envoyer un email de notification si l'utilisateur n'est pas 1234
        if (cofounders_user_id(user_id) === false) {
            const { data: userData, error: userError } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', user_id)
            .single();

            if (userError) {
                console.error('Erreur lors de la récupération des informations utilisateur:', userError);
            }

            // Récupérer les informations de l'entreprise
            const { data: entrepriseData, error: entrepriseError } = await supabase
                .from('entreprise')
                .select('name')
                .eq('id', entreprise_id)
                .single();       

            if (entrepriseError) {
                console.error('Erreur lors de la récupération des informations de l\'entreprise:', entrepriseError);
            }

            const successfulUploads = results.filter(result => result.success);
            if (successfulUploads.length > 0) {
                const fileType = selectedFileType === 'pdf' ? 'PDF' : 'Excel';
                const response = await fetch('/api/send_mail', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        to: "asohm@fleap.fr",
                        subject: `Nouveau(x) fichier(s) ${fileType} importé(s) sur Fleap`,
                        text: `${successfulUploads.length} fichier(s) ${fileType} a/ont été importé(s) par l'utilisateur ${userData?.first_name} ${userData?.last_name} de l'entreprise ${entrepriseData?.name} : ${successfulUploads.map(result => result.file).join(', ')}`,
                    }),
                });

                if (!response.ok) {
                    console.error('Erreur lors de l\'envoi de l\'email de notification');
                }
            }
        }

        results.forEach(result => {
            if (result.success) {
                console.log(`${result.file} importé avec succès`);
            } else {
                console.error(`Erreur pour ${result.file}:`, result.error);
                alert(`Erreur lors de l'import de ${result.file}: ${result.error}`);
            }
        });

        setLoading(false);
        setUploadProgress({});
        triggerReload();
    };

    return (
        <div className="flex flex-col items-center w-full">
            {/* Modal d'alerte pour les doublons */}
            {showDuplicateAlert && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold text-red-600 mb-4">
                            Nous voyons des doublons
                        </h3>
                        <p className="text-gray-700 mb-4">
                            Les fichiers suivants existent déjà dans votre entreprise :
                        </p>
                        <ul className="bg-gray-100 p-3 rounded mb-4 max-h-32 overflow-y-auto">
                            {duplicateFiles.map((fileName, index) => (
                                <li key={index} className="text-sm text-gray-600 mb-1">
                                    • {fileName}
                                </li>
                            ))}
                        </ul>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={cancelImport}
                                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={confirmImportWithDuplicates}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                                Importer quand même
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de sélection site/presta pour tous les PDFs */}
            {showPDFMetaModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
                  <h3 className="text-lg font-semibold text-blue-700 mb-4">Configuration de l'import PDF</h3>
                  
                  {/* Liste des fichiers */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Fichiers à importer ({filesToImport.length})</label>
                    <div className="bg-gray-50 p-3 rounded max-h-32 overflow-y-auto">
                      {filesToImport.map((file, index) => (
                        <div key={file.name} className="text-sm text-gray-600 mb-1">
                          {index + 1}. {file.name}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Message d'aide */}
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-sm text-blue-800">
                      <strong>💡 Conseil :</strong> Si vos PDFs concernent des sites ou prestataires différents, 
                      faites plusieurs imports séparés pour une meilleure organisation.
                    </p>
                  </div>

                  {/* Sélection du type de document */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type de document <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedDocumentType}
                      onChange={(e) => setSelectedDocumentType(e.target.value as 'bsd' | 'facture' | 'bon')}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="bsd">📄 Bordereau de Suivi de Déchets (BSD)</option>
                      <option value="facture">🧾 Facture</option>
                      <option value="bon">📋 Bon de livraison/collecte</option>
                    </select>
                  </div>

                  {/* Sélection du site */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Site <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedSite?.table_id || ''}
                      onChange={(e) => {
                        const site = autocompletionData.sites.find(s => s.table_id === Number(e.target.value)) || null;
                        setSelectedSite(site);
                      }}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">Sélectionner un site</option>
                      {autocompletionData.sites.map(site => (
                        <option key={site.table_id} value={site.table_id}>
                          🏢 {site.value.nom} ({site.value.siret})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sélection du prestataire */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Prestataire <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedPresta?.id || ''}
                      onChange={(e) => {
                        const presta = prestataires.find(p => p.id === Number(e.target.value)) || null;
                        setSelectedPresta(presta);
                      }}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">Sélectionner un prestataire</option>
                      {prestataires.map(presta => (
                        <option key={`${presta.type}-${presta.id}`} value={presta.id}>
                          {presta.type === 'transporteur' ? '🚛' : '🏭'} {presta.nom}
                          {presta.siret && ` (${presta.siret})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Boutons */}
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={handleCancelPDFMeta}
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleConfirmPDFMeta}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      disabled={!selectedSite || !selectedPresta}
                    >
                      Importer {filesToImport.length} fichier{filesToImport.length > 1 ? 's' : ''}
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div 
                className="border-[1px] border-dashed border-gray-400 p-4 rounded-md w-full text-center cursor-pointer"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
            >
                {loading ? (
                    <label className="btn bg-[var(--green-medium)] hover:bg-[var(--green-dark)] text-white h-8 px-2 flex items-center mx-auto max-w-[400px]">
                        <span className="loader"></span>
                    </label>
                ) : (
                    <div className="relative">
                        <button 
                            onClick={() => setShowFileTypeMenu(!showFileTypeMenu)}
                            className="btn bg-[var(--green-medium)] hover:bg-[var(--green-dark)] text-white h-8 px-2 flex items-center mx-auto max-w-[400px]"
                        >
                            <div className="flex items-center gap-2">
                                <BoxIcon color='white' name='import' />
                                <p>Sélectionner des fichiers</p>
                            </div>
                        </button>
                        <input 
                            ref={fileInputRef}
                            type="file" 
                            accept=".pdf,.xlsx,.xls"
                            onChange={handleFileChange} 
                            className="hidden"
                            multiple
                        />
                        {showFileTypeMenu && (
                            <div 
                                ref={menuRef}
                                className="absolute left-1/2 transform -translate-x-1/2 mt-2 bg-white rounded-md shadow-lg z-50 py-2 w-40"
                            >
                                <button
                                    onClick={() => {
                                        setSelectedFileType('pdf');
                                        setShowFileTypeMenu(false);
                                        fileInputRef.current?.click();
                                    }}
                                    className="w-full px-2 py-1 text-sm text-gray-700 hover:bg-red-50 flex items-center gap-2"
                                >
                                    <BoxIcon color='red' name='file-pdf' type='solid' />
                                    <span className='ml-2'>PDF</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setSelectedFileType('excel');
                                        setShowFileTypeMenu(false);
                                        fileInputRef.current?.click();
                                    }}
                                    className="w-full px-2 py-1 text-sm text-gray-700 hover:bg-green-50 flex items-center gap-2"
                                >
                                    <ExcelIcon />
                                    <span className='ml-2'>Excel</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {loading && (
                <div className="w-full max-w-md mt-4">
                    {Object.entries(uploadProgress).map(([fileName, progress]) => (
                        <div key={fileName} className="mb-2">
                            <div className="text-sm text-gray-600">{fileName}</div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div 
                                    className="bg-green-600 h-2.5 rounded-full transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Fonction utilitaire pour vérifier le type de fichier
const getFileType = (file: File): Promise<{ isPDF: boolean }> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = (e) => {
            const arr = new Uint8Array(e.target?.result as ArrayBuffer).subarray(0, 4);
            let header = '';
            for (let i = 0; i < arr.length; i++) {
                header += arr[i].toString(16);
            }
            // Vérifie la signature du fichier PDF (%PDF)
            resolve({ isPDF: header.startsWith('25504446') });
        };
        reader.readAsArrayBuffer(file.slice(0, 4));
    });
};

export default ImportPDF;