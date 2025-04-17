/*import { supabase } from "@/app/database/supabaseClient";
import { AutocompletionData, RawAutocompletionData, AutocompletionLinks, SelectedFields } from "./types";

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
    contacts: []
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
    contactLinks: []
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
  });

  console.log('result', result);
  return result;
};

export const checkAutocompletion = (
  selectedFields: SelectedFields,
  links: AutocompletionLinks,
  allOptions: AutocompletionData
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


*/