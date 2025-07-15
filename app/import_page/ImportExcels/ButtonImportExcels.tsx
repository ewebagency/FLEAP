'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSession } from '@/app/component/SessionProvider';
import { supabase } from '@/app/database/supabaseClient';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import BoxIcon from '@/app/component/BoxIconWrapper';
import standard_with_paprec from './FormatsExcels/paprec';
import standard_with_ecobtp from './FormatsExcels/ecobtp';
import standard_with_luxobennes from './FormatsExcels/luxobennes';
import { sendDataToBdd } from './send_data_to_bdd';
import PreviewImport from '../ImportComponents/PreviewImport';
import { PdfInfo } from '../ImportComponents/TableImportedFiles';
import { useImport } from '../ImportComponents/ImportContext';
import { OtherInfos } from '@/app/register/interface/BSD_Interface';

// Type pour les formats disponibles
type ExcelFormat = 'paprec' | 'ecobtp' | 'luxobennes';



export interface RowBSDPreview {
    created_at: string;
    user_id: string;
    entreprise_id: string;
    infos_json: {
        formAPI: {
            createFormInput: {
                readableId: string;
                takenOverAt: string;
                emitter: {
                    type: string;
                    company: {
                        name: string;
                        siret: string;
                        orgId: string;
                        address: string;
                        country: string;
                        contact: string;
                        phone: string;
                        mail: string;
                    };
                    workSite: {
                        name: string;
                        address: string;
                        city: string;
                        postalCode: string;
                        infos: string;
                    };
                };
                transporter: {
                    company: {
                        name: string;
                        siret: string;
                        orgId: string;
                        address: string;
                        country: string;
                        contact: string;
                        phone: string;
                        mail: string;
                    };
                    takenOverAt: string;
                    isExemptedOfReceipt: boolean;
                    receipt?: string;
                    numberPlate?: string;
                };
                recipient: {
                    company: {
                        name: string;
                        siret: string;
                        orgId: string;
                        address: string;
                        country: string;
                        contact: string;
                        phone: string;
                        mail: string;
                    };
                    cap: string;
                    processingOperation: string;
                    valoParts: Array<{
                        code_valo: string;
                        tonnage: number;
                    }>;
                };
                wasteDetails: {
                    code: string;
                    name: string;
                    isSubjectToADR: boolean;
                    onuCode: string;
                    packagingInfos: Array<{
                        type: string;
                        quantity: number;
                    }>;
                    quantity: number;
                    quantityType: "REAL";
                    consistence: string;
                    pop: boolean;
                    isDangerous: boolean;
                    parcelNumbers: {
                        city: string;
                        postalCode: string;
                    };
                };
            };
        };
    };
    other_infos: {
        volume: string;
        volumeUnit: string;
        tri?: boolean;
    };
    status_track_dechets: string;
    readable_id_track_dechets: string;
    source: string;
}



// Types pour les données d'autocomplétion
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

// Types pour les données Excel
export interface ExcelData {
  nom_fichier: string;
  presta: {
    id: number;
    type: 'transporteur' | 'destinataire';
    nom: string;
    siret?: string;
    email?: string;
    nomBoite?: string;
    nomPrenom?: string;
    adresse?: string;
    telephone?: string;
  };
  site: {
    id: number;
    nom: string;
    siret: string;
    adresseSiege: string;
    pointsCollecte: { nom: string; adresse: string; }[];
  };
  excel_data: { [sheetName: string]: unknown[] };
  sheets: string[];
  nombre_sheets: number;
  nombre_lignes_total: number;
  nombre_lignes_par_sheet: { [sheetName: string]: number };
  date_import: string;
}

type StandardizedData = { [standard: string]: string | number | boolean };

// Type pour les données standardisées Luxobennes
export interface StandardizedLineData {
  numeroBsd: string;
  dateCollecteTransporteur: string;
  nomSiteEmetteur: string;
  siretEmetteur: string;
  adresseCollecte: string;
  nomPointCollecte: string;
  nomTransporteur: string;
  siretTransporteur: string;
  adresseTransporteur: string;
  nomContactTransporteur: string;
  telephoneContactTransporteur: string;
  emailContactTransporteur: string;
  recepisseTransporteur: string;
  immatriculationTransporteur: string;
  nomInstallationDestination: string;
  siretInstallationDestination: string;
  adresseInstallationDestination: string;
  codeTraitementPrevuInstallationDestination: string;
  valo1_dest: string;
  tonnage1_dest: number;
  valo2_dest: string;
  tonnage2_dest: number;
  valo3_dest?: string;
  tonnage3_dest?: number;
  codeCed: string;
  descDechet: string;
  quantiteEstimeeReelleTransporteur: number;
  cubage: string;
  volumeUnitaire: string;
  sent_to_rep?: boolean;
  tri?: boolean;
  
}



// Type pour les prestataires (transporteur + destinataire)
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

const ButtonImportExcels = () => {
  const { entreprise_id, user_id } = useSession();
  const { updatePdfInfos } = useImport();
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [selectedPresta, setSelectedPresta] = useState<Prestataire | null>(null);
  const [selectedSite, setSelectedSite] = useState<SiteInterface | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<ExcelFormat>('paprec');
  const [autocompletionData, setAutocompletionData] = useState<AutocompletionData>({
    sites: [],
    transporteurs: [],
    destinataires: []
  });
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<RowBSDPreview[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Charger les données d'autocomplétion
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

                     data.forEach((item: {
             id: number;
             site?: SiteInterface['value'];
             transporteur?: TransporteurInterface['value'];
             destinataire?: DestinataireInterface['value'];
           }) => {
            if (item.site) {
              sites.push({
                table_id: item.id,
                value: item.site
              });
            }
            if (item.transporteur) {
              transporteurs.push({
                table_id: item.id,
                value: item.transporteur
              });
            }
            if (item.destinataire) {
              destinataires.push({
                table_id: item.id,
                value: item.destinataire
              });
            }
          });

          setAutocompletionData({ sites, transporteurs, destinataires });
        }
      } catch (error) {
        console.error('Erreur lors du chargement des données d\'autocomplétion:', error);
        toast.error('Erreur lors du chargement des données');
      }
    };

    fetchAutocompletionData();
  }, [entreprise_id]);

  // Créer la liste des prestataires (transporteurs + destinataires)
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

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowModal(true);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile || !selectedPresta || !selectedSite) {
      toast.error('Veuillez sélectionner un fichier, un prestataire et un site');
      return;
    }

    setIsLoading(true);
    try {
      // Lire le fichier Excel
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      
      // Traiter toutes les sheets
      const allSheetsData: { [sheetName: string]: unknown[] } = {};
      
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];
        allSheetsData[sheetName] = jsonData;
      });

      // Appeler la fonction de traitement avec les paramètres
      const data_excel = await processExcelImport(
        fileName,
        selectedPresta,
        selectedSite,
        allSheetsData
      );

      if (entreprise_id && user_id) {
        // Préparer les données pour la prévisualisation selon le format sélectionné
        let previewDataReady: RowBSDPreview[];
        
        if (selectedFormat === 'paprec') {
          const standardizedData = await standard_with_paprec(data_excel, user_id, entreprise_id);
          // Cast temporaire, attention : il faut idéalement une vraie conversion !
          previewDataReady = createPreviewData(standardizedData as unknown as StandardizedLineData[], data_excel, user_id, entreprise_id);
        } else if (selectedFormat === 'ecobtp') {
          previewDataReady = await standard_with_ecobtp(data_excel, user_id, entreprise_id);
        } else if (selectedFormat === 'luxobennes') {
          const luxobennesData = await standard_with_luxobennes(data_excel, user_id, entreprise_id);
          // Convertir les données Luxobennes en format StandardizedData
          const standardizedData: StandardizedLineData[] = luxobennesData;
          previewDataReady = createPreviewData(standardizedData, data_excel, user_id, entreprise_id);
          console.log('previewDataReady', previewDataReady);
        } else {
          toast.error('Format non reconnu');
          return;
        }
        
        setPreviewData(previewDataReady);
        setShowPreview(true);
        setShowModal(false);
      }
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      toast.error('Erreur lors de l\'import');
    } finally {
      setIsLoading(false);
    }
  };

  const createPreviewData = (
    standardizedData: StandardizedLineData[],
    data_excel: ExcelData,
    user_id: string,
    entreprise_id: string
  ): RowBSDPreview[] => {
    // Créer les données de prévisualisation sans les envoyer
    const data_ready_to_send: RowBSDPreview[] = [];
    console.log('nom du fichieeer', data_excel.nom_fichier);

    standardizedData.forEach(row => {
      // Construction dynamique de valoParts
      const valoParts = [];
      if (row.valo1_dest && row.tonnage1_dest !== undefined) {
        valoParts.push({
          code_valo: String(row.valo1_dest),
          tonnage: typeof row.tonnage1_dest === 'number' ? row.tonnage1_dest : parseFloat(String(row.tonnage1_dest)),
        });
      }
      if (row.valo2_dest && row.tonnage2_dest !== undefined) {
        valoParts.push({
          code_valo: String(row.valo2_dest),
          tonnage: typeof row.tonnage2_dest === 'number' ? row.tonnage2_dest : parseFloat(String(row.tonnage2_dest)),
        });
      }
      if (row.valo3_dest !== undefined && row.tonnage3_dest !== undefined) {
        valoParts.push({
          code_valo: String(row.valo3_dest),
          tonnage: typeof row.tonnage3_dest === 'number' ? row.tonnage3_dest : parseFloat(String(row.tonnage3_dest)),
        });
      }

      // Construction dynamique de other_infos
      const other_infos: OtherInfos = {
        volume: String(row.cubage),
        volumeUnit: String(row.volumeUnitaire),
        fillRate: '', // valeur par défaut, à ajuster si besoin
        containerDescription: '', // valeur par défaut, à ajuster si besoin
      };
      if (typeof row.tri !== 'undefined') {
        other_infos.tri = row.tri;
      }
      if (typeof row.sent_to_rep !== 'undefined') {
        other_infos.rep = { sent_to_rep: row.sent_to_rep };
      }

      const newRow: RowBSDPreview = {
        created_at: String(row.dateCollecteTransporteur),
        user_id: user_id,
        entreprise_id: entreprise_id,
        infos_json: {
          formAPI: {
            createFormInput: {
              readableId: String(row.numeroBsd),
              takenOverAt: String(row.dateCollecteTransporteur),
              emitter: {
                type: "PRODUCER",
                company: {
                  name: String(row.nomSiteEmetteur),
                  siret: String(row.siretEmetteur || ''),
                  orgId: String(row.siretEmetteur || ''),
                  address: String(row.adresseCollecte),
                  country: "FR",
                  contact: "",
                  phone: "",
                  mail: "",
                },
                workSite: {
                  name: String(row.nomPointCollecte),
                  address: String(row.adresseCollecte),
                  city: "",
                  postalCode: "",
                  infos: "",
                },
              },
              transporter: {
                company: {
                  name: String(row.nomTransporteur),
                  siret: String(row.siretTransporteur || ''),
                  orgId: String(row.siretTransporteur || ''),
                  address: String(row.adresseTransporteur),
                  country: "FR",
                  contact: String(row.nomContactTransporteur || ''),
                  phone: String(row.telephoneContactTransporteur || ''),
                  mail: String(row.emailContactTransporteur || ''),
                },
                takenOverAt: String(row.dateCollecteTransporteur),
                isExemptedOfReceipt: false,
                receipt: row.recepisseTransporteur ? String(row.recepisseTransporteur) : undefined,
                numberPlate: row.immatriculationTransporteur ? String(row.immatriculationTransporteur) : undefined,
              },
              recipient: {
                company: {
                  name: String(row.nomInstallationDestination),
                  siret: String(row.siretInstallationDestination || ''),
                  orgId: String(row.siretInstallationDestination || ''),
                  address: String(row.adresseInstallationDestination || ''),
                  country: "FR",
                  contact: "",
                  phone: "",
                  mail: "",
                },
                cap: "",
                processingOperation: String(row.codeTraitementPrevuInstallationDestination),
                valoParts: valoParts,
              },
              wasteDetails: {
                code: String(row.codeCed),
                name: String(row.descDechet),
                isSubjectToADR: false,
                onuCode: "",
                packagingInfos: [{
                  type: "OTHER",
                  quantity: 1,
                }],
                quantity: typeof row.quantiteEstimeeReelleTransporteur === 'number' ? row.quantiteEstimeeReelleTransporteur : parseFloat(String(row.quantiteEstimeeReelleTransporteur)),
                quantityType: "REAL" as const,
                consistence: "SOLIDE",
                pop: false,
                isDangerous: false,
                parcelNumbers: {
                  city: "",
                  postalCode: "",
                },
              }
            }
          }
        },
        other_infos,
        status_track_dechets: "IMPORTED",
        readable_id_track_dechets: String(row.numeroBsd),
        source: data_excel.nom_fichier
      };
      data_ready_to_send.push(newRow);
    });

    return data_ready_to_send;
  };

  const handleConfirmImport = async () => {
    setIsProcessing(true);
    try {
      // Convertir les données de prévisualisation en format RowBSD complet
      const dataToSend = previewData.map(row => ({
        created_at: row.created_at,
        user_id: row.user_id,
        entreprise_id: row.entreprise_id,
        infos_json: row.infos_json,
        other_infos: row.other_infos,
        status_track_dechets: row.status_track_dechets,
        readable_id_track_dechets: row.readable_id_track_dechets,
        source: row.source,        
      }));

      // Importer les données vers Supabase
      const result = await sendDataToBdd(dataToSend as RowBSDPreview[], entreprise_id || '');
      
      if (result.importedCount > 0) {
        toast.success(`${result.importedCount} lignes importées avec succès !`);
        
        // Créer une ligne dans la table pdf_infos
        try {
          const { data: pdfData, error: pdfError } = await supabase
            .from('pdf_infos')
            .insert({
              user_id: user_id,
              pdf_path: '',
              name_pdf: fileName,
              name_pdf_in_bucket: '',
              status: 'read',
              site_siret: selectedSite?.value.siret || null,
              document_type: 'excel',
              entreprise_id: entreprise_id,
              site_siret_plus: selectedSite?.value.siret ? [selectedSite.value.siret] : null,
            })
            .select()
            .single();

          if (pdfError) {
            console.error('Erreur lors de la création de la ligne pdf_infos:', pdfError);
            toast.error('Erreur lors de l\'enregistrement des informations du fichier');
          } else if (pdfData && updatePdfInfos) {
            // Mettre à jour les données locales avec le nouveau PDF
            updatePdfInfos(pdfData as PdfInfo);
          }
        } catch (error) {
          console.error('Erreur lors de la création de la ligne pdf_infos:', error);
          toast.error('Erreur lors de l\'enregistrement des informations du fichier');
        }
      }
      if (result.skippedCount > 0) {
        toast.error(`${result.skippedCount} lignes ignorées (doublons)`);
      }
      if (result.errorCount > 0) {
        toast.error(`${result.errorCount} erreurs lors de l'import`);
      }
      
      setShowPreview(false);
      resetForm();
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      toast.error('Erreur lors de l\'import');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setFileName('');
    setSelectedPresta(null);
    setSelectedSite(null);
    setSelectedFormat('paprec');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    resetForm();
  };

  return (
    <div className="relative">
      <button 
        onClick={handleButtonClick}
        className="h-[30px] flex justify-between items-center gap-2 bg-gray-100 rounded-md px-2 cursor-pointer active:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isLoading}
      >
        <div className="text-[var(--green-light)] rounded-full py-1 mt-1 font-thin">
          {isLoading ? (
            <span className="inline-block animate-spin">↻</span>
          ) : (
            <BoxIcon name='import' type='solid' color='green' size="18px" />
          )}
        </div>
        <div className="text-black font-thin text-md">
          {isLoading ? 'Import en cours...' : 'Importer un Excel'}
        </div>
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Importer un fichier Excel</h3>
            
            {/* Sélection du fichier */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fichier Excel <span className="text-red-500">*</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {fileName && (
                <p className="text-sm text-gray-600 mt-1">Fichier sélectionné: {fileName}</p>
              )}
            </div>

            {/* Sélection du prestataire */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prestataire <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedPresta?.id || ''}
                onChange={(e) => {
                  const presta = prestataires.find(p => p.id === Number(e.target.value));
                  setSelectedPresta(presta || null);
                }}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Sélectionner un prestataire</option>
                {prestataires.map((presta) => (
                  <option key={`${presta.type}-${presta.id}`} value={presta.id}>
                    {presta.type === 'transporteur' ? '🚛' : '🏭'} {presta.nom}
                    {presta.siret && ` (${presta.siret})`}
                  </option>
                ))}
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
                  const site = autocompletionData.sites.find(s => s.table_id === Number(e.target.value));
                  setSelectedSite(site || null);
                }}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Sélectionner un site</option>
                {autocompletionData.sites.map((site) => (
                  <option key={site.table_id} value={site.table_id}>
                    🏢 {site.value.nom} ({site.value.siret})
                  </option>
                ))}
              </select>
            </div>

            {/* Sélection du format Excel */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Format Excel <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value as ExcelFormat)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="paprec">📄 Format Paprec</option>
                <option value="ecobtp">🏗️ Format Ecobtp</option>
                <option value="luxobennes">🗑️ Format Luxobennes</option>
              </select>
            </div>

            {/* Boutons */}
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                disabled={isLoading}
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                disabled={isLoading || !selectedFile || !selectedPresta || !selectedSite}
              >
                {isLoading ? 'Import en cours...' : 'Importer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de prévisualisation */}
      <PreviewImport
        dataReadyToSend={previewData}
        entreprise_id={entreprise_id || ''}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onConfirm={handleConfirmImport}
        isLoading={isProcessing}
      />
    </div>
  );
};

// Fonction de traitement de l'import Excel
const processExcelImport = async (
  nom_fichier: string,
  presta: Prestataire,
  site: SiteInterface,
  excelData: { [sheetName: string]: unknown[] }
) => {
  console.log('=== Import Excel ===');
  console.log('Nom du fichier:', nom_fichier);
  console.log('Prestataire:', presta);
  console.log('Site:', site);
  console.log('Sheets disponibles:', Object.keys(excelData));
  console.log('Données Excel par sheet:', excelData);

  // Calculer le nombre total de lignes
  const totalLignes = Object.values(excelData).reduce((total, sheetData) => {
    return total + (Array.isArray(sheetData) ? sheetData.length : 0);
  }, 0);

  // Ici vous pouvez implémenter votre logique de traitement
  // Par exemple, envoyer les données à une API ou les traiter localement
  
  // Exemple d'utilisation des données :
  const processedData: ExcelData = {
    nom_fichier,
          presta: {
        id: presta.id,
        type: presta.type,
        nom: presta.nom,
        nomBoite: presta.nomBoite,
        nomPrenom: presta.nomPrenom,
        siret: presta.siret,
        email: presta.email,
        adresse: presta.adresse,
        telephone: presta.telephone,
      },
    site: {
      id: site.table_id,
      nom: site.value.nom,
      siret: site.value.siret,
      adresseSiege: site.value.adresseSiege,
      pointsCollecte: site.value.pointsCollecte
    },
    excel_data: excelData,
    sheets: Object.keys(excelData),
    nombre_sheets: Object.keys(excelData).length,
    nombre_lignes_total: totalLignes,
    nombre_lignes_par_sheet: Object.fromEntries(
      Object.entries(excelData).map(([sheetName, sheetData]) => [
        sheetName, 
        Array.isArray(sheetData) ? sheetData.length : 0
      ])
    ),
    date_import: new Date().toISOString()
  };

  console.log('Données traitées:', processedData);

  // Vous pouvez ici appeler votre fonction de traitement
  // await votreFonctionDeTraitement(processedData);
  
  return processedData;
};

export default ButtonImportExcels;
