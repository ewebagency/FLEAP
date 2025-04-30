import { Site, Transporteur, Dechet, Destinataire, Contenant, Negociant, Courtier, Ecorganisme, CodeTreatment, Contrat, BaseLink } from "./types";

import { supabase } from "@/app/database/supabaseClient";

export const fetchAutocompletionData = async (
  entrepriseId: number,
  setSites: (sites: Site[]) => void,
  setTransporteurs: (transporteurs: Transporteur[]) => void,
  setDechets: (dechets: Dechet[]) => void,
  setDestinataires: (destinataires: Destinataire[]) => void,
  setContenants: (contenants: Contenant[]) => void,
  setNegociants: (negociants: Negociant[]) => void,
  setCourtiers: (courtiers: Courtier[]) => void,
  setEcoorganismes: (ecoorganismes: Ecorganisme[]) => void,
  setCodeTreatments: (codeTreatments: CodeTreatment[]) => void,
  setContrats: (contrats: Contrat[]) => void,
  setTransportLinks: (transportLinks: BaseLink[]) => void,
  setDestLinks: (destLinks: BaseLink[]) => void,
  setNegociantLinks: (negociantLinks: BaseLink[]) => void,
  setCourtierLinks: (courtierLinks: BaseLink[]) => void,
  setContenantLinks: (contenantLinks: BaseLink[]) => void,
  setCodeTreatmentLinks: (codeTreatmentLinks: BaseLink[]) => void,
  setEcoorganismeLinks: (ecoorganismeLinks: BaseLink[]) => void,
  setContratLinks: (contratLinks: BaseLink[]) => void
) => {
  try {
    console.log('Fetching autocompletion data for entreprise:', entrepriseId);
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
      const negociants: Negociant[] = [];
      const courtiers: Courtier[] = [];
      const ecoOrganismes: Ecorganisme[] = [];
      const contrats: Contrat[] = [];
      const codeTraitements: CodeTreatment[] = [];
      const transportLinks: BaseLink[] = [];
      const destLinks: BaseLink[] = [];
      const negociantLinks: BaseLink[] = [];
      const courtierLinks: BaseLink[] = [];
      const contenantLinks: BaseLink[] = [];
      const codeTreatmentLinks: BaseLink[] = [];
      const ecoorganismesLinks: BaseLink[] = [];
      const contratLinks: BaseLink[] = [];

      data.forEach(record => {
        if (record.site) {
          sites.push({
            ...record.site,
            id: record.id.toString()
          });
        }
        if (record.dechet) {
          dechets.push({
            ...record.dechet,
            id: record.id.toString()
          });
        }

        if (record.transporteur) {
          transporteurs.push({
            ...record.transporteur,
            id: record.id.toString()
          });
          if (record.transport_link) {
            record.transport_link.forEach((link: { site: string; dechet: string, mail: boolean }) => {
              transportLinks.push({
                id: record.id.toString(),
                site: link.site,
                dechet: link.dechet,
                mail: link.mail
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
            record.dest_link.forEach((link: { site: string; dechet: string, mail: boolean }) => {
              destLinks.push({
                id: record.id.toString(),
                site: link.site,
                dechet: link.dechet,
                mail: link.mail
              });
            });
          }
        }

        if (record.contenant) {
          contenants.push({
            ...record.contenant,
            id: record.id.toString()
          });
          if (record.contenant_link) {
            record.contenant_link.forEach((link: { site: string; dechet: string }) => {
              contenantLinks.push({
                id: record.id.toString(),
                site: link.site,
                dechet: link.dechet,
              });
            });
          }
        }

        if (record.negociant) {
          negociants.push({
            ...record.negociant,
            id: record.id.toString()
          });
        }
        if (record.negociant_link) {
          record.negociant_link.forEach((link: { site: string; dechet: string, mail: boolean }) => {
            negociantLinks.push({
              id: record.id.toString(),
              site: link.site,
              dechet: link.dechet,
              mail: link.mail
            });
          });
        }

        if (record.courtier) {
          courtiers.push({
            ...record.courtier,
            id: record.id.toString()
          });
        }
        if (record.courtier_link) {
          record.courtier_link.forEach((link: { site: string; dechet: string, mail: boolean }) => {
            courtierLinks.push({
              id: record.id.toString(),
              site: link.site,
              dechet: link.dechet,
              mail: link.mail
            });
          });
        }

        if (record.eco_organisme) {
          ecoOrganismes.push({
            ...record.eco_organisme,
            id: record.id.toString()
          });
        }
        if (record.eco_organisme_link) {
          record.eco_organisme_link.forEach((link: { site: string; dechet: string, mail: boolean }) => {
            ecoorganismesLinks.push({
              id: record.id.toString(),
              site: link.site,
              dechet: link.dechet,
              mail: link.mail
            });
          });
        }

        if (record.code_traitement) {
          codeTraitements.push({
            ...record.code_traitement,
            id: record.id.toString()
          });
        }
        if (record.code_traitement_link) {
          record.code_traitement_link.forEach((link: { site: string; dechet: string, mail: boolean }) => {
            codeTreatmentLinks.push({
              id: record.id.toString(),
              site: link.site,
              dechet: link.dechet
            });
          });
        }

        if (record.contrat) {
          contrats.push({
            ...record.contrat,
            id: record.id.toString()
          });
        }
        if (record.contrat_link) {
          record.contrat_link.forEach((link: { site: string; dechet: string }) => {
            contratLinks.push({
              id: record.id.toString(),
              site: link.site,
              dechet: link.dechet,
            });
          });
        }
      });

      setSites(sites);
      setTransporteurs(transporteurs);
      setDechets(dechets);
      setDestinataires(destinataires);
      setContenants(contenants);
      setNegociants(negociants);
      setCourtiers(courtiers);
      setEcoorganismes(ecoOrganismes);
      setContrats(contrats);
      setCodeTreatments(codeTraitements);
      setTransportLinks(transportLinks);
      setDestLinks(destLinks);
      setNegociantLinks(negociantLinks);
      setCourtierLinks(courtierLinks);
      setContenantLinks(contenantLinks);
      setCodeTreatmentLinks(codeTreatmentLinks);
      setEcoorganismeLinks(ecoorganismesLinks);
      setContratLinks(contratLinks);
    }
  } catch (error) {
    console.error('Error in fetchAutocompletionData:', error);
  }
};






