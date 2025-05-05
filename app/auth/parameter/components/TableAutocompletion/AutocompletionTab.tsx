'use client';

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

  Contrat,
  BaseLink,
  CollectionPoint,
  Contact
} from './types';
import {
  handleTransportLink,
  handleDestLink,
  handleContenantLink,
  handleNegociantLink,
  handleCourtierLink,
  handleEcorganismeLink,
  handleCodeTreatmentLink,
  handleContratLink,
} from './LinkHandlers';
import { fetchAutocompletionData } from './utils';
import { siteAttributes, transporteurAttributes, dechetAttributes, destinataireAttributes, contenantAttributes, negociantAttributes, courtierAttributes, ecoorganismeAttributes, codeTraitementAttributes, codeTraitementOptions, contratAttributes } from './definitions';
import ImportEntityFromExcel from './ImportEntityFromExcel';
import { cofounders_user_id } from '@/app/component/SideBar';
import { code_ced_DICTIONNAIRE } from '@/app/component/CodeCED';
interface AutocompletionRecord {
  id: string;
  transport_link?: BaseLink[];
  dest_link?: BaseLink[];
  contenant_link?: BaseLink[];
  code_traitement_link?: BaseLink[];
  negociant_link?: BaseLink[];
  courtier_link?: BaseLink[];
  eco_organisme_link?: BaseLink[];
  contrat_link?: BaseLink[];
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
  const [filteredCedOptions, setFilteredCedOptions] = useState<Array<{ ced: string; nom: string; masse_volumique: number; icone: string }>>([]);
  //on va chercher les liens
  const [transportLinks, setTransportLinks] = useState<BaseLink[]>([]);
  const [destLinks, setDestLinks] = useState<BaseLink[]>([]);
  const [negociantLinks, setNegociantLinks] = useState<BaseLink[]>([]);
  const [courtierLinks, setCourtierLinks] = useState<BaseLink[]>([]);
  const [contenantLinks, setContenantLinks] = useState<BaseLink[]>([]);
  const [codeTreatmentLinks, setCodeTreatmentLinks] = useState<BaseLink[]>([]);
  const [ecoorganismeLinks, setEcoorganismeLinks] = useState<BaseLink[]>([]);
  const [contratLinks, setContratLinks] = useState<BaseLink[]>([]);

  const [showNewForm, setShowNewForm] = useState<{ [key: string]: boolean }>({
    site: false,
    transporteur: false,
    dechet: false,
    destinataire: false,
    contenant: false,
    negociant: false,
    courtier: false,
    ecoorganisme: false,
    codeTraitement: false,
    contrat: false
  });
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingItems, setEditingItems] = useState<Set<string>>(new Set());
  const {entreprise_id, user_id} = useSession();

  //on va chercher les données allOptions
  useEffect(() => {
    if (entreprise_id) {
      fetchAutocompletionData(Number(entreprise_id), setSites, setTransporteurs, setDechets, setDestinataires, setContenants, setNegociants, setCourtiers, setEcoorganismes, setCodeTreatments, setContrats, setTransportLinks, setDestLinks, setNegociantLinks, setCourtierLinks, setContenantLinks, setCodeTreatmentLinks, setEcoorganismeLinks, setContratLinks);
    }
  }, [entreprise_id]);

  // Ajout d'un état pour gérer l'onglet actif
  const [activeTab, setActiveTab] = useState<string>('sites');
  const [viewMode, setViewMode] = useState<'entities' | 'links'>('entities');

  // Liste des onglets disponibles
  const [showAllTabs, setShowAllTabs] = useState(false);

  const tabs = [
    { id: 'sites', label: 'Sites' },
    { id: 'transporteurs', label: 'Transporteurs' },
    { id: 'dechets', label: 'Déchets' },
    { id: 'destinataires', label: 'Destinataires' },
    { id: 'contenants', label: 'Contenants' },
    { id: 'codeTraitements', label: 'Codes de traitement' },
    ...(showAllTabs ? [
      { id: 'negociants', label: 'Négociants' },
      { id: 'courtiers', label: 'Courtiers' },
      { id: 'ecoorganismes', label: 'Éco-organismes' },
      { id: 'contrats', label: 'Contrats' }
    ] : [])
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
        setSites(prev => prev.map(site => {
          if (site.id !== id) return site;
          
          // Gestion des points de collecte
          if (field.startsWith('pointsCollecte.')) {
            const [_, index, prop] = field.split('.');
            const pointsCollecte = [...site.pointsCollecte];
            pointsCollecte[parseInt(index)] = {
              ...pointsCollecte[parseInt(index)],
              [prop]: value
            };
            return {
              ...site,
              pointsCollecte
            };
          }
          
          // Gestion des contacts multiples
          if (field.startsWith('contacts.')) {
            const [_, index, prop] = field.split('.');
            const contacts = [...site.contacts];
            contacts[parseInt(index)] = {
              ...contacts[parseInt(index)],
              [prop]: value
            };
            return {
              ...site,
              contacts
            };
          }
          
          // Gestion des champs simples
          return { ...site, [field]: value };
        }));
        break;
      case 'Transporteur':
        setTransporteurs(prev => prev.map(transporteur => 
          transporteur.id === id ? { ...transporteur, [field]: value } : transporteur
        ));
        break;
      case 'Dechet':
        setDechets(prev => prev.map(dechet => {
          if (dechet.id !== id) return dechet;
          if (field === 'masseVolumique') {
            return { ...dechet, [field]: Number(value) };
          }
          return { ...dechet, [field]: value };
        }));
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
      case 'Ecoorganisme':
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
        case 'Ecoorganisme':
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
        case 'Ecoorganisme':
          setEcoorganismes(prev => prev.filter(ecoorganisme => ecoorganisme.id !== id));
          break;
        case 'CodeTraitement':
          setCodeTreatments(prev => prev.filter(codeTreatment => codeTreatment.id !== id));
          break;
        case 'Contrat':
          setContrats(prev => prev.filter(contrat => contrat.id !== id));
          break;
      }

      // Supprimer complètement la ligne de la base de données
      const { error: deleteError } = await supabase
        .from('table_autocompletion')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Error deleting record:', deleteError);
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
          const updatedTransportLinks = record.transport_link.filter((link: BaseLink) => {
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
          const updatedDestLinks = record.dest_link.filter((link: BaseLink) => {
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
          const updatedContenantLinks = record.contenant_link.filter((link: BaseLink) => {
            if (type === 'Site' && link.site === id) return false;
            if (type === 'Dechet' && link.dechet === id) return false;
            if (type === 'Contenant' && record.id === id) return false;
            return true;
          });
          if (updatedContenantLinks.length !== record.contenant_link.length) {
            updates.contenant_link = updatedContenantLinks;
          }
        }

        // Supprimer les liens de code traitement
        if (record.code_traitement_link) {
          const updatedCodeTreatmentLinks = record.code_traitement_link.filter((link: BaseLink) => {
            if (type === 'Site' && link.site === id) return false;
            if (type === 'Dechet' && link.dechet === id) return false;
            if (type === 'CodeTraitement' && record.id === id) return false;
            return true;
          });
          if (updatedCodeTreatmentLinks.length !== record.code_traitement_link.length) {
            updates.code_traitement_link = updatedCodeTreatmentLinks;
          }
        }

        // Supprimer les liens de négociant
        if (record.negociant_link) {
          const updatedNegociantLinks = record.negociant_link.filter((link: BaseLink) => {
            if (type === 'Site' && link.site === id) return false;
            if (type === 'Dechet' && link.dechet === id) return false;
            if (type === 'Negociant' && record.id === id) return false; 
            return true;
          });
          if (updatedNegociantLinks.length !== record.negociant_link.length) {
            updates.negociant_link = updatedNegociantLinks;
          }
        }

        // Supprimer les liens de courtier
        if (record.courtier_link) {
          const updatedCourtierLinks = record.courtier_link.filter((link: BaseLink) => {
            if (type === 'Site' && link.site === id) return false;
            if (type === 'Dechet' && link.dechet === id) return false;
            if (type === 'Courtier' && record.id === id) return false;  
            return true;
          });
          if (updatedCourtierLinks.length !== record.courtier_link.length) {
            updates.courtier_link = updatedCourtierLinks;
          }
        }

        // Supprimer les liens de ecoorganisme
        if (record.eco_organisme_link) {
          const updatedEcoorganismeLinks = record.eco_organisme_link.filter((link: BaseLink) => {
            if (type === 'Site' && link.site === id) return false;
            if (type === 'Dechet' && link.dechet === id) return false;
            if (type === 'Ecoorganisme' && record.id === id) return false;
            return true;
          });
          if (updatedEcoorganismeLinks.length !== record.eco_organisme_link.length) {
            updates.eco_organisme_link = updatedEcoorganismeLinks;
          }
        }
        
        // Supprimer les liens de contrat
        if (record.contrat_link) {
          const updatedContratLinks = record.contrat_link.filter((link: BaseLink) => {
            if (type === 'Site' && link.site === id) return false;
            if (type === 'Dechet' && link.dechet === id) return false;
            if (type === 'Contrat' && record.id === id) return false;
            return true;
          });
          if (updatedContratLinks.length !== record.contrat_link.length) {
            updates.contrat_link = updatedContratLinks;
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
    
    // Validation du format du code CED pour les déchets
    if (entityType === 'Dechet') {
      const codeCED = data.codeCED as string;
      const cedRegex = /^\d{2}\s\d{2}\s\d{2}(\*)?$/;
      if (!cedRegex.test(codeCED)) {
        alert('Le code CED doit être au format 00 00 00 ou 00 00 00*');
        return;
      }
    }

    // Validation de l'unité de volume pour les contenants
    if (entityType === 'Contenant') {
      const uniteVolume = data.uniteVolume as string;
      if (uniteVolume !== 'm3' && uniteVolume !== 'L') {
        alert('L\'unité de volume doit être "m3" ou "L"');
        return;
      }
    }
    
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

    // Créer une copie des données sans le champ contacts pour les transporteurs
    const cleanData = { ...data };
    if (entityType !== 'Site') {
      delete cleanData.contacts;
    }

    const insertData = {
      entreprise_id: entreprise_id,
      [getTableName(entityType)]: cleanData,
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
          nomPrenom: data.nomPrenom as string,
          email: data.email as string,
          telephone: data.telephone as string,
          adresse: data.adresse as string,
          siret: data.siret as string,
        };
        setTransporteurs(prev => [...prev, newTransporteur]);
        break;
      case 'Dechet':
        const newDechet: Dechet = {
          ...baseItem,
          nom: data.nom as string,
          codeCED: data.codeCED as string,
          adr: data.adr as string,
          masseVolumique: Number(data.masseVolumique),
        };
        setDechets(prev => [...prev, newDechet]);
        break;
      case 'Destinataire':
        const newDestinataire: Destinataire = {
          ...baseItem,
          nomBoite: data.nomBoite as string,
          nomPrenom: data.nomPrenom as string,
          email: data.email as string,
          telephone: data.telephone as string,
          adresse: data.adresse as string,
          siret: data.siret as string,
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
          email: data.email as string,
          telephone: data.telephone as string,
          adresse: data.adresse as string,
          siret: data.siret as string
        };
        setNegociants(prev => [...prev, newNegociant]);
        break;
      case 'Courtier':
        const newCourtier: Courtier = {
          ...baseItem,
          nomBoite: data.nomBoite as string,
          email: data.email as string,
          telephone: data.telephone as string,
          adresse: data.adresse as string,
          siret: data.siret as string
        };
        setCourtiers(prev => [...prev, newCourtier]);
        break;
      case 'Ecoorganisme':
        const newEcoorganisme: Ecorganisme = {
          ...baseItem,
          nomBoite: data.nomBoite as string,
          siret: data.siret as string,
          email: data.email as string,
          telephone: data.telephone as string,
          adresse: data.adresse as string,
        };
        setEcoorganismes(prev => [...prev, newEcoorganisme]);
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
        case 'Ecoorganisme':
          return 'ecoorganisme';
        case 'CodeTraitement':
          return 'codeTraitement';
        default:
          return type.toLowerCase();
      }
    };
    
    setShowNewForm(prev => ({ ...prev, [getFormKey(entityType)]: false }));
  };

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
        case 'Ecoorganisme':
          attributes = ecoorganismeAttributes;
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
                  {isEditing ? (
                    <input
                      type="text"
                      value={String(entity[mainField as keyof typeof entity])}
                      onChange={(e) => handleFieldChange(type, entity.id, mainField, e.target.value)}
                      className="text-sm font-semibold text-gray-800 bg-white px-2 py-1 rounded-lg border border-gray-200 focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                    />
                  ) : (
                    <h3 className="text-sm font-semibold text-gray-800">{String(entity[mainField as keyof typeof entity])}</h3>
                  )}
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
                  {type === 'Site' && (entity as Site).siret !== undefined ? (
                    <>
                      {/* Siret */}
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-medium text-gray-400 min-w-[80px]">
                          {getAttributeLabel('siret', type)}
                        </span>
                        {isEditing ? (
                          <input
                            type="text"
                            value={String((entity as Site).siret)}
                            onChange={(e) => handleFieldChange(type, entity.id, 'siret', e.target.value)}
                            className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm border border-gray-200 focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                          />
                        ) : (
                          <span className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm">{String((entity as Site).siret)}</span>
                        )}
                      </div>
                      
                      {/* Adresse du siège */}
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-medium text-gray-400 min-w-[80px]">
                          {getAttributeLabel('adresseSiege', type)}
                        </span>
                        {isEditing ? (
                          <input
                            type="text"
                            value={String((entity as Site).adresseSiege)}
                            onChange={(e) => handleFieldChange(type, entity.id, 'adresseSiege', e.target.value)}
                            className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm border border-gray-200 focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                          />
                        ) : (
                          <span className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm">{String((entity as Site).adresseSiege)}</span>
                        )}
                      </div>

                      {/* Contacts */}
                      {(entity as Site).contacts && Array.isArray((entity as Site).contacts) && (
                        <div className="bg-gray-50 rounded-xl p-4">
                          <div className="flex justify-between items-center mb-3">
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Contacts</p>
                            {isEditing && (
                              <button
                                onClick={() => handleAddContact(entity.id)}
                                className="bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white px-2 py-1 rounded-lg text-xs font-medium shadow-sm hover:shadow-md transition-all"
                              >
                                + Ajouter un contact
                              </button>
                            )}
                          </div>
                          <ul className="space-y-3">
                            {(entity as Site).contacts.map((contact: Contact, index: number) => (
                              <li key={contact.id} className="flex flex-col gap-2">
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-medium text-gray-400 min-w-[80px]">Contact {index + 1}:</span>
                                  {isEditing ? (
                                    <div className="flex flex-col gap-2 w-full">
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="text"
                                          value={contact.nom}
                                          onChange={(e) => handleFieldChange(type, entity.id, `contacts.${index}.nom`, e.target.value)}
                                          className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm border border-gray-200 focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                                          placeholder="Nom"
                                        />
                                        <button
                                          onClick={() => handleRemoveContact(entity.id, contact.id)}
                                          className="bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded-lg text-xs font-medium hover:bg-red-100 transition-all"
                                        >
                                          Supprimer
                                        </button>
                                      </div>
                                      <input
                                        type="email"
                                        value={contact.email}
                                        onChange={(e) => handleFieldChange(type, entity.id, `contacts.${index}.email`, e.target.value)}
                                        className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm border border-gray-200 focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                                        placeholder="Email"
                                      />
                                      <input
                                        type="tel"
                                        value={contact.telephone}
                                        onChange={(e) => handleFieldChange(type, entity.id, `contacts.${index}.telephone`, e.target.value)}
                                        className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm border border-gray-200 focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                                        placeholder="Téléphone"
                                      />
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={contact.respoTerrain}
                                          onChange={(e) => handleFieldChange(type, entity.id, `contacts.${index}.respoTerrain`, e.target.checked)}
                                          className="rounded border-gray-300 text-[var(--green-medium)] focus:ring-[var(--green-medium)]"
                                        />
                                        <label className="text-xs text-gray-600">Mentionner comme référent à contacter lors d&apos;enlèvement sur site</label>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-row gap-2">
                                      <span className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm">{contact.nom}</span>
                                      <span className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm">{contact.email}</span>
                                      <span className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm">{contact.telephone}</span>
                                      {contact.respoTerrain && <span className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm">Référent ✅</span>}
                                    </div>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Points de collecte */}
                      {(entity as Site).pointsCollecte && Array.isArray((entity as Site).pointsCollecte) && (
                        <div className="bg-gray-50 rounded-xl p-4">
                          <div className="flex justify-between items-center mb-3">
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Points de collecte</p>
                            {isEditing && (
                              <button
                                onClick={() => handleAddCollectionPoint(entity.id)}
                                className="bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white px-2 py-1 rounded-lg text-xs font-medium shadow-sm hover:shadow-md transition-all"
                              >
                                + Ajouter un point
                              </button>
                            )}
                          </div>
                          <ul className="space-y-3">
                            {(entity as Site).pointsCollecte.map((point: CollectionPoint, index: number) => (
                              <li key={point.id} className="flex flex-col gap-2">
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-medium text-gray-400 min-w-[80px]">Point {index + 1}:</span>
                                  {isEditing ? (
                                    <div className="flex flex-col gap-2 w-full">
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="text"
                                          value={point.nom}
                                          onChange={(e) => handleFieldChange(type, entity.id, `pointsCollecte.${index}.nom`, e.target.value)}
                                          className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm border border-gray-200 focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                                          placeholder="Nom du point de collecte"
                                        />
                                        <button
                                          onClick={() => handleRemoveCollectionPoint(entity.id, point.id)}
                                          className="bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded-lg text-xs font-medium hover:bg-red-100 transition-all"
                                        >
                                          Supprimer
                                        </button>
                                      </div>
                                      <input
                                        type="text"
                                        value={point.adresse}
                                        onChange={(e) => handleFieldChange(type, entity.id, `pointsCollecte.${index}.adresse`, e.target.value)}
                                        className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm border border-gray-200 focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                                        placeholder="Adresse"
                                      />
                                    </div>
                                  ) : (
                                    <span className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm">{point.nom} - {point.adresse}</span>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    // Rendu par défaut pour les autres types d'entités
                    Object.entries(entity).map(([key, value]) => {
                      if (key === 'id' || key === mainField) return null;
                      if (key === 'onu') return null; // Supprimer le champ ONU pour les déchets
                      if (key === 'tarifs' && type === 'Contrat') return null; // Masquer les tarifs pour les contrats
                      if (key === 'contact' && typeof value === 'object') {
                        return (
                          <div key={key} className="bg-gray-50 rounded-xl p-4">
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Contact</p>
                            <ul className="space-y-3">
                              {Object.entries(value).map(([contactKey, contactValue]) => {
                                // Changer le label pour contact.nomPrenom
                                const label = contactKey === 'nomPrenom' ? 'Prénom Nom' : getAttributeLabel(`${contactKey}`, type);
                                return (
                                  <li key={contactKey} className="flex items-center gap-3">
                                    <span className="text-[10px] font-medium text-gray-400 min-w-[80px]">
                                      {label}
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
                                );
                              })}
                            </ul>
                          </div>
                        );
                      }
                      // Ajout de la gestion du SIRET pour les transporteurs et destinataires
                      if ((type === 'Transporteur' || type === 'Destinataire') && key === 'siret') {
                        return (
                          <div key={key} className="flex items-center gap-3">
                            <span className="text-[10px] font-medium text-gray-400 min-w-[80px]">
                              {getAttributeLabel('siret', type)}
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
                      }
                      // Ajout de la gestion spéciale pour les déchets
                      if (type === 'Dechet' && key === 'masseVolumique') {
                        return (
                          <div key={key} className="flex items-center gap-3">
                            <span className="text-[10px] font-medium text-gray-400 min-w-[80px]">
                              {getAttributeLabel('masseVolumique', type)}
                            </span>
                            {isEditing ? (
                              <input
                                type="number"
                                value={String(value)}
                                onChange={(e) => handleFieldChange(type, entity.id, key, e.target.value)}
                                step="0.01"
                                min="0"
                                className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm border border-gray-200 focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                              />
                            ) : (
                              <span className="text-xs bg-white px-3 py-1.5 rounded-lg text-gray-800 shadow-sm">{String(value)}</span>
                            )}
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
                    })
                  )}
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

  // Ajout des fonctions pour gérer les contacts et points de collecte
  const handleAddContact = (siteId: string) => {
    setSites(prev => prev.map(site => {
      if (site.id !== siteId) return site;
      const newContact = {
        id: Date.now().toString(),
        nom: '',
        email: '',
        telephone: '',
        respoTerrain: false
      };
      return {
        ...site,
        contacts: [...site.contacts, newContact]
      };
    }));
  };

  const handleRemoveContact = (siteId: string, contactId: string) => {
    setSites(prev => prev.map(site => {
      if (site.id !== siteId) return site;
      return {
        ...site,
        contacts: site.contacts.filter(contact => contact.id !== contactId)
      };
    }));
  };

  const handleAddCollectionPoint = (siteId: string) => {
    setSites(prev => prev.map(site => {
      if (site.id !== siteId) return site;
      const newPoint = {
        id: Date.now().toString(),
        nom: '',
        adresse: '',
        codePostal: '',
        ville: ''
      };
      return {
        ...site,
        pointsCollecte: [...site.pointsCollecte, newPoint]
      };
    }));
  };

  const handleRemoveCollectionPoint = (siteId: string, pointId: string) => {
    setSites(prev => prev.map(site => {
      if (site.id !== siteId) return site;
      return {
        ...site,
        pointsCollecte: site.pointsCollecte.filter(point => point.id !== pointId)
      };
    }));
  };

  //Chaque Carte d'entités
  return (
    <div className="flex flex-col gap-8">
      {/* Barre d'onglets et bouton de contrôle */}
      <div className="flex flex-col gap-4">
        {/* Onglets Entités/Liens */}
        <div className="w-1/2 ml-auto">
          <div className="flex space-x-4">
            <button
              onClick={() => setViewMode('entities')}
              className="relative flex flex-col items-center flex-1"
            >
              <span className={`text-sm font-medium transition-all ${
                viewMode === 'entities'
                  ? 'text-black'
                  : 'text-gray-400'
              }`}>
                Entités
              </span>
              <div className={`w-full h-0.5 mt-1 transition-all ${
                viewMode === 'entities'
                  ? 'bg-green-500'
                  : 'bg-transparent'
              }`} />
            </button>
            <button
              onClick={() => setViewMode('links')}
              className="relative flex flex-col items-center flex-1"
            >
              <span className={`text-sm font-medium transition-all ${
                viewMode === 'links'
                  ? 'text-black'
                  : 'text-gray-400'
              }`}>
                Liens
              </span>
              <div className={`w-full h-0.5 mt-1 transition-all ${
                viewMode === 'links'
                  ? 'bg-green-500'
                  : 'bg-transparent'
              }`} />
            </button>
          </div>
        </div>

        {viewMode === 'entities' && (
          <>
            <div className="flex justify-end">
              <button
                onClick={() => setShowAllTabs(!showAllTabs)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              >
                {showAllTabs ? 'Masquer les onglets avancés' : 'Afficher les onglets avancés'}
              </button>
            </div>

            {/* Onglets des entités */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex space-x-2">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
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
          </>
        )}
      </div>

      {/* Contenu des onglets */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        {viewMode === 'entities' ? (
          <>
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
                  <div className="bg-white rounded-xl shadow-sm p-5">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Nouveau déchet</h3>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const nom = formData.get('nom') as string;
                      const codeCED = formData.get('codeCED') as string;
                      const masseVolumique = formData.get('masseVolumique') as string;
                      const adr = formData.get('adr') as string;
                      handleSave('Dechet', { nom, codeCED, masseVolumique: Number(masseVolumique), adr });
                    }} className="space-y-4">
                      <div className="w-full">
                        <label className="block text-md font-medium text-gray-500 mb-1">
                          Nom du déchet
                        </label>
                        <input
                          type="text"
                          name="nom"
                          required
                          className="w-full px-2 py-1.5 text-md border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                          placeholder="Entrez le nom du déchet"
                        />
                      </div>
                      <div className="w-full">
                        <label className="block text-md font-medium text-gray-500 mb-1">
                          Code CED
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            name="codeCED"
                            required
                            className="w-full px-2 py-1.5 text-md border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                            placeholder="Rechercher un code CED..."
                            onChange={(e) => {
                              const searchValue = e.target.value.toLowerCase();
                              const filteredOptions = code_ced_DICTIONNAIRE.filter(d => 
                                d.ced.toLowerCase().includes(searchValue) || 
                                d.nom.toLowerCase().includes(searchValue)
                              );
                              setFilteredCedOptions(filteredOptions);
                            }}
                          />
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {filteredCedOptions.map((dechet) => (
                              <div
                                key={dechet.ced}
                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                                onClick={() => {
                                  const codeCEDInput = document.querySelector('input[name="codeCED"]') as HTMLInputElement;
                                  const masseVolumiqueInput = document.querySelector('input[name="masseVolumique"]') as HTMLInputElement;
                                  if (codeCEDInput && masseVolumiqueInput) {
                                    codeCEDInput.value = dechet.ced;
                                    masseVolumiqueInput.value = dechet.masse_volumique.toString();
                                    setFilteredCedOptions([]);
                                  }
                                }}
                              >
                                <div className="font-medium">{dechet.ced}</div>
                                <div className="text-sm text-gray-600">{dechet.nom}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="w-full">
                        <label className="block text-md font-medium text-gray-500 mb-1">
                          Masse volumique (t/m³)
                        </label>
                        <input
                          type="number"
                          name="masseVolumique"
                          required
                          step="0.01"
                          min="0"
                          className="w-full px-2 py-1.5 text-md border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                          placeholder="Masse volumique"
                        />
                      </div>
                      <div className="w-full">
                        <label className="block text-md font-medium text-gray-500 mb-1">
                          Mention ADR
                        </label>
                        <input
                          type="text"
                          name="adr"
                          required
                          className="w-full px-2 py-1.5 text-md border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                          placeholder="Entrez la mention ADR"
                        />
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

            {activeTab === 'ecoorganismes' && (
              <>
                {!showNewForm.ecoorganisme && (
                  <div className="flex justify-between items-end mb-4">
                    <p className="text-xl ml-2 font-semibold text-gray-800">Éco-organismes</p>
                    <button
                      onClick={() => setShowNewForm(prev => ({ ...prev, ecoorganisme: true }))}
                      className="bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
                    >
                      + Nouveau
                    </button>
                  </div>
                )}
                {showNewForm.ecoorganisme ? (
                  <EntityForm
                    title="Nouvel éco-organisme"
                    mainAttribute={ecoorganismeAttributes.mainAttribute}
                    secondaryAttributes={ecoorganismeAttributes.secondaryAttributes}
                    onSave={(data) => handleSave('Ecoorganisme', data)}
                  />
                ) : (
                  renderEntityList(ecoorganismes, 'Ecoorganisme', 'nomBoite')
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
                              {option.groupe} | {option.code} - {option.nom}
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
            {(cofounders_user_id(user_id)===true) && <ImportEntityFromExcel />}
          </>
        ) : (
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
              onContratLink={(contratId, siteId, dechetId) => handleContratLink(contratId, siteId, dechetId, setContratLinks, contratLinks)}
              onUpdateTransportLinks={setTransportLinks}
              onUpdateDestLinks={setDestLinks}
              onUpdateContenantLinks={setContenantLinks}
              onUpdateNegociantLinks={setNegociantLinks}
              onUpdateCourtierLinks={setCourtierLinks}
              onUpdateCodeTreatmentLinks={setCodeTreatmentLinks}
              onUpdateEcorganismeLinks={setEcoorganismeLinks}
              onUpdateContratLinks={setContratLinks}
              siteContactLinks={[]}
              onSiteContactLink={() => {}}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AutocompletionTab;
