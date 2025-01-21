import { supabase } from '@/app/database/supabaseClient';
import { FactureLine } from '../types/interfaces';

type BaseNestedObject = {
    [key: string]: string | number | boolean | BaseNestedObject | BaseNestedObject[] | undefined;
};

type NestedObject = BaseNestedObject | FactureLine;

type NestedArray = NestedObject[];


export const getNestedValue = (
    obj: FactureLine | NestedObject, 
    path: string
): string | number | boolean | undefined => {
    try {
        const result = path.split('.').reduce<unknown>((acc, part) => {
            if (!acc) return undefined;
            return (acc as Record<string, unknown>)[part];
        }, obj);
        
        return result as string | number | boolean | undefined;
    } catch (error) {
        console.warn(`Error getting nested value for path ${path}:`, error);
        return undefined;
    }
};

export const getMappingTableFiliere = async (entrepriseId: string | null) => {
    if (!entrepriseId) return [];
    
    const { data, error } = await supabase
        .from('entreprise')
        .select('mapping_ced_filiere')
        .eq('id', entrepriseId)
        .single();
        
    if (error) {
        console.error('Erreur lors de la récupération du mapping:', error);
        return [];
    }
    return data?.mapping_ced_filiere || [];
};

export const getFiliere = (code: string | undefined, mappingTable: { ced: string, filiere: string }[]) => {
    if (!code) return '';
    
    const codeClean = code.replaceAll(" ", "").replace('*', '');
    const result = mappingTable.find(item => item.ced === codeClean)?.filiere;
    console.log("mappingtable", mappingTable);
    console.log("code", code);
    console.log("result", result);
    // Mettre la première lettre en majuscule et le reste en minuscule
    return result ? result.charAt(0).toUpperCase() + result.slice(1).toLowerCase() : '';
}; 