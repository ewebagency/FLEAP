/*'use client';

import React, { useState, useEffect } from 'react';
import EntityForm from './EntityForm';
import { supabase } from '@/app/database/supabaseClient';
import { useSession } from '@/app/component/SessionProvider';
import LinkComponents from './LinkComponents';

export interface CollectionPoint {
  nom: string;
  adresse: string;
}

export interface Site {
  id: string;
  nom: string;
  siret?: string;
  adresseSiege?: string;
  pointsCollecte?: CollectionPoint[];
}

export interface Transporteur {
  id: string;
  nomBoite: string;
  siret?: string;
  contact?: {
    nomPrenom?: string;
    email?: string;
    telephone?: string;
  };
  adresse?: string;
}

export interface Dechet {
  id: string;
  nom: string;
  codeCED?: string;
  adr?: string;
  onu?: string;
}

export interface Destinataire {
  id: string;
  nomBoite: string;
  siret?: string;
  contact: {
    nomPrenom: string;
    email: string;
    telephone: string;
  };
  adresse: string;
}

export interface Contenant {
  id: string;
  nom: string;
  volume: number;
  uniteVolume: string;
}

export interface ContactEmetteur {
  id: string;
  prenomNom: string;
  email: string;
  telephone: string;
}

interface TransportLink {
  site: string;
  dechet: string;
}

interface DestLink {
  site: string;
  dechet: string;
}

interface ContenantLink {
  site: string;
  dechet: string;
}

interface SiteContactLink {
  site: string;
  contact: string;
}

const AutocompletionTab: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [transporteurs, setTransporteurs] = useState<Transporteur[]>([]);
  const [dechets, setDechets] = useState<Dechet[]>([]);
  const [destinataires, setDestinataires] = useState<Destinataire[]>([]);
  const [contenants, setContenants] = useState<Contenant[]>([]);
  const [contactEmetteurs, setContactEmetteurs] = useState<ContactEmetteur[]>([]);
  const [showNewForm, setShowNewForm] = useState<{ [key: string]: boolean }>({
    site: false,
    transporteur: false,
    dechet: false,
    destinataire: false,
    contenant: false,
    contactEmetteur: false,
  });
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingItems, setEditingItems] = useState<Set<string>>(new Set());
  const [transportLinks, setTransportLinks] = useState<TransportLink[]>([]);
  const [destLinks, setDestLinks] = useState<DestLink[]>([]);
  const [contenantLinks, setContenantLinks] = useState<ContenantLink[]>([]);
  const [siteContactLinks, setSiteContactLinks] = useState<SiteContactLink[]>([]);
  const {entreprise_id} = useSession();

  useEffect(() => {
    if (entreprise_id) {
      fetchAutocompletionData(Number(entreprise_id));
    }
  }, [entreprise_id]);

  const fetchAutocompletionData = async (entrepriseId: number) => {
    const { data, error } = await supabase
      .from('table_autocompletion')
      .select('*')
      .eq('entreprise_id', entrepriseId);

    if (error) {
      console.error('Error fetching autocompletion data:', error);
      return;
    }

    if (data) {
      const sites: Site[] = [];
      const transporteurs: Transporteur[] = [];
      const dechets: Dechet[] = [];
      const destinataires: Destinataire[] = [];
      const contenants: Contenant[] = [];
      const contactEmetteurs: ContactEmetteur[] = [];
      const transportLinks: TransportLink[] = [];
      const destLinks: DestLink[] = [];
      const contenantLinks: ContenantLink[] = [];
      const siteContactLinks: SiteContactLink[] = [];

      data.forEach(record => {
        if (record.site) {
          sites.push({
            ...record.site,
            id: record.id.toString()
          });
        }
        if (record.transporteur) {
          transporteurs.push({
            ...record.transporteur,
            id: record.id.toString()
          });
          if (record.transport_link) {
            record.transport_link.forEach((link: { site: string; dechet: string }) => {
              transportLinks.push({
                site: link.site,
                dechet: link.dechet
              });
            });
          }
        }
        if (record.destinataire) {
          destinataires.push({
            ...record.destinataire,
            id: record.id.toString()
          });
          if (record.dest_link) {
            record.dest_link.forEach((link: { site: string; dechet: string }) => {
              destLinks.push({
                site: link.site,
                dechet: link.dechet
              });
            });
          }
        }
        if (record.dechet) {
          dechets.push({
            ...record.dechet,
            id: record.id.toString()
          });
        }
        if (record.contenant) {
          contenants.push({
            ...record.contenant,
            id: record.id.toString()
          });
          if (record.contenant_link) {
            record.contenant_link.forEach((link: { site: string; dechet: string }) => {
              contenantLinks.push({
                site: link.site,
                dechet: link.dechet
              });
            });
          }
        }
        if (record.contact_emetteur) {
          contactEmetteurs.push({
            ...record.contact_emetteur,
            id: record.id.toString()
          });
        }
        if (record.contact_link) {
          record.contact_link.forEach((link: { site: string; contact: string }) => {
            siteContactLinks.push({
              site: link.site,
              contact: link.contact
            });
          });
        }
      });

      setSites(sites);
      setTransporteurs(transporteurs);
      setDechets(dechets);
      setDestinataires(destinataires);
      setContenants(contenants);
      setContactEmetteurs(contactEmetteurs);
      setTransportLinks(transportLinks);
      setDestLinks(destLinks);
      setContenantLinks(contenantLinks);
      setSiteContactLinks(siteContactLinks);
    }
  };

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

  const handleFieldChange = (type: string, id: string, field: string, value: string) => {
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
    }
  };

  const handleContactFieldChange = (type: string, id: string, field: string, value: string) => {
    switch (type) {
      case 'Transporteur':
        setTransporteurs(prev => prev.map(transporteur => 
          transporteur.id === id ? { 
            ...transporteur, 
            contact: { ...transporteur.contact, [field]: value } 
          } : transporteur
        ));
        break;
      case 'Destinataire':
        setDestinataires(prev => prev.map(destinataire => 
          destinataire.id === id ? { 
            ...destinataire, 
            contact: { ...destinataire.contact, [field]: value } 
          } : destinataire
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
      }

      if (!dataToUpdate) return;

      // Créer une copie des données sans l'ID
      const { id: _, ...dataWithoutId } = dataToUpdate;

      const { error } = await supabase
        .from('table_autocompletion')
        .update({ [type.toLowerCase()]: dataWithoutId })
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
          setSiteContactLinks(prev => prev.filter(link => link.site !== id));
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
        case 'ContactEmetteur':
          setContactEmetteurs(prev => prev.filter(contact => contact.id !== id));
          // Supprimer les liens associés au contact
          setSiteContactLinks(prev => prev.filter(link => link.contact !== id));
          break;
      }

      // Mettre à jour Supabase avec le bon nom de colonne
      const columnName = type === 'ContactEmetteur' ? 'contact_emetteur' : type.toLowerCase();
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
        const updates: any = {};

        // Supprimer les liens de transport
        if (record.transport_link) {
          const updatedTransportLinks = record.transport_link.filter((link: any) => {
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
          const updatedDestLinks = record.dest_link.filter((link: any) => {
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
          const updatedContenantLinks = record.contenant_link.filter((link: any) => {
            if (type === 'Site' && link.site === id) return false;
            if (type === 'Dechet' && link.dechet === id) return false;
            if (type === 'Contenant' && record.id === id) return false;
            return true;
          });
          if (updatedContenantLinks.length !== record.contenant_link.length) {
            updates.contenant_link = updatedContenantLinks;
          }
        }

        // Supprimer les liens de contact
        if (record.contact_link) {
          const updatedContactLinks = record.contact_link.filter((link: any) => {
            if (type === 'Site' && link.site === id) return false;
            if (type === 'ContactEmetteur' && link.contact === id) return false;
            return true;
          });
          if (updatedContactLinks.length !== record.contact_link.length) {
            updates.contact_link = updatedContactLinks;
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
    
    const insertData = {
      entreprise_id: entreprise_id,
      [entityType.toLowerCase() === 'contactemetteur' ? 'contact_emetteur' : entityType.toLowerCase()]: data,
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
          onu: data.onu as string,
        };
        setDechets(prev => [...prev, newDechet]);
        break;
      case 'Destinataire':
        const newDestinataire: Destinataire = {
          ...baseItem,
          nomBoite: data.nomBoite as string,
          contact: {
            nomPrenom: data['contact.nomPrenom'] as string,
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
      case 'ContactEmetteur':
        const newContactEmetteur: ContactEmetteur = {
          ...baseItem,
          prenomNom: data.prenomNom as string,
          email: data.email as string,
          telephone: data.telephone as string,
        };
        setContactEmetteurs(prev => [...prev, newContactEmetteur]);
        break;
    }
    
    // Mettre à jour l'état showNewForm avec la bonne clé
    const formKey = entityType === 'ContactEmetteur' ? 'contactEmetteur' : entityType.toLowerCase();
    setShowNewForm(prev => ({ ...prev, [formKey]: false }));
  };

  const siteAttributes = {
    mainAttribute: {
      name: 'nom',
      label: 'Nom du site',
      type: 'string' as const,
      required: true,
      placeholder: 'Entrez le nom du site',
    },
    secondaryAttributes: [
      {
        name: 'siret',
        label: 'SIRET',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez le numéro SIRET',
      },
      {
        name: 'adresseSiege',
        label: 'Adresse du siège',
        type: 'address' as const,
        required: true,
      },
      {
        name: 'pointsCollecte',
        label: 'Points de collecte',
        type: 'collectionPoint' as const,
        required: false,
      },
    ],
  };

  const transporteurAttributes = {
    mainAttribute: {
      name: 'nomBoite',
      label: 'Nom de la société',
      type: 'string' as const,
      required: true,
      placeholder: 'Entrez le nom de la société',
    },
    secondaryAttributes: [
      {
        name: 'siret',
        label: 'SIRET',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez le numéro SIRET',
      },
      {
        name: 'contact',
        label: 'Contact',
        type: 'contact' as const,
        required: true,
      },
      {
        name: 'adresse',
        label: 'Adresse',
        type: 'address' as const,
        required: false,
      },
    ],
  };

  const dechetAttributes = {
    mainAttribute: {
      name: 'nom',
      label: 'Nom du déchet',
      type: 'string' as const,
      required: true,
      placeholder: 'Entrez le nom du déchet',
    },
    secondaryAttributes: [
      {
        name: 'codeCED',
        label: 'Code CED',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez le code CED',
      },
      {
        name: 'adr',
        label: 'ADR',
        type: 'string' as const,
        required: false,
        placeholder: 'Entrez le code ADR',
      },
      {
        name: 'onu',
        label: 'ONU',
        type: 'string' as const,
        required: false,
        placeholder: 'Entrez le code ONU',
      },
    ],
  };

  const destinataireAttributes = {
    mainAttribute: {
      name: 'nomBoite',
      label: 'Nom de la société',
      type: 'string' as const,
      required: true,
      placeholder: 'Entrez le nom de la société',
    },
    secondaryAttributes: [
      {
        name: 'contact.nomPrenom',
        label: 'Nom et Prénom',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez le nom et prénom',
      },
      {
        name: 'contact.email',
        label: 'Email',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez l\'email',
      },
      {
        name: 'contact.telephone',
        label: 'Téléphone',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez le téléphone',
      },
      {
        name: 'adresse',
        label: 'Adresse',
        type: 'address' as const,
        required: true,
      },
    ],
  };

  const contenantAttributes = {
    mainAttribute: {
      name: 'nom',
      label: 'Nom du contenant',
      type: 'string' as const,
      required: true,
      placeholder: 'Entrez le nom du contenant',
    },
    secondaryAttributes: [
      {
        name: 'volume',
        label: 'Volume',
        type: 'number' as const,
        required: true,
        placeholder: 'Entrez le volume',
      },
      {
        name: 'uniteVolume',
        label: 'Unité du volume',
        type: 'select' as const,
        required: true,
        placeholder: 'Sélectionnez l\'unité',
        options: [
          { value: 'm3', label: 'm³' },
          { value: 'L', label: 'Litre (L)' }
        ],
      },
    ],
  };

  const contactEmetteurAttributes = {
    mainAttribute: {
      name: 'prenomNom',
      label: 'Prénom et Nom',
      type: 'string' as const,
      required: true,
      placeholder: 'Entrez le prénom et le nom',
    },
    secondaryAttributes: [
      {
        name: 'email',
        label: 'Email',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez l\'email',
      },
      {
        name: 'telephone',
        label: 'Téléphone',
        type: 'string' as const,
        required: true,
        placeholder: 'Entrez le numéro de téléphone',
      },
    ],
  };

  const renderEntityList = (
    entities: Site[] | Transporteur[] | Dechet[] | Destinataire[] | Contenant[] | ContactEmetteur[],
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
        case 'ContactEmetteur':
          attributes = contactEmetteurAttributes;
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
                                    onChange={(e) => handleContactFieldChange(type, entity.id, contactKey, e.target.value)}
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

  const handleTransportLink = async (transportId: string, siteId: string, dechetId: string) => {
    try {
      const newLink: TransportLink = { site: siteId, dechet: dechetId };
      setTransportLinks(prev => [...prev, newLink]);

      const { data: existingRecord, error: fetchError } = await supabase
        .from('table_autocompletion')
        .select('transport_link')
        .eq('id', transportId)
        .single();

      if (fetchError) {
        console.error('Error fetching existing transport links:', fetchError);
        return;
      }

      const existingLinks = existingRecord?.transport_link || [];
      const updatedLinks = [...existingLinks, { site: siteId, dechet: dechetId }];

      const { error: updateError } = await supabase
        .from('table_autocompletion')
        .update({ transport_link: updatedLinks })
        .eq('id', transportId);

      if (updateError) {
        console.error('Error updating transport link:', updateError);
      }
    } catch (error) {
      console.error('Error in handleTransportLink:', error);
    }
  };

  const handleDestLink = async (destId: string, siteId: string, dechetId: string) => {
    try {
      const newLink: DestLink = { site: siteId, dechet: dechetId };
      setDestLinks(prev => [...prev, newLink]);

      const { data: existingRecord, error: fetchError } = await supabase
        .from('table_autocompletion')
        .select('dest_link')
        .eq('id', destId)
        .single();

      if (fetchError) {
        console.error('Error fetching existing destination links:', fetchError);
        return;
      }

      const existingLinks = existingRecord?.dest_link || [];
      const updatedLinks = [...existingLinks, { site: siteId, dechet: dechetId }];

      const { error: updateError } = await supabase
        .from('table_autocompletion')
        .update({ dest_link: updatedLinks })
        .eq('id', destId);

      if (updateError) {
        console.error('Error updating destination link:', updateError);
      }
    } catch (error) {
      console.error('Error in handleDestLink:', error);
    }
  };

  const handleContenantLink = async (contenantId: string, siteId: string, dechetId: string) => {
    try {
      const newLink: ContenantLink = { site: siteId, dechet: dechetId };
      setContenantLinks(prev => [...prev, newLink]);

      const { data: existingRecord, error: fetchError } = await supabase
        .from('table_autocompletion')
        .select('contenant_link')
        .eq('id', contenantId)
        .single();

      if (fetchError) {
        console.error('Error fetching existing container links:', fetchError);
        return;
      }

      const existingLinks = existingRecord?.contenant_link || [];
      const updatedLinks = [...existingLinks, { site: siteId, dechet: dechetId }];

      const { error: updateError } = await supabase
        .from('table_autocompletion')
        .update({ contenant_link: updatedLinks })
        .eq('id', contenantId);

      if (updateError) {
        console.error('Error updating container link:', updateError);
      }
    } catch (error) {
      console.error('Error in handleContenantLink:', error);
    }
  };

  const handleSiteContactLink = async (siteId: string, contactId: string) => {
    try {
      const newLink: SiteContactLink = { site: siteId, contact: contactId };
      setSiteContactLinks(prev => [...prev, newLink]);

      const { data: existingRecord, error: fetchError } = await supabase
        .from('table_autocompletion')
        .select('contact_link')
        .eq('id', siteId)
        .single();

      if (fetchError) {
        console.error('Error fetching existing site contact links:', fetchError);
        return;
      }

      const existingLinks = existingRecord?.contact_link || [];
      const updatedLinks = [...existingLinks, { site: siteId, contact: contactId }];

      const { error: updateError } = await supabase
        .from('table_autocompletion')
        .update({ contact_link: updatedLinks })
        .eq('id', siteId);

      if (updateError) {
        console.error('Error updating site contact link:', updateError);
      }
    } catch (error) {
      console.error('Error in handleSiteContactLink:', error);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex gap-8 justify-center">
        <div className="bg-white rounded-xl shadow-sm p-5 w-[40%]">
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
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 w-[40%]">
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
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 w-[40%]">
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
        </div>
      </div>

      <div className="flex gap-8 justify-center">
        <div className="bg-white rounded-xl shadow-sm p-5 w-[40%]">
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
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 w-[40%]">
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
        </div>
      </div>

      <div className="flex gap-8 justify-center">
        <div className="bg-white rounded-xl shadow-sm p-5 w-[40%]">
          {!showNewForm.contactEmetteur && (
            <div className="flex justify-between items-end mb-4">
              <p className="text-xl ml-2 font-semibold text-gray-800">Contacts Émetteurs</p>
              <button
                onClick={() => setShowNewForm(prev => ({ ...prev, contactEmetteur: true }))}
                className="bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
              >
                + Nouveau
              </button>
            </div>
          )}

          {showNewForm.contactEmetteur ? (
            <EntityForm
              title="Nouveau contact émetteur"
              mainAttribute={contactEmetteurAttributes.mainAttribute}
              secondaryAttributes={contactEmetteurAttributes.secondaryAttributes}
              onSave={(data) => handleSave('ContactEmetteur', data)}
            />
          ) : (
            renderEntityList(contactEmetteurs, 'ContactEmetteur', 'prenomNom')
          )}
        </div>
      </div>

      <div className="mt-8">
        <LinkComponents
          sites={sites}
          transporteurs={transporteurs}
          dechets={dechets}
          destinataires={destinataires}
          contenants={contenants}
          contactEmetteurs={contactEmetteurs}
          transportLinks={transportLinks}
          destLinks={destLinks}
          contenantLinks={contenantLinks}
          siteContactLinks={siteContactLinks}
          onTransportLink={handleTransportLink}
          onDestLink={handleDestLink}
          onContenantLink={handleContenantLink}
          onSiteContactLink={handleSiteContactLink}
        />
      </div>
    </div>
  );
};

export default AutocompletionTab;
*/