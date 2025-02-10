import Swal from 'sweetalert2'
import { useState, useEffect, useRef, useMemo } from 'react'
import InputFull from './InputFull'
import { createRoot } from 'react-dom/client'
import { FormInput, CompleteFormInput } from "@/app/register/interface/BSD_Interface"
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
      {/* Site émetteur */}
      <div className="flex items-start space-x-32">
        <div className="w-[230px]">
          <InputFull
            titre="Nom du site"
            placeholder="Nom du site"
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
            width={35}
          />
        </div>
        <InputFull
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
          width={30}
        />
      </div>

      {/* Point de collecte */}
      <div className="flex items-start space-x-32">
        <div className="w-[230px]">
          <InputFull
            titre="Point de collecte"
            placeholder="Nom du point"
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
            width={35}
          />
        </div>
        <InputFull
          titre=""
          placeholder="Adresse d'enlèvement"
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
          width={30}
        />
      </div>

      {/* Déchet */}
      <div className="flex items-start space-x-32">
        <div className="w-[230px]">
          <InputFull
            titre="Déchet"
            placeholder="Nom du déchet"
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
            width={35}
          />
        </div>
          <InputFull
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
            width={30}
          />
      </div>

      {/* Transporteur */}
      <div className="flex items-start space-x-32">
        <div className="w-[230px]">
          <InputFull
            titre="Transporteur"
            placeholder="Nom du transporteur"
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
            width={35}
          />
        </div>
        <InputFull
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
          width={30}
        />
      </div>

      {/* Destinataire */}
      <div className="flex items-start space-x-32">
        <div className="w-[230px]">
          <InputFull
            titre="Destinataire"
            placeholder="Nom du destinataire"
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
            width={35}
          />
        </div>
        <InputFull
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
          width={30}
        />
      </div>

      {/* Opération d'élimination */}
      <div className="flex items-start space-x-32">
        <div className="w-[230px]">
          <InputFull
            titre="Traitement"
            placeholder="Opération de traitement"
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
            width={35}
          />
        </div>
      </div>

      {/* Section chiffres */}
      <div className="mt-4 space-y-4">
        {/* Première ligne: Volume et Contenants */}
        <div className="grid grid-cols-2 gap-4">
          {/* Volume et unité */}
          <div className="flex gap-4">
            {/* Contenant */}
            <div className="w-1/2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contenant
                </label>
                <InputFull
                    titre=""
                    placeholder="Benne"
                    name="other_infos.containerDescription"
                    value={otherInfos?.containerDescription || ''}
                    onChange={(e: { target: { value: string } } | string) => {
                        const newValue = typeof e === 'object' && e.target ? e.target.value : e as string;
                        handleOtherInfosChange({ containerDescription: newValue });
                    }}
                    options={getUniqueOptions(options, allOptions, opt => 
                        opt.other_infos?.containerDescription || ''
                    )}
                    width={30}
                    enabled={true}
                    display={true}
                    stylePrimary={true}
                    popup={true}
                />
            </div>

            {/* Volume */}
            <div className="w-1/4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Volume
                </label>
                <InputFull
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
                    width={3}
                    enabled={true}
                    display={true}
                    stylePrimary={true}
                    popup={true}
                />
            </div>

            {/* Unité */}
            <div className="w-1/4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unité
                </label>
                <InputFull
                    titre=""
                    placeholder="Unité"
                    name="other_infos.volumeUnit"
                    value={otherInfos?.volumeUnit || 'm3'}
                    onChange={(e: { target: { value: string } } | string) => {
                        const newValue = typeof e === 'object' && e.target ? e.target.value : e as string;
                        handleOtherInfosChange({ volumeUnit: newValue });
                    }}
                    options={{
                        filteredOptions: [],
                        allOptions: ['m3', 'L']
                    }}
                    width={3}
                    enabled={true}
                    display={true}
                    stylePrimary={true}
                    popup={true}
                />
            </div>
          </div>

          {/* Nombre de contenants */}
          <div className="flex flex-col items-center">
            <label className="block text-sm font-medium text-gray-700 mb-1 w-full text-center">
              Nombre de contenants
            </label>
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

        {/* Radio buttons pour le mode de calcul */}
        <div className="flex justify-between items-center">
          <div className="flex space-x-4">
            <label className="flex items-center space-x-2">
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
            <label className="flex items-center space-x-2">
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
          <div className="flex items-center space-x-2">
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
              Calcul automatique
            </label>
          </div>
        </div>

        {/* Dernière ligne: Taux de remplissage et Quantité */}
        <div className="grid grid-cols-2 gap-4">
          {/* Taux de remplissage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Taux de remplissage
            </label>
            <div className="space-y-2">
              <div className="flex space-x-2">
                {['50', '75', '95'].map((percent) => (
                  <button
                    key={percent}
                    type="button"
                    className={`flex-1 p-2 border rounded-md ${
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
                      />
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

          {/* Quantité */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Poids (tonnes)
            </label>
            <div className="space-y-2">
              <input
                type="number"
                className={`w-full text-2xl px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
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
                  Quantité estimée
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Après le taux de remplissage */}
      {getFiliere(dataToogle.wasteDetails.code, ced_table) === 'DIB' && (
        <div className="mt-4">
          <MelangeData
            otherInfos={otherInfos}
            onUpdate={(melange) => {
              handleOtherInfosChange({ melange });
            }}
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
  const autoCompleteOtherInfos = (currentDataToogle: FormInput, allOptions: {json_row: FormInput, other_infos?: OtherInfos}[]) => {
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
                currentDataToogle as unknown as Record<string, unknown>
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
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] overflow-y-auto py-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="bg-white p-6 rounded-lg shadow-lg max-w-2xl w-full mx-4 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex flex-col items-center justify-center">
          <h2 className="text-lg font-semibold">Vérification des informations</h2>
          <p className="text-sm text-gray-600">Veuillez vérifier et compléter les informations manquantes</p>
        </div>

        <div className="max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
          {renderContent()}
        </div>

        <div className="mt-4 flex justify-end space-x-2">
          <button
            onClick={(e) => {
              e.preventDefault();
              onCancel?.();
            }}
            type="button"
            className="px-4 py-2 text-gray-600 border rounded hover:bg-gray-100"
          >
            Annuler
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            type="button"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}

// Fonction pour calculer le poids estimé
const calculateEstimatedWeight = (
  volume: string | undefined, 
  fillRate: string | undefined, 
  wasteCode: string | undefined,
  volumeUnit: string = 'm3'
): number | null => {
  if (!volume) return null;

  // Convertir le volume en m3 si nécessaire
  const volumeInM3 = volumeUnit === 'L' ? parseFloat(volume) / 1000 : parseFloat(volume);
  
  // Trouver la masse volumique correspondante ou utiliser une valeur par défaut
  const wasteInfo = wasteCode ? 
    dic_json_ced_masse_volumique.find(
      item => item.code_CED.replace(/\s/g, '') === wasteCode.replace(/\s/g, '')
    ) : null;
  
  // Utiliser la masse volumique trouvée ou une valeur par défaut de 1000 kg/m3
  const masseVolumique = wasteInfo?.masse_volumique || 1000;

  // Calculer le poids en tenant compte du taux de remplissage
  const fillRateMultiplier = fillRate ? parseInt(fillRate) / 100 : 1;
  
  // Retourner le poids en tonnes (masse volumique est en kg/m3)
  return (volumeInM3 * masseVolumique * fillRateMultiplier) / 1000;
}

// Fonction pour calculer le taux de remplissage
const calculateFillRate = (
  volume: string | undefined,
  weight: string | undefined,
  wasteCode: string | undefined,
  volumeUnit: string = 'm3'
): number | null => {
  if (!volume || !weight) return null;

  // Convertir le volume en m3 si nécessaire
  const volumeInM3 = volumeUnit === 'L' ? parseFloat(volume) / 1000 : parseFloat(volume);
  
  // Convertir le poids en kg (weight est en tonnes)
  const weightInKg = parseFloat(weight) * 1000;

  // Trouver la masse volumique correspondante ou utiliser une valeur par défaut
  const wasteInfo = wasteCode ? 
    dic_json_ced_masse_volumique.find(
      item => item.code_CED.replace(/\s/g, '') === wasteCode.replace(/\s/g, '')
    ) : null;
  
  // Utiliser la masse volumique trouvée ou une valeur par défaut de 1000 kg/m3
  const masseVolumique = wasteInfo?.masse_volumique || 1000;

  // Calculer le taux de remplissage (en pourcentage)
  const fillRate = (weightInKg / (volumeInM3 * masseVolumique)) * 100;
  
  // Limiter le résultat entre 0 et 100
  return Math.min(Math.max(fillRate, 0), 100);
}
