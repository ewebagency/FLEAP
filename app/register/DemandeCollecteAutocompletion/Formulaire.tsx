import React, { useRef, useState, useEffect } from 'react';
import { useAutocompletion } from './useAutocompletion';
import { useSession } from "@/app/component/SessionProvider";
import InputFull from "../RegisterComponents/Modal/FormulaireFull/InputFull";
import InputMobile from "../RegisterComponents/Modal/FormulaireFull/InputMobile";
import BoxIcon from "@/app/component/BoxIconWrapper";
import { toast } from "react-hot-toast";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { aggregateByMailRecipient, createLines } from './utils';
import MailsPartComponent, { MailsPartComponentRef } from './MailsPartComponent';
import { BSD } from '@/app/register/TableBSD';
import { useBSDs } from '@/app/register/BSDsProvider';
import { supabase } from '@/app/database/supabaseClient';

interface FormulaireProps {
  setDisplayThis: (display: boolean) => void;
}

const Formulaire: React.FC<FormulaireProps> = ({ setDisplayThis }) => {
  const { entreprise_id, user_id, entreprise_name } = useSession();
  const [isMobile, setIsMobile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [siteAccess, setSiteAccess] = useState<string[]>([]);
  const { allOptions, selectedFieldsList, handleFieldChange, addNewLine, removeLine } = useAutocompletion(entreprise_id, siteAccess);
  const mailsPartRef = useRef<MailsPartComponentRef>(null);
  const { setAllBSDs, setAllFilteredBSDs, setDisplayedBSDs } = useBSDs();

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-hidden">
      <div className="bg-white rounded-lg shadow-lg w-[95%] md:w-[80%] max-w-8xl h-[90vh] flex flex-col touch-none overflow-x-hidden">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-4 border-b">
          <h3 className="font-bold text-lg ml-0 md:ml-8 flex items-center gap-2">
            <BoxIcon className="mb-1" name='truck' type='solid' />
            <span className="text-green-medium mt-1 font-bold">
              Demande de collecte avec Autocompletion
            </span>
          </h3>
        </div>
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4">
          <form className="w-full max-w-full">
            {/* Section Point de départ et Contact (en-tête) */}
            <div className="text-sm font-semibold ml-2 md:ml-6 mt-2 text-gray-700">Point de départ et Contact</div>
            <div className="bg-white rounded-lg p-3 mb-4 shadow-sm">
              <div className="flex flex-wrap gap-4">
                {isMobile ? (
                  <>
                    <div className={inputClasses}>
                      <InputMobile
                        name="site"
                        titre="Site"
                        placeholder="Sélectionner un site"
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
                    <div className={inputClasses}>
                      <InputMobile
                        name="pointCollecte"
                        titre="Point de collecte"
                        placeholder="Sélectionner un point de collecte"
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
                    <div className={inputClasses}>
                      <InputMobile
                        name="contactEmetteur"
                        titre="Contact émetteur"
                        placeholder="Sélectionner un contact"
                        options={{
                          filteredOptions: allOptions.contacts?.map(contact => contact.value.prenomNom || '') || [],
                          allOptions: []
                        }}
                        value={selectedFieldsList[0]?.contactEmetteur?.[0]?.value?.prenomNom || ''}
                        onChange={(e) => {
                          const selectedContact = allOptions.contacts?.find(c => c.value.prenomNom === e.target.value);
                          if (selectedContact) {
                            const newContacts = selectedFieldsList[0]?.contactEmetteur || [];
                            if (!newContacts.some(c => c.table_id === selectedContact.table_id)) {
                              handleFieldChange(0, 'contactEmetteur', [...newContacts, selectedContact]);
                            }
                          }
                        }}
                        enableText={true}
                        stylePrimary={true}
                        onMobile={true}
                      />
                      {selectedFieldsList[0]?.contactEmetteur && selectedFieldsList[0].contactEmetteur.length > 0 && (
                        <div className="mt-2 flex flex-row flex-nowrap overflow-x-auto gap-2">
                          {selectedFieldsList[0].contactEmetteur.map((contact) => (
                            <div key={contact.table_id} className="flex-shrink-0 flex items-center justify-between bg-gray-50 p-2 rounded w-[150px]">
                              <span className="text-sm truncate">{contact.value.prenomNom}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newContacts = selectedFieldsList[0]?.contactEmetteur?.filter(c => c.table_id !== contact.table_id) || [];
                                  handleFieldChange(0, 'contactEmetteur', newContacts.length > 0 ? newContacts : null);
                                }}
                                className="text-red-500 hover:text-red-700 ml-2"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className={inputClasses}>
                      <InputFull
                        name="site"
                        titre="Site"
                        placeholder="Sélectionner un site"
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
                    <div className={inputClasses}>
                      <InputFull
                        name="pointCollecte"
                        titre="Point de collecte"
                        placeholder="Sélectionner un point de collecte"
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
                    <div className="w-[800px]">
                    <div className="flex flex-row justify-between items-center">
                      <InputFull
                        name="contactEmetteur"
                        titre="Contact émetteur"
                        placeholder="Sélectionner un contact"
                        options={{
                          filteredOptions: allOptions.contacts?.map(contact => contact.value.prenomNom || '') || [],
                          allOptions: []
                        }}
                        value={selectedFieldsList[0]?.contactEmetteur?.[0]?.value?.prenomNom || ''}
                        onChange={(e) => {
                          const selectedContact = allOptions.contacts?.find(c => c.value.prenomNom === e.target.value);
                          if (selectedContact) {
                            const newContacts = selectedFieldsList[0]?.contactEmetteur || [];
                            if (!newContacts.some(c => c.table_id === selectedContact.table_id)) {
                              handleFieldChange(0, 'contactEmetteur', [...newContacts, selectedContact]);
                            }
                          }
                        }}
                        enableText={true}
                        stylePrimary={true}
                      />
                      {selectedFieldsList[0]?.contactEmetteur && selectedFieldsList[0].contactEmetteur.length > 0 && (
                        <div className="mt-2 flex flex-row flex-wrap overflow-x-auto gap-2">
                          {selectedFieldsList[0].contactEmetteur.map((contact) => (
                            <div key={contact.table_id} className="flex-shrink-0 flex items-center justify-between bg-gray-50 p-2 rounded w-[150px]">
                              <span className="text-sm truncate">{contact.value.prenomNom}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newContacts = selectedFieldsList[0]?.contactEmetteur?.filter(c => c.table_id !== contact.table_id) || [];
                                  handleFieldChange(0, 'contactEmetteur', newContacts.length > 0 ? newContacts : null);
                                }}
                                className="text-red-500 hover:text-red-700 ml-2"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Liste des lignes de déchets et transport */}
            {selectedFieldsList.map((selectedFields, index) => (
              <div key={index} className={lineClasses}>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-semibold text-gray-700">Ligne {index + 1}</h4>
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Supprimer
                    </button>
                  )}
                </div>

                {/* Section Déchets et Date */}
                <div className={sectionClasses}>
                  <div className="flex flex-wrap gap-4">
                    {isMobile ? (
                      <>
                        <div className={inputClasses}>
                          <InputMobile
                            name="dechet"
                            titre="Déchet"
                            placeholder="Sélectionner un déchet"
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
                        <div className={inputClasses}>
                          <InputMobile
                            name="contenant"
                            titre="Contenant"
                            placeholder="Sélectionner un contenant"
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
                          <div className="flex items-center justify-center gap-0">
                            <button
                              type="button"
                              onClick={() => {
                                const currentNumber = selectedFields.nombreContenant || 1;
                                if (currentNumber > 1) {
                                  handleFieldChange(index, 'nombreContenant', currentNumber - 1);
                                }
                              }}
                              className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300 transition-colors"
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
                              className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300 transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className={inputClasses}>
                          <DatePicker
                            selected={selectedFields.date || null}
                            onChange={(date) => handleFieldChange(index, 'date', date)}
                            className="w-full p-2 border rounded-md"
                            placeholderText="Sélectionner une date"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={inputClasses}>
                          <InputFull
                            name="dechet"
                            titre="Déchet"
                            placeholder="Sélectionner un déchet"
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
                        <div className={inputClasses}>
                          <InputFull
                            name="contenant"
                            titre="Contenant"
                            placeholder="Sélectionner un contenant"
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
                        <div className="flex items-center justify-center gap-0 mr-4">
                            <button
                              type="button"
                              onClick={() => {
                                const currentNumber = selectedFields.nombreContenant || 1;
                                if (currentNumber > 1) {
                                  handleFieldChange(index, 'nombreContenant', currentNumber - 1);
                                }
                              }}
                              className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300 transition-colors"
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
                              className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300 transition-colors"
                            >
                              +
                            </button>
                          </div>                        
                        <div className={inputClasses}>
                          <DatePicker
                            selected={selectedFields.date || null}
                            onChange={(date) => handleFieldChange(index, 'date', date)}
                            className="w-full p-2 border rounded-md"
                            placeholderText="Sélectionner une date"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Section Transport */}
                <div className={sectionClasses}>
                  <div className="flex flex-wrap gap-4">
                    {isMobile ? (
                      <>
                        <div className={inputClasses}>
                          <InputMobile
                            name="transporteur"
                            titre="Transporteur"
                            placeholder="Sélectionner un transporteur"
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
                            titre="Destinataire"
                            placeholder="Sélectionner un destinataire"
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
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => handleFieldChange(index, 'showNegociant', !selectedFields.showNegociant)}
                            className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
                          >
                            <span>{selectedFields.showNegociant ? 'Masquer' : 'Afficher +'}</span>
                            <BoxIcon name={selectedFields.showNegociant ? 'chevron-up' : 'chevron-down'} type="solid" size="xs" />
                          </button>
                          <select
                            value={selectedFields.destinataireMail}
                            onChange={(e) => handleFieldChange(index, 'destinataireMail', e.target.value)}
                            className="text-sm text-gray-600 bg-transparent border-0 focus:outline-none focus:ring-0"
                          >
                            <option value="transporteur">Transporteur</option>
                            <option value="destinataire">Destinataire</option>
                            <option value="negociant">Négociant</option>
                            <option value="courtier">Courtier</option>
                          </select>
                          <select
                            value={selectedFields.typePrestation}
                            onChange={(e) => handleFieldChange(index, 'typePrestation', e.target.value)}
                            className="text-sm text-gray-600 bg-transparent border-0 focus:outline-none focus:ring-0"
                          >
                            <option value="enlevement">Enlèvement de déchets</option>
                            <option value="camion_journee">Camion à la journée</option>
                            <option value="camion_demie">Camion à la demi-journée</option>
                            <option value="livraison">Livraison de contenants vides</option>
                          </select>
                        </div>
                        {selectedFields.showNegociant && (
                          <>
                            <div className={inputClasses}>
                              <InputMobile
                                name="negociant"
                                titre="Négociant"
                                placeholder="Sélectionner un négociant"
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
                                placeholder="Sélectionner un courtier"
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
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <div className={inputClasses}>
                          <InputFull
                            name="transporteur"
                            titre="Transporteur"
                            placeholder="Sélectionner un transporteur"
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
                            placeholder="Sélectionner un destinataire"
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
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => handleFieldChange(index, 'showNegociant', !selectedFields.showNegociant)}
                            className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
                          >
                            <span>{selectedFields.showNegociant ? 'Masquer' : 'Afficher +'}</span>
                            <BoxIcon name={selectedFields.showNegociant ? 'chevron-up' : 'chevron-down'} type="solid" size="xs" />
                          </button>
                          <select
                            value={selectedFields.destinataireMail}
                            onChange={(e) => handleFieldChange(index, 'destinataireMail', e.target.value)}
                            className="text-sm text-gray-600 bg-transparent border-0 focus:outline-none focus:ring-0"
                          >
                            <option value="transporteur">Transporteur</option>
                            <option value="destinataire">Destinataire</option>
                            <option value="negociant">Négociant</option>
                            <option value="courtier">Courtier</option>
                          </select>
                          <select
                            value={selectedFields.typePrestation}
                            onChange={(e) => handleFieldChange(index, 'typePrestation', e.target.value)}
                            className="text-sm text-gray-600 bg-transparent border-0 focus:outline-none focus:ring-0"
                          >
                            <option value="enlevement">Enlèvement de déchets</option>
                            <option value="camion_journee">Camion à la journée</option>
                            <option value="camion_demie">Camion à la demi-journée</option>
                            <option value="livraison">Livraison de contenants vides</option>
                          </select>
                        </div>
                        {selectedFields.showNegociant && (
                          <>
                            <div className={inputClasses}>
                              <InputFull
                                name="negociant"
                                titre="Négociant"
                                placeholder="Sélectionner un négociant"
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
                                placeholder="Sélectionner un courtier"
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
                onClick={addNewLine}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--green-medium)] rounded-md hover:bg-[var(--green-dark)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--green-medium)] transition-colors duration-200"
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
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`w-full md:w-auto px-4 py-2 text-sm font-medium text-white bg-[var(--green-medium)] rounded-md hover:bg-[var(--green-dark)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--green-medium)] transition-colors duration-200 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
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
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Formulaire;
