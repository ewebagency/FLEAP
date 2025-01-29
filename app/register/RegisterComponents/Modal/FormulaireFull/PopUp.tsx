/*import Swal from 'sweetalert2'
import { useState, useEffect, useRef, useMemo } from 'react'
import InputFull from './InputFull'
import { createRoot } from 'react-dom/client'
import { FormInput } from "@/app/register/interface/BSD_Interface"

// Définir l'interface OtherInfos ici aussi
interface OtherInfos {
  containerDescription: string;
  volume: string;
  volumeUnit: string;
  fillRate: string;
  inputMode?: 'tonnage' | 'volume';
}

interface PopUpProps {
  dataToogle: {
    emitter: {
      company: { name: string; siret: string };
      workSite: { name: string; address: string };
    };
    wasteDetails: {
      name: string;
      code: string;
      quantity: string;
      quantityType: 'ESTIMATED' | 'REAL';
      packagingInfos: [{
        type: 'FUT' | 'GRV' | 'CITERNE' | 'BENNE' | 'PIPELINE' | 'AUTRE';
        quantity: number;
        other: string;
      }];
    };
    transporter: {
      company: { name: string; siret: string };
    };
    recipient: {
      company: { name: string; siret: string };
    };
  };
  setDataToogle: (data: PopUpProps['dataToogle']) => void;
  modalType: string
  onMobile: boolean
  otherInfos: OtherInfos
  setOtherInfos: (data: OtherInfos) => void
  getUniqueOptions: (filteredOptions: FormInput[], allOptions: FormInput[], selector: (opt: FormInput) => string) => {
    filteredOptions: string[];
    allOptions: string[];
  }
  options: FormInput[]
  allOptions: FormInput[]
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

export default function PopUp({
  dataToogle,
  setDataToogle,
  modalType,
  onMobile,
  otherInfos,
  setOtherInfos,
  getUniqueOptions,
  options,
  allOptions,
}: PopUpProps) {
  const [root, setRoot] = useState<ReturnType<typeof createRoot> | null>(null)
  const rootRef = useRef<ReturnType<typeof createRoot> | null>(null)
  const containerRef = useRef<HTMLElement | null>(null)
  const [localData, setLocalData] = useState(dataToogle)
  
  // Initialiser avec des valeurs vides
  const initialState = useRef({
    emitter: {
      company: { name: '', siret: '' },
      workSite: { name: '', address: '' }
    },
    wasteDetails: { name: '', code: '' },
    transporter: {
      company: { name: '', siret: '' }
    },
    recipient: {
      company: { name: '', siret: '' }
    }
  })

  // Ajoutons un flag pour suivre si le composant est monté
  const isMounted = useRef(true);

  // Modifier renderInputs pour éviter les créations multiples de root
  const renderInputs = (container: HTMLElement) => {
    try {
      containerRef.current = container;
      if (!rootRef.current && isMounted.current) {
        rootRef.current = createRoot(container);
        setRoot(rootRef.current);
      }
      if (rootRef.current && isMounted.current) {
        rootRef.current.render(renderContent());
      }
    } catch (error) {
      console.error('Error in renderInputs:', error);
    }
  }

  const getDisplayConditions = () => ({
    site: !initialState.current.emitter.company.name || !initialState.current.emitter.company.siret,
    workSite: !initialState.current.emitter.workSite.name || !initialState.current.emitter.workSite.address,
    waste: !initialState.current.wasteDetails.name || !initialState.current.wasteDetails.code,
    transporter: !initialState.current.transporter.company.name || !initialState.current.transporter.company.siret,
    recipient: !initialState.current.recipient.company.name || !initialState.current.recipient.company.siret
  })

  // Initialiser inputMode à 'volume' si non défini
  useEffect(() => {
    if (!otherInfos.inputMode) {
      //handleOtherInfosChange({ inputMode: 'volume' })
      setOtherInfos({ ...otherInfos, inputMode: 'volume' })
    }
  }, [])

  // Modifions l'useEffect pour otherInfos
  useEffect(() => {
    const container = document.getElementById('input-container');
    if (container && root && isMounted.current) {
      root.render(renderContent());
    }
  }, [otherInfos]);

  // Modifions useEffect pour le nettoyage
  useEffect(() => {
    isMounted.current = true;
    
    return () => {
      isMounted.current = false;
      if (rootRef.current) {
        try {
          rootRef.current.unmount();
        } catch (error) {
          console.error('Error unmounting root:', error);
        }
        rootRef.current = null;
        setRoot(null);
      }
      containerRef.current = null;
    };
  }, []);

  const renderContent = () => (
    <div className="space-y-2">
      <InputFull
        titre="Site"
        placeholder="Sélectionner un site"
        name="emitter.company"
        value={localData.emitter.company.name ? `${localData.emitter.company.name} - ${localData.emitter.company.siret}` : ''}
        onChange={(e: { target: { value: string } } | string) => {
          const newValue = typeof e === 'object' && e.target ? e.target.value : e as string
          const [name, siret] = newValue.split(' - ')
          handleMultiInputChange({
            'emitter.company.name': name,
            'emitter.company.siret': siret
          })
        }}
        options={getUniqueOptions(options, allOptions, 
          opt => opt.emitter.company.name && opt.emitter.company.siret ? 
            `${opt.emitter.company.name} - ${opt.emitter.company.siret}` : ''
        )}
        enabled={true}
        display={getDisplayConditions().site}
      />

      <InputFull
        titre="Point de collecte"
        placeholder="Sélectionner un point de collecte"
        name="emitter.workSite"
        value={localData.emitter.workSite.name ? `${localData.emitter.workSite.name} - ${localData.emitter.workSite.address}` : ''}
        onChange={(e: { target: { value: string } } | string) => {
          const newValue = typeof e === 'object' && e.target ? e.target.value : e as string
          const [name, address] = newValue.split(' - ')
          handleMultiInputChange({
            'emitter.workSite.name': name,
            'emitter.workSite.address': address
          })
        }}
        options={getUniqueOptions(options, allOptions, 
          opt => opt.emitter.workSite.name && opt.emitter.workSite.address ? 
            `${opt.emitter.workSite.name} - ${opt.emitter.workSite.address}` : ''
        )}
        enabled={true}
        display={getDisplayConditions().workSite}
      />

      <InputFull
        titre="Déchet"
        placeholder="Sélectionner un déchet"
        name="wasteDetails"
        value={localData.wasteDetails.name ? `${localData.wasteDetails.name} - ${localData.wasteDetails.code}` : ''}
        onChange={(e: { target: { value: string } } | string) => {
          const newValue = typeof e === 'object' && e.target ? e.target.value : e as string
          const [name, code] = newValue.split(' - ')
          handleMultiInputChange({
            'wasteDetails.name': name,
            'wasteDetails.code': code
          })
        }}
        options={getUniqueOptions(options, allOptions, 
          opt => opt.wasteDetails.name && opt.wasteDetails.code ? 
            `${opt.wasteDetails.name} - ${opt.wasteDetails.code}` : ''
        )}
        enabled={true}
        display={getDisplayConditions().waste}
      />

      <InputFull
        titre="Transporteur"
        placeholder="Sélectionner un transporteur"
        name="transporter.company"
        value={localData.transporter.company.name ? `${localData.transporter.company.name} - ${localData.transporter.company.siret}` : ''}
        onChange={(e: { target: { value: string } } | string) => {
          const newValue = typeof e === 'object' && e.target ? e.target.value : e as string
          const [name, siret] = newValue.split(' - ')
          handleMultiInputChange({
            'transporter.company.name': name,
            'transporter.company.siret': siret
          })
        }}
        options={getUniqueOptions(options, allOptions, 
          opt => opt.transporter.company.name && opt.transporter.company.siret ? 
            `${opt.transporter.company.name} - ${opt.transporter.company.siret}` : ''
        )}
        enabled={true}
        display={getDisplayConditions().transporter}
      />        

      <InputFull
        titre="Destinataire"
        placeholder="Sélectionner un destinataire"
        name="recipient.company"
        value={localData.recipient.company.name ? `${localData.recipient.company.name} - ${localData.recipient.company.siret}` : ''}
        onChange={(e: { target: { value: string } } | string) => {
          const newValue = typeof e === 'object' && e.target ? e.target.value : e as string
          const [name, siret] = newValue.split(' - ')
          handleMultiInputChange({
            'recipient.company.name': name,
            'recipient.company.siret': siret
          })
        }}
        options={getUniqueOptions(options, allOptions, 
          opt => opt.recipient.company.name && opt.recipient.company.siret ? 
            `${opt.recipient.company.name} - ${opt.recipient.company.siret}` : ''
        )}
        enabled={true}
        display={getDisplayConditions().recipient}
      />


      {/* Section chiffres
      <div className="mt-4 grid grid-cols-2 gap-4">
        {/* Debug info 
        <div className="col-span-2 p-2 bg-gray-100 rounded text-sm hidden">
          <p>Mode: {otherInfos?.inputMode || 'non défini'}</p>
          <p>Volume: {otherInfos?.volume || '0'} {otherInfos?.volumeUnit}</p>
          <p>Taux de remplissage: {otherInfos?.fillRate || '0'}%</p>
          <p>Code déchet: {localData.wasteDetails.code}</p>
          <p>Poids calculé: {
            calculateEstimatedWeight(
              otherInfos?.volume,
              otherInfos?.fillRate,
              localData.wasteDetails.code,
              otherInfos?.volumeUnit
            )?.toFixed(3) || 'N/A'
          } tonnes</p>
          <p>Taux de remplissage calculé: {
            calculateFillRate(
              otherInfos?.volume,
              localData.wasteDetails.quantity,
              localData.wasteDetails.code,
              otherInfos?.volumeUnit
            )?.toFixed(1) || 'N/A'
          }%</p>
        </div>

        {/* Radio buttons pour le mode de saisie 
        <div className="col-span-2 flex space-x-4 mb-2">
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              name="inputMode"
              value="tonnage"
              checked={otherInfos?.inputMode === 'tonnage'}
              onChange={() => handleOtherInfosChange({ inputMode: 'tonnage' })}
              className="h-4 w-4 text-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">Tonnage</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              name="inputMode"
              value="volume"
              checked={otherInfos?.inputMode === 'volume'}
              onChange={() => handleOtherInfosChange({ inputMode: 'volume' })}
              className="h-4 w-4 text-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">Volume</span>
          </label>
        </div>

        {/* Colonne gauche 
        <div className="space-y-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantité (tonnes)
            </label>
            <input
              type="number"
              className={`w-full text-2xl px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                otherInfos?.inputMode === 'volume' ? 'bg-gray-100' : ''
              }`}
              value={localData.wasteDetails.quantity || ''}
              onChange={(e) => {
                handleMultiInputChange({
                  'wasteDetails.quantity': e.target.value
                });
                if (otherInfos?.inputMode === 'tonnage') {
                  // Calculer et mettre à jour le volume
                  const fillRate = calculateFillRate(
                    otherInfos.volume,
                    e.target.value,
                    localData.wasteDetails.code,
                    otherInfos.volumeUnit
                  );
                  if (fillRate !== null) {
                    handleOtherInfosChange({ fillRate: fillRate.toFixed(0) });
                  }
                }
              }}
              disabled={otherInfos?.inputMode === 'volume'}
              placeholder="0.00"
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              className="h-4 w-4 text-blue-600 rounded"
              checked={localData.wasteDetails.quantityType === 'ESTIMATED'}
              onChange={(e) => {
                handleMultiInputChange({
                  'wasteDetails.quantityType': e.target.checked ? 'ESTIMATED' : 'REAL'
                })
              }}
            />
            <label className="text-sm text-gray-600">
              Quantité estimée
            </label>
          </div>

        {/* Section quantité contenants
        <div className='position-absolute left-0 rounded-md border-gray-300 border-t border-r pl-2'>
          <label className="block text-xs font-medium text-gray-700 mb-1 mt-2 ml-4 text-left">
            Nombre de contenants avec ces caractéristiques
          </label>
          <div className="flex items-center space-x-2 ml-2">
            <button
              type="button"
              onClick={() => {
                const currentQty = Number(localData.wasteDetails.packagingInfos[0].quantity) || 0;
                console.log('Decreasing - Current quantity:', currentQty);
                if (currentQty > 0) {
                  handleMultiInputChange({
                    'wasteDetails.packagingInfos[0].quantity': (currentQty - 1).toString()
                  });
                }
              }}
              className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300"
            >
              -
            </button>
            
            <input
              type="number"
              className="w-20 text-center px-2 py-1 border border-gray-300 rounded-md ml-2"
              value={localData.wasteDetails.packagingInfos[0].quantity || 0}
              onChange={(e) => {
                const value = Math.max(Number(e.target.value) || 0, 0);
                handleMultiInputChange({
                  'wasteDetails.packagingInfos[0].quantity': value.toString()
                });
              }}
              min="0"
            />
            
            <button
              type="button" 
              onClick={() => {
                const currentQty = Number(localData.wasteDetails.packagingInfos[0].quantity) || 0;
                handleMultiInputChange({
                  'wasteDetails.packagingInfos[0].quantity': (currentQty + 1).toString()
                });
              }}
              className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300"
            >
              +
            </button>
          </div>
        </div>

        </div>

        {/* Colonne droite 
        <div className="space-y-2">
          <div className="flex space-x-2">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Volume
              </label>
              <input
                type="number"
                className="w-full text-2xl px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={otherInfos?.volume || ''}
                onChange={(e) => handleVolumeChange(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="w-20">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unité
              </label>
              <select
                className="w-full px-2 py-2 border border-gray-300 rounded-md text-lg"
                value={otherInfos?.volumeUnit || 'm3'}
                onChange={(e) => {
                  handleOtherInfosChange({ volumeUnit: e.target.value })
                }}
              >
                <option value="m3">m³</option>
                <option value="L">L</option>
              </select>
            </div>
          </div>
          <div>
            <div className="space-y-2">
              <div className="flex space-x-2">
                {['50', '75', '95'].map((percent) => (
                  <button
                    key={percent}
                    className={`flex-1 p-2 border rounded-md ${
                      otherInfos?.fillRate === percent
                        ? 'bg-blue-100 border-blue-500'
                        : 'border-gray-300 hover:bg-gray-50'
                    } ${otherInfos?.inputMode === 'tonnage' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => {
                      if (otherInfos?.inputMode !== 'tonnage') {
                        handleOtherInfosChange({ fillRate: percent })
                      }
                    }}
                    disabled={otherInfos?.inputMode === 'tonnage'}
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
                className={`w-full h-8 px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  otherInfos?.inputMode === 'tonnage' ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                value={otherInfos?.fillRate || ''}
                onChange={(e) => {
                  const value = Math.min(Math.max(parseInt(e.target.value) || 0, 0), 100).toString();
                  handleOtherInfosChange({ fillRate: value });
                }}
                disabled={otherInfos?.inputMode === 'tonnage'}
                placeholder="Taux de remplissage (%)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const handleMultiInputChange = (updates: { [key: string]: string }) => {
    console.log('handleMultiInputChange called with:', updates);
    const updatedLocalData = { ...localData };
    const updatedDataToogle = { ...dataToogle };
    
    Object.entries(updates).forEach(([path, value]) => {
      console.log('Processing path:', path, 'with value:', value);
      
      // Gestion spéciale pour packagingInfos[0]
      if (path.includes('packagingInfos[0]')) {
        const [base, field] = path.split('.packagingInfos[0].');
        
        // Mise à jour de localData
        if (!updatedLocalData.wasteDetails.packagingInfos) {
          updatedLocalData.wasteDetails.packagingInfos = [{ type: 'FUT', quantity: 0, other: '' }];
        }
        updatedLocalData.wasteDetails.packagingInfos[0] = {
          ...updatedLocalData.wasteDetails.packagingInfos[0],
          [field]: Number(value)
        };

        // Mise à jour de dataToogle
        if (!updatedDataToogle.wasteDetails.packagingInfos) {
          updatedDataToogle.wasteDetails.packagingInfos = [{ type: 'FUT', quantity: 0, other: '' }];
        }
        updatedDataToogle.wasteDetails.packagingInfos[0] = {
          ...updatedDataToogle.wasteDetails.packagingInfos[0],
          [field]: Number(value)
        };
      } else {
        // Gestion normale pour les autres champs
        const pathArray = path.split('.');
        let currentLocal = updatedLocalData as any;
        let currentToogle = updatedDataToogle as any;
        
        for (let i = 0; i < pathArray.length - 1; i++) {
          if (!currentLocal[pathArray[i]]) {
            currentLocal[pathArray[i]] = {};
          }
          currentLocal = currentLocal[pathArray[i]];
          
          if (!currentToogle[pathArray[i]]) {
            currentToogle[pathArray[i]] = {};
          }
          currentToogle = currentToogle[pathArray[i]];
        }
        
        currentLocal[pathArray[pathArray.length - 1]] = value;
        currentToogle[pathArray[pathArray.length - 1]] = value;
      }
    });
    
    console.log('Updated data:', {
      localData: updatedLocalData,
      dataToogle: updatedDataToogle
    });
    
    setLocalData(updatedLocalData);
    setDataToogle(updatedDataToogle);

    if (rootRef.current && isMounted.current) {
      rootRef.current.render(renderContent());
    }
  };

  const handleOtherInfosChange = (updates: Partial<OtherInfos>) => {
    const updatedOtherInfos: OtherInfos = {
      containerDescription: otherInfos?.containerDescription || '',
      volume: otherInfos?.volume || '',
      volumeUnit: otherInfos?.volumeUnit || 'm3',
      fillRate: otherInfos?.fillRate || '',
      inputMode: otherInfos?.inputMode,
      ...updates
    }
    
    // Si le taux de remplissage ou le volume change et qu'on est en mode volume, recalculer le tonnage
    if ((updates.fillRate || updates.volume) && updatedOtherInfos.inputMode === 'volume' && updatedOtherInfos.volume) {
      const weight = calculateEstimatedWeight(
        updatedOtherInfos.volume,
        updates.fillRate || updatedOtherInfos.fillRate,
        localData.wasteDetails.code,
        updatedOtherInfos.volumeUnit
      );
      if (weight !== null) {
        handleMultiInputChange({
          'wasteDetails.quantity': weight.toFixed(3)
        });
      }
    }
    
    setOtherInfos(updatedOtherInfos)
  }

  const handleSubmit = async () => {
    // Nettoyer le root existant avant d'ouvrir le modal
    if (rootRef.current) {
      try {
        rootRef.current.unmount();
      } catch (error) {
        console.error('Error unmounting root:', error);
      }
      rootRef.current = null;
      setRoot(null);
    }

    // Mettre à jour initialState avec les valeurs actuelles de dataToogle
    initialState.current = {
      emitter: {
        company: { ...dataToogle.emitter.company },
        workSite: { ...dataToogle.emitter.workSite }
      },
      wasteDetails: { ...dataToogle.wasteDetails },
      transporter: {
        company: { ...dataToogle.transporter.company }
      },
      recipient: {
        company: { ...dataToogle.recipient.company }
      }
    }

    if (getDisplayConditions().site || 
        getDisplayConditions().workSite || 
        getDisplayConditions().waste || 
        getDisplayConditions().transporter || 
        getDisplayConditions().recipient) {

      const modalContent = document.createElement('div')
      const inputContainer = document.createElement('div')
      inputContainer.id = 'input-container'
      modalContent.appendChild(inputContainer)

      const result = await MySwal.fire({
        title: 'Champs manquants',
        text: 'Veuillez remplir tous les champs obligatoires',
        html: modalContent,
        showCancelButton: true,
        confirmButtonText: 'Confirmer',
        cancelButtonText: 'Annuler',
        didOpen: () => {
          const container = document.getElementById('input-container')
          if (container) {
            renderInputs(container)
          }
        },
        willClose: () => {
          if (rootRef.current) {
            try {
              rootRef.current.unmount();
            } catch (error) {
              console.error('Error unmounting root:', error);
            }
            rootRef.current = null;
            setRoot(null);
          }
        },
        customClass: {
          container: onMobile ? 'mobile-swal-container' : '',
          popup: onMobile ? 'mobile-swal-popup' : '',
        },
      })

      if (result.dismiss === Swal.DismissReason.cancel || 
          result.dismiss === Swal.DismissReason.backdrop || 
          result.dismiss === Swal.DismissReason.esc) {
        setLocalData(dataToogle)
      } else if (result.isConfirmed) {
        setDataToogle(localData)
      }
    } else {
      await MySwal.fire({
        icon: 'success',
        title: 'Formulaire complet',
        text: 'Tous les champs obligatoires sont remplis.',
        customClass: {
          container: onMobile ? 'mobile-swal-container' : '',
          popup: onMobile ? 'mobile-swal-popup' : '',
        },
      })
    }
  }

  const handleVolumeChange = (newVolume: string) => {
    handleOtherInfosChange({ volume: newVolume });
    if (otherInfos?.inputMode === 'volume' && otherInfos.fillRate) {
      // Calculer et mettre à jour le tonnage
      const weight = calculateEstimatedWeight(
        newVolume,
        otherInfos.fillRate,
        localData.wasteDetails.code,
        otherInfos.volumeUnit
      );
      if (weight !== null) {
        handleMultiInputChange({
          'wasteDetails.quantity': weight.toFixed(3)
        });
      }
    }
  }

  const handleTonnageChange = (newTonnage: string) => {
    handleMultiInputChange({
      'wasteDetails.quantity': newTonnage
    });
    if (otherInfos?.inputMode === 'tonnage' && otherInfos.volume) {
      // Calculer et mettre à jour le taux de remplissage
      const fillRate = calculateFillRate(
        otherInfos.volume,
        newTonnage,
        localData.wasteDetails.code,
        otherInfos.volumeUnit
      );
      if (fillRate !== null) {
        handleOtherInfosChange({ fillRate: fillRate.toFixed(0) });
      }
    }
  }

  return (
    <button
      onClick={handleSubmit}
      type="button"
      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
    >
      Soumettre
    </button>
  )
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
*/