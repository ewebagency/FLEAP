import {supabase} from '@/app/database/supabaseClient';
import { 
  BaseLink
} from './types';

// Fonction utilitaire pour unifier les objets de liens
const unifyLinkObjects = (existingLinks: BaseLink[], newLink: BaseLink) => {
  // Créer un Map avec une clé unique pour chaque lien
  const uniqueLinks = new Map();
  
  // Ajouter d'abord tous les liens existants
  existingLinks.forEach(link => {
    const key = `${link.site}-${link.dechet}`;
    uniqueLinks.set(key, link);
  });
  
  // Ajouter ou remplacer par le nouveau lien
  const newKey = `${newLink.site}-${newLink.dechet}`;
  uniqueLinks.set(newKey, newLink);
  
  // Convertir le Map en tableau
  return Array.from(uniqueLinks.values());
};

// Fonction générique pour gérer les liens (création/mise à jour)
export const handleGenericLink = async (
  itemId: string,
  siteId: string, 
  dechetId: string,
  isMailRecipient: boolean | undefined,
  linkType: string,
  onUpdateLinks: (links: BaseLink[]) => void,
  currentLinks: BaseLink[]
) => {
  try {
    const { data: existingRecord, error: fetchError } = await supabase
      .from('table_autocompletion')
      .select(`${linkType}_link`)
      .eq('id', itemId)
      .single();

    if (fetchError) {
      console.error(`Error fetching ${linkType} links:`, fetchError);
      return;
    }

    const existingLinks = (existingRecord?.[`${linkType}_link` as keyof typeof existingRecord] || []) as BaseLink[];
    const newLink = { site: siteId, dechet: dechetId, ...(isMailRecipient !== undefined && { mail: isMailRecipient }) };
    const updatedLinks = unifyLinkObjects(existingLinks, newLink);

    const { error: updateError } = await supabase
      .from('table_autocompletion')
      .update({ [`${linkType}_link`]: updatedLinks })
      .eq('id', itemId);

    if (updateError) {
      console.error(`Error updating ${linkType} links:`, updateError);
      return;
    }

    const updatedLinksList = currentLinks.map(link => {
      if (link.site === siteId && link.dechet === dechetId) {
        return { ...link, id: itemId };
      }
      return link;
    });

    onUpdateLinks(updatedLinksList);
  } catch (error) {
    console.error(`Error in handle${linkType}Link:`, error);
  }
};

// Fonction générique pour supprimer les liens
export const handleDeleteGenericLink = async (
  itemId: string,
  siteId: string,
  dechetId: string,
  linkType: string,
  onUpdateLinks: (links: BaseLink[]) => void,
  currentLinks: BaseLink[]
) => {
  try {
    const { data: existingRecord, error: fetchError } = await supabase
      .from('table_autocompletion')
      .select(`${linkType}_link`)
      .eq('id', itemId)
      .single();

    if (fetchError) {
      console.error(`Error fetching ${linkType} links:`, fetchError);
      return;
    }

    const existingLinks = (existingRecord?.[`${linkType}_link` as keyof typeof existingRecord] || []) as BaseLink[];
    const updatedLinks = existingLinks.filter(
      (link: { site: string; dechet: string }) => !(link.site === siteId && link.dechet === dechetId)
    );

    const { error: updateError } = await supabase
      .from('table_autocompletion')
      .update({ [`${linkType}_link`]: updatedLinks })
      .eq('id', itemId);

    if (updateError) {
      console.error(`Error updating ${linkType} links:`, updateError);
      return;
    }

    onUpdateLinks(currentLinks.filter(
      link => !(link.site === siteId && link.dechet === dechetId)
    ));
  } catch (error) {
    console.error(`Error in handleDelete${linkType}Link:`, error);
  }
};

// Fonctions spécifiques qui utilisent les fonctions génériques
export const handleTransportLink = async (
  transportId: string, 
  siteId: string, 
  dechetId: string,
  isMailRecipient: boolean,
  onUpdateTransportLinks: (links: BaseLink[]) => void,
  transportLinks: BaseLink[]
) => {
  await handleGenericLink(transportId, siteId, dechetId, isMailRecipient, 'transport', onUpdateTransportLinks, transportLinks);
};

export const handleDestLink = async (
  destId: string, 
  siteId: string, 
  dechetId: string,
  isMailRecipient: boolean,
  onUpdateDestLinks: (links: BaseLink[]) => void,
  destLinks: BaseLink[]
) => {
  await handleGenericLink(destId, siteId, dechetId, isMailRecipient, 'dest', onUpdateDestLinks, destLinks);
};

export const handleContenantLink = async (
  contenantId: string, 
  siteId: string, 
  dechetId: string,
  onUpdateContenantLinks: (links: BaseLink[]) => void,
  contenantLinks: BaseLink[]
) => {
  await handleGenericLink(contenantId, siteId, dechetId, undefined, 'contenant', onUpdateContenantLinks, contenantLinks);
};

