import { AutocompletionData, SelectedFields, AutocompletionLinks } from "./types"
import { useEffect, useState } from "react";
import { fetchAutocompletionData, fetchAutocompletionLinks, checkAutocompletion, TYPES_PRESTATION } from "./utils";

export const useAutocompletion = (entreprise_id: string|null, site_access?: string[]) => {
  const [autocompletionEnabled, setAutocompletionEnabled] = useState(true);
  const [allOptions, setAllOptions] = useState<AutocompletionData>({
    sites: [],
    transporteurs: [],
    destinataires: [],
    dechets: [],
    contenants: [],
    negociants: [],
    courtiers: [],
    ecoorganismes: [],
    codeTraitements: [],
    contrats: []
  });
  const [links, setLinks] = useState<AutocompletionLinks>({
    transportLinks: [],
    destinataireLinks: [],
    contenantLinks: [],
    codeTraitementLinks: [],
    negociantLinks: [],
    courtierLinks: [],
    ecoorganismeLinks: [],
    contratLinks: []
  });

  const [selectedFieldsList, setSelectedFieldsList] = useState<SelectedFields[]>([{
    site: null,
    pointCollecte: null,
    dechet: null,
    transporteur: null,
    destinataire: null,
    negociant: null,
    courtier: null,
    contenant: null,
    contactEmetteur: null,
    date: null,
    nombreContenant: 1,
    destinataireMail: 'transporteur',
    typePrestation: TYPES_PRESTATION.ENLEVEMENT_AVEC_DEPOT,
    showNegociant: false,
    ecoorganisme: null,
    codeTraitement: null,
    contrat: null,
    mention: null,
    photo: null,
    showTime: false,
    time: '09:00'
  }]);

  useEffect(() => {
    const fetchData = async () => {
      if (entreprise_id) {
        const data = await fetchAutocompletionData(Number(entreprise_id));
        const dataLinks = await fetchAutocompletionLinks(Number(entreprise_id));
        
        // Filtrer les sites en fonction des site_access
        const filteredData = { ...data };
        if (site_access && site_access.length > 0) {
          filteredData.sites = data.sites.filter(site => 
            site_access.includes(site.value.siret)
          );
        }

        setLinks(dataLinks);
        setAllOptions(filteredData);

        // Si un seul site est disponible, l'auto-compléter
        if (filteredData.sites.length === 1) {
          setSelectedFieldsList(prev => {
            const newList = [...prev];
            newList[0] = { ...newList[0], site: filteredData.sites[0] };
            return newList.map(fields => checkAutocompletion(fields, dataLinks, filteredData));
          });
        }
      }
    };
    fetchData();
  }, [entreprise_id, site_access]);

  const handleFieldChange = (index: number, field: keyof SelectedFields, value: SelectedFields[keyof SelectedFields]) => {
    setSelectedFieldsList(prev => {
      const newList = [...prev];
      newList[index] = { ...newList[index], [field]: value };
      
      // Si on modifie les champs partagés (site, pointCollecte, contactEmetteur)
      // on met à jour toutes les lignes
      if (field === 'site' || field === 'pointCollecte' || field === 'contactEmetteur') {
        for (let i = 0; i < newList.length; i++) {
          if (i !== index) {
            newList[i] = { ...newList[i], [field]: value };
          }
        }
      }

      // On vérifie l'autocomplétion pour chaque ligne
      if(autocompletionEnabled){
        return newList.map(fields => checkAutocompletion(fields, links, allOptions));
      }
      return newList;
    });
  };

  const addNewLine = () => {
    setSelectedFieldsList(prev => {
      const lastLine = prev[prev.length - 1];
      return [
        ...prev,
        {
          site: lastLine.site,
          pointCollecte: lastLine.pointCollecte,
          contactEmetteur: lastLine.contactEmetteur,
          dechet: null,
          transporteur: null,
          destinataire: null,
          negociant: null,
          courtier: null,
          contenant: null,
          ecoorganisme: null,
          codeTraitement: null,
          contrat: null,
          date: null,
          nombreContenant: 1,
          destinataireMail: 'transporteur',
          typePrestation: TYPES_PRESTATION.ENLEVEMENT_AVEC_DEPOT,
          showNegociant: false,
          mention: null,
          photo: null,
          showTime: false,
          time: '09:00'
        }
      ];
    });
  };

  const removeLine = (index: number) => {
    setSelectedFieldsList(prev => prev.filter((_, i) => i !== index));
  };

  //console.log("selectedFieldsList", selectedFieldsList);
  return { allOptions, selectedFieldsList, handleFieldChange, addNewLine, removeLine, autocompletionEnabled, setAutocompletionEnabled };
};
