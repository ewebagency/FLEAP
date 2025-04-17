/*import React from 'react';
import { useAutocompletion } from './useAutocompletion';
import { useSession } from "@/app/component/SessionProvider";
import InputFull from "../RegisterComponents/Modal/FormulaireFull/InputFull";
import InputMobile from "../RegisterComponents/Modal/FormulaireFull/InputMobile";
import BoxIcon from "@/app/component/BoxIconWrapper";
import { toast } from "react-hot-toast";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

interface FormulaireProps {
  setDisplayThis: (display: boolean) => void;
}

const Formulaire: React.FC<FormulaireProps> = ({ setDisplayThis }) => {
  const { entreprise_id } = useSession();
  const { allOptions, selectedFields, handleFieldChange } = useAutocompletion(entreprise_id);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Effet pour auto-compléter le point de collecte quand il n'y en a qu'un seul
  React.useEffect(() => {
    if (selectedFields.site?.value?.pointsCollecte?.length === 1) {
      handleFieldChange('site', selectedFields.site);
    }
  }, [selectedFields.site, handleFieldChange]);

  const inputClasses = "w-[300px]";
  const sectionClasses = "w-[98%] md:w-[95%] pb-4 border-b border-3 mt-2 mx-auto border-gray-300";

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
            {/* Section Point de départ et Contact 
            <div className="text-sm font-semibold ml-2 md:ml-6 mt-2">Point de départ et Contact</div>
            <div className={sectionClasses}>
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
                        value={selectedFields.site?.value?.nom || ''}
                        onChange={(e) => {
                          const selectedSite = allOptions.sites.find(site => site.value.nom === e.target.value);
                          handleFieldChange('site', selectedSite || null);
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
                          filteredOptions: selectedFields.site?.value?.pointsCollecte?.map(point => point.nom) || [],
                          allOptions: []
                        }}
                        value={selectedFields.pointCollecte?.nom || ''}
                        onChange={(e) => {
                          const selectedPoint = selectedFields.site?.value?.pointsCollecte?.find(p => p.nom === e.target.value);
                          handleFieldChange('site', selectedPoint || null);
                        }}
                        enableText={selectedFields.site?.value?.pointsCollecte?.length === 1}
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
                        value={selectedFields.contactEmetteur?.[0]?.value?.prenomNom || ''}
                        onChange={(e) => {
                          const selectedContact = allOptions.contacts?.find(c => c.value.prenomNom === e.target.value);
                          if (selectedContact) {
                            const newContacts = selectedFields.contactEmetteur || [];
                            if (!newContacts.some(c => c.table_id === selectedContact.table_id)) {
                              handleFieldChange('contactEmetteur', [...newContacts, selectedContact]);
                            }
                          }
                        }}
                        enableText={true}
                        stylePrimary={true}
                        onMobile={true}
                      />
                      {selectedFields.contactEmetteur && selectedFields.contactEmetteur.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {selectedFields.contactEmetteur.map((contact, index) => (
                            <div key={contact.table_id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                              <span className="text-sm">{contact.value.prenomNom}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newContacts = selectedFields.contactEmetteur?.filter(c => c.table_id !== contact.table_id) || [];
                                  handleFieldChange('contactEmetteur', newContacts.length > 0 ? newContacts : null);
                                }}
                                className="text-red-500 hover:text-red-700"
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
                        value={selectedFields.site?.value?.nom || ''}
                        onChange={(e) => {
                          const selectedSite = allOptions.sites.find(site => site.value.nom === e.target.value);
                          handleFieldChange('site', selectedSite || null);
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
                          filteredOptions: selectedFields.site?.value?.pointsCollecte?.map(point => point.nom) || [],
                          allOptions: []
                        }}
                        value={selectedFields.pointCollecte?.nom || ''}
                        onChange={(e) => {
                          const selectedPoint = selectedFields.site?.value?.pointsCollecte?.find(p => p.nom === e.target.value);
                          handleFieldChange('pointCollecte', selectedPoint || null);
                        }}
                        enableText={selectedFields.site?.value?.pointsCollecte?.length === 1}
                        stylePrimary={true}
                      />
                    </div>
                    <div className={inputClasses}>
                      <InputFull
                        name="contactEmetteur"
                        titre="Contact émetteur"
                        placeholder="Sélectionner un contact"
                        options={{
                          filteredOptions: allOptions.contacts?.map(contact => contact.value.prenomNom || '') || [],
                          allOptions: []
                        }}
                        value={selectedFields.contactEmetteur?.[0]?.value?.prenomNom || ''}
                        onChange={(e) => {
                          const selectedContact = allOptions.contacts?.find(c => c.value.prenomNom === e.target.value);
                          if (selectedContact) {
                            const newContacts = selectedFields.contactEmetteur || [];
                            if (!newContacts.some(c => c.table_id === selectedContact.table_id)) {
                              handleFieldChange('contactEmetteur', [...newContacts, selectedContact]);
                            }
                          }
                        }}
                        enableText={true}
                        stylePrimary={true}
                      />
                      {selectedFields.contactEmetteur && selectedFields.contactEmetteur.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {selectedFields.contactEmetteur.map((contact, index) => (
                            <div key={contact.table_id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                              <span className="text-sm">{contact.value.prenomNom}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newContacts = selectedFields.contactEmetteur?.filter(c => c.table_id !== contact.table_id) || [];
                                  handleFieldChange('contactEmetteur', newContacts.length > 0 ? newContacts : null);
                                }}
                                className="text-red-500 hover:text-red-700"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Section Déchets et Date 
            <div className="text-sm font-semibold ml-2 md:ml-6 mt-2">Déchets et Date</div>
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
                          handleFieldChange('dechet', selectedDechet || null);
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
                        handleFieldChange('contenant', selectedContenant || null);
                      }}
                        enableText={true}
                        stylePrimary={true}
                        onMobile={true}
                      />
                    </div>
                    <div className={inputClasses}>
                      <DatePicker
                        selected={selectedFields.date || null}
                        onChange={(date) => handleFieldChange('date', date)}
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
                          handleFieldChange('dechet', selectedDechet || null);
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
                          handleFieldChange('contenant', selectedContenant || null);
                        }}
                        enableText={true}
                        stylePrimary={true}
                      />
                    </div>
                    <div className={inputClasses}>
                      <DatePicker
                        selected={selectedFields.date || null}
                        onChange={(date) => handleFieldChange('date', date)}
                        className="w-full p-2 border rounded-md"
                        placeholderText="Sélectionner une date"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Section Transport 
            <div className="text-sm font-semibold ml-2 md:ml-6 mt-2">Transport</div>
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
                          handleFieldChange('transporteur', selectedTransporteur || null);
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
                          handleFieldChange('destinataire', selectedDestinataire || null);
                        }}
                        enableText={true}
                        stylePrimary={true}
                        onMobile={true}
                      />
                    </div>
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
                          handleFieldChange('transporteur', selectedTransporteur || null);
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
                          handleFieldChange('destinataire', selectedDestinataire || null);
                        }}
                        enableText={true}
                        stylePrimary={true}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Boutons d'action
            <div className="flex flex-col md:flex-row justify-end gap-4 mt-6 mb-4 mx-2 md:mr-4">
              <button
                type="button"
                onClick={() => setDisplayThis(false)}
                className="w-full md:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.success('Formulaire soumis avec succès');
                  setDisplayThis(false);
                }}
                className="w-full md:w-auto px-4 py-2 text-sm font-medium text-white bg-[var(--green-medium)] rounded-md hover:bg-[var(--green-dark)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--green-medium)]"
              >
                Envoyer
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Formulaire;
*/