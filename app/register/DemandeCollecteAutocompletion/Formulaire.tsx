import React, { useRef, useState, useEffect } from 'react';
import { useAutocompletion } from './useAutocompletion';
import { useSession } from "@/app/component/SessionProvider";
import InputFull from "../RegisterComponents/Modal/FormulaireFull/InputFull";
import InputMobile from "../RegisterComponents/Modal/FormulaireFull/InputMobile";
import BoxIcon from "@/app/component/BoxIconWrapper";
import { toast } from "react-hot-toast";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { aggregateByMailRecipient, createLines, TYPES_PRESTATION, TYPES_PRESTATION_LABELS } from './utils';
import MailsPartComponent, { MailsPartComponentRef } from './MailsPartComponent';
import { BSD } from '@/app/register/TableBSD';
import { useBSDs } from '@/app/register/BSDsProvider';
import { supabase } from '@/app/database/supabaseClient';
import { 
  SiteInterface, 
  PointCollecteInterface, 
  ContactInterface, 
  DechetInterface, 
  ContenantInterface, 
  TransporteurInterface, 
  DestinataireInterface, 
  NegociantInterface, 
  CourtierInterface, 
  EcorganismeInterface, 
  CodeTraitementInterface, 
  ContratInterface 
} from './types';
import { invalidateCache } from '@/app/utils/invalidateCache';
import { useModalContextNew } from '../RegisterComponents/Modal/ContextModal';
import PhotoCaptureModal from './PhotoCaptureModal';

interface FormulaireProps {
  setDisplayThis: (display: boolean) => void;
}