export const handleNegociantLink = async (
  negociantId: string, 
  siteId: string, 
  dechetId: string,
  isMailRecipient: boolean,
  onUpdateNegociantLinks: (links: BaseLink[]) => void,
  negociantLinks: BaseLink[]
) => {
  await handleGenericLink(negociantId, siteId, dechetId, isMailRecipient, 'negociant', onUpdateNegociantLinks, negociantLinks);
};

export const handleCourtierLink = async (
  courtierId: string, 
  siteId: string, 
  dechetId: string,
  isMailRecipient: boolean,
  onUpdateCourtierLinks: (links: BaseLink[]) => void,
  courtierLinks: BaseLink[]
) => {
  await handleGenericLink(courtierId, siteId, dechetId, isMailRecipient, 'courtier', onUpdateCourtierLinks, courtierLinks);
};

export const handleCodeTreatmentLink = async (
  codeTreatmentId: string, 
  siteId: string, 
  dechetId: string,
  onUpdateCodeTreatmentLinks: (links: BaseLink[]) => void,
  codeTreatmentLinks: BaseLink[]
) => {
  await handleGenericLink(codeTreatmentId, siteId, dechetId, undefined, 'code_traitement', onUpdateCodeTreatmentLinks, codeTreatmentLinks);
};

export const handleEcorganismeLink = async (
  ecoorganismeId: string,
  siteId: string,
  dechetId: string,
  isMailRecipient: boolean,
  onUpdateEcorganismeLinks: (links: BaseLink[]) => void,
  ecoorganismeLinks: BaseLink[]
) => {
  await handleGenericLink(ecoorganismeId, siteId, dechetId, isMailRecipient, 'eco_organisme', onUpdateEcorganismeLinks, ecoorganismeLinks);
};

export const handleContratLink = async (
  contratId: string,
  siteId: string,
  dechetId: string,
  onUpdateContratLinks: (links: BaseLink[]) => void,
  contratLinks: BaseLink[]
) => {
  await handleGenericLink(contratId, siteId, dechetId, undefined, 'contrat', onUpdateContratLinks, contratLinks);
};

// Fonctions de suppression spécifiques
export const handleDeleteTransportLink = async (
  transportId: string,
  siteId: string,
  dechetId: string,
  onUpdateTransportLinks: (links: BaseLink[]) => void,
  transportLinks: BaseLink[]
) => {
  await handleDeleteGenericLink(transportId, siteId, dechetId, 'transport', onUpdateTransportLinks, transportLinks);
};

export const handleDeleteDestLink = async (
  destId: string,
  siteId: string,
  dechetId: string,
  onUpdateDestLinks: (links: BaseLink[]) => void,
  destLinks: BaseLink[]
) => {
  await handleDeleteGenericLink(destId, siteId, dechetId, 'dest', onUpdateDestLinks, destLinks);
};

export const handleDeleteContenantLink = async (
  contenantId: string,
  siteId: string,
  dechetId: string,
  onUpdateContenantLinks: (links: BaseLink[]) => void,
  contenantLinks: BaseLink[]
) => {
  await handleDeleteGenericLink(contenantId, siteId, dechetId, 'contenant', onUpdateContenantLinks, contenantLinks);
};

export const handleDeleteNegociantLink = async (
  negociantId: string,
  siteId: string,
  dechetId: string,
  onUpdateNegociantLinks: (links: BaseLink[]) => void,
  negociantLinks: BaseLink[]
) => {
  await handleDeleteGenericLink(negociantId, siteId, dechetId, 'negociant', onUpdateNegociantLinks, negociantLinks);
};

export const handleDeleteCourtierLink = async (
  courtierId: string,
  siteId: string,
  dechetId: string,
  onUpdateCourtierLinks: (links: BaseLink[]) => void,
  courtierLinks: BaseLink[]
) => {
  await handleDeleteGenericLink(courtierId, siteId, dechetId, 'courtier', onUpdateCourtierLinks, courtierLinks);
};

export const handleDeleteCodeTreatmentLink = async (
  codeTreatmentId: string,
  siteId: string,
  dechetId: string,
  onUpdateCodeTreatmentLinks: (links: BaseLink[]) => void,
  codeTreatmentLinks: BaseLink[]
) => {
  await handleDeleteGenericLink(codeTreatmentId, siteId, dechetId, 'code_traitement', onUpdateCodeTreatmentLinks, codeTreatmentLinks);
};

export const handleDeleteEcorganismeLink = async (
  ecoorganismeId: string,
  siteId: string,
  dechetId: string,
  onUpdateEcorganismeLinks: (links: BaseLink[]) => void,
  ecoorganismeLinks: BaseLink[]
) => {
  await handleDeleteGenericLink(ecoorganismeId, siteId, dechetId, 'eco_organisme', onUpdateEcorganismeLinks, ecoorganismeLinks);
};

export const handleDeleteContratLink = async (
  contratId: string,
  siteId: string,
  dechetId: string,
  onUpdateContratLinks: (links: BaseLink[]) => void,
  contratLinks: BaseLink[]
) => {
  await handleDeleteGenericLink(contratId, siteId, dechetId, 'contrat', onUpdateContratLinks, contratLinks);
};

