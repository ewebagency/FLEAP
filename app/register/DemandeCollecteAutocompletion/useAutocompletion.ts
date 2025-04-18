/*import { AutocompletionData, SelectedFields, AutocompletionLinks } from "./types"
import { useEffect, useState } from "react";
import { fetchAutocompletionData, fetchAutocompletionLinks, checkAutocompletion } from "./utils";

export const useAutocompletion = (entreprise_id: string|null) => {
  const [allOptions, setAllOptions] = useState<AutocompletionData>({
    sites: [],
    transporteurs: [],
    destinataires: [],
    dechets: [],
    contenants: [],
    contacts: []
  });
  const [links, setLinks] = useState<AutocompletionLinks>({
    transportLinks: [],
    destinataireLinks: [],
    contenantLinks: [],
    codeTraitementLinks: [],
    contactLinks: []
  });

  const [selectedFieldsList, setSelectedFieldsList] = useState<SelectedFields[]>([{
    site: null,
    pointCollecte: null,
    dechet: null,
    transporteur: null,
    destinataire: null,
    contenant: null,
    contactEmetteur: null,
    date: null
  }]);

  useEffect(() => {
    const fetchData = async () => {
      if (entreprise_id) {
        const data = await fetchAutocompletionData(Number(entreprise_id));
        const dataLinks = await fetchAutocompletionLinks(Number(entreprise_id));
        setLinks(dataLinks);
        setAllOptions(data);
      }
    };
    fetchData();
  }, [entreprise_id]);

  const handleFieldChange = (index: number, field: keyof SelectedFields, value: any | null) => {
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
      return newList.map(fields => checkAutocompletion(fields, links, allOptions));
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
          contenant: null,
          date: null
        }
      ];
    });
  };

  const removeLine = (index: number) => {
    setSelectedFieldsList(prev => prev.filter((_, i) => i !== index));
  };

  return { allOptions, selectedFieldsList, handleFieldChange, addNewLine, removeLine };
};
*/