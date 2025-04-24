/*import {supabase} from '@/app/database/supabaseClient';
import { 
  TransportLink, 
  DestLink, 
  ContenantLink, 
  NegociantLink, 
  CourtierLink, 
  CodeTreatmentLink, 
  EcorganismeLink,
  ContratLink
} from './types';


//--------------------------------handleDelete--------------------------------
export const handleDeleteTransportLink = async (
  transportId: string, 
  siteId: string, 
  dechetId: string,
  onUpdateTransportLinks: (links: TransportLink[]) => void,
  transportLinks: TransportLink[]
) => {
  try {
    const { data: existingRecord, error: fetchError } = await supabase
      .from('table_autocompletion')
      .select('transport_link')
      .eq('id', transportId)
      .single();

    if (fetchError) {
      console.error('Error fetching transport links:', fetchError);
      return;
    }

    const existingLinks = existingRecord?.transport_link || [];
    const updatedLinks = existingLinks.filter(
      (link: { site: string; dechet: string }) => !(link.site === siteId && link.dechet === dechetId)
    );

    const { error: updateError } = await supabase
      .from('table_autocompletion')
      .update({ transport_link: updatedLinks })
      .eq('id', transportId);

    if (updateError) {
      console.error('Error updating transport links:', updateError);
      return;
    }

    onUpdateTransportLinks(transportLinks.filter(
      link => !(link.site === siteId && link.dechet === dechetId)
    ));
  } catch (error) {
    console.error('Error in handleDeleteTransportLink:', error);
  }
};

export const handleDeleteDestLink = async (
  destId: string, 
  siteId: string, 
  dechetId: string,
  onUpdateDestLinks: (links: DestLink[]) => void,
  destLinks: DestLink[]
) => {
  try {
    const { data: existingRecord, error: fetchError } = await supabase
      .from('table_autocompletion')
      .select('dest_link')
      .eq('id', destId)
      .single();

    if (fetchError) {
      console.error('Error fetching dest links:', fetchError);
      return;
    }

    const existingLinks = existingRecord?.dest_link || [];
    const updatedLinks = existingLinks.filter(
      (link: { site: string; dechet: string }) => !(link.site === siteId && link.dechet === dechetId)
    );

    const { error: updateError } = await supabase
      .from('table_autocompletion')
      .update({ dest_link: updatedLinks })
      .eq('id', destId);

    if (updateError) {
      console.error('Error updating dest links:', updateError);
      return;
    }

    onUpdateDestLinks(destLinks.filter(
      link => !(link.site === siteId && link.dechet === dechetId)
    ));
  } catch (error) {
    console.error('Error in handleDeleteDestLink:', error);
  }
};

export const handleDeleteContenantLink = async (
  contenantId: string, 
  siteId: string, 
  dechetId: string,
  onUpdateContenantLinks: (links: ContenantLink[]) => void,
  contenantLinks: ContenantLink[]
) => {
  try {
    const { data: existingRecord, error: fetchError } = await supabase
      .from('table_autocompletion')
      .select('contenant_link')
      .eq('id', contenantId)
      .single();

    if (fetchError) {
      console.error('Error fetching contenant links:', fetchError);
      return;
    }

    const existingLinks = existingRecord?.contenant_link || [];
    const updatedLinks = existingLinks.filter(
      (link: { site: string; dechet: string }) => !(link.site === siteId && link.dechet === dechetId)
    );

    const { error: updateError } = await supabase
      .from('table_autocompletion')
      .update({ contenant_link: updatedLinks })
      .eq('id', contenantId);

    if (updateError) {
      console.error('Error updating contenant links:', updateError);
      return;
    }

    onUpdateContenantLinks(contenantLinks.filter(
      link => !(link.site === siteId && link.dechet === dechetId)
    ));
  } catch (error) {
    console.error('Error in handleDeleteContenantLink:', error);
  }
};

export const handleDeleteNegociantLink = async (
  negociantId: string, 
  siteId: string, 
  dechetId: string,
  onUpdateNegociantLinks: (links: NegociantLink[]) => void,
  negociantLinks: NegociantLink[]
) => {
  try {
    const { data: existingRecord, error: fetchError } = await supabase
      .from('table_autocompletion')
      .select('negociant_link')
      .eq('id', negociantId)
      .single();

    if (fetchError) {
      console.error('Error fetching negociant links:', fetchError);
      return;
    }

    const existingLinks = existingRecord?.negociant_link || [];
    const updatedLinks = existingLinks.filter(
      (link: { site: string; dechet: string }) => !(link.site === siteId && link.dechet === dechetId)
    );

    const { error: updateError } = await supabase
      .from('table_autocompletion')
      .update({ negociant_link: updatedLinks })
      .eq('id', negociantId);

    if (updateError) {
      console.error('Error updating negociant links:', updateError);
      return;
    }

    onUpdateNegociantLinks(negociantLinks.filter(
      link => !(link.site === siteId && link.dechet === dechetId)
    ));
  } catch (error) {
    console.error('Error in handleDeleteNegociantLink:', error);
  }
};

export const handleDeleteCourtierLink = async (
  courtierId: string, 
  siteId: string, 
  dechetId: string,
  onUpdateCourtierLinks: (links: CourtierLink[]) => void,
  courtierLinks: CourtierLink[]
) => {
  try {
    const { data: existingRecord, error: fetchError } = await supabase
      .from('table_autocompletion')
      .select('courtier_link')
      .eq('id', courtierId)
      .single();

    if (fetchError) {
      console.error('Error fetching courtier links:', fetchError);
      return;
    }

    const existingLinks = existingRecord?.courtier_link || [];
    const updatedLinks = existingLinks.filter(
      (link: { site: string; dechet: string }) => !(link.site === siteId && link.dechet === dechetId)
    );

    const { error: updateError } = await supabase
      .from('table_autocompletion')
      .update({ courtier_link: updatedLinks })
      .eq('id', courtierId);

    if (updateError) {
      console.error('Error updating courtier links:', updateError);
      return;
    }

    onUpdateCourtierLinks(courtierLinks.filter(
      link => !(link.site === siteId && link.dechet === dechetId)
    ));
  } catch (error) {
    console.error('Error in handleDeleteCourtierLink:', error);
  }
};

export const handleDeleteCodeTreatmentLink = async (
  codeTreatmentId: string, 
  siteId: string, 
  dechetId: string,
  onUpdateCodeTreatmentLinks: (links: CodeTreatmentLink[]) => void,
  codeTreatmentLinks: CodeTreatmentLink[]
) => {
  try {
    const { data: existingRecord, error: fetchError } = await supabase
      .from('table_autocompletion')
      .select('code_traitement_link')
      .eq('id', codeTreatmentId)
      .single();

    if (fetchError) {
      console.error('Error fetching code treatment links:', fetchError);
      return;
    }

    const existingLinks = existingRecord?.code_traitement_link || [];
    const updatedLinks = existingLinks.filter(
      (link: { site: string; dechet: string }) => !(link.site === siteId && link.dechet === dechetId)
    );

    const { error: updateError } = await supabase
      .from('table_autocompletion')
      .update({ code_traitement_link: updatedLinks })
      .eq('id', codeTreatmentId);

    if (updateError) {
      console.error('Error updating code treatment links:', updateError);
      return;
    }

    onUpdateCodeTreatmentLinks(codeTreatmentLinks.filter(
      link => !(link.site === siteId && link.dechet === dechetId)
    ));
  } catch (error) {
    console.error('Error in handleDeleteCodeTreatmentLink:', error);
  }
};

export const handleDeleteEcorganismeLink = async (
  ecoorganismeId: string, 
  siteId: string, 
  dechetId: string,
  onUpdateEcorganismeLinks: (links: EcorganismeLink[]) => void,
  ecoorganismeLinks: EcorganismeLink[]
) => {
  try {
    const { data: existingRecord, error: fetchError } = await supabase
      .from('table_autocompletion')
      .select('eco_organisme_link')
      .eq('id', ecoorganismeId)
      .single();

    if (fetchError) {
      console.error('Error fetching ecoorganisme links:', fetchError);
      return;
    }

    const existingLinks = existingRecord?.eco_organisme_link || [];
    const updatedLinks = existingLinks.filter(
      (link: { site: string; dechet: string }) => !(link.site === siteId && link.dechet === dechetId)
    );

    const { error: updateError } = await supabase
      .from('table_autocompletion')
      .update({ eco_organisme_link: updatedLinks })
      .eq('id', ecoorganismeId);

    if (updateError) {
      console.error('Error updating ecoorganisme links:', updateError);
      return;
    }

    onUpdateEcorganismeLinks(ecoorganismeLinks.filter(
      link => !(link.site === siteId && link.dechet === dechetId)
    ));
  } catch (error) {
    console.error('Error in handleDeleteEcorganismeLink:', error);
  }
};

export const handleDeleteContratLink = async (
  contratId: string,
  siteId: string,
  dechetId: string,
  onUpdateContratLinks: (links: ContratLink[]) => void,
  contratLinks: ContratLink[]
) => {
  try {
    const { data: existingRecord, error: fetchError } = await supabase
      .from('table_autocompletion')
      .select('contrat_link')
      .eq('id', contratId)
      .single();

    if (fetchError) {
      console.error('Error fetching contrat links:', fetchError);
      return;
    }

    const existingLinks = existingRecord?.contrat_link || [];
    const updatedLinks = existingLinks.filter(
      (link: { site: string; dechet: string }) => !(link.site === siteId && link.dechet === dechetId)
    );

    const { error: updateError } = await supabase
      .from('table_autocompletion')
      .update({ contrat_link: updatedLinks })
      .eq('id', contratId);

    if (updateError) {
      console.error('Error updating contrat links:', updateError);
      return;
    }

    onUpdateContratLinks(contratLinks.filter(
      link => !(link.site === siteId && link.dechet === dechetId)
    ));
  } catch (error) {
    console.error('Error in handleDeleteContratLink:', error);
  }
};



export const handleTransportLink = async (
  transportId: string, 
  siteId: string, 
  dechetId: string,
  isMailRecipient: boolean,
  onUpdateTransportLinks: (links: TransportLink[]) => void,
  transportLinks: TransportLink[]
) => {
  try {
    const newLink: TransportLink = { 
      id: transportId, 
      site: siteId, 
      dechet: dechetId,
      mail: isMailRecipient 
    };
    console.log('parametres', transportId, siteId, dechetId, isMailRecipient, onUpdateTransportLinks, transportLinks);

    onUpdateTransportLinks([...transportLinks, newLink]);

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
    const updatedLinks = [...existingLinks, newLink];

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

export const handleDestLink = async (
  destId: string, 
  siteId: string, 
  dechetId: string,
  isMailRecipient: boolean,
  onUpdateDestLinks: (links: DestLink[]) => void,
  destLinks: DestLink[]
) => {
  try {
    const newLink: DestLink = { 
      id: destId, 
      site: siteId, 
      dechet: dechetId,
      mail: isMailRecipient 
    };
    onUpdateDestLinks([...destLinks, newLink]);

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
    const updatedLinks = [...existingLinks, newLink];

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

export const handleContenantLink = async (
  contenantId: string, 
  siteId: string, 
  dechetId: string,
  onUpdateContenantLinks: (links: ContenantLink[]) => void,
  contenantLinks: ContenantLink[]
) => {
  try {
    const newLink: ContenantLink = { id: contenantId, site: siteId, dechet: dechetId };
    onUpdateContenantLinks([...contenantLinks, newLink]);

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
    const updatedLinks = [...existingLinks, newLink];

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

export const handleNegociantLink = async (
  negociantId: string, 
  siteId: string, 
  dechetId: string,
  isMailRecipient: boolean,
  onUpdateNegociantLinks: (links: NegociantLink[]) => void,
  negociantLinks: NegociantLink[]
) => {
  try {
    const newLink: NegociantLink = { 
      id: negociantId, 
      site: siteId, 
      dechet: dechetId,
      mail: isMailRecipient 
    };
    onUpdateNegociantLinks([...negociantLinks, newLink]);

    const { data: existingRecord, error: fetchError } = await supabase
      .from('table_autocompletion')
      .select('negociant_link')
      .eq('id', negociantId)
      .single();

    if (fetchError) {
      console.error('Error fetching existing negociant links:', fetchError);
      return;
    }

    const existingLinks = existingRecord?.negociant_link || [];
    const updatedLinks = [...existingLinks, newLink];

    const { error: updateError } = await supabase
      .from('table_autocompletion')
      .update({ negociant_link: updatedLinks })
      .eq('id', negociantId);

    if (updateError) {
      console.error('Error updating negociant link:', updateError);
    }
  } catch (error) {
    console.error('Error in handleNegociantLink:', error);
  }
};

export const handleCourtierLink = async (
  courtierId: string, 
  siteId: string, 
  dechetId: string,
  isMailRecipient: boolean,
  onUpdateCourtierLinks: (links: CourtierLink[]) => void,
  courtierLinks: CourtierLink[]
) => {
  try {
    const newLink: CourtierLink = { 
      id: courtierId, 
      site: siteId, 
      dechet: dechetId,
      mail: isMailRecipient 
    };
    onUpdateCourtierLinks([...courtierLinks, newLink]);

    const { data: existingRecord, error: fetchError } = await supabase
      .from('table_autocompletion')
      .select('courtier_link')
      .eq('id', courtierId)
      .single();

    if (fetchError) {
      console.error('Error fetching existing courtier links:', fetchError);
      return;
    }

    const existingLinks = existingRecord?.courtier_link || [];
    const updatedLinks = [...existingLinks, newLink];

    const { error: updateError } = await supabase
      .from('table_autocompletion')
      .update({ courtier_link: updatedLinks })
      .eq('id', courtierId);

    if (updateError) {
      console.error('Error updating courtier link:', updateError);
    }
  } catch (error) {
    console.error('Error in handleCourtierLink:', error);
  }
};

export const handleEcorganismeLink = async (
  ecoorganismeId: string, 
  siteId: string, 
  dechetId: string,
  isMailRecipient: boolean,
  onUpdateEcorganismeLinks: (links: EcorganismeLink[]) => void,
  ecoorganismeLinks: EcorganismeLink[]
) => {
  try {
    const newLink: EcorganismeLink = { 
      id: ecoorganismeId, 
      site: siteId, 
      dechet: dechetId,
      mail: isMailRecipient 
    };
    onUpdateEcorganismeLinks([...ecoorganismeLinks, newLink]);

    const { data: existingRecord, error: fetchError } = await supabase
      .from('table_autocompletion')
      .select('eco_organisme_link')
      .eq('id', ecoorganismeId)
      .single();

    if (fetchError) {
      console.error('Error fetching existing ecoorganisme links:', fetchError);
      return;
    }

    const existingLinks = existingRecord?.eco_organisme_link || [];
    const updatedLinks = [...existingLinks, newLink];

    const { error: updateError } = await supabase
      .from('table_autocompletion')
      .update({ eco_organisme_link: updatedLinks })
      .eq('id', ecoorganismeId);

    if (updateError) {
      console.error('Error updating ecoorganisme link:', updateError);
    }
  } catch (error) {
    console.error('Error in handleEcorganismeLink:', error);
  }
};

export const handleCodeTreatmentLink = async (
  codeTreatmentId: string, 
  siteId: string, 
  dechetId: string,
  onUpdateCodeTreatmentLinks: (links: CodeTreatmentLink[]) => void,
  codeTreatmentLinks: CodeTreatmentLink[]
) => {
  try {
    const newLink: CodeTreatmentLink = { id: codeTreatmentId, site: siteId, dechet: dechetId };
    onUpdateCodeTreatmentLinks([...codeTreatmentLinks, newLink]);

    const { data: existingRecord, error: fetchError } = await supabase
      .from('table_autocompletion')
      .select('code_traitement_link')
      .eq('id', codeTreatmentId)
      .single();

    if (fetchError) {
      console.error('Error fetching existing code treatment links:', fetchError);
      return;
    }

    const existingLinks = existingRecord?.code_traitement_link || [];
    const updatedLinks = [...existingLinks, newLink];

    const { error: updateError } = await supabase
      .from('table_autocompletion')
      .update({ code_traitement_link: updatedLinks })
      .eq('id', codeTreatmentId);

    if (updateError) {
      console.error('Error updating code treatment link:', updateError);
    }
  } catch (error) {
    console.error('Error in handleCodeTreatmentLink:', error);
  }
};

export const handleContratLink = async (
  contratId: string, 
  siteId: string, 
  dechetId: string,
  onUpdateContratLinks: (links: ContratLink[]) => void,
  contratLinks: ContratLink[]
) => {
  try {
    const newLink: ContratLink = { id: contratId, site: siteId, dechet: dechetId };
    onUpdateContratLinks([...contratLinks, newLink]);

    const { data: existingRecord, error: fetchError } = await supabase
      .from('table_autocompletion')
      .select('contrat_link')
      .eq('id', contratId)
      .single();

    if (fetchError) {
      console.error('Error fetching existing contrat links:', fetchError);
      return;
    }

    const existingLinks = existingRecord?.contrat_link || [];
    const updatedLinks = [...existingLinks, newLink];

    const { error: updateError } = await supabase
      .from('table_autocompletion')
      .update({ contrat_link: updatedLinks })
      .eq('id', contratId);

    if (updateError) {
      console.error('Error updating contrat link:', updateError);
    }
  } catch (error) {
    console.error('Error in handleContratLink:', error);
  }
};

export const handleSiteContactLink = async (
  siteId: string, 
  contactId: string,
  onUpdateSiteContactLinks: (links: SiteContactLink[]) => void,
  siteContactLinks: SiteContactLink[]
) => {
  try {
    const newLink: SiteContactLink = { id: contactId, site: siteId, contact: contactId };
    onUpdateSiteContactLinks([...siteContactLinks, newLink]);

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
    const updatedLinks = [...existingLinks, newLink];

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
};*/