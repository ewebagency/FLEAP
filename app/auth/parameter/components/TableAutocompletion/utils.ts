/*import { Site, Transporteur, Dechet, Destinataire, Contenant, ContactEmetteur, Negociant, Courtier, Ecorganisme, CodeTreatment } from "./types";
import { DestLink, TransportLink, NegociantLink, CourtierLink, ContenantLink, SiteContactLink, CodeTreatmentLink, EcorganismeLink } from "./types";


import { supabase } from "@/app/database/supabaseClient";

export const fetchAutocompletionData = async (entrepriseId: number, setSites: (sites: Site[]) => void, setTransporteurs: (transporteurs: Transporteur[]) => void, setDechets: (dechets: Dechet[]) => void, setDestinataires: (destinataires: Destinataire[]) => void, setContenants: (contenants: Contenant[]) => void, setContactEmetteurs: (contactEmetteurs: ContactEmetteur[]) => void, setNegociants: (negociants: Negociant[]) => void, setCourtiers: (courtiers: Courtier[]) => void, setEcoorganismes: (ecoorganismes: Ecorganisme[]) => void, setCodeTreatments: (codeTreatments: CodeTreatment[]) => void, setTransportLinks: (transportLinks: TransportLink[]) => void, setDestLinks: (destLinks: DestLink[]) => void, setNegociantLinks: (negociantLinks: NegociantLink[]) => void, setCourtierLinks: (courtierLinks: CourtierLink[]) => void, setContenantLinks: (contenantLinks: ContenantLink[]) => void, setSiteContactLinks: (siteContactLinks: SiteContactLink[]) => void, setCodeTreatmentLinks: (codeTreatmentLinks: CodeTreatmentLink[]) => void, setEcoorganismeLinks: (ecoorganismeLinks: EcorganismeLink[]) => void) => {
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
        const contactEmetteurs: ContactEmetteur[] = [];
        const negociants: Negociant[] = [];
        const courtiers: Courtier[] = [];
        const ecoOrganismes: Ecorganisme[] = [];
        const codeTraitements: CodeTreatment[] = [];
        const transportLinks: TransportLink[] = [];
        const destLinks: DestLink[] = [];
        const negociantLinks: NegociantLink[] = [];
        const courtierLinks: CourtierLink[] = [];
        const contenantLinks: ContenantLink[] = [];
        const siteContactLinks: SiteContactLink[] = [];
        const codeTreatmentLinks: CodeTreatmentLink[] = [];
        const ecoorganismesLinks: EcorganismeLink[] = [];

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
              record.transport_link.forEach((link: { site: string; dechet: string }) => {
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
              record.dest_link.forEach((link: { site: string; dechet: string }) => {
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

          if (record.contact_emetteur) {
            contactEmetteurs.push({
              ...record.contact_emetteur,
              id: record.id.toString()
            });
          }
          if (record.contact_link) {
            record.contact_link.forEach((link: { site: string; contact: string }) => {
              siteContactLinks.push({
                id: record.id.toString(),
                site: link.site,
                contact: link.contact
              });
            });
          }

          if (record.negociant) {
            negociants.push({
              ...record.negociant,
              id: record.id.toString()
            });
          }
          if (record.negociant_link) {
            record.negociant_link.forEach((link: { site: string; dechet: string }) => {
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
            record.courtier_link.forEach((link: { site: string; dechet: string }) => {
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
            record.eco_organisme_link.forEach((link: { site: string; dechet: string }) => {
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
            record.code_traitement_link.forEach((link: { site: string; dechet: string }) => {
              codeTreatmentLinks.push({
                id: record.id.toString(),
                site: link.site,
                dechet: link.dechet
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
        setNegociants(negociants);
        setCourtiers(courtiers);
        setEcoorganismes(ecoOrganismes);
        setCodeTreatments(codeTraitements);
        setTransportLinks(transportLinks);
        setDestLinks(destLinks);
        setNegociantLinks(negociantLinks);
        setCourtierLinks(courtierLinks);
        setContenantLinks(contenantLinks);
        setSiteContactLinks(siteContactLinks);
        setCodeTreatmentLinks(codeTreatmentLinks);
        setEcoorganismeLinks(ecoorganismesLinks);
      }


    } catch (error) {
      console.error('Error in fetchAutocompletionData:', error);
    }
  };






  */