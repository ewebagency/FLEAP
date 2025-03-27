'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { FilterContextType, FilterData, FILTER_FIELDS, FilterFunction, FilterValue } from './types';
import { get } from 'lodash';
import { useSession } from '../SessionProvider';
import { BSDD_TrackDechets } from '@/app/register/interface/BSD_Interface';
import { BSD } from '@/app/analysis/AnalysisProvider';
import { CommonBSD } from "@/app/register/FiltreFunctionnal";
import { supabase } from '@/app/database/supabaseClient';

export type TYPE_table_bsd = CommonBSD;

const FiltresPersoContext = createContext<FilterContextType | undefined>(undefined);

const STORAGE_KEY = 'filtresPerso';

export const FiltresPersoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  
  const [data, setData] = useState<TYPE_table_bsd[]>([]);
  const [filterData, setFilterData] = useState<FilterData>(() => {
    // Initialiser filterData depuis localStorage si disponible
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });
  const [filterFunctions, setFilterFunctions] = useState<FilterFunction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const {entreprise_id, user_id} = useSession();
  const [mappingCodeTraitement, setMappingCodeTraitement] = useState<Record<string, string[]>>({});

  // Fonction pour récupérer le mapping_code_traitement
  useEffect(() => {
    const fetchMappingCodeTraitement = async () => {
      if (!entreprise_id) return;
      
      try {
        const { data, error } = await supabase
          .from('entreprise')
          .select('mapping_code_traitement')
          .eq('id', entreprise_id)
          .single();

        if (error) {
          console.error('Erreur mapping_code_traitement:', error);
          return;
        }

        if (data?.mapping_code_traitement) {
          setMappingCodeTraitement(data.mapping_code_traitement);
        }
      } catch (error) {
        console.error('Erreur mapping_code_traitement:', error);
      }
    };

    fetchMappingCodeTraitement();
  }, [entreprise_id]);

  // Fonction pour calculer le nom le plus fréquent pour un SIRET donné
  const calculateMostFrequentName = (data: TYPE_table_bsd[], field: string, siret: string): string => {
    const nameCounts: Record<string, number> = {};
    
    data.forEach(item => {
      const formInput = item.infos_json?.formAPI?.createFormInput;
      if (!formInput) return;

      // Utiliser le chemin complet du champ pour la comparaison
      if (field === 'formAPI.createFormInput.transporter.company.siret' && formInput.transporter?.company?.siret === siret) {
        const name = formInput.transporter?.company?.name || '';
        if (name) {
          nameCounts[name] = (nameCounts[name] || 0) + 1;
        }
      } else if (field === 'formAPI.createFormInput.recipient.company.siret' && formInput.recipient?.company?.siret === siret) {
        const name = formInput.recipient?.company?.name || '';
        if (name) {
          nameCounts[name] = (nameCounts[name] || 0) + 1;
        }
      }
    });

    let mostFrequentName = '';
    let maxCount = 0;

    Object.entries(nameCounts).forEach(([name, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostFrequentName = name;
      }
    });

    return mostFrequentName;
  };

  // Sauvegarder filterData dans localStorage quand il change
  useEffect(() => {
    if (Object.keys(filterData).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filterData));
    }
  }, [filterData]);

  // Charger les données initiales
  useEffect(() => {
    
    // Si session est null ou pas d'entreprise_id, on n'est pas connecté
    if (!entreprise_id) {
      setIsLoading(false);
      setData([]);
      return;
    }

    const loadFilterData = async () => {
      setIsLoading(true);
      try {
        // Utiliser l'API get_data_bsd au lieu de Supabase
        const response = await fetch(`/api/get_data_bsd?entreprise_id=${entreprise_id}&user_id=${user_id}`);
        const { data: bsds } = await response.json();

        if (!bsds) {
          console.error("Pas de données reçues de l'API");
          return;
        }

        setData(bsds);
      } catch (error) {
        console.error("Error in loadFilterData:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFilterData();
  }, [entreprise_id]);

  // Mettre à jour filterData quand data change
  useEffect(() => {
    if (!data.length) {
      return;
    }
    
    const newFilterData: FilterData = {};
    const savedFilterData = typeof window !== 'undefined' ? 
      JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') : {};
    
    for (const field of FILTER_FIELDS) {
      const colonne = field.supabase_column;
      const json_path = field.json_path;
      const unique_values = Array.from(new Set(data.map(item => {
        if (colonne === 'on_track_dechets' || colonne === 'created_on_fleap') {
          return item[colonne] ? "Oui" : "Non";
        }
        
        const value = get(item[colonne], json_path);
        if (field.label === "Déchet Dangereux") {
          return value ? "Dangereux" : "Non dangereux";
        }
        return value?.toString() || '';
      })));
      
      const savedValues = savedFilterData[field.label] || [];
      const savedValuesMap = new Map(savedValues.map((v: FilterValue) => [v.value, !!v.checked]));
      
      const value_checked = unique_values.map(value => {
        let mostFrequentName = '';
        // Calculer le nom le plus fréquent pour les SIRET
        if (field.label === "Transporteur (siret)" || field.label === "Destinataire (siret)") {
          mostFrequentName = calculateMostFrequentName(data, json_path, value);
        }
        
        return {
          value,
          checked: savedValuesMap.has(value) ? Boolean(savedValuesMap.get(value)) : true,
          mostFrequentName
        };
      });
      
      newFilterData[field.label] = value_checked;
    }

    setFilterData(newFilterData);
  }, [data]);

  // Met à jour une valeur de filtre et reconstruit les fonctions de filtrage
  const updateFilterValue = (fieldLabel: string, value: string, checked: boolean) => {
    const newData = { ...filterData };
    
    const fieldValues = newData[fieldLabel];
    const valueIndex = fieldValues.findIndex(v => v.value === value);
    
    if (valueIndex !== -1) {
        fieldValues[valueIndex] = { ...fieldValues[valueIndex], checked };
    }
    
    setFilterData(newData);

    // Reconstruire immédiatement les fonctions de filtrage avec les nouvelles données
    const newFilterFunctions: FilterFunction[] = [];

    FILTER_FIELDS.forEach(field => {
        const checkedValues = newData[field.label]?.filter(v => v.checked).map(v => v.value);
        
        if (checkedValues && checkedValues.length < newData[field.label].length) {
            const filterFunction = (data: TYPE_table_bsd[]) => {
                return data.filter(item => {
                    if (field.supabase_column === 'on_track_dechets' || field.supabase_column === 'created_on_fleap') {
                        const boolValue = item[field.supabase_column];
                        const stringValue = boolValue ? "Oui" : "Non";
                        return checkedValues.includes(stringValue);
                    }
                    
                    const itemValue = get(item[field.supabase_column], field.json_path);
                    // Traitement spécial pour le champ isDangerous
                    if (field.label === "Déchet Dangereux") {
                        const displayValue = itemValue ? "Dangereux" : "Non dangereux";
                        return checkedValues.includes(displayValue);
                    }
                    return checkedValues.includes(itemValue?.toString() || '');
                });
            };
            newFilterFunctions.push(filterFunction);
        }
    });

    setFilterFunctions(newFilterFunctions);
  };

  // Ajouter cette nouvelle fonction pour mettre à jour toutes les valeurs d'un champ
  const updateAllFilterValues = (fieldLabel: string, checked: boolean) => {
    const newData = { ...filterData };
    
    newData[fieldLabel] = newData[fieldLabel].map(v => ({
      ...v,
      checked
    }));
    
    setFilterData(newData);

    // Reconstruire les fonctions de filtrage
    const newFilterFunctions: FilterFunction[] = [];

    FILTER_FIELDS.forEach(field => {
      const checkedValues = newData[field.label]?.filter(v => v.checked).map(v => v.value);
      
      if (checkedValues && checkedValues.length < newData[field.label].length) {
        const filterFunction = (data: TYPE_table_bsd[]) => {
          return data.filter(item => {
            if (field.supabase_column === 'on_track_dechets' || field.supabase_column === 'created_on_fleap') {
              const boolValue = item[field.supabase_column];
              const stringValue = boolValue ? "Oui" : "Non";
              return checkedValues.includes(stringValue);
            }
            
            const itemValue = get(item[field.supabase_column], field.json_path);
            if (field.label === "Déchet Dangereux") {
              const displayValue = itemValue ? "Dangereux" : "Non dangereux";
              return checkedValues.includes(displayValue);
            }
            return checkedValues.includes(itemValue?.toString() || '');
          });
        };
        newFilterFunctions.push(filterFunction);
      }
    });

    setFilterFunctions(newFilterFunctions);
  };

  // Applique toutes les fonctions de filtrage à un ensemble de données
  const applyFilters = (data: TYPE_table_bsd[]) => {
    return filterFunctions.reduce((filteredData, filterFn) => {
      return filterFn(filteredData);
    }, data);
  };

  // Réinitialise tous les filtres
  const clearFilters = () => {
    setFilterData(prev => {
      const newData = { ...prev };
      Object.keys(newData).forEach(fieldLabel => {
        newData[fieldLabel] = newData[fieldLabel].map(value => ({
          ...value,
          checked: false
        }));
      });
      return newData;
    });
    setFilterFunctions([]);
  };

  return (
    <FiltresPersoContext.Provider
      value={{
        filterFields: FILTER_FIELDS,
        filterData,
        filterFunctions,
        updateFilterValue,
        updateAllFilterValues,
        clearFilters,
        applyFilters,
        isLoading,
        mappingCodeTraitement
      }}
    >
      {children}
    </FiltresPersoContext.Provider>
  );
};

export const useFiltresPerso = () => {
  const context = useContext(FiltresPersoContext);
  if (context === undefined) {
    throw new Error('useFiltresPerso must be used within a FiltresPersoProvider');
  }
  return context;
};