import Swal from 'sweetalert2'
import { useState, useEffect, useRef, useMemo } from 'react'
import InputMobile from './InputMobile'
import { createRoot } from 'react-dom/client'
import { CompleteFormInput, FormInput } from "@/app/register/interface/BSD_Interface"
import { toast } from 'react-hot-toast'
import MelangeData from './MelangeData'
import { getFiliere } from './utils_new'

// Définir l'interface OtherInfos ici aussi
export interface OtherInfos {
  containerDescription: string;
  volume: string;
  volumeUnit: string;
  fillRate: string;
  inputMode?: 'tonnage' | 'volume';
  automaticMode?: boolean;
  melange?: Array<{name: string, percent: string}>;
}

interface PopUpProps {
  dataToogle: FormInput;
  setDataToogle: (data: FormInput) => void;
  modalType: string
  onMobile: boolean
  otherInfos: OtherInfos
  setOtherInfos: (data: OtherInfos) => void
  getUniqueOptions: (filteredOptions: CompleteFormInput[], allOptions: CompleteFormInput[], selector: (opt: CompleteFormInput) => string) => {
    filteredOptions: string[];
    allOptions: string[];
  }
  options: CompleteFormInput[]
  allOptions: CompleteFormInput[]
  onConfirm?: () => void;
  onCancel?: () => void;
  autoSubmit?: boolean;
  handleChange: (e: React.ChangeEvent<HTMLSelectElement> | { target: { name: string; value: string } }) => void;
  ced_table: { ced: string, filiere: string }[];
}

const MySwal = Swal

const dic_json_ced_masse_volumique = [
  {
    "code_CED": "17 01 01",
    "masse_volumique": 2300
  },
  {
    "code_CED": "17 01 02",
    "masse_volumique": 1900
  },
  {
    "code_CED": "17 01 07",
    "masse_volumique": 2000
  },
  {
    "code_CED": "20 01 01",
    "masse_volumique": 150
  },
  {
    "code_CED": "20 01 39",
    "masse_volumique": 100
  },
  {
    "code_CED": "20 03 01",
    "masse_volumique": 250
  },
  {
    "code_CED": "15 01 01",
    "masse_volumique": 100
  },
  {
    "code_CED": "15 01 07",
    "masse_volumique": 35
  },
  {
    "code_CED": "20 02 01",
    "masse_volumique": 500
  },
  {
    "code_CED": "17 09 04",
    "masse_volumique": 1500
  }
];

// Ajouter cette interface pour les dépendances
interface InputDependency {
    children: string[];
    filterFields?: string[];
}

interface InputDependencies {
    [key: string]: InputDependency;
}

const inputDependencies: InputDependencies = {
    'emitter.company': {
        children: ['emitter.company.siret', 'emitter.company.address', 'emitter.company.contact', 'emitter.company.phone', 'emitter.company.mail'],
    },
    'emitter.workSite': {
        children: ['emitter.workSite.address', 'emitter.workSite.infos'],
    },
    'transporter.company': {
        children: ['transporter.company.siret', 'transporter.company.address', 'transporter.company.contact', 'transporter.company.phone', 'transporter.company.mail'],
    },
    'recipient.company': {
        children: ['recipient.company.siret', 'recipient.company.address', 'recipient.company.contact', 'recipient.company.phone', 'recipient.company.mail'],
    },
};