/*export const updateMailRecipient = async (
  siteId: string,
  dechetId: string,
  mailRecipient: string,
  selectedTransporteur: string,
  selectedDestinataire: string,
  selectedContenant: string,
  selectedNegociant: string,
  selectedCourtier: string,
  selectedCodeTreatment: string,
  selectedEcorganisme: string,
  selectedContrat: string
) => {
  try {

    const updateItemLink = async (itemId: string, itemLinkSupabase: string, itemLink: string) => {
      const { data: existingRecord, error: fetchError } = await supabase
        .from('table_autocompletion')
        .select('*')
        .eq('id', itemId)
        .single();

      if (fetchError) {
        console.error('Erreur lors de la récupération des liens:', fetchError);
        return;
      }

      const existingItemLinks = existingRecord[itemLinkSupabase] || [];
      const updatedItemLinks = existingItemLinks.map((link: { site: string; dechet: string; mail?: boolean })  => {
        if (link.site === siteId && link.dechet === dechetId) {
          return { ...link, mail: mailRecipient === itemLink };
        }
        return link;
      });

      const { error: updateError } = await supabase
        .from('table_autocompletion')
        .update({ [itemLinkSupabase]: updatedItemLinks })
        .eq('id', itemId);

      if (updateError) {
        console.error('Erreur lors de la mise à jour:', updateError);
      }

      console.log('---UpdateMailRecipient---');
      console.log('---Combinaison site/dechet:', siteId, dechetId);
      console.log('---mailRecipient:', mailRecipient);
      console.log('---itemLink:', itemLink);
      console.log('---mailRecipient === itemLink:', mailRecipient === itemLink);
      console.log('---existingItemLink:', existingItemLinks.map((link: { site: string; dechet: string; mail?: boolean }) => link.site === siteId && link.dechet === dechetId));
      console.log('---updatedItemLink:', updatedItemLinks.map((link: { site: string; dechet: string; mail?: boolean }) => link.site === siteId && link.dechet === dechetId));
      
    }

    await updateItemLink(selectedTransporteur, 'transport_link', 'transporteur');
    await updateItemLink(selectedDestinataire, 'dest_link', 'destinataire');
    await updateItemLink(selectedNegociant, 'negociant_link', 'negociant');
    await updateItemLink(selectedCourtier, 'courtier_link', 'courtier');
    await updateItemLink(selectedEcorganisme, 'eco_organisme_link', 'ecorganisme');

  } catch (error) {
    console.error('Erreur dans updateMailRecipient:', error);
  }
};*/


/*export const showCombinaisonLink = async (
  siteId: string,
  dechetId: string
) => {
  try {
    const { data: existingRecord, error: fetchError } = await supabase
      .from('table_autocompletion')
      .select('*');

    console.log("\n\n---showCombinaisonLink---");
    existingRecord?.map((item: { id: string; transport_link: BaseLink[]; dest_link: BaseLink[]; negociant_link: BaseLink[]; courtier_link: BaseLink[]; eco_organisme_link: BaseLink[]; contrat_link: BaseLink[]; code_traitement_link: BaseLink[]; contenant_link: BaseLink[]; }) => {
      if (item.transport_link.some((link: { site: string; dechet: string; mail?: boolean }) => link.site === siteId && link.dechet === dechetId)) {
        console.log('---transport_link:', item.transport_link, item.id);
      }
      if (item.dest_link.some((link: { site: string; dechet: string; mail?: boolean }) => link.site === siteId && link.dechet === dechetId)) {
        console.log('---dest_link:', item.dest_link, item.id);
      }
      if (item.negociant_link.some((link: { site: string; dechet: string; mail?: boolean }) => link.site === siteId && link.dechet === dechetId)) {
        console.log('---negociant_link:', item.negociant_link, item.id);
      }
      if (item.courtier_link.some((link: { site: string; dechet: string; mail?: boolean }) => link.site === siteId && link.dechet === dechetId)) {
        console.log('---courtier_link:', item.courtier_link, item.id);
      }
      if (item.eco_organisme_link.some((link: { site: string; dechet: string; mail?: boolean }) => link.site === siteId && link.dechet === dechetId)) {
        console.log('---eco_organisme_link:', item.eco_organisme_link, item.id);
      }
      if (item.contrat_link.some((link: { site: string; dechet: string; mail?: boolean }) => link.site === siteId && link.dechet === dechetId)) {
        console.log('---contrat_link:', item.contrat_link, item.id);
      }
      if (item.code_traitement_link.some((link: { site: string; dechet: string; mail?: boolean }) => link.site === siteId && link.dechet === dechetId)) {
        console.log('---code_traitement_link:', item.code_traitement_link, item.id);
      }
      if (item.contenant_link.some((link: { site: string; dechet: string; mail?: boolean }) => link.site === siteId && link.dechet === dechetId)) {
        console.log('---contenant_link:', item.contenant_link, item.id);
      }
    });

    if (fetchError) {
      console.error('Erreur lors de la récupération des liens:', fetchError);
      return;
    }
  } catch (error) {
    console.error('Erreur dans showCombinaisonLink:', error);
  }
};*/