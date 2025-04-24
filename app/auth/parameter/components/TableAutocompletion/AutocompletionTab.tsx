/*'use client';

import React, { useState, useEffect } from 'react';
import EntityForm from './EntityForm';
import { supabase } from '@/app/database/supabaseClient';
import { useSession } from '@/app/component/SessionProvider';
import LinkComponents from './LinkComponents';
import {
  Site,
  Transporteur,
  Dechet,
  Destinataire,
  Contenant,
  Negociant,
  Courtier,
  Ecorganisme,
  CodeTreatment,
  TransportLink,
  DestLink,
  NegociantLink,
  CourtierLink,
  ContenantLink,
  CodeTreatmentLink,
  EcorganismeLink,
  Contrat,
  ContratLink
} from './types';
import {
  handleTransportLink,
  handleDestLink,
  handleContenantLink,
  handleNegociantLink,
  handleCourtierLink,
  handleEcorganismeLink,
  handleCodeTreatmentLink,
  handleContratLink
} from './LinkHandlers';
import { fetchAutocompletionData } from './utils';
import { siteAttributes, transporteurAttributes, dechetAttributes, destinataireAttributes, contenantAttributes, negociantAttributes, courtierAttributes, ecoOrganismeAttributes, codeTraitementAttributes, codeTraitementOptions, contratAttributes } from './definitions';

interface AutocompletionRecord {
  id: string;
  transport_link?: TransportLink[];
  dest_link?: DestLink[];
  contenant_link?: ContenantLink[];
}

const AutocompletionTab: React.FC = () => {
  
  //on va chercher allOptions
  const [sites, setSites] = useState<Site[]>([]);
  const [transporteurs, setTransporteurs] = useState<Transporteur[]>([]);
  const [dechets, setDechets] = useState<Dechet[]>([]);
  const [destinataires, setDestinataires] = useState<Destinataire[]>([]);
  const [contenants, setContenants] = useState<Contenant[]>([]);
  const [negociants, setNegociants] = useState<Negociant[]>([]);
  const [courtiers, setCourtiers] = useState<Courtier[]>([]);
  const [ecoorganismes, setEcoorganismes] = useState<Ecorganisme[]>([]);
  const [codeTreatments, setCodeTreatments] = useState<CodeTreatment[]>([]);
  const [contrats, setContrats] = useState<Contrat[]>([]);
  //on va chercher les liens
  const [transportLinks, setTransportLinks] = useState<TransportLink[]>([]);
  const [destLinks, setDestLinks] = useState<DestLink[]>([]);
  const [negociantLinks, setNegociantLinks] = useState<NegociantLink[]>([]);
  const [courtierLinks, setCourtierLinks] = useState<CourtierLink[]>([]);
  const [contenantLinks, setContenantLinks] = useState<ContenantLink[]>([]);
  const [codeTreatmentLinks, setCodeTreatmentLinks] = useState<CodeTreatmentLink[]>([]);
  const [ecoorganismeLinks, setEcoorganismeLinks] = useState<EcorganismeLink[]>([]);
  const [contratLinks, setContratLinks] = useState<ContratLink[]>([]);

  const [showNewForm, setShowNewForm] = useState<{ [key: string]: boolean }>({
    site: false,
    transporteur: false,
    dechet: false,
    destinataire: false,
    contenant: false,
    negociant: false,
    courtier: false,
    ecoOrganisme: false,
    codeTraitement: false,
    contrat: false
  });
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingItems, setEditingItems] = useState<Set<string>>(new Set());
  const {entreprise_id} = useSession();

  //on va chercher les données allOptions
  useEffect(() => {
    if (entreprise_id) {
      fetchAutocompletionData(Number(entreprise_id), setSites, setTransporteurs, setDechets, setDestinataires, setContenants, setNegociants, setCourtiers, setEcoorganismes, setCodeTreatments, setContrats, setTransportLinks, setDestLinks, setNegociantLinks, setCourtierLinks, setContenantLinks, setCodeTreatmentLinks, setEcoorganismeLinks, setContratLinks);
    }
  }, [entreprise_id]);

  // Ajout d'un état pour gérer l'onglet actif
  const [activeTab, setActiveTab] = useState<string>('sites');

  // Liste des onglets disponibles
  const tabs = [
    { id: 'sites', label: 'Sites' },
    { id: 'transporteurs', label: 'Transporteurs' },
    { id: 'dechets', label: 'Déchets' },
    { id: 'destinataires', label: 'Destinataires' },
    { id: 'contenants', label: 'Contenants' },
    { id: 'negociants', label: 'Négociants' },
    { id: 'courtiers', label: 'Courtiers' },
    { id: 'ecoOrganismes', label: 'Éco-organismes' },
    { id: 'codeTraitements', label: 'Codes de traitement' },
    { id: 'contrats', label: 'Contrats' }
  ];

  //-------------------------------- Fonctions utils --------------------------------
  
  //Fonction de toogle pour les items
  const toggleItem = (itemId: string, type: string) => {
    const uniqueId = `${type}-${itemId}`;
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(uniqueId)) {
        newSet.delete(uniqueId);
      } else {
        newSet.add(uniqueId);
      }
      return newSet;
    });
  };

  const isItemExpanded = (itemId: string, type: string) => {
    return expandedItems.has(`${type}-${itemId}`);
  };

  //Fonction d'édition pour les items
  const handleEdit = (itemId: string, type: string) => {
    const uniqueId = `${type}-${itemId}`;
    setEditingItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(uniqueId)) {
        newSet.delete(uniqueId);
      } else {
        newSet.add(uniqueId);
      }
      return newSet;
    });
  };

  const isItemEditing = (itemId: string, type: string) => {
    return editingItems.has(`${type}-${itemId}`);
  };

  //Fonction de changement pour les items -> différent de edit ?
  const handleFieldChange = (type: string, id: string, field: string, value: string | boolean) => {
    switch (type) {
      case 'Site':
        setSites(prev => prev.map(site => 
          site.id === id ? { ...site, [field]: value } : site
        ));
        break;
      case 'Transporteur':
        setTransporteurs(prev => prev.map(transporteur => 
          transporteur.id === id ? { ...transporteur, [field]: value } : transporteur
        ));
        break;
      case 'Dechet':
        setDechets(prev => prev.map(dechet => 
          dechet.id === id ? { ...dechet, [field]: value } : dechet
        ));
        break;
      case 'Destinataire':
        setDestinataires(prev => prev.map(destinataire => 
          destinataire.id === id ? { ...destinataire, [field]: value } : destinataire
        ));
        break;
      case 'Contenant':
        setContenants(prev => prev.map(contenant => 
          contenant.id === id ? { ...contenant, [field]: value } : contenant
        ));
        break;
      case 'Negociant':
        setNegociants(prev => prev.map(negociant => 
          negociant.id === id ? { ...negociant, [field]: value } : negociant
        ));
        break;
      case 'Courtier':
        setCourtiers(prev => prev.map(courtier => 
          courtier.id === id ? { ...courtier, [field]: value } : courtier
        ));
        break;
      case 'EcoOrganisme':
        setEcoorganismes((prev: Ecorganisme[]) => prev.map((ecoorganisme: Ecorganisme) => 
          ecoorganisme.id === id ? { ...ecoorganisme, [field]: value } : ecoorganisme
        ));
        break;
      case 'CodeTraitement':
        setCodeTreatments((prev: CodeTreatment[]) => prev.map((codeTreatment: CodeTreatment) => 
          codeTreatment.id === id ? { ...codeTreatment, [field]: value } : codeTreatment
        ));
        break;
      case 'Contrat':
        setContrats((prev: Contrat[]) => prev.map((contrat: Contrat) => 
          contrat.id === id ? { ...contrat, [field]: value } : contrat
        ));
        break;
    }
  };

  const handleSaveEdit = async (type: string, id: string) => {
    try {
      let dataToUpdate;
      switch (type) {
        case 'Site':
          dataToUpdate = sites.find(site => site.id === id);
          break;
        case 'Transporteur':
          dataToUpdate = transporteurs.find(transporteur => transporteur.id === id);
          break;
        case 'Dechet':
          dataToUpdate = dechets.find(dechet => dechet.id === id);
          break;
        case 'Destinataire':
          dataToUpdate = destinataires.find(destinataire => destinataire.id === id);
          break;
        case 'Contenant':
          dataToUpdate = contenants.find(contenant => contenant.id === id);
          break;
        case 'Negociant':
          dataToUpdate = negociants.find(negociant => negociant.id === id);
          break;
        case 'Courtier':
          dataToUpdate = courtiers.find(courtier => courtier.id === id);
          break;
        case 'EcoOrganisme':
          dataToUpdate = ecoorganismes.find(ecoorganisme => ecoorganisme.id === id);
          break;
        case 'CodeTraitement':
          dataToUpdate = codeTreatments.find(codeTreatment => codeTreatment.id === id);
          break;
        case 'Contrat':
          dataToUpdate = contrats.find(contrat => contrat.id === id);
          break;
      }

      if (!dataToUpdate) return;

      // Créer une copie des données sans l'ID
      const { id: _, ...dataWithoutId } = dataToUpdate;

      const getTableName = (type: string) => {
        switch (type.toLowerCase()) {
          case 'contactemetteur':
            return 'contact_emetteur';
          case 'ecoorganisme':
            return 'eco_organisme';
          case 'codetraitement':
            return 'code_traitement';
          default:
            return type.toLowerCase();
        }
      };

      const { error } = await supabase
        .from('table_autocompletion')
        .update({ [getTableName(type)]: dataWithoutId })
        .eq('id', id);

      if (error) {
        console.error('Error updating record:', error);
        return;
      }

      handleEdit(id, type);
    } catch (error) {
      console.error('Error in handleSaveEdit:', error);
    }
  };

  const handleDelete = async (type: string, id: string) => {
    try {
      // Mettre à jour l'état local
      switch (type) {
        case 'Site':
          setSites(prev => prev.filter(site => site.id !== id));
          // Supprimer les liens associés au site
          setTransportLinks(prev => prev.filter(link => link.site !== id));
          setDestLinks(prev => prev.filter(link => link.site !== id));
          setContenantLinks(prev => prev.filter(link => link.site !== id));
          break;
        case 'Transporteur':
          setTransporteurs(prev => prev.filter(transporteur => transporteur.id !== id));
          // Supprimer les liens associés au transporteur
          //setTransportLinks(prev => prev.filter(link => link.id !== id));
          break;
        case 'Dechet':
          setDechets(prev => prev.filter(dechet => dechet.id !== id));
          // Supprimer les liens associés au déchet
          setTransportLinks(prev => prev.filter(link => link.dechet !== id));
          setDestLinks(prev => prev.filter(link => link.dechet !== id));
          setContenantLinks(prev => prev.filter(link => link.dechet !== id));
          break;
        case 'Destinataire':
          setDestinataires(prev => prev.filter(destinataire => destinataire.id !== id));
          // Supprimer les liens associés au destinataire
          //setDestLinks(prev => prev.filter(link => link.id !== id));
          break;
        case 'Contenant':
          setContenants(prev => prev.filter(contenant => contenant.id !== id));
          // Supprimer les liens associés au contenant
          //setContenantLinks(prev => prev.filter(link => link.id !== id));
          break;
        case 'Negociant':
          setNegociants(prev => prev.filter(negociant => negociant.id !== id));
          // Supprimer les liens associés au négociant
          //setNegociantLinks(prev => prev.filter(link => link.id !== id));
          break;
        case 'Courtier':
          setCourtiers(prev => prev.filter(courtier => courtier.id !== id));
          // Supprimer les liens associés au courtier
          //setCourtierLinks(prev => prev.filter(link => link.id !== id));
          break;
        case 'EcoOrganisme':
          setEcoorganismes(prev => prev.filter(ecoorganisme => ecoorganisme.id !== id));
          break;
        case 'CodeTraitement':
          setCodeTreatments(prev => prev.filter(codeTreatment => codeTreatment.id !== id));
          break;
        case 'Contrat':
          setContrats(prev => prev.filter(contrat => contrat.id !== id));
          break;
      }

      // Mettre à jour Supabase avec le bon nom de colonne
      const columnName = type === 'EcoOrganisme' ? 'eco_organisme' : 
                        type === 'CodeTraitement' ? 'code_traitement' : 
                        type.toLowerCase();
      const { error: updateError } = await supabase
        .from('table_autocompletion')
        .update({ [columnName]: null })
        .eq('id', id);

      if (updateError) {
        console.error('Error updating record after deletion:', updateError);
        return;
      }

      // Mettre à jour les liens dans la base de données
      const { data: allRecords, error: fetchError } = await supabase
        .from('table_autocompletion')
        .select('*');

      if (fetchError) {
        console.error('Error fetching records for link cleanup:', fetchError);
        return;
      }

      // Mettre à jour chaque enregistrement pour supprimer les liens associés
      for (const record of allRecords) {
        const updates: Partial<AutocompletionRecord> = {};

        // Supprimer les liens de transport
        if (record.transport_link) {
          const updatedTransportLinks = record.transport_link.filter((link: TransportLink) => {
            if (type === 'Site' && link.site === id) return false;
            if (type === 'Dechet' && link.dechet === id) return false;
            if (type === 'Transporteur' && record.id === id) return false;
            return true;
          });
          if (updatedTransportLinks.length !== record.transport_link.length) {
            updates.transport_link = updatedTransportLinks;
          }
        }

        // Supprimer les liens de destination
        if (record.dest_link) {
          const updatedDestLinks = record.dest_link.filter((link: DestLink) => {
            if (type === 'Site' && link.site === id) return false;
            if (type === 'Dechet' && link.dechet === id) return false;
            if (type === 'Destinataire' && record.id === id) return false;
            return true;
          });
          if (updatedDestLinks.length !== record.dest_link.length) {
            updates.dest_link = updatedDestLinks;
          }
        }

        // Supprimer les liens de contenant
        if (record.contenant_link) {
          const updatedContenantLinks = record.contenant_link.filter((link: ContenantLink) => {
            if (type === 'Site' && link.site === id) return false;
            if (type === 'Dechet' && link.dechet === id) return false;
            if (type === 'Contenant' && record.id === id) return false;
            return true;
          });
          if (updatedContenantLinks.length !== record.contenant_link.length) {
            updates.contenant_link = updatedContenantLinks;
          }
        }

        // Mettre à jour l'enregistrement si des liens ont été supprimés
        if (Object.keys(updates).length > 0) {
          const { error: linkUpdateError } = await supabase
            .from('table_autocompletion')
            .update(updates)
            .eq('id', record.id);

          if (linkUpdateError) {
            console.error('Error updating links after deletion:', linkUpdateError);
          }
        }
      }
    } catch (error) {
      console.error('Error in handleDelete:', error);
    }
  };

  const handleSave = async (entityType: string, data: Record<string, unknown>) => {
    if (!entreprise_id) return;
    
    const getTableName = (type: string) => {
      switch (type.toLowerCase()) {
        case 'ecoorganisme':
          return 'eco_organisme';
        case 'codetraitement':
          return 'code_traitement';
        default:
          return type.toLowerCase();
      }
    };

    const insertData = {
      entreprise_id: entreprise_id,
      [getTableName(entityType)]: data,
    };

    const { data: insertedData, error: insertError } = await supabase
      .from('table_autocompletion')
      .insert([insertData])
      .select()
      .single();
    
    if (insertError) {
      console.error('Error inserting data:', insertError);
      return;
    }

    if (!insertedData) return;

    // Créer l'item avec l'ID de la table
    const baseItem = {
      id: insertedData.id.toString(),
    };
    
    switch (entityType) {
      case 'Site':
        const newSite: Site = {
          ...baseItem,
          nom: data.nom as string,
          siret: data.siret as string,
          adresseSiege: data.adresseSiege as string,
          pointsCollecte: data.pointsCollecte as CollectionPoint[],
          contacts: data.contacts as Contact[],
        };
        setSites(prev => [...prev, newSite]);
        break;
      case 'Transporteur':
        const newTransporteur: Transporteur = {
          ...baseItem,
          nomBoite: data.nomBoite as string,
          contact: data.contact as Transporteur['contact'],
          adresse: data.adresse as string,
        };
        setTransporteurs(prev => [...prev, newTransporteur]);
        break;
      case 'Dechet':
        const newDechet: Dechet = {
          ...baseItem,
          nom: data.nom as string,
          codeCED: data.codeCED as string,
          adr: data.adr as string,
        };
        setDechets(prev => [...prev, newDechet]);
        break;
      case 'Destinataire':
        const newDestinataire: Destinataire = {
          ...baseItem,
          nomBoite: data.nomBoite as string,
          contact: {
            email: data['contact.email'] as string,
            telephone: data['contact.telephone'] as string,
          },
          adresse: data.adresse as string,
        };
        setDestinataires(prev => [...prev, newDestinataire]);
        break;
      case 'Contenant':
        const newContenant: Contenant = {
          ...baseItem,
          nom: data.nom as string,
          volume: Number(data.volume),
          uniteVolume: data.uniteVolume as string,
        };
        setContenants(prev => [...prev, newContenant]);
        break;
      case 'Negociant':
        const newNegociant: Negociant = {
          ...baseItem,
          nomBoite: data.nomBoite as string,
          contact: data.contact as Negociant['contact'],
          adresse: data.adresse as string,
        };
        setNegociants(prev => [...prev, newNegociant]);
        break;
      case 'Courtier':
        const newCourtier: Courtier = {
          ...baseItem,
          nomBoite: data.nomBoite as string,
          contact: data.contact as Courtier['contact'],
          adresse: data.adresse as string,
        };
        setCourtiers(prev => [...prev, newCourtier]);
        break;
      case 'EcoOrganisme':
        const newEcoOrganisme: Ecorganisme = {
          ...baseItem,
          nomBoite: data.nomBoite as string,
          siret: data.siret as string,
          contact: {
            email: data['contact.email'] as string,
            telephone: data['contact.telephone'] as string,
          },
          adresse: data.adresse as string,
        };
        setEcoorganismes(prev => [...prev, newEcoOrganisme]);
        break;
      case 'CodeTraitement':
        const selectedOption = codeTraitementOptions.find(option => option.code === data.code);
        const newCodeTraitement: CodeTreatment = {
          ...baseItem,
          nom: selectedOption?.nom || '',
          code: data.code as string,
        };
        setCodeTreatments(prev => [...prev, newCodeTraitement]);
        break;
      case 'Contrat':
        const newContrat: Contrat = {
          ...baseItem,
          nom: data.nom as string,
          num_client: data.num_client as string,
          tarifs: data.tarifs as Contrat['tarifs'],
        };
        setContrats(prev => [...prev, newContrat]);
        break;
    }
    // Mettre à jour l'état showNewForm avec la bonne clé
    const getFormKey = (type: string) => {
      switch (type) {
        case 'EcoOrganisme':
          return 'ecoOrganisme';
        case 'CodeTraitement':
          return 'codeTraitement';
        default:
          return type.toLowerCase();
      }
    };
    
    setShowNewForm(prev => ({ ...prev, [getFormKey(entityType)]: false }));
  };

  //--------------------------------


  //Le component qui affiche une entité avec son toogle
  const renderEntityList = (
    entities: Site[] | Transporteur[] | Dechet[] | Destinataire[] | Contenant[] | Negociant[] | Courtier[] | Ecorganisme[] | CodeTreatment[] | Contrat[],
    type: string,
    mainField: string
  ) => {
    const getAttributeLabel = (field: string, type: string) => {
      let attributes;
      switch (type) {
        case 'Site':
          attributes = siteAttributes;
          break;
        case 'Transporteur':
          attributes = transporteurAttributes;
          break;
        case 'Dechet':
          attributes = dechetAttributes;
          break;
        case 'Destinataire':
          attributes = destinataireAttributes;
          break;
        case 'Contenant':
          attributes = contenantAttributes;
          break;
        case 'Negociant':
          attributes = negociantAttributes;
          break;
        case 'Courtier':
          attributes = courtierAttributes;
          break;
        case 'EcoOrganisme':
          attributes = ecoOrganismeAttributes;
          break;
        case 'CodeTraitement':
          attributes = codeTraitementAttributes;
          break;
        case 'Contrat':
          attributes = contratAttributes;
          break;
        default:
          return field;
      }

      // Vérifier dans les attributs secondaires
      const secondaryAttr = attributes.secondaryAttributes.find(attr => attr.name === field);
      if (secondaryAttr) return secondaryAttr.label;

      // Vérifier dans l'attribut principal
      if (attributes.mainAttribute.name === field) return attributes.mainAttribute.label;

      // Pour les champs de contact
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        const contactAttr = attributes.secondaryAttributes.find(attr => attr.name === parent);
        if (contactAttr && contactAttr.type === 'contact') {
          return child.charAt(0).toUpperCase() + child.slice(1);
        }
      }

      return field;
    };

    return (
      <div className="space-y-4">
        {entities.map((entity, index) => {
          const itemId = entity.id || `temp-${type}-${index}`;
          const uniqueId = `${type}-${itemId}`;
          const isEditing = isItemEditing(itemId, type);
          
          return (
            <div key={uniqueId} className="bg-white border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition-all shadow-sm hover:shadow-md">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 justify-between w-full">
                  <h3 className="text-sm font-semibold text-gray-800">{String(entity[mainField as keyof typeof entity])}</h3>
                  <button
                    onClick={() => toggleItem(itemId, type)}
                    className="text-gray-400 hover:text-gray-600 text-sm mr-6"
                  >
                    {isItemExpanded(itemId, type) ? '▼' : '▶'}
                  </button>
                </div>
              </div>
              {isItemExpanded(itemId, type) && (
                <div className="mt-4 space-y-2">
                  {Object.entries(entity).map(([key, value]) => {
                    if (key === 'id' || key === mainField) return null;
                    if (key === 'contact' && typeof value === 'object') {
                      return (
                        <div key={key} className="bg-gray-50 rounded-xl p-4">
                          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Contact</p>
                          <ul className="space-y-3">
                            {Object.entries(value).map(([contactKey, contactValue]) => (
                              <li key={contactKey} className="flex items-center gap-3">
                                <span className="text-[10px] font-medium text-gray-400 min-w-[80px]">
                                  {getAttributeLabel(`contact.${contactKey}`, type)}
                                </span>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={String(contactValue)}
                                    onChange={(e) => handleFieldChange(type, entity.id, contactKey, e.target.value)}
                                    className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm border border-gray-200 focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                                  />
                                ) : (
                                  <span className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm">{String(contactValue)}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    }
                    if (key === 'pointsCollecte' && Array.isArray(value) && type === 'Site') {
                      return (
                        <div key={key} className="bg-gray-50 rounded-xl p-4">
                          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Points de collecte</p>
                          <ul className="space-y-3">
                            {value.map((point, index) => (
                              <li key={index} className="flex items-center gap-3">
                                <span className="text-[10px] font-medium text-gray-400 min-w-[80px]">Point {index + 1}:</span>
                                <span className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm">{point.nom} - {point.adresse}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    }
                    if (key === 'contacts' && Array.isArray(value) && type === 'Site') {
                      return (
                        <div key={key} className="bg-gray-50 rounded-xl p-4">
                          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Contacts</p>
                          <ul className="space-y-3">
                            {value.map((contact, index) => (
                              <li key={index} className="flex flex-col gap-2">
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-medium text-gray-400 min-w-[80px]">Contact {index + 1}:</span>
                                  <div className="flex flex-row gap-2">
                                    <span className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm">{contact.nom}</span>
                                    <span className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm">{contact.email}</span>
                                    <span className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm">{contact.telephone}</span>
                                    {contact.respoTerrain && <span className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm">Terrain ✅</span>}
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    }
                    if (key === 'tarifs' && Array.isArray(value) && type === 'Contrat') {
                      return (
                        <div key={key} className="bg-gray-50 rounded-xl p-4 hidden">
                          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Tarifs</p>
                          <ul className="space-y-3">
                            {value.map((tarif, index) => (
                              <li key={index} className="flex flex-col gap-2">
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-medium text-gray-400 min-w-[80px]">Déchet:</span>
                                  <span className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm">{tarif.dechet}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-medium text-gray-400 min-w-[80px]">Code CED:</span>
                                  <span className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm">{tarif.code_ced}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-medium text-gray-400 min-w-[80px]">Coûts:</span>
                                  <span className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm">
                                    Traitement: {tarif.couts.traitement}€ | Location: {tarif.couts.location}€ | Transport: {tarif.couts.transport}€
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    }
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <span className="text-[10px] font-medium text-gray-400 min-w-[80px]">
                          {getAttributeLabel(key, type)}
                        </span>
                        {isEditing ? (
                          <input
                            type="text"
                            value={String(value)}
                            onChange={(e) => handleFieldChange(type, entity.id, key, e.target.value)}
                            className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm border border-gray-200 focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                          />
                        ) : (
                          <span className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm">{String(value)}</span>
                        )}
                      </div>
                    );
                  })}
                  <div className="flex justify-end gap-2 mt-4">
                    {entity.id && (
                      <>
                        <button
                          onClick={() => handleEdit(itemId, type)}
                          className="bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white px-3 py-1 rounded-lg text-xs font-medium shadow-sm hover:shadow-md transition-all"
                        >
                          {isEditing ? 'Annuler' : 'Modifier'}
                        </button>
                        {isEditing && (
                          <button
                            onClick={() => handleSaveEdit(type, entity.id)}
                            className="bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white px-3 py-1 rounded-lg text-xs font-medium shadow-sm hover:shadow-md transition-all"
                          >
                            Enregistrer
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(type, entity.id)}
                          className="text-white bg-red-500 rounded-full text-xl font-medium pb-1 w-5 h-5 text-center flex items-center justify-center hover:bg-red-600 transition-all"
                        >
                          -
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  //Chaque Carte d'entités
  return (
    <div className="flex flex-col gap-8">
      {/* Barre d'onglets 
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex space-x-2 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-[var(--green-medium)] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu des onglets 
      <div className="bg-white rounded-xl shadow-sm p-5">
        {activeTab === 'sites' && (
          <>
            {!showNewForm.site && (
              <div className="flex justify-between items-end mb-4">
                <p className="text-xl ml-2 font-semibold text-gray-800">Sites</p>
                <button
                  onClick={() => setShowNewForm(prev => ({ ...prev, site: true }))}
                  className="bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white px-4 py-1 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
                >
                  + Nouveau
                </button>
              </div>
            )}
            {showNewForm.site ? (
              <EntityForm
                title="Nouveau site"
                mainAttribute={siteAttributes.mainAttribute}
                secondaryAttributes={siteAttributes.secondaryAttributes}
                onSave={(data) => handleSave('Site', data)}
              />
            ) : (
              renderEntityList(sites, 'Site', 'nom')
            )}
          </>
        )}

        {activeTab === 'transporteurs' && (
          <>
            {!showNewForm.transporteur && (
              <div className="flex justify-between items-end mb-4">
                <p className="text-xl ml-2 font-semibold text-gray-800">Transporteurs</p>
                <button
                  onClick={() => setShowNewForm(prev => ({ ...prev, transporteur: true }))}
                  className="bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
                >
                  + Nouveau
                </button>
              </div>
            )}
            {showNewForm.transporteur ? (
              <EntityForm
                title="Nouveau transporteur"
                mainAttribute={transporteurAttributes.mainAttribute}
                secondaryAttributes={transporteurAttributes.secondaryAttributes}
                onSave={(data) => handleSave('Transporteur', data)}
              />
            ) : (
              renderEntityList(transporteurs, 'Transporteur', 'nomBoite')
            )}
          </>
        )}

        {activeTab === 'dechets' && (
          <>
            {!showNewForm.dechet && (
              <div className="flex justify-between items-end mb-4">
                <p className="text-xl ml-2 font-semibold text-gray-800">Déchets</p>
                <button
                  onClick={() => setShowNewForm(prev => ({ ...prev, dechet: true }))}
                  className="bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
                >
                  + Nouveau
                </button>
              </div>
            )}
            {showNewForm.dechet ? (
              <EntityForm
                title="Nouveau déchet"
                mainAttribute={dechetAttributes.mainAttribute}
                secondaryAttributes={dechetAttributes.secondaryAttributes}
                onSave={(data) => handleSave('Dechet', data)}
              />
            ) : (
              renderEntityList(dechets, 'Dechet', 'nom')
            )}
          </>
        )}

        {activeTab === 'destinataires' && (
          <>
            {!showNewForm.destinataire && (
              <div className="flex justify-between items-end mb-4">
                <p className="text-xl ml-2 font-semibold text-gray-800">Destinataires</p>
                <button
                  onClick={() => setShowNewForm(prev => ({ ...prev, destinataire: true }))}
                  className="bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
                >
                  + Nouveau
                </button>
              </div>
            )}
            {showNewForm.destinataire ? (
              <EntityForm
                title="Nouveau destinataire"
                mainAttribute={destinataireAttributes.mainAttribute}
                secondaryAttributes={destinataireAttributes.secondaryAttributes}
                onSave={(data) => handleSave('Destinataire', data)}
              />
            ) : (
              renderEntityList(destinataires, 'Destinataire', 'nomBoite')
            )}
          </>
        )}

        {activeTab === 'contenants' && (
          <>
            {!showNewForm.contenant && (
              <div className="flex justify-between items-end mb-4">
                <p className="text-xl ml-2 font-semibold text-gray-800">Contenants</p>
                <button
                  onClick={() => setShowNewForm(prev => ({ ...prev, contenant: true }))}
                  className="bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
                >
                  + Nouveau
                </button>
              </div>
            )}
            {showNewForm.contenant ? (
              <EntityForm
                title="Nouveau contenant"
                mainAttribute={contenantAttributes.mainAttribute}
                secondaryAttributes={contenantAttributes.secondaryAttributes}
                onSave={(data) => handleSave('Contenant', data)}
              />
            ) : (
              renderEntityList(contenants, 'Contenant', 'nom')
            )}
          </>
        )}

        {activeTab === 'negociants' && (
          <>
            {!showNewForm.negociant && (
              <div className="flex justify-between items-end mb-4">
                <p className="text-xl ml-2 font-semibold text-gray-800">Négociants</p>
                <button
                  onClick={() => setShowNewForm(prev => ({ ...prev, negociant: true }))}
                  className="bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
                >
                  + Nouveau
                </button>
              </div>
            )}
            {showNewForm.negociant ? (
              <EntityForm
                title="Nouveau négociant"
                mainAttribute={negociantAttributes.mainAttribute}
                secondaryAttributes={negociantAttributes.secondaryAttributes}
                onSave={(data) => handleSave('Negociant', data)}
              />
            ) : (
              renderEntityList(negociants, 'Negociant', 'nomBoite')
            )}
          </>
        )}

        {activeTab === 'courtiers' && (
          <>
            {!showNewForm.courtier && (
              <div className="flex justify-between items-end mb-4">
                <p className="text-xl ml-2 font-semibold text-gray-800">Courtiers</p>
                <button
                  onClick={() => setShowNewForm(prev => ({ ...prev, courtier: true }))}
                  className="bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
                >
                  + Nouveau
                </button>
              </div>
            )}
            {showNewForm.courtier ? (
              <EntityForm
                title="Nouveau courtier"
                mainAttribute={courtierAttributes.mainAttribute}
                secondaryAttributes={courtierAttributes.secondaryAttributes}
                onSave={(data) => handleSave('Courtier', data)}
              />
            ) : (
              renderEntityList(courtiers, 'Courtier', 'nomBoite')
            )}
          </>
        )}

        {activeTab === 'ecoOrganismes' && (
          <>
            {!showNewForm.ecoOrganisme && (
              <div className="flex justify-between items-end mb-4">
                <p className="text-xl ml-2 font-semibold text-gray-800">Éco-organismes</p>
                <button
                  onClick={() => setShowNewForm(prev => ({ ...prev, ecoOrganisme: true }))}
                  className="bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
                >
                  + Nouveau
                </button>
              </div>
            )}
            {showNewForm.ecoOrganisme ? (
              <EntityForm
                title="Nouvel éco-organisme"
                mainAttribute={ecoOrganismeAttributes.mainAttribute}
                secondaryAttributes={ecoOrganismeAttributes.secondaryAttributes}
                onSave={(data) => handleSave('EcoOrganisme', data)}
              />
            ) : (
              renderEntityList(ecoorganismes, 'EcoOrganisme', 'nomBoite')
            )}
          </>
        )}

        {activeTab === 'codeTraitements' && (
          <>
            {!showNewForm.codeTraitement && (
              <div className="flex justify-between items-end mb-4">
                <p className="text-xl ml-2 font-semibold text-gray-800">Codes de traitement</p>
                <button
                  onClick={() => setShowNewForm(prev => ({ ...prev, codeTraitement: true }))}
                  className="bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
                >
                  + Nouveau
                </button>
              </div>
            )}
            {showNewForm.codeTraitement ? (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Nouveau code de traitement</h3>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const code = formData.get('code') as string;
                  const selectedOption = codeTraitementOptions.find(option => option.code === code);
                  if (selectedOption) {
                    handleSave('CodeTraitement', { code, nom: selectedOption.nom });
                  }
                }} className="space-y-4">
                  <div className="w-full">
                    <label className="block text-md font-medium text-gray-500 mb-1">
                      Code de traitement
                    </label>
                    <select
                      name="code"
                      required
                      className="w-full px-2 py-1.5 text-md border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                    >
                      <option value="">Sélectionnez le code de traitement</option>
                      {codeTraitementOptions.map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.code} | {option.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end">
                    <button 
                      type="submit" 
                      className="bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
                    >
                      Enregistrer
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              renderEntityList(codeTreatments, 'CodeTraitement', 'nom')
            )}
          </>
        )}

        {activeTab === 'contrats' && (
          <>
            {!showNewForm.contrat && (
              <div className="flex justify-between items-end mb-4">
                <p className="text-xl ml-2 font-semibold text-gray-800">Contrats</p>
                <button
                  onClick={() => setShowNewForm(prev => ({ ...prev, contrat: true }))}
                  className="bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
                >
                  + Nouveau
                </button>
              </div>
            )}
            {showNewForm.contrat ? (
              <EntityForm
                title="Nouveau contrat"
                mainAttribute={contratAttributes.mainAttribute}
                secondaryAttributes={contratAttributes.secondaryAttributes}
                onSave={(data) => handleSave('Contrat', data)}
              />
            ) : (
              renderEntityList(contrats, 'Contrat', 'nom')
            )}
          </>
        )}
      </div>

      {/* Carte des liens 
      <div className="mt-8">
        <LinkComponents
          sites={sites}
          transporteurs={transporteurs}
          dechets={dechets}
          destinataires={destinataires}
          contenants={contenants}
          negociants={negociants}
          courtiers={courtiers}
          ecoorganismes={ecoorganismes}
          codeTreatments={codeTreatments}
          contrats={contrats}
          transportLinks={transportLinks}
          destLinks={destLinks}
          contenantLinks={contenantLinks}
          negociantLinks={negociantLinks}
          courtierLinks={courtierLinks}
          codeTreatmentLinks={codeTreatmentLinks}
          ecoorganismeLinks={ecoorganismeLinks}
          contratLinks={contratLinks}
          onTransportLink={(transportId, siteId, dechetId, isMailRecipient) => handleTransportLink(transportId, siteId, dechetId, isMailRecipient, setTransportLinks, transportLinks)}
          onDestLink={(destId, siteId, dechetId, isMailRecipient) => handleDestLink(destId, siteId, dechetId, isMailRecipient, setDestLinks, destLinks)}
          onContenantLink={(contenantId, siteId, dechetId) => handleContenantLink(contenantId, siteId, dechetId, setContenantLinks, contenantLinks)}
          onNegociantLink={(negociantId, siteId, dechetId, isMailRecipient) => handleNegociantLink(negociantId, siteId, dechetId, isMailRecipient, setNegociantLinks, negociantLinks)}
          onCourtierLink={(courtierId, siteId, dechetId, isMailRecipient) => handleCourtierLink(courtierId, siteId, dechetId, isMailRecipient, setCourtierLinks, courtierLinks)}
          onCodeTreatmentLink={(codeTreatmentId, siteId, dechetId) => handleCodeTreatmentLink(codeTreatmentId, siteId, dechetId, setCodeTreatmentLinks, codeTreatmentLinks)}
          onEcorganismeLink={(ecoorganismeId, siteId, dechetId, isMailRecipient) => handleEcorganismeLink(ecoorganismeId, siteId, dechetId, isMailRecipient, setEcoorganismeLinks, ecoorganismeLinks)}
          onContratLink={(contratId, siteId, dechetId, isMailRecipient) => handleContratLink(contratId, siteId, dechetId, setContratLinks, contratLinks)}
        />
      </div>
    </div>
  );
};

export default AutocompletionTab;
*/