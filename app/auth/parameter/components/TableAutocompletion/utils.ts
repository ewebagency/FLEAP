import { Site, Transporteur, Dechet, Destinataire, Contenant, Negociant, Courtier, Ecorganisme, CodeTreatment, Contrat, BaseLink } from "./types";

import { supabase } from "@/app/database/supabaseClient";

interface AutocompletionRecord {
  id: string;
  entreprise_id: number;
  site?: Site;
  transporteur?: Transporteur;
  dechet?: Dechet;
  destinataire?: Destinataire;
  contenant?: Contenant;
  negociant?: Negociant;
  courtier?: Courtier;
  eco_organisme?: Ecorganisme;
  code_traitement?: CodeTreatment;
  contrat?: Contrat;
  transport_link?: BaseLink[];
  dest_link?: BaseLink[];
  contenant_link?: BaseLink[];
  code_traitement_link?: BaseLink[];
  negociant_link?: BaseLink[];
  courtier_link?: BaseLink[];
  eco_organisme_link?: BaseLink[];
  contrat_link?: BaseLink[];
}

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
    
    // Charger toutes les données avec une boucle pour éviter la limite de 1000
    const allData: AutocompletionRecord[] = [];
    const batchSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('table_autocompletion')
        .select('*')
        .eq('entreprise_id', entrepriseId)
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error('Error fetching autocompletion data:', error);
        return;
      }

      if (data && data.length > 0) {
        allData.push(...(data as AutocompletionRecord[]));
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    if (allData.length > 0) {
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

      allData.forEach(record => {
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
            record.transport_link.forEach((link: BaseLink) => {
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
            record.dest_link.forEach((link: BaseLink) => {
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
            record.contenant_link.forEach((link: BaseLink) => {
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
          record.negociant_link.forEach((link: BaseLink) => {
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
          record.courtier_link.forEach((link: BaseLink) => {
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
          record.eco_organisme_link.forEach((link: BaseLink) => {
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
          record.code_traitement_link.forEach((link: BaseLink) => {
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
          record.contrat_link.forEach((link: BaseLink) => {
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






