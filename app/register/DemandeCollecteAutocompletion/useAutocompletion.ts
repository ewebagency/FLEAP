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

  const [selectedFields, setSelectedFields] = useState<SelectedFields>({
    site: null,
    pointCollecte: null,
    dechet: null,
    transporteur: null,
    destinataire: null,
    contenant: null,
    contactEmetteur: null,
    date: null
  });

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

  const handleFieldChange = (field: keyof SelectedFields, value: any | null) => {
    setSelectedFields(prev => {
      const newFields = { ...prev, [field]: value };
      const updatedFields = checkAutocompletion(newFields, links, allOptions);
      //console.log('updatedFields', updatedFields);
      return updatedFields;
    });
  };
  

  //console.log('alloptions', allOptions);
  return { allOptions, selectedFields, handleFieldChange };
};
*/