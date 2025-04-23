import { supabase } from "@/app/database/supabaseClient";
import { AutocompletionData, RawAutocompletionData, AutocompletionLinks, SelectedFields } from "./types";
import { CommonBSD } from "@/app/register/FiltreFunctionnal";
import { getFiliere, getMappingTableFiliere, parseAddress } from "../RegisterComponents/Modal/FormulaireFull/utils_new";

export const fetchAutocompletionData = async (entreprise_id: number): Promise<AutocompletionData> => {
  const { data, error } = await supabase
    .from('table_autocompletion')
    .select('*')
    .eq('entreprise_id', entreprise_id);

  if (error) throw error;
  
  const result: AutocompletionData = {
    sites: [],
    transporteurs: [],
    destinataires: [],
    dechets: [],
    contenants: [],
    contacts: [],
    negociants: [],
    courtiers: []
  };

  if (!data) return result;

  data.forEach((item: RawAutocompletionData) => {
    if (item.site) {
      result.sites.push({
        table_id: item.id,
        value: item.site
      });
    }
    if (item.transporteur) {
      result.transporteurs.push({
        table_id: item.id,
        value: item.transporteur
      });
    }
    if (item.destinataire) {
      result.destinataires.push({
        table_id: item.id,
        value: item.destinataire
      });
    }
    if (item.dechet) {
      result.dechets.push({
        table_id: item.id,
        value: item.dechet
      });
    }
    if (item.contenant) {
      result.contenants.push({
        table_id: item.id,
        value: item.contenant
      });
    }
    if (item.contact_emetteur) {
      result.contacts.push({
        table_id: item.id,
        value: item.contact_emetteur
      });
    }
    if (item.negociant) {
      result.negociants.push({
        table_id: item.id,
        value: item.negociant
      });
    }
    if (item.courtier) {
      result.courtiers.push({
        table_id: item.id,
        value: item.courtier
      });
    }
  });

  console.log('result', result);
  return result;
};

export const fetchAutocompletionLinks = async (entreprise_id: number): Promise<AutocompletionLinks> => {
  const { data, error } = await supabase
    .from('table_autocompletion')
    .select('*')
    .eq('entreprise_id', entreprise_id);

  if (error) throw error;

  const result: AutocompletionLinks = {
    transportLinks: [],
    destinataireLinks: [],
    contenantLinks: [],
    codeTraitementLinks: [],
    contactLinks: [],
    negociantLinks: [],
    courtierLinks: []
  };

  if (!data) return result;

  data.forEach((item: RawAutocompletionData) => {
    if (item.transport_link && item.transport_link.length > 0) {
      result.transportLinks.push({
        table_id: item.id,
        transport_link: item.transport_link
      });
    }
    if (item.dest_link && item.dest_link.length > 0) {
      result.destinataireLinks.push({
        table_id: item.id,
        dest_link: item.dest_link
      });
    }
    if (item.contenant_link && item.contenant_link.length > 0) {
      result.contenantLinks.push({
        table_id: item.id,
        contenant_link: item.contenant_link
      });
    }
    if (item.code_traitement_link && item.code_traitement_link.length > 0) {
      result.codeTraitementLinks.push({
        table_id: item.id,
        code_traitement_link: item.code_traitement_link
      });
    }
    if (item.contact_link && item.contact_link.length > 0) {
      result.contactLinks.push({
        table_id: item.id,
        contact_link: item.contact_link
      });
    }
    if (item.negociant_link && item.negociant_link.length > 0) {
      result.negociantLinks.push({
        table_id: item.id,
        negociant_link: item.negociant_link
      });
    }
    if (item.courtier_link && item.courtier_link.length > 0) {
      result.courtierLinks.push({
        table_id: item.id,
        courtier_link: item.courtier_link
      });
    }
  });

  console.log('result', result);
  return result;
};

export const checkAutocompletion = (
  selectedFields: SelectedFields,
  links: AutocompletionLinks,
  allOptions: AutocompletionData,
  site_access?: string[]
): SelectedFields => {
  const result = { ...selectedFields };

  // Vérifier si site et déchet
  if (selectedFields.site && selectedFields.dechet) {
    
    // Rechercher un transportLink qui correspond à la paire site/dechet
    const transportLink = links.transportLinks.find(link => {
      const siteMatch = link.transport_link.some(item => item.site === selectedFields.site!.table_id.toString());
      const dechetMatch = link.transport_link.some(item => item.dechet === selectedFields.dechet!.table_id.toString());
      return siteMatch && dechetMatch;
    });

    if (transportLink) {
      
      // Trouver le transporteur correspondant
      const transporteur = allOptions.transporteurs.find(t => t.table_id === transportLink.table_id);
      if (transporteur) {
        result.transporteur = transporteur;
      }
    }


    // Rechercher un destinataireLink qui correspond à la paire site/dechet
    const destinataireLink = links.destinataireLinks.find(link => {
      const siteMatch = link.dest_link.some(item => item.site === selectedFields.site!.table_id.toString());
      const dechetMatch = link.dest_link.some(item => item.dechet === selectedFields.dechet!.table_id.toString());
      return siteMatch && dechetMatch;
    });

    if (destinataireLink) {
      
      // Trouver le destinataire correspondant
      const destinataire = allOptions.destinataires.find(d => d.table_id === destinataireLink.table_id);
      if (destinataire) {
        result.destinataire = destinataire;
      }
    }

    
    // Rechercher un contenantLink qui correspond à la paire site/dechet
    const contenantLink = links.contenantLinks.find(link => {
      const siteMatch = link.contenant_link.some(item => item.site === selectedFields.site!.table_id.toString());
      const dechetMatch = link.contenant_link.some(item => item.dechet === selectedFields.dechet!.table_id.toString());
      return siteMatch && dechetMatch;
    });

    if (contenantLink) {
      
      // Trouver le contenant correspondant
      const contenant = allOptions.contenants.find(c => c.table_id === contenantLink.table_id);
      if (contenant) {
        result.contenant = contenant;
      }
    }

    // Rechercher un negociantLink qui correspond à la paire site/dechet
    const negociantLink = links.negociantLinks.find(link => {
      const siteMatch = link.negociant_link.some(item => item.site === selectedFields.site!.table_id.toString());
      const dechetMatch = link.negociant_link.some(item => item.dechet === selectedFields.dechet!.table_id.toString());
      return siteMatch && dechetMatch;
    });

    if (negociantLink) {
      // Trouver le negociant correspondant
      const negociant = allOptions.negociants.find(n => n.table_id === negociantLink.table_id);
      if (negociant) {
        result.negociant = negociant;
      }
    }

    // Rechercher un courtierLink qui correspond à la paire site/dechet
    const courtierLink = links.courtierLinks.find(link => {
      const siteMatch = link.courtier_link.some(item => item.site === selectedFields.site!.table_id.toString());
      const dechetMatch = link.courtier_link.some(item => item.dechet === selectedFields.dechet!.table_id.toString());
      return siteMatch && dechetMatch;
    });

    if (courtierLink) {
      // Trouver le courtier correspondant
      const courtier = allOptions.courtiers.find(c => c.table_id === courtierLink.table_id);
      if (courtier) {
        result.courtier = courtier;
      }
    }
    
    
  }

  // Vérifier si site
  if (selectedFields.site) {
    
    const site_table_id = selectedFields.site!.table_id;
    const contact_linked = links.contactLinks.filter(link => {
      return link.contact_link.some(item => item.site === site_table_id.toString());
    });

    if (contact_linked.length > 0) {
      
      // Trouver tous les contacts correspondants
      const contacts = allOptions.contacts.filter(option => 
        contact_linked.some(link => 
          link.contact_link.some(item => item.contact === option.table_id.toString())
        )
      );
      

      if (contacts.length > 0) {
        result.contactEmetteur = contacts;
      }
    }

  if(result.site?.value.pointsCollecte.length==1){
    result.pointCollecte = result.site?.value.pointsCollecte[0];
  }
  
  
  }

  return result;
};