const treatmentLabels = {
  "R1": "Utilisation comme combustible",
  "R2": "Récupération des solvants",
  "R3": "Recyclage des substances organiques",
  "R4": "Recyclage des métaux",
  "R5": "Recyclage des matières minérales",
  "R6": "Régénération des acides ou des bases",
  "R7": "Récupération des produits anti-pollution",
  "R8": "Récupération des catalyseurs",
  "R9": "Régénération des huiles",
  "R10": "Épandage agricole",
  "R11": "Utilisation de déchets pour remblayage",
  "R12": "Échange de déchets",
  "R13": "Stockage avant valorisation",
  "D1": "Dépôt sur ou dans le sol",
  "D2": "Traitement en milieu terrestre",
  "D3": "Injection en profondeur",
  "D4": "Lagunage",
  "D5": "Mise en décharge",
  "D6": "Rejet en milieu aquatique",
  "D7": "Immersion",
  "D8": "Traitement biologique",
  "D9": "Traitement physico-chimique",
  "D10": "Incinération à terre",
  "D11": "Incinération en mer",
  "D12": "Stockage permanent",
  "D13": "Regroupement avant élimination",
  "D14": "Reconditionnement avant élimination",
  "D15": "Stockage avant élimination",
  "default": "Méthode de traitement inconnue"
};

// Fonction pour calculer le poids estimé
const calculateEstimatedWeight = (
  volume: string | undefined, 
  fillRate: string | undefined, 
  wasteCode: string | undefined,
  volumeUnit: string = 'm3'
): number | null => {
  if (!volume) return null;

  const volumeInM3 = volumeUnit === 'L' ? parseFloat(volume) / 1000 : parseFloat(volume);
  const wasteInfo = wasteCode ? 
    dic_json_ced_masse_volumique.find(
      item => item.code_CED.replace(/\s/g, '') === wasteCode.replace(/\s/g, '')
    ) : null;
  const masseVolumique = wasteInfo?.masse_volumique || 1000;
  const fillRateMultiplier = fillRate ? parseInt(fillRate) / 100 : 1;
  return (volumeInM3 * masseVolumique * fillRateMultiplier) / 1000;
};

// Fonction pour calculer le taux de remplissage
const calculateFillRate = (
  volume: string | undefined,
  weight: string | undefined,
  wasteCode: string | undefined,
  volumeUnit: string = 'm3'
): number | null => {
  if (!volume || !weight) return null;

  const volumeInM3 = volumeUnit === 'L' ? parseFloat(volume) / 1000 : parseFloat(volume);
  const weightInKg = parseFloat(weight) * 1000;
  const wasteInfo = wasteCode ? 
    dic_json_ced_masse_volumique.find(
      item => item.code_CED.replace(/\s/g, '') === wasteCode.replace(/\s/g, '')
    ) : null;
  const masseVolumique = wasteInfo?.masse_volumique || 1000;
  const fillRate = (weightInKg / (volumeInM3 * masseVolumique)) * 100;
  return Math.min(Math.max(fillRate, 0), 100);
};

export default function PopUp({
  dataToogle,
  setDataToogle,
  handleChange,
  modalType,
  onMobile,
  otherInfos,
  setOtherInfos,
  getUniqueOptions,
  options,
  allOptions,
  onConfirm,
  onCancel,
  autoSubmit = false,
  ced_table
}: PopUpProps) {
  const [localData, setLocalData] = useState(dataToogle);
  const isMounted = useRef(true);
  
  // Garder une référence des valeurs initiales
  const initialValues = useRef({
    emitter: {
      company: { 
        name: dataToogle.emitter.company.name,
        siret: dataToogle.emitter.company.siret 
      },
      workSite: { 
        name: dataToogle.emitter.workSite.name,
        address: dataToogle.emitter.workSite.address,
        fullAddress: dataToogle.emitter.workSite.fullAddress
      }
    },
    wasteDetails: { 
      name: dataToogle.wasteDetails.name,
      code: dataToogle.wasteDetails.code 
    },
    transporter: {
      company: { 
        name: dataToogle.transporter.company.name,
        siret: dataToogle.transporter.company.siret 
      }
    },
    recipient: {
      company: { 
        name: dataToogle.recipient.company.name,
        siret: dataToogle.recipient.company.siret 
      },
      processingOperation: dataToogle.recipient.processingOperation
    }
  });

  const getDisplayConditions = () => ({
    site: !initialValues.current.emitter.company.name || !initialValues.current.emitter.company.siret,
    workSite: !initialValues.current.emitter.workSite.name || !initialValues.current.emitter.workSite.fullAddress,
    waste: !initialValues.current.wasteDetails.name || !initialValues.current.wasteDetails.code,
    transporter: !initialValues.current.transporter.company.name || !initialValues.current.transporter.company.siret,
    recipient: !initialValues.current.recipient.company.name || !initialValues.current.recipient.company.siret,
    processingOperation: !initialValues.current.recipient.processingOperation
  });

  const validateFields = () => {
    console.log("Validating fields with localData:", localData);
    const conditions = {
        site: !localData.emitter.company.name || !localData.emitter.company.siret,
        workSite: !localData.emitter.workSite.name || !localData.emitter.workSite.fullAddress,
        waste: !localData.wasteDetails.name || !localData.wasteDetails.code,
        transporter: !localData.transporter.company.name || !localData.transporter.company.siret,
        recipient: !localData.recipient.company.name || !localData.recipient.company.siret
    };
    console.log("Validation conditions:", conditions);
    return !Object.values(conditions).some(condition => condition);
  };

  // Initialiser inputMode à 'volume' si non défini
  useEffect(() => {
    if (!otherInfos.inputMode || !otherInfos.automaticMode) {
      setOtherInfos({ 
        ...otherInfos, 
        inputMode: 'volume',
        automaticMode: true 
      })
    }
  }, [])

  // Modifions l'useEffect pour otherInfos
  useEffect(() => {
    const container = document.getElementById('input-container');
    if (container && isMounted.current) {
      renderContent();
    }
  }, [otherInfos]);

  // Modifions useEffect pour le nettoyage
  useEffect(() => {
    isMounted.current = true;
    
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Ajouter un useEffect pour déclencher handleSubmit automatiquement
  useEffect(() => {
    if (autoSubmit) {
      handleSubmit();
    }
  }, []);

  const renderContent = () => (
    <div className="space-y-1 w-fit">
      {/* Champs manquants */}
      <div className="space-y-1">      
        {/* Site émetteur */}
        <div className="grid grid-cols-2 gap-2">
              <InputMobile
                titre=""
                placeholder="Site"
                name="emitter.company.name"
                value={dataToogle.emitter.company.name}
                onChange={(e: { target: { value: string } } | string) => {
                  const newValue = typeof e === 'object' && e.target ? e.target.value : e as string;
                  handleChange({ target: { name: 'emitter.company.name', value: newValue } });
                }}
                options={getUniqueOptions(options, allOptions, opt => 
                    opt.json_row.emitter.company.name
                )}
                enabled={true}
                display={getDisplayConditions().site}
                width={48}
                onMobile={true}
              />
              <InputMobile
                titre=""
                placeholder="SIRET"
                name="emitter.company.siret"
                value={dataToogle.emitter.company.siret}
                onChange={(e: { target: { value: string } } | string) => {
                  const newValue = typeof e === 'object' && e.target ? e.target.value : e as string;
                  handleChange({ target: { name: 'emitter.company.siret', value: newValue } });
                }}
                options={getUniqueOptions(options, allOptions, opt => 
                      opt.json_row.emitter.company.siret
                  )}
                enabled={true}
                display={getDisplayConditions().site}
                width={48}
                onMobile={true}
              />
        </div>

        {/* Point de collecte */}
        <div className="grid grid-cols-2 gap-2">
              <InputMobile
                titre=""
            placeholder="Point de collecte"
                name="emitter.workSite.name"
                value={dataToogle.emitter.workSite.name}
            onChange={(e: { target: { value: string } } | string) => {
              const newValue = typeof e === 'object' && e.target ? e.target.value : e as string;
              handleChange({ 
                target: { 
                  name: 'emitter.workSite.name', 
                  value: newValue 
                } 
                  });
                }}
            options={getUniqueOptions(options, allOptions, opt => 
                opt.json_row.emitter.workSite.name
            )}
                enabled={true}
                display={getDisplayConditions().workSite}
            width={48}
                onMobile={true}
              />
              <InputMobile
                titre=""
            placeholder="Adresse"
                name="emitter.workSite.fullAddress"
                value={dataToogle.emitter.workSite.fullAddress || ''}
            onChange={(e: { target: { value: string } } | string) => {
              const newValue = typeof e === 'object' && e.target ? e.target.value : e as string;
              handleChange({ 
                target: { 
                  name: 'emitter.workSite.fullAddress', 
                  value: newValue 
                } 
                  });
                }}
            options={getUniqueOptions(options, allOptions, opt => 
                  opt.json_row.emitter.workSite.fullAddress || ''
              )}
                enabled={true}
                display={getDisplayConditions().workSite}
            width={48}
              />
        </div>

        {/* Déchet */}
        <div className="grid grid-cols-2 gap-2">
              <InputMobile
                titre=""
            placeholder="Déchet"
                name="wasteDetails.name"
                value={dataToogle.wasteDetails.name}
            onChange={(e: { target: { value: string } } | string) => {
              const newValue = typeof e === 'object' && e.target ? e.target.value : e as string;
                  handleChange({ target: { name: 'wasteDetails.name', value: newValue } });
                }}
            options={getUniqueOptions(options, allOptions, opt => 
                opt.json_row.wasteDetails.name
            )}
                enabled={true}
                display={getDisplayConditions().waste}
            width={48}
              />
              <InputMobile
                titre=""
                placeholder="Code CED"
                name="wasteDetails.code"
                value={dataToogle.wasteDetails.code}
            onChange={(e: { target: { value: string } } | string) => {
              const newValue = typeof e === 'object' && e.target ? e.target.value : e as string;
                  handleChange({ target: { name: 'wasteDetails.code', value: newValue } });
                }}
            options={getUniqueOptions(options, allOptions, opt => 
                opt.json_row.wasteDetails.code ? 
                    `${opt.json_row.wasteDetails.code}` : ''
            )}
                enabled={true}
                display={getDisplayConditions().waste}
            width={48}
              />
        </div>

        {/* Transporteur */}
        <div className="grid grid-cols-2 gap-2">
              <InputMobile
                titre=""
                placeholder="Transporteur"
                name="transporter.company.name"
                value={dataToogle.transporter.company.name}
            onChange={(e: { target: { value: string } } | string) => {
              const newValue = typeof e === 'object' && e.target ? e.target.value : e as string;
              handleChange({ target: { name: 'transporter.company.name', value: newValue } });
            }}
            options={getUniqueOptions(options, allOptions, opt => 
                opt.json_row.transporter.company.name
            )}
                enabled={true}
                display={getDisplayConditions().transporter}
            width={48}
              />
              <InputMobile
                titre=""
                placeholder="SIRET"
                name="transporter.company.siret"
                value={dataToogle.transporter.company.siret}
            onChange={(e: { target: { value: string } } | string) => {
              const newValue = typeof e === 'object' && e.target ? e.target.value : e as string;
              handleChange({ target: { name: 'transporter.company.siret', value: newValue } });
            }}
            options={getUniqueOptions(options, allOptions, opt => 
                  opt.json_row.transporter.company.siret
              )}
                enabled={true}
                display={getDisplayConditions().transporter}
            width={48}
              />
        </div>

        {/* Destinataire */}
        <div className="grid grid-cols-2 gap-2">
              <InputMobile
                titre=""
            placeholder="Destinataire"
                name="recipient.company.name"
                value={dataToogle.recipient.company.name}
            onChange={(e: { target: { value: string } } | string) => {
              const newValue = typeof e === 'object' && e.target ? e.target.value : e as string;
              handleChange({ target: { name: 'recipient.company.name', value: newValue } });
            }}
            options={getUniqueOptions(options, allOptions, opt => 
                opt.json_row.recipient.company.name
            )}
                enabled={true}
                display={getDisplayConditions().recipient}
            width={48}
              />
              <InputMobile
                titre=""
                placeholder="SIRET"
                name="recipient.company.siret"
                value={dataToogle.recipient.company.siret}
            onChange={(e: { target: { value: string } } | string) => {
              const newValue = typeof e === 'object' && e.target ? e.target.value : e as string;
              handleChange({ target: { name: 'recipient.company.siret', value: newValue } });
            }}
            options={getUniqueOptions(options, allOptions, opt => 
                  opt.json_row.recipient.company.siret
              )}
                enabled={true}
                display={getDisplayConditions().recipient}
            width={48}
                onMobile={true}
              />
        </div>

        {/* Opération d'élimination */}
        <div className="grid grid-cols-2 gap-2">
          <InputMobile
            titre=""
            placeholder="Traitement"
            name="recipient.processingOperation"
            value={dataToogle.recipient.processingOperation ? 
                `${dataToogle.recipient.processingOperation} - ${treatmentLabels[dataToogle.recipient.processingOperation.replaceAll(' ', '') as keyof typeof treatmentLabels] || 'Méthode de traitement inconnue'}` 
                : ''}
              onChange={(e: { target: { value: string } } | string) => {
                  const newValue = typeof e === 'object' && e.target ? e.target.value : e as string;
                const code = newValue.split(' - ')[0];
                handleChange({ target: { name: 'recipient.processingOperation', value: code } });
            }}
            options={getUniqueOptions(options, allOptions, opt => 
                  opt.json_row.recipient.processingOperation ? 
                  `${opt.json_row.recipient.processingOperation} - ${treatmentLabels[opt.json_row.recipient.processingOperation.replaceAll(' ', '') as keyof typeof treatmentLabels] || 'Méthode de traitement inconnue'}`
                : ''
            )}
            enabled={true}
            display={getDisplayConditions().processingOperation}
            width={48}
            onMobile={true}
          />
        </div>
      </div>

      <div className='block h-[30px]'></div>

      {/* Section chiffres */}
      <div className="mt-8 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Colonne gauche: Contenant et Volume+Unité */}
          <div className="space-y-1">
            {/* Contenant */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contenant
              </label>
              <InputMobile
                  titre=""
                  placeholder="Benne"
                  name="other_infos.containerDescription"
                  value={otherInfos?.containerDescription || ''}
                  onChange={(e) => {
                      const newValue = typeof e === 'object' && e.target ? e.target.value : e;
                      handleOtherInfosChange({ containerDescription: newValue as string });
                  }}
                  options={getUniqueOptions(options, allOptions, opt => 
                      opt.other_infos?.containerDescription || ''
                  )}
                  width={48}
                  enabled={true}
                  display={true}
                  stylePrimary={true}
                  onMobile={true}
                  popup={true}
              />
            </div>

            {/* Volume + Unité */}
            <div className="flex space-x-1">
              {/* Volume */}
              <div className="flex-1">
                <InputMobile
                    titre=""
                    placeholder="0"
                    name="other_infos.volume"
                    value={otherInfos?.volume || ''}
                    onChange={(e: { target: { value: string } } | string) => {
                        const newValue = typeof e === 'object' && e.target ? e.target.value : e as string;
                        handleOtherInfosChange({ volume: newValue });
                    }}
                    options={getUniqueOptions(options, allOptions, opt => 
                        opt.other_infos?.volume || ''
                    )}
                    enabled={true}
                    display={true}
                    stylePrimary={true}
                    onMobile={true}
                    popup={true}
                />
              </div>

              {/* Unité */}
              <div className="flex-1">
                <InputMobile
                    titre=""
                    placeholder="Unité"
                    name="other_infos.volumeUnit"
                    value={otherInfos?.volumeUnit || 'm3'}
                    onChange={(e) => {
                        const newValue = typeof e === 'object' && e.target ? e.target.value : e;
                        handleOtherInfosChange({ volumeUnit: newValue as string   });
                    }}
                    options={{
                        filteredOptions: [],
                        allOptions: ['m3', 'L']
                    }}
                    enabled={true}
                    display={true}
                    stylePrimary={true}
                    onMobile={true}
                    popup={true}
                />
              </div>
            </div>
          </div>

          {/* Colonne droite: Nombre de contenants */}
          <div>
            {/* Nombre de contenants */}
            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-1 ml-2 ">
                Nombre de contenants
              </label>
              {/* Input Nombre de contenants */}
              <div className="flex items-center justify-center space-x-2 h-[42px]">
                <button
                  type="button"
                  onClick={() => {
                    const currentQty = Number(dataToogle.wasteDetails.packagingInfos[0].quantity) || 0;
                    if (currentQty > 0) {
                          handleChange({
                            target: { 
                              name: 'wasteDetails.packagingInfos[0].quantity', 
                              value: (currentQty - 1).toString() 
                            } 
                      });
                    }
                  }}
                      className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300"
                >
                  -
                </button>
            
                <input
                  type="number"
                      className="w-20 h-[42px] text-center px-2 border border-gray-300 rounded-md"
                  value={dataToogle.wasteDetails.packagingInfos[0].quantity || 0}
                  onChange={(e) => {
                    const value = Math.max(Number(e.target.value) || 0, 0);
                        handleChange({
                          target: { 
                            name: 'wasteDetails.packagingInfos[0].quantity', 
                            value: value.toString() 
                          } 
                    });
                  }}
                  min="0"
                />
            
                <button
                  type="button"
                  onClick={() => {
                    const currentQty = Number(dataToogle.wasteDetails.packagingInfos[0].quantity) || 0;
                        handleChange({
                          target: { 
                            name: 'wasteDetails.packagingInfos[0].quantity', 
                            value: (currentQty + 1).toString() 
                          } 
                    });
                  }}
                      className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>


        <div className='block h-[10px]'></div>

        {/* Tonnage+Remplissage Automatique */}
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-center mr-4">
            {/* Remplissage + Tonnage */}
            <div className="flex space-x-2">
              {/* Remplissage */}
              <label className="flex items-center space-x-1">
                <input
                  type="radio"
                  name="inputMode"
                  value="volume"
                  checked={otherInfos?.inputMode === 'volume'}
                  onChange={() => handleOtherInfosChange({ inputMode: 'volume' })}
                    className="h-4 w-4 text-blue-600"
                  disabled={!otherInfos?.automaticMode}
                />
                  <span className={`text-sm font-medium ${!otherInfos?.automaticMode ? 'text-gray-400' : 'text-gray-700'}`}>
                    Remplissage
                  </span>
              </label>
              
              {/* Tonnage */}
              <label className="flex items-center space-x-1">
                <input
                  type="radio"
                  name="inputMode"
                  value="tonnage"
                  checked={otherInfos?.inputMode === 'tonnage'}
                  onChange={() => handleOtherInfosChange({ inputMode: 'tonnage' })}
                    className="h-4 w-4 text-blue-600"
                  disabled={!otherInfos?.automaticMode}
                />
                  <span className={`text-sm font-medium ${!otherInfos?.automaticMode ? 'text-gray-400' : 'text-gray-700'}`}>
                    Tonnage
                  </span>
              </label>
            </div>
            {/* Calcul automatique */}
            <div className="flex items-center space-x-1">
                <input
                  type="checkbox"
                  checked={otherInfos?.automaticMode}
                  onChange={(e) => {
                    handleOtherInfosChange({ 
                      automaticMode: e.target.checked,
                      inputMode: e.target.checked ? 'volume' : undefined
                    });
                  }}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <label className="text-sm font-medium text-gray-700">
                  Automatique
              </label>
            </div>
        </div>

        {/* Taux de remplissage + tonnage */}
        <div className="flex flex-row gap-4">
          {/* Taux de remplissage en 3 blocs */}
          <div className="w-2/3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Taux de remplissage
            </label>
            <div className="space-y-1">
              <div className="flex space-x-1">
              {['50', '75', '95'].map((percent) => (
                <button
                  key={percent}
                  type="button"
                      className={`flex-1 py-2 px-2 border rounded-md ${
                    otherInfos?.fillRate === percent
                        ? 'bg-blue-100 border-blue-500'
                        : 'border-gray-300 hover:bg-gray-50'
                    } ${otherInfos?.automaticMode && otherInfos?.inputMode === 'tonnage' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    if (!otherInfos?.automaticMode || otherInfos?.inputMode !== 'tonnage') {
                      handleOtherInfosChange({ fillRate: percent });
                    }
                  }}
                  disabled={otherInfos?.automaticMode && otherInfos?.inputMode === 'tonnage'}
                >
                    <div className="relative h-6 bg-gray-200 rounded-sm overflow-hidden">
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-blue-500"
                        style={{ height: `${percent}%` }}
                      ></div>
                    </div>
                    <span className="block text-xs mt-1 text-center">{percent}%</span>
                </button>
              ))}
            </div>
            <input
              type="number"
              min="0"
              max="100"
                step="10"
                className={`w-full h-8 px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  otherInfos?.automaticMode && otherInfos?.inputMode === 'tonnage' ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              value={otherInfos?.fillRate || ''}
              onChange={(e) => {
                const value = Math.min(Math.max(parseInt(e.target.value) || 0, 0), 100).toString();
                handleOtherInfosChange({ fillRate: value });
              }}
              disabled={otherInfos?.automaticMode && otherInfos?.inputMode === 'tonnage'}
                placeholder="Taux de remplissage (%)"
            />
            </div>
          </div>

          {/* Poids tonne */}
          <div className="w-1/3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Poids (tonnes)
            </label>
            <div className="space-y-2">
              <input
                type="number"
                className={`w-full text-2xl mr-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                otherInfos?.automaticMode && otherInfos?.inputMode === 'volume' ? 'bg-gray-100' : ''
                }`}
                value={dataToogle.wasteDetails.quantity || ''}
                onChange={(e) => {
                handleChange({
                  target: { 
                    name: 'wasteDetails.quantity', 
                    value: e.target.value 
                    } 
                  });
                  if (otherInfos?.automaticMode && otherInfos?.inputMode === 'tonnage') {
                    const fillRate = calculateFillRate(
                      otherInfos.volume,
                      e.target.value,
                      dataToogle.wasteDetails.code,
                      otherInfos.volumeUnit
                    );
                    if (fillRate !== null) {
                      handleOtherInfosChange({ fillRate: fillRate.toFixed(0) });
                    }
                  }
                }}
                disabled={otherInfos?.automaticMode && otherInfos?.inputMode === 'volume'}
                placeholder="0.00"
              />
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 rounded"
                  checked={dataToogle.wasteDetails.quantityType === 'ESTIMATED'}
                  onChange={(e) => {
                    handleChange({
                      target: { 
                        name: 'wasteDetails.quantityType', 
                        value: e.target.checked ? 'ESTIMATED' : 'REAL' 
                      } 
                    });
                  }}
                />
                <label className="text-sm text-gray-600">
                  Estimation
                </label>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    {/* Mélange (conditionnel) */}
    {getFiliere(dataToogle.wasteDetails.code, ced_table) === 'DIB' && (
      <div className="mt-4">
        <MelangeData
          otherInfos={otherInfos}
          onUpdate={(melange) => {
            handleOtherInfosChange({ melange });
          }}
          onMobile={true}
        />
      </div>
    )}
    </div>
  )

  const handleOtherInfosChange = (updates: Partial<OtherInfos>) => {
    const updatedOtherInfos: OtherInfos = {
      ...otherInfos,
        ...updates
    };
    
  // Si le mode automatique est activé et qu'on est en mode volume
  if (updatedOtherInfos.automaticMode && updatedOtherInfos.inputMode === 'volume' && 
      (updates.fillRate || updates.volume || updates.volumeUnit)) {
        const weight = calculateEstimatedWeight(
            updatedOtherInfos.volume,
          updatedOtherInfos.fillRate,
            dataToogle.wasteDetails.code,
            updatedOtherInfos.volumeUnit
        );
        if (weight !== null) {
          handleChange({ 
              target: { 
                  name: 'wasteDetails.quantity', 
                  value: weight.toFixed(3) 
              } 
            });
        }
    }
    
    setOtherInfos(updatedOtherInfos);
  };

  const handleSubmit = () => {
    console.log("PopUp handleSubmit called");
    if (onConfirm) {
        onConfirm();
    }
  };

  // Ajouter cette fonction en haut du composant PopUp
  const autoCompleteOtherInfos = (currentDataToogle: FormInput, allOptions: CompleteFormInput[]) => {
    const wrappedDataToogle: CompleteFormInput = { json_row: currentDataToogle };
    // Trouver les options qui correspondent au maximum de champs de dataToogle
    const matchingOptions = allOptions.filter(option => {
        const matchingFields = [
            'emitter.company.name',
            'emitter.workSite.name',
            'wasteDetails.code',
            'wasteDetails.packagingInfos[0].type'
        ].filter(field => {
            const optionValue = field.split('.').reduce<unknown>((obj, key) => 
                typeof obj === 'object' && obj ? (obj as Record<string, unknown>)[key] : undefined,
                option.json_row as unknown as Record<string, unknown>
            );
            const currentValue = field.split('.').reduce<unknown>((obj, key) => 
                typeof obj === 'object' && obj ? (obj as Record<string, unknown>)[key] : undefined,
                wrappedDataToogle as unknown as Record<string, unknown>
            );
            return optionValue === currentValue;
        });

        return matchingFields.length > 0;
    });

    if (matchingOptions.length === 0) return null;

    // Compter les occurrences de chaque combinaison de other_infos
    const otherInfosCounts = matchingOptions.reduce((acc, option) => {
        if (!option.other_infos) return acc;
        
        const key = JSON.stringify({
            containerDescription: option.other_infos.containerDescription || '',
            volume: option.other_infos.volume || '',
            volumeUnit: option.other_infos.volumeUnit || '',
            fillRate: option.other_infos.fillRate || ''
        });

        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {} as {[key: string]: number});

    // Trouver la combinaison la plus fréquente
    let mostFrequentOtherInfos = null;
    let maxCount = 0;

    Object.entries(otherInfosCounts).forEach(([key, count]) => {
        if (count > maxCount) {
            maxCount = count;
            mostFrequentOtherInfos = JSON.parse(key);
        }
    });

    return mostFrequentOtherInfos;
  };

  // Modifier useEffect dans PopUp pour surveiller les changements de dataToogle
  useEffect(() => {
    const suggestedOtherInfos = autoCompleteOtherInfos(dataToogle, allOptions) as (OtherInfos | null);
    
    if (suggestedOtherInfos) {
        setOtherInfos({
            containerDescription: otherInfos.containerDescription || suggestedOtherInfos.containerDescription,
            volume: otherInfos.volume || suggestedOtherInfos.volume,
            volumeUnit: otherInfos.volumeUnit || suggestedOtherInfos.volumeUnit,
            fillRate: otherInfos.fillRate || suggestedOtherInfos.fillRate,
            automaticMode: otherInfos.automaticMode,
            inputMode: otherInfos.inputMode,
            melange: otherInfos.melange
        });
    }
  }, [dataToogle, allOptions]);

  return (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] overflow-hidden">
      <div className="h-full flex flex-col bg-white">
        {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3 border-b border-gray-200 bg-white">
        <h2 className="text-lg font-medium">Vérification</h2>
          <p className="text-sm text-gray-500 mt-1">Veuillez compléter les informations</p>
        </div>

        {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-4 pb-24">
          {renderContent()}
        </div>

        {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-3 border-t border-gray-200 bg-white">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onCancel}
            className="h-11 text-gray-700 bg-gray-100 rounded-lg text-base font-medium active:bg-gray-200"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
            className="h-11 text-white bg-blue-600 rounded-lg text-base font-medium active:bg-blue-700"
            >
              Confirmer
            </button>
          </div>
        </div>
      </div>
    </div>
  );

}  // Fermeture de la fonction PopUp