const Formulaire: React.FC<FormulaireProps> = ({ setDisplayThis }) => {
  const { entreprise_id, user_id, entreprise_name } = useSession();
  const {modalReload, setModalReload} = useModalContextNew();
  const [isMobile, setIsMobile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [siteAccess, setSiteAccess] = useState<string[]>([]);
  const [affichage_conditionnel, setAffichageConditionnel] = useState<{ [key: number]: string }>({});
  const { allOptions, selectedFieldsList, handleFieldChange: originalHandleFieldChange, addNewLine, removeLine, autocompletionEnabled, setAutocompletionEnabled } = useAutocompletion(entreprise_id, siteAccess);
  const mailsPartRef = useRef<MailsPartComponentRef>(null);
  const { setAllBSDs, setAllFilteredBSDs, setDisplayedBSDs } = useBSDs();
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number | null>(null);
  

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const fetchUserSiteAccess = async () => {
      if (user_id) {
        console.log('Récupération des accès aux sites pour user_id:', user_id);
        const { data, error } = await supabase
          .from('profiles')
          .select('site_access')
          .eq('user_id', user_id)
          .single();

        if (error) {
          console.error('Erreur lors de la récupération des accès aux sites:', error);
          return;
        }

        if (data?.site_access) {
          setSiteAccess(data.site_access);
        }
      }
    };

    fetchUserSiteAccess();
  }, [user_id]);

  const inputClasses = "w-[300px]";
  const sectionClasses = "w-[98%] md:w-[95%] pb-2 mt-1 mx-auto";
  const lineClasses = "bg-gray-50 rounded-lg p-3 mb-3 shadow-sm hover:shadow-md transition-shadow duration-200";

  type FieldValue = {
    site: SiteInterface | null;
    pointCollecte: PointCollecteInterface | null;
    contactEmetteur: ContactInterface[] | null;
    dechet: DechetInterface | null;
    contenant: ContenantInterface | null;
    nombreContenant: number;
    date: Date | null;
    showTime: boolean;
    time: string;
    transporteur: TransporteurInterface | null;
    destinataire: DestinataireInterface | null;
    showNegociant: boolean;
    destinataireMail: string;
    typePrestation: string;
    negociant: NegociantInterface | null;
    courtier: CourtierInterface | null;
    ecoorganisme: EcorganismeInterface | null;
    codeTraitement: CodeTraitementInterface | null;
    contrat: ContratInterface | null;
    mention: { toMentionned: boolean; mentionType: string; mentionCompany: string; mentionAddress: string } | null;
    photo: File | null;
  };

  const handleFieldChange = (index: number, field: keyof FieldValue, value: FieldValue[keyof FieldValue]) => {
    // Update the display state based on field changes
    if (field === 'site' && value) {
      setAffichageConditionnel(prev => ({ ...prev, [index]: 'affichage_site' }));
    } else if (field === 'dechet' && value) {
      setAffichageConditionnel(prev => ({ ...prev, [index]: 'affichage_dechet' }));
    }
    // Call the original handleFieldChange
    originalHandleFieldChange(index, field, value);
  };

  const handleShowMore = (index: number) => {
    if (affichage_conditionnel[index] === 'affichage_maximum') {
      setAffichageConditionnel(prev => ({ ...prev, [index]: 'affichage_dechet' }));
    }
    else {
      setAffichageConditionnel(prev => ({ ...prev, [index]: 'affichage_maximum' }));
    }
    //originalHandleFieldChange(index, 'showNegociant', !selectedFieldsList[index].showNegociant);
  };

  const handleAddNewLine = () => {
    const newIndex = selectedFieldsList.length;
    setAffichageConditionnel(prev => ({ ...prev, [newIndex]: 'initial' }));
    addNewLine();
  };

  // Fonction pour vérifier si tous les mails requis sont présents
  const areAllMailsPresent = () => {
    return selectedFieldsList.every(field => {
      const destinataireMail = field.destinataireMail;
      switch (destinataireMail) {
        case 'transporteur':
          return field.transporteur?.value?.email;
        case 'destinataire':
          return field.destinataire?.value?.email;
        case 'negociant':
          return field.negociant?.value?.email;
        case 'courtier':
          return field.courtier?.value?.email;
        case 'ecoorganisme':
          return field.ecoorganisme?.value?.email;
        default:
          return false;
      }
    });
  };

  const handleSubmit = async () => {
    if (mailsPartRef.current) {
      try {
        setIsSubmitting(true);
        // Envoyer les mails
        await mailsPartRef.current.sendAllMails();
        
        // Créer les lignes dans Supabase
        const result = await createLines(selectedFieldsList, entreprise_id, user_id, entreprise_name);
        
        if (result.success) {
          // Mettre à jour les BSDs locaux
          setTimeout(() => {
            setAllBSDs(prev => [...result.createdData as unknown as BSD[], ...prev]);
            setAllFilteredBSDs(prev => [...result.createdData as unknown as BSD[], ...prev]);
            setDisplayedBSDs(prev => [...result.createdData as unknown as BSD[], ...prev]);
          }, 100);

          toast.success('Formulaire soumis avec succès');
          setModalReload(!modalReload)
          invalidateCache(entreprise_id, user_id);
          setDisplayThis(false);
        } else {
          toast.error(result.error || 'Erreur lors de la création des lignes');
        }
      } catch (error) {
        console.error('Erreur:', error);
        toast.error('Une erreur est survenue');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handlePhotoCapture = (file: File) => {
    if (currentPhotoIndex !== null) {
      handleFieldChange(currentPhotoIndex, 'photo', file);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-hidden">
      <div className="bg-white rounded-lg shadow-lg w-[95%] md:w-[80%] max-w-8xl h-[90vh] flex flex-col touch-none overflow-x-hidden">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 px-4 py-2 border-b">
          <div className="w-full flex flex-row items-center justify-between">
            <h3 className="font-bold text-lg ml-0 md:ml-8 flex items-center gap-2">
              <BoxIcon className="mb-1" name='truck' type='solid' />
              <span className="text-green-medium mt-1 font-bold">
                Demande de collecte
              </span>
            </h3>
            {isMobile && (
              <button
                onClick={() => setDisplayThis(false)}
                className="text-gray-500 hover:text-gray-700 focus:outline-none mt-2"
              >
                <BoxIcon name="x" type="solid" size="md" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setAutocompletionEnabled(!autocompletionEnabled)}
              className="md:w-[190px] px-2 py-1 text-sm font-medium bg-gray-100 rounded-md px-2 pb-1 cursor-pointer active:bg-gray-200 flex items-center gap-2"
              title={autocompletionEnabled 
                ? "Les informations ne sont pas modifiables quand l'autocomplétion est activée, vous pouvez la désactiver." 
                : "Activer l'autocomplétion"}
            >
              <BoxIcon name='pencil' type='solid' size='sm' color='green'></BoxIcon>
              <p>{autocompletionEnabled ? "Remplissage manuel" : "Remplissage auto"}</p>
              {/*<BoxIcon 
                name={autocompletionEnabled ? "check-circle" : "x-circle"} 
                type="solid" 
                size="sm" 
                className={autocompletionEnabled ? "text-[var(--green-medium)]" : "text-gray-400"}
              />*/}
            </button>
            <button
              type="button"
              onClick={() => {
                console.log('Début de la réinitialisation');
                
                // 1. Réinitialiser l'état d'affichage
                const newAffichageConditionnel: { [key: number]: string } = { 0: 'initial' };
                setAffichageConditionnel(newAffichageConditionnel);
                console.log('État d\'affichage réinitialisé');

                // 2. Réinitialiser les champs de la première ligne
                const resetFields = () => {
                  handleFieldChange(0, 'site', null);
                  handleFieldChange(0, 'pointCollecte', null);
                  handleFieldChange(0, 'contactEmetteur', null);
                  handleFieldChange(0, 'dechet', null);
                  handleFieldChange(0, 'contenant', null);
                  handleFieldChange(0, 'nombreContenant', 1);
                  handleFieldChange(0, 'date', null);
                  handleFieldChange(0, 'transporteur', null);
                  handleFieldChange(0, 'destinataire', null);
                  handleFieldChange(0, 'showNegociant', false);
                  handleFieldChange(0, 'destinataireMail', 'transporteur');
                  handleFieldChange(0, 'typePrestation', TYPES_PRESTATION.ENLEVEMENT_AVEC_DEPOT);
                  handleFieldChange(0, 'negociant', null);
                  handleFieldChange(0, 'courtier', null);
                  handleFieldChange(0, 'ecoorganisme', null);
                  handleFieldChange(0, 'codeTraitement', null);
                  handleFieldChange(0, 'contrat', null);
                  handleFieldChange(0, 'mention', null);
                };
                resetFields();
                console.log('Champs de la première ligne réinitialisés');

                // 3. Supprimer les lignes supplémentaires de manière sécurisée
                const removeExtraLines = () => {
                  const currentLength = selectedFieldsList.length;
                  console.log(`Nombre de lignes avant suppression: ${currentLength}`);
                  
                  if (currentLength > 1) {
                    // Supprimer les lignes de la fin vers le début pour éviter les problèmes d'index
                    for (let i = currentLength - 1; i > 0; i--) {
                      console.log(`Suppression de la ligne ${i}`);
                      removeLine(i);
                    }
                  }
                  console.log('Suppression des lignes supplémentaires terminée');
                };
                removeExtraLines();

                console.log('Réinitialisation terminée');
              }}
              className="md:w-[130px] px-2 py-1 text-sm font-medium bg-gray-100 rounded-md px-2 pb-1 cursor-pointer active:bg-gray-200 flex items-center gap-2"
            >
              <BoxIcon name='eraser' type='solid' size='sm' color='green'></BoxIcon>
              <span>Tout effacer</span>
            </button>
            {!isMobile && (
              <button
                onClick={() => setDisplayThis(false)}
                className="text-gray-500 hover:text-gray-700 focus:outline-none mt-2"
              >
                <BoxIcon name="x" type="solid" size="md" />
              </button>
            )}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4">
          <form className="w-full max-w-full">
            {/* Section Point de départ et Contact (en-tête) */}
            <div className="text-sm font-semibold ml-2 md:ml-6 mt-2 mb-2 text-gray-700">Point de départ  </div>
            <div className="bg-white rounded-lg p-3 mb-4 shadow-sm">
              <div>
                {isMobile ? (
                  <div className="flex flex-col gap-2">
                    <div className={inputClasses}>
                      <InputMobile
                        name="site"
                        titre="Site"
                        placeholder="Site"
                        options={{
                          filteredOptions: allOptions.sites.map(site => site.value.nom),
                          allOptions: []
                        }}
                        value={selectedFieldsList[0]?.site?.value?.nom || ''}
                        onChange={(e) => {
                          const selectedSite = allOptions.sites.find(site => site.value.nom === e.target.value);
                          handleFieldChange(0, 'site', selectedSite || null);
                        }}
                        enableText={true}
                        stylePrimary={true}
                        onMobile={true}
                      />
                    </div>
                    {(affichage_conditionnel[0] === 'affichage_site' || affichage_conditionnel[0] === 'affichage_dechet' || affichage_conditionnel[0] === 'affichage_maximum') && (
                      <>
                        <div className={inputClasses}>
                          <InputMobile
                            name="pointCollecte"
                            titre="Collecte"
                            placeholder="Point de collecte"
                            options={{
                              filteredOptions: selectedFieldsList[0]?.site?.value?.pointsCollecte?.map(point => point.nom) || [],
                              allOptions: []
                            }}
                            value={selectedFieldsList[0]?.pointCollecte?.nom || ''}
                            onChange={(e) => {
                              const selectedPoint = selectedFieldsList[0]?.site?.value?.pointsCollecte?.find(p => p.nom === e.target.value);
                              handleFieldChange(0, 'pointCollecte', selectedPoint || null);
                            }}
                            enableText={selectedFieldsList[0]?.site?.value?.pointsCollecte?.length === 1}
                            stylePrimary={true}
                            onMobile={true}
                          />
                        </div>
                        <div className={`${inputClasses} hidden`}>
                          <InputMobile
                            name="contactEmetteur"
                            titre="Respo"
                            placeholder="Contact"
                            options={{
                              filteredOptions: selectedFieldsList[0]?.site?.value?.contacts?.map(contact => contact.nom) || [],
                              allOptions: []
                            }}
                            value={selectedFieldsList[0]?.contactEmetteur?.[0]?.nom || ''}
                            onChange={(e) => {
                              const selectedContact = selectedFieldsList[0]?.site?.value?.contacts?.find(c => c.nom === e.target.value);
                              if (selectedContact) {
                                const newContacts = selectedFieldsList[0]?.contactEmetteur || [];
                                if (!newContacts.some(c => c.nom === selectedContact.nom)) {
                                  handleFieldChange(0, 'contactEmetteur', [...newContacts, selectedContact]);
                                }
                              }
                            }}
                            enableText={true}
                            stylePrimary={true}
                            onMobile={true}
                          />
                          {selectedFieldsList[0]?.site?.value?.contacts?.length && selectedFieldsList[0]?.site?.value?.contacts?.length > 1 && <div className="text-gray-500 text-sm ml-[80px] mt-1">+ {selectedFieldsList[0]?.site?.value?.contacts?.length - 1} {selectedFieldsList[0]?.site?.value?.contacts?.length - 1 > 1 ? 'autres' : 'autre'}</div>}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <div  className="flex flex-row gap-4 items-center ml-6">
                      <div className={inputClasses}>
                        <InputFull
                          name="site"
                          titre="Site"
                          placeholder="Site"
                          options={{
                            filteredOptions: allOptions.sites.map(site => site.value.nom),
                            allOptions: []
                          }}
                          value={selectedFieldsList[0]?.site?.value?.nom || ''}
                          onChange={(e) => {
                            const selectedSite = allOptions.sites.find(site => site.value.nom === e.target.value);
                            handleFieldChange(0, 'site', selectedSite || null);
                          }}
                          enableText={true}
                          stylePrimary={true}
                        />
                      </div>
                      {(affichage_conditionnel[0] === 'affichage_site' || affichage_conditionnel[0] === 'affichage_dechet' || affichage_conditionnel[0] === 'affichage_maximum') && (
                        <>
                          <div className={inputClasses}>
                            <InputFull
                              name="pointCollecte"
                              titre="Enlèvement"
                              placeholder="Point de collecte"
                              options={{
                                filteredOptions: selectedFieldsList[0]?.site?.value?.pointsCollecte?.map(point => point.nom) || [],
                                allOptions: []
                              }}
                              value={selectedFieldsList[0]?.pointCollecte?.nom || ''}
                              onChange={(e) => {
                                const selectedPoint = selectedFieldsList[0]?.site?.value?.pointsCollecte?.find(p => p.nom === e.target.value);
                                handleFieldChange(0, 'pointCollecte', selectedPoint || null);
                              }}
                              enableText={selectedFieldsList[0]?.site?.value?.pointsCollecte?.length === 1}
                              stylePrimary={true}
                            />
                          </div>
                          <div className="flex justify-start items-center gap-2 hidden">
                            <InputFull
                              name="contactEmetteur"
                              titre="Respo Terrain"
                              placeholder="Contact"
                              options={{
                                filteredOptions: selectedFieldsList[0]?.site?.value?.contacts?.map(contact => contact.nom) || [],
                                allOptions: []
                              }}
                              value={selectedFieldsList[0]?.contactEmetteur?.filter(contact => contact.respoTerrain === true)[0]?.nom || ''}
                              onChange={(e) => {
                                const selectedContact = selectedFieldsList[0]?.site?.value?.contacts?.find(c => c.nom === e.target.value);
                                if (selectedContact) {
                                  const newContacts = selectedFieldsList[0]?.contactEmetteur || [];
                                  if (!newContacts.some(c => c.nom === selectedContact.nom)) {
                                    handleFieldChange(0, 'contactEmetteur', [...newContacts, selectedContact]);
                                  }
                                }
                              }}
                              enableText={true}
                              stylePrimary={true}
                            />
                            {selectedFieldsList[0]?.site?.value?.contacts?.length && selectedFieldsList[0]?.site?.value?.contacts?.length > 1 && <div className="text-gray-500 text-sm">+ {selectedFieldsList[0]?.site?.value?.contacts?.length - 1} {selectedFieldsList[0]?.site?.value?.contacts?.length - 1 > 1 ? 'autres' : 'autre'}</div>}
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Liste des lignes de déchets et transport */}
            {selectedFieldsList.map((selectedFields, index) => (
              <div key={index} className={lineClasses}>
                <div className="flex justify-between items-center mb-6">
                  <div className="flex flex-row items-center gap-2">
                    <h4 className="text-sm font-semibold text-gray-700 flex flex-row items-center gap-2"><p className="hidden md:block">Demande</p> {index + 1} :</h4>
                    <select
                      value={selectedFields.typePrestation}
                      onChange={(e) => handleFieldChange(index, 'typePrestation', e.target.value)}
                      className="text-sm text-gray-600 bg-white border border-[#43A047] rounded-md p-1 focus:outline-none focus:ring-0 font-medium hover:cursor-pointer hover:bg-gray-50 min-w-[100px]"
                    >
                      {Object.entries(TYPES_PRESTATION_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {isMobile ? label.split(' (')[0] : label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentPhotoIndex(index);
                        setPhotoModalOpen(true);
                      }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        selectedFields.photo ? 'bg-green-500' : 'bg-gray-200'
                      } hover:bg-opacity-80 transition-colors`}
                      title="Prendre une photo"
                    >
                      <BoxIcon 
                        name="camera" 
                        type="solid" 
                        size="sm" 
                        color={selectedFields.photo ? 'white' : 'gray-600'} 
                      />
                    </button>
                  </div>

                  {index > 0 && (
                    isMobile ? (
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        className="text-white bg-red-500 hover:bg-red-600 font-bold text-sm rounded-xl px-3 pb-1"
                      >
                        -
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Supprimer
                      </button>
                    )
                  )}
                </div>

                {/* Section Déchets et Date */}
                <div className={sectionClasses}>
                  <div className="flex md:flex-row flex-col gap-2 items-center">
                    {isMobile ? (
                      <>
                        <div className={`${inputClasses} ml-[-50px]`}>
                          <InputMobile
                            name="dechet"
                            titre="Déchet"
                            placeholder="Déchet"
                            options={{
                              filteredOptions: allOptions.dechets.map(dechet => dechet.value.nom),
                              allOptions: []
                            }}
                            value={selectedFields.dechet?.value?.nom || ''}
                            onChange={(e) => {
                              const selectedDechet = allOptions.dechets.find(d => d.value.nom === e.target.value);
                              handleFieldChange(index, 'dechet', selectedDechet || null);
                            }}
                            enableText={true}
                            stylePrimary={true}
                            onMobile={true}
                          />
                        </div>
                        {(affichage_conditionnel[index] === 'affichage_dechet' || affichage_conditionnel[index] === 'affichage_maximum') && (
                          <>
                        <div className={`${inputClasses} ml-[-50px]`}>
                          <InputMobile
                            name="contenant"
                            titre="Contenant"
                            placeholder="Contenant"
                            options={{
                              filteredOptions: allOptions.contenants.map(contenant => contenant.value.nom),
                              allOptions: []
                            }}
                            value={selectedFields.contenant?.value?.nom || ''}
                            onChange={(e) => {
                              const selectedContenant = allOptions.contenants.find(c => c.value.nom === e.target.value);
                              handleFieldChange(index, 'contenant', selectedContenant || null);
                            }}
                            enableText={true}
                            stylePrimary={true}
                            onMobile={true}
                          />
                          {/* Date et nombre de contenant */}
                          <div className="ml-[74px] w-[80%] flex items-center justify-between mt-2">
                            {/* Nombre de contenant */}
                            <div className="flex items-center justify-center gap-0">
                              <button
                                type="button"
                                onClick={() => {
                                  const currentNumber = selectedFields.nombreContenant || 1;
                                  if (currentNumber > 1) {
                                    handleFieldChange(index, 'nombreContenant', currentNumber - 1);
                                  }
                                }}
                                className="w-6 h-6 flex items-center justify-center bg-green-700 text-white rounded-full hover:bg-green-800 transition-colors"
                              >
                                -
                              </button>
                              <span className="w-6 text-center">{selectedFields.nombreContenant || 1}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const currentNumber = selectedFields.nombreContenant || 1;
                                  handleFieldChange(index, 'nombreContenant', currentNumber + 1);
                                }}
                                className="w-6 h-6 flex items-center justify-center bg-green-700 text-white rounded-full hover:bg-green-800 transition-colors"
                              >
                                +
                              </button>
                            </div>
                            {/* Date */}
                            <DatePicker
                              selected={selectedFields.date || null}
                              onChange={(date) => {
                                if (date) {
                                  const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
                                  handleFieldChange(index, 'date', localDate);
                                } else {
                                  handleFieldChange(index, 'date', null);
                                }
                              }}
                              className="ml-[20px] w-[80%] p-1 border rounded-md"
                              placeholderText="Dès que possible"
                              dateFormat="dd/MM/yyyy"
                            />
                          </div>
                          {/* Heure */}
                          <div className="flex items-center gap-2 justify-end mt-1">
                            <button
                              type="button"
                              onClick={() => handleFieldChange(index, 'showTime', !selectedFields.showTime)}
                              className={`px-2 py-1 text-sm rounded-md ${
                                selectedFields.showTime 
                                    ? 'bg-green-500 text-white' 
                                    : 'bg-gray-200 text-gray-600'
                              }`}
                            >
                              Heure
                            </button>
                            {selectedFields.showTime && (
                              <select
                                value={selectedFields.time || '09:00'}
                                onChange={(e) => handleFieldChange(index, 'time', e.target.value)}
                                className="text-sm border rounded-md p-1"
                              >
                                {Array.from({ length: 17 }, (_, i) => {
                                  const hour = i + 6; // De 6h à 22h
                                  return (
                                    <option key={hour} value={`${hour.toString().padStart(2, '0')}:00`}>
                                      {hour}h
                                    </option>
                                  );
                                })}
                              </select>
                            )}
                          </div>
                        </div>
                      
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <div className={inputClasses}>
                          <InputFull
                            name="dechet"
                            titre="Déchet"
                            placeholder="Déchet"
                            options={{
                              filteredOptions: allOptions.dechets.map(dechet => dechet.value.nom),
                              allOptions: []
                            }}
                            value={selectedFields.dechet?.value?.nom || ''}
                            onChange={(e) => {
                              const selectedDechet = allOptions.dechets.find(d => d.value.nom === e.target.value);
                              handleFieldChange(index, 'dechet', selectedDechet || null);
                            }}
                            enableText={true}
                            stylePrimary={true}
                          />
                        </div>
                        {(affichage_conditionnel[index] === 'affichage_dechet' || affichage_conditionnel[index] === 'affichage_maximum') && (
                          <>
                        <div className="flex justify-start items-center gap-2 ml-[-20px]">
                          <div>
                            <InputFull
                              name="contenant"
                              titre="Contenant"
                              placeholder="Contenant"
                              options={{
                                filteredOptions: allOptions.contenants.map(contenant => contenant.value.nom),
                                allOptions: []
                              }}
                              value={selectedFields.contenant?.value?.nom || ''}
                              onChange={(e) => {
                                const selectedContenant = allOptions.contenants.find(c => c.value.nom === e.target.value);
                                handleFieldChange(index, 'contenant', selectedContenant || null);
                              }}
                              enableText={true}
                              stylePrimary={true}
                            />

                          </div>
                          <div className="flex items-center justify-center gap-0"> 
                              <button
                                type="button"
                                onClick={() => {
                                  const currentNumber = selectedFields.nombreContenant || 1;
                                  if (currentNumber > 1) {
                                    handleFieldChange(index, 'nombreContenant', currentNumber - 1);
                                  }
                                }}
                                className="w-5 h-5 flex items-center justify-center bg-green-700 text-white rounded-full hover:bg-green-800 transition-colors"
                              >
                                -
                              </button>
                              <span className="w-6 text-center">{selectedFields.nombreContenant || 1}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const currentNumber = selectedFields.nombreContenant || 1;
                                  handleFieldChange(index, 'nombreContenant', currentNumber + 1);
                                }}
                                className="w-5 h-5 flex items-center justify-center bg-green-700 text-white rounded-full hover:bg-green-800 transition-colors"
                              >
                                +
                              </button>
                            </div>                        
                        </div>
                        <div className="ml-[40px] flex justify-start items-center gap-2">
                          <div className="text-gray-500 text-sm">Collecte le</div>
                          <DatePicker
                            selected={selectedFields.date || null}
                            onChange={(date) => {
                              if (date) {
                                const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
                                handleFieldChange(index, 'date', localDate);
                              } else {
                                handleFieldChange(index, 'date', null);
                              }
                            }}
                            className="w-[67%] h-1/2 p-1 border rounded-md text-sm tracking-wide"
                            placeholderText="Dès que possible"
                            dateFormat="dd/MM/yyyy"
                          />
                          <div className="flex items-center gap-2 ml-[-60px]">
                            <div className="text-gray-500 text-sm">Heure</div>
                            <div className="flex items-center gap-2 relative" style={{ marginLeft: '-50px', zIndex: 10 }}>
                              <button
                                type="button"
                                onClick={() => handleFieldChange(index, 'showTime', !selectedFields.showTime)}
                                className={`px-2 py-0.5 text-sm rounded-md ${
                                  selectedFields.showTime 
                                      ? 'bg-green-500 text-white' 
                                      : 'bg-gray-200 text-gray-600'
                                }`}
                              >
                                Heure
                              </button>
                              {selectedFields.showTime && (
                                <select
                                  value={selectedFields.time || '09:00'}
                                  onChange={(e) => handleFieldChange(index, 'time', e.target.value)}
                                  className="text-sm border rounded-md p-1"
                                >
                                  {Array.from({ length: 17 }, (_, i) => {
                                    const hour = i + 6; // De 6h à 22h
                                    return (
                                      <option key={hour} value={`${hour.toString().padStart(2, '0')}:00`}>
                                        {hour}h
                                      </option>
                                    );
                                  })}
                                </select>
                              )}
                            </div>
                          </div>
                        </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Bouton Afficher + */}
                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    onClick={() => handleShowMore(index)}
                    className="text-sm text-gray-600 hover:text-gray-800 flex items-start gap-1"
                  >
                    <span>{affichage_conditionnel[index] === 'affichage_maximum' ? 'Masquer' : 'Afficher plus'}</span>
                    <div className="mt-0.5"><BoxIcon name={affichage_conditionnel[index] === 'affichage_maximum' ? 'chevron-up' : 'chevron-down'} type="solid" size="xs" /></div>
                  </button>
                </div>

                {/* Section Transport */}
                <div className={sectionClasses}>
                  <div className="flex flex-wrap gap-4">
                    {isMobile ? (
                      <>
                        {affichage_conditionnel[index] === 'affichage_maximum' && (
                          <>
                            {/* Première ligne : Transporteur, Destinataire, DestinataireMail */}
                            <div className="flex flex-wrap gap-2">
                              <div className={inputClasses}>
                                <InputMobile
                                  name="transporteur"
                                  titre="Transport."
                                  placeholder="Transporteur"
                                  options={{
                                    filteredOptions: allOptions.transporteurs.map(transporteur => transporteur.value.nomBoite || ''),
                                    allOptions: []
                                  }}
                                  value={selectedFields.transporteur?.value?.nomBoite || ''}
                                  onChange={(e) => {
                                    const selectedTransporteur = allOptions.transporteurs.find(t => t.value.nomBoite === e.target.value);
                                    handleFieldChange(index, 'transporteur', selectedTransporteur || null);
                                  }}
                                  enableText={true}
                                  stylePrimary={true}
                                  onMobile={true}
                                />
                              </div>
                              <div className={inputClasses}>
                                <InputMobile
                                  name="destinataire"
                                  titre="Destinat."
                                  placeholder="Destinataire"
                                  options={{
                                    filteredOptions: allOptions.destinataires?.map(dest => dest.value.nomBoite || '') || [],
                                    allOptions: []
                                  }}
                                  value={selectedFields.destinataire?.value?.nomBoite || ''}
                                  onChange={(e) => {
                                    const selectedDestinataire = allOptions.destinataires?.find(d => d.value.nomBoite === e.target.value);
                                    handleFieldChange(index, 'destinataire', selectedDestinataire || null);
                                  }}
                                  enableText={true}
                                  stylePrimary={true}
                                  onMobile={true}
                                />
                              </div>
                              <div className={inputClasses}>
                                <div className="flex items-center gap-4 ml-[60px]">
                                  <div className="text-gray-500 text-sm">Mail pour le</div>
                                  <select
                                    value={selectedFields.destinataireMail}
                                    onChange={(e) => handleFieldChange(index, 'destinataireMail', e.target.value)}
                                    className="text-sm text-gray-600 bg-transparent border-0 focus:outline-none focus:ring-0"
                                  >
                                    <option value="transporteur">Transporteur</option>
                                    <option value="destinataire">Destinataire</option>
                                    <option value="negociant">Négociant</option>
                                    <option value="courtier">Courtier</option>
                                    <option value="ecoorganisme">Ecoorganisme</option>
                                  </select>
                                </div>
                              </div>
                            </div>

                            {/* Deuxième ligne : Négociant, Courtier, Eco Organisme */}
                            <div className="flex flex-wrap gap-2">
                              <div className={inputClasses}>
                                <InputMobile
                                  name="negociant"
                                  titre="Négociant"
                                  placeholder="Négociant"
                                  options={{
                                    filteredOptions: allOptions.negociants?.map(nego => nego.value.nomBoite || '') || [],
                                    allOptions: []
                                  }}
                                  value={selectedFields.negociant?.value?.nomBoite || ''}
                                  onChange={(e) => {
                                    const selectedNegociant = allOptions.negociants?.find(nego => nego.value.nomBoite === e.target.value);
                                    handleFieldChange(index, 'negociant', selectedNegociant || null);
                                  }}
                                  enableText={true}
                                  stylePrimary={true}
                                  onMobile={true}
                                />
                              </div>
                              <div className={inputClasses}>
                                <InputMobile
                                  name="courtier"
                                  titre="Courtier"
                                  placeholder="Courtier"
                                  options={{
                                    filteredOptions: allOptions.courtiers?.map(court => court.value.nomBoite || '') || [],
                                    allOptions: []
                                  }}
                                  value={selectedFields.courtier?.value?.nomBoite || ''}
                                  onChange={(e) => {
                                    const selectedCourtier = allOptions.courtiers?.find(court => court.value.nomBoite === e.target.value);
                                    handleFieldChange(index, 'courtier', selectedCourtier || null);
                                  }}
                                  enableText={true}
                                  stylePrimary={true}
                                  onMobile={true}
                                />
                              </div>
                              <div className={inputClasses}>
                                <InputMobile
                                  name="ecoorganisme"
                                  titre="EcoOrg."
                                  placeholder="Ecoorganisme"
                                  options={{
                                    filteredOptions: allOptions.ecoorganismes?.map(eco => eco.value.nomBoite || '') || [],
                                    allOptions: []
                                  }}
                                  value={selectedFields.ecoorganisme?.value?.nomBoite || ''}
                                  onChange={(e) => {
                                    const selectedEcoorganisme = allOptions.ecoorganismes?.find(eco => eco.value.nomBoite === e.target.value);
                                    handleFieldChange(index, 'ecoorganisme', selectedEcoorganisme || null);
                                  }}
                                  enableText={true}
                                  stylePrimary={true}
                                  onMobile={true}
                                />
                              </div>
                            </div>

                            {/* Troisième ligne : Contrat, Code de traitement */}
                            <div className="flex flex-wrap gap-2">
                              <div className={inputClasses}>
                                <InputMobile
                                  name="contrat"
                                  titre="Contrat"
                                  placeholder="Contrat"
                                  options={{
                                    filteredOptions: allOptions.contrats?.map(contrat => contrat.value.nom || '') || [],
                                    allOptions: []
                                  }}
                                  value={selectedFields.contrat?.value?.nom || ''}
                                  onChange={(e) => {
                                    const selectedContrat = allOptions.contrats?.find(contrat => contrat.value.nom === e.target.value);
                                    handleFieldChange(index, 'contrat', selectedContrat || null);
                                  }}
                                  enableText={true}
                                  stylePrimary={true}
                                  onMobile={true}
                                />
                              </div>
                              <div className={inputClasses}>
                                <InputMobile
                                  name="codeTraitement"
                                  titre="Traitement"
                                  placeholder="Code de traitement"
                                  options={{
                                    filteredOptions: allOptions.codeTraitements?.map(code => `${code.value.code} - ${code.value.nom}` || '') || [],
                                    allOptions: []
                                  }}
                                  value={selectedFields.codeTraitement?.value?.code || ''}
                                  onChange={(e) => {
                                    const selectedCodeTraitement = allOptions.codeTraitements?.find(code => `${code.value.code} - ${code.value.nom}` === e.target.value);
                                    handleFieldChange(index, 'codeTraitement', selectedCodeTraitement || null);
                                  }}
                                  enableText={true}
                                  stylePrimary={true}
                                  onMobile={true}
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        {affichage_conditionnel[index] === 'affichage_maximum' && (
                          <>
                            {/* Première ligne : Transporteur, Destinataire, DestinataireMail */}
                            <div className="flex flex-wrap gap-4 items-center">
                              <div className={inputClasses}>
                                <InputFull
                                  name="transporteur"
                                  titre="Transporteur"
                                  placeholder="Transporteur"
                                  options={{
                                    filteredOptions: allOptions.transporteurs.map(transporteur => transporteur.value.nomBoite || ''),
                                    allOptions: []
                                  }}
                                  value={selectedFields.transporteur?.value?.nomBoite || ''}
                                  onChange={(e) => {
                                    const selectedTransporteur = allOptions.transporteurs.find(t => t.value.nomBoite === e.target.value);
                                    handleFieldChange(index, 'transporteur', selectedTransporteur || null);
                                  }}
                                  enableText={true}
                                  stylePrimary={true}
                                />
                              </div>
                              <div className={inputClasses}>
                                <InputFull
                                  name="destinataire"
                                  titre="Destinataire"
                                  placeholder="Destinataire"
                                  options={{
                                    filteredOptions: allOptions.destinataires?.map(dest => dest.value.nomBoite || '') || [],
                                    allOptions: []
                                  }}
                                  value={selectedFields.destinataire?.value?.nomBoite || ''}
                                  onChange={(e) => {
                                    const selectedDestinataire = allOptions.destinataires?.find(d => d.value.nomBoite === e.target.value);
                                    handleFieldChange(index, 'destinataire', selectedDestinataire || null);
                                  }}
                                  enableText={true}
                                  stylePrimary={true}
                                />
                              </div>
                              <div className={inputClasses}>
                                <div className="flex items-center gap-2 ml-[40px]">
                                  <div className="text-gray-500 text-sm">Mail pour le</div>
                                  <select
                                    value={selectedFields.destinataireMail}
                                    onChange={(e) => handleFieldChange(index, 'destinataireMail', e.target.value)}
                                    className="text-sm text-gray-600 bg-transparent border-0 focus:outline-none focus:ring-0"
                                  >
                                    <option value="transporteur">Transporteur</option>
                                    <option value="destinataire">Destinataire</option>
                                    <option value="negociant">Négociant</option>
                                    <option value="courtier">Courtier</option>
                                    <option value="ecoorganisme">Ecoorganisme</option>
                                  </select>
                                </div>
                              </div>
                            </div>

                            {/* Deuxième ligne : Négociant, Courtier, Eco Organisme */}
                            <div className="flex flex-wrap gap-4">
                              <div className={inputClasses}>
                                <InputFull
                                  name="negociant"
                                  titre="Négociant"
                                  placeholder="Négociant"
                                  options={{
                                    filteredOptions: allOptions.negociants?.map(nego => nego.value.nomBoite || '') || [],
                                    allOptions: []
                                  }}
                                  value={selectedFields.negociant?.value?.nomBoite || ''}
                                  onChange={(e) => {
                                    const selectedNegociant = allOptions.negociants?.find(nego => nego.value.nomBoite === e.target.value);
                                    handleFieldChange(index, 'negociant', selectedNegociant || null);
                                  }}
                                  enableText={true}
                                  stylePrimary={true}
                                />
                              </div>
                              <div className={inputClasses}>
                                <InputFull
                                  name="courtier"
                                  titre="Courtier"
                                  placeholder="Courtier"
                                  options={{
                                    filteredOptions: allOptions.courtiers?.map(court => court.value.nomBoite || '') || [],
                                    allOptions: []
                                  }}
                                  value={selectedFields.courtier?.value?.nomBoite || ''}
                                  onChange={(e) => {
                                    const selectedCourtier = allOptions.courtiers?.find(court => court.value.nomBoite === e.target.value);
                                    handleFieldChange(index, 'courtier', selectedCourtier || null);
                                  }}
                                  enableText={true}
                                  stylePrimary={true}
                                />
                              </div>
                              <div className={inputClasses}>
                                <InputFull
                                  name="ecoorganisme"
                                  titre="Ecoorganisme"
                                  placeholder="Ecoorganisme"
                                  options={{
                                    filteredOptions: allOptions.ecoorganismes?.map(eco => eco.value.nomBoite || '') || [],
                                    allOptions: []
                                  }}
                                  value={selectedFields.ecoorganisme?.value?.nomBoite || ''}
                                  onChange={(e) => {
                                    const selectedEcoorganisme = allOptions.ecoorganismes?.find(eco => eco.value.nomBoite === e.target.value);
                                    handleFieldChange(index, 'ecoorganisme', selectedEcoorganisme || null);
                                  }}
                                  enableText={true}
                                  stylePrimary={true}
                                />
                              </div>
                            </div>

                            {/* Troisième ligne : Contrat, Code de traitement */}
                            <div className="flex flex-wrap gap-4">
                              <div className={inputClasses}>
                                <InputFull
                                  name="contrat"
                                  titre="Contrat"
                                  placeholder="Contrat"
                                  options={{
                                    filteredOptions: allOptions.contrats?.map(contrat => contrat.value.nom || '') || [],
                                    allOptions: []
                                  }}
                                  value={selectedFields.contrat?.value?.nom || ''}
                                  onChange={(e) => {
                                    const selectedContrat = allOptions.contrats?.find(contrat => contrat.value.nom === e.target.value);
                                    handleFieldChange(index, 'contrat', selectedContrat || null);
                                  }}
                                  enableText={true}
                                  stylePrimary={true}
                                />
                              </div>
                              <div className={inputClasses}>
                                <InputFull
                                  name="codeTraitement"
                                  titre="Code traitement"
                                  placeholder="Code de traitement"
                                  options={{
                                    filteredOptions: allOptions.codeTraitements?.map(code => `${code.value.code} - ${code.value.nom}` || '') || [],
                                    allOptions: []
                                  }}
                                  value={selectedFields.codeTraitement?.value?.code || ''}
                                  onChange={(e) => {
                                    const selectedCodeTraitement = allOptions.codeTraitements?.find(code => `${code.value.code} - ${code.value.nom}` === e.target.value);
                                    handleFieldChange(index, 'codeTraitement', selectedCodeTraitement || null);
                                  }}
                                  enableText={true}
                                  stylePrimary={true}
                                />
                              </div>
                              <div className="flex items-center gap-2 ml-8">
                                <div className="text-gray-500 text-sm">Mentionner le {selectedFields.destinataireMail === 'transporteur' ? 'destinataire' : 'transporteur'}</div>
                                <input
                                  type="checkbox"
                                  checked={selectedFields.mention?.toMentionned || selectedFields.destinataire?.value?.mention || false}
                                  onChange={(e) => {
                                    const mention = {
                                      toMentionned: e.target.checked,
                                      mentionType: selectedFields.destinataireMail === 'transporteur' ? 'recipient' : 'transporteur',
                                      mentionCompany: selectedFields.destinataire?.value?.nomBoite || '',
                                      mentionAddress: selectedFields.destinataire?.value?.adresse || ''
                                    };
                                    handleFieldChange(index, 'mention', mention);
                                  }}
                                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Bouton Ajouter une ligne */}
            <div className="flex justify-center mt-3">
              <button
                type="button"
                onClick={handleAddNewLine}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--green-medium)] rounded-md hover:bg-[var(--green-dark)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--green-medium)] transition-colors duration-200 mb-2"
              >
                Ajouter une ligne
              </button>
            </div>


            <MailsPartComponent 
              ref={mailsPartRef}
              aggregatedMailRecipients={aggregateByMailRecipient(selectedFieldsList)} 
            />

            {/* Boutons d'action */}
            <div className="flex flex-col md:flex-row justify-end gap-4 mt-4 mb-4 mx-2 md:mr-4">
              <button
                type="button"
                onClick={() => setDisplayThis(false)}
                className="w-full md:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-200"
              >
                Annuler
              </button>
              <div className="relative group">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !areAllMailsPresent()}
                  className={`w-full md:w-auto px-4 py-2 text-sm font-medium text-white bg-[var(--green-medium)] rounded-md hover:bg-[var(--green-dark)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--green-medium)] transition-colors duration-200 ${(isSubmitting || !areAllMailsPresent()) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Envoi en cours...
                    </div>
                  ) : (
                    'Envoyer'
                  )}
                </button>
                {!areAllMailsPresent() && (
                  <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                    Veuillez remplir tous les champs de mail requis
                    <div className="absolute top-1/2 -translate-y-1/2 -right-2 border-4 border-transparent border-l-gray-900"></div>
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>

      <PhotoCaptureModal
        isOpen={photoModalOpen}
        onClose={() => {
          setPhotoModalOpen(false);
          setCurrentPhotoIndex(null);
        }}
        onCapture={handlePhotoCapture}
      />
    </div>
  );
};

export default Formulaire;