export interface AggregatedMailRecipient {
  destinataire: {
    type: string;
    email: string;
    nom?: string;
  };
  lignes: SelectedFields[];
}

interface ValueType {
  nomBoite?: string;
  adresse?: string;
  siret?: string;
  contact?: {
    nomPrenom?: string;
    email?: string;
    telephone?: string;
  };
  [key: string]: string | { nomPrenom?: string; email?: string; telephone?: string } | undefined;
}

export const aggregateByMailRecipient = (selectedFieldsList: SelectedFields[]): AggregatedMailRecipient[] => {
  const groupedByRecipient: { [key: string]: AggregatedMailRecipient } = {};
  console.log('selectedFieldsList', JSON.stringify(selectedFieldsList));

  selectedFieldsList.forEach((line) => {
    let recipientEmail = '';
    const recipientType = line.destinataireMail || 'transporteur';
    const typePrestation = line.typePrestation || '';
    let recipientNom = '';

    const getEmailFromValue = (value: ValueType | undefined): string => {
      if (!value) return '';
      const contactEmail = value['contact.email'];
      return typeof contactEmail === 'string' ? contactEmail : '';
    };

    switch (recipientType) {
      case 'transporteur':
        recipientEmail = getEmailFromValue(line.transporteur?.value);
        recipientNom = line.transporteur?.value?.nomBoite || '';
        break;
      case 'destinataire':
        recipientEmail = getEmailFromValue(line.destinataire?.value);
        recipientNom = line.destinataire?.value?.nomBoite || '';
        break;
      case 'negociant':
        recipientEmail = getEmailFromValue(line.negociant?.value);
        recipientNom = line.negociant?.value?.nomBoite || '';
        break;
      case 'courtier':
        recipientEmail = getEmailFromValue(line.courtier?.value);
        recipientNom = line.courtier?.value?.nomBoite || '';
        break;
    }

    // Créer une clé unique pour le regroupement incluant le type de prestation
    const recipientKey = `${recipientType}-${recipientEmail}-${typePrestation}`;

    if (!groupedByRecipient[recipientKey]) {
      groupedByRecipient[recipientKey] = {
        destinataire: {
          type: recipientType,
          email: recipientEmail,
          nom: recipientNom
        },
        lignes: []
      };
    }

    groupedByRecipient[recipientKey].lignes.push(line);
  });

  // Convertir l'objet en tableau et filtrer les entrées sans email
  return Object.values(groupedByRecipient).filter(
    (group) => group.destinataire.email !== ''
  );
};

export interface CreateLineResult {
  success: boolean;
  error?: string;
  createdIds?: string[];
  createdData?: CommonBSD[];
}

export const createLines = async (selectedFieldsList: SelectedFields[], entreprise_id: string| null, user_id: string|null, entreprise_name: string|null): Promise<CreateLineResult> => {
  if (!entreprise_id) throw new Error('Entreprise non trouvée');
  const ced_table = await getMappingTableFiliere(entreprise_id);
  try {
    // Filtrer les lignes pour exclure le type 'livraison'
    const filteredLines = selectedFieldsList.filter(line => line.typePrestation !== 'livraison');
    
    const linesToCreate = filteredLines.map(line => {
      let recipientEmail = '';
      const getEmailFromValue = (value: ValueType | undefined): string => {
        if (!value) return '';
        const email = value['contact.email'];
        return typeof email === 'string' ? email : '';
      };

      switch(line.destinataireMail){
        case 'transporteur':
          recipientEmail = getEmailFromValue(line.transporteur?.value as ValueType);
          break;
        case 'destinataire':
          recipientEmail = getEmailFromValue(line.destinataire?.value as ValueType);
          break;
        case 'negociant':
          recipientEmail = getEmailFromValue(line.negociant?.value as ValueType);
          break;
        case 'courtier':
          recipientEmail = getEmailFromValue(line.courtier?.value as ValueType);
          break;
        default:
          recipientEmail = '';
          break;
      }
      return {
        user_id: user_id,
        entreprise_id: entreprise_id,
        created_on_fleap: true,
        id_track_dechets: "Ligne demandée",
        status_track_dechets: "Ligne demandée",
        readable_id_track_dechets: "Ligne demandée",
        infos_json: {
          formAPI: {
            createFormInput: {
              emitter: {
                type: "PRODUCER",
                company: {
                  name: line.site?.value?.nom || '',
                  siret: line.site?.value?.siret || '',
                  address: line.site?.value?.adresseSiege || '',
                  contact: line.contactEmetteur?.[0]?.value?.prenomNom || '',
                  phone: line.contactEmetteur?.[0]?.value?.telephone || '',
                  mail: line.contactEmetteur?.[0]?.value?.email || '',
                  country: ''
                },
                workSite: {
                  name: line.pointCollecte?.nom || '',
                  address: parseAddress(line.pointCollecte?.adresse || '').street,
                  postalCode: parseAddress(line.pointCollecte?.adresse || '').postalCode,
                  city: parseAddress(line.pointCollecte?.adresse || '').city,
                  infos: ''
                },
                isForeignShip: false,
                isPrivateIndividual: false
              },
              recipient: {
                cap: '',
                company: {
                  name: line.destinataire?.value?.nomBoite || '',
                  siret: '',
                  address: line.destinataire?.value?.adresse || '',
                  contact: line.destinataire?.value?.contact?.nomPrenom || '',
                  phone: line.destinataire?.value?.contact?.telephone || '',
                  mail: line.destinataire?.value?.contact?.email || '',
                  country: ''
                },
                isTempStorage: false,
                processingOperation: ''
              },
              transporter: {
                company: {
                  name: line.transporteur?.value?.nomBoite || '',
                  siret: '',
                  address: line.transporteur?.value?.adresse || '',
                  contact: line.transporteur?.value?.contact?.nomPrenom || '',
                  phone: line.transporteur?.value?.contact?.telephone || '',
                  mail: line.transporteur?.value?.contact?.email || '',
                  country: ''
                },
                receipt: '',
                customInfo: '',
                numberPlate: '',
                isExemptedOfReceipt: false
              },
              wasteDetails: {
                code: line.dechet?.value?.codeCED || '',
                name: line.dechet?.value?.nom || '',
                isSubjectToADR: false,
                isDangerous: false,
                pop: false,
                quantity: 0,
                quantityType: "ESTIMATED",
                packagingInfos: [{
                  type: line.contenant?.value?.nom || "AUTRE",
                  quantity: line.nombreContenant || 1
                }]
              }
            }
          }
        },
        other_infos: {
          containerDescription: line.contenant?.value?.nom || '',
          volume: line.contenant?.value?.volume || '',
          volumeUnit: line.contenant?.value?.uniteVolume || '',
          inputMode: 'volume',
          automaticMode: true,
          filiere: getFiliere(line.dechet?.value?.codeCED || '', ced_table),
          recipientEmail: recipientEmail,
          entreprise_name: entreprise_name,
          typePrestation: line.typePrestation || 'enlevement'
        },
        created_at: line.date?.toISOString() || new Date().toISOString()
      };
    });

    console.log('linesToCreate', linesToCreate);
    // Insérer les lignes dans Supabase
    const { data, error } = await supabase
      .from('bsd')
      .insert(linesToCreate)
      .select('*');

    if (error) throw error;

    return {
      success: true,
      createdIds: data.map(item => item.id),
      createdData: data.map(item => item as CommonBSD)
    };
  } catch (error) {
    console.error('Erreur lors de la création des lignes:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Une erreur est survenue'
    };
  }
};

