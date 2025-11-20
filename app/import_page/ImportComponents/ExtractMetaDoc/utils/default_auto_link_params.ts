import { AutoLinkParams, MatchingRule } from './link';

// Interface pour une configuration de linkage
export interface LinkConfig {
	id: string;
	name: string;
	description: string;
	params: AutoLinkParams;
}

// Interface simplifiée pour définir les règles (seulement les true)
interface SimplifiedRule {
	num_bsd?: boolean;
	num_bon?: boolean;
	site?: boolean;
	presta?: boolean;
	ced?: boolean;
	nom_dechet?: boolean;
	nom_dechet_tresh?: number;
	date?: boolean;
	date_tresh?: number;
}

// Fonction helper pour compléter une règle avec les false par défaut
const completeRule = (rule: SimplifiedRule): MatchingRule => {
	return {
		num_bsd: rule.num_bsd || false,
		num_bon: rule.num_bon || false,
		site: rule.site || false,
		presta: rule.presta || false,
		ced: rule.ced || false,
		nom_dechet: rule.nom_dechet || false,
		nom_dechet_tresh: rule.nom_dechet_tresh || 0,
		date: rule.date || false,
		date_tresh: rule.date_tresh || 0
	};
};

// Configuration LINK - pour linker à priori
export const LINK_CONFIG: AutoLinkParams = {
	to_link: [
		completeRule({
			num_bsd: true,
			date: true,
			date_tresh: 5
		}),
		completeRule({
			num_bon: true,
			date: true,
			date_tresh: 5
		}),			
		completeRule({
			site: true,
			presta: true,
			date: true,
			date_tresh: 0,
			ced: true,
		})
	],
	to_check_by_user: [
		completeRule({
			date: true,
			date_tresh: 100
		})
	],
	create: []
};

// Configuration CREATE - pour créer à priori
export const CREATE_CONFIG: AutoLinkParams = {
	to_link: [],
	to_check_by_user: [
		completeRule({
			num_bsd: true,
			presta: true,
			date: true,
			date_tresh: 5
		}),
		completeRule({
			num_bon: true,
			presta: true,
			date: true,
			date_tresh: 5
		}),			
	],
	create: [
		completeRule({
			date: true,
			date_tresh: 100
		})
	]
};

// Configuration priorisant l'usage des identifiants (numéro de bon / BSD)
export const ID_CONFIG: AutoLinkParams = {
	to_link: [
		completeRule({
			site: true,
			num_bon: true,
			date: true,
			date_tresh: 4
		}),
		completeRule({
			site: true,
			num_bsd: true,
			date: true,
			date_tresh: 4
		})
	],
	to_check_by_user: [],
	create: []
};

// Configuration dédiée aux documents sans identifiant exploitable
export const NO_ID_CONFIG: AutoLinkParams = {
	to_link: [],
	to_check_by_user: [
		completeRule({
			site: true,
			presta: true,
			nom_dechet: true,
			nom_dechet_tresh: 80,
			date: true,
			date_tresh: 0
		})
	],
	create: []
};

// Configuration NORMAL - configuration par défaut d'avant
export const NORMAL_CONFIG: AutoLinkParams = {
	to_link: [
		completeRule({
			num_bsd: true,
			site: true,
			date: true,
			date_tresh: 4
		}),    
		completeRule({
			num_bon: true,
			site: true,
			date: true,
			date_tresh: 4
		}),	
		completeRule({
			num_bsd: true,
			presta: true,
			date: true,
			date_tresh: 4
		}),    
		completeRule({
			num_bon: true,
			presta: true,
			date: true,
			date_tresh: 4
		}),	
		completeRule({
			site: true,
			presta: true,
			ced: true,
			date: true,
			date_tresh : 0
		})
	],
	to_check_by_user: [
		completeRule({
			site: true,
			presta: true,
			ced: true,
			date: true,
			date_tresh: 2
		}),	
		completeRule({
			site: true,
			presta: true,
			nom_dechet: true,
			nom_dechet_tresh: 80,
			date: true,
			date_tresh: 3
		}),
		completeRule({
			site: true,
			presta: true,
			nom_dechet: true,
			nom_dechet_tresh: 80,
			date: true,
			date_tresh: 8
		}),  
		completeRule({
			num_bsd: true
		}),
		completeRule({
			num_bon: true
		})   			 		   
	],
	create: [
		completeRule({
			site: true,
			presta: true,
			date: true,
			date_tresh: 10
		})
	]
};

// Configuration par défaut (NORMAL)
export const DEFAULT_AUTO_LINK_PARAMS: AutoLinkParams = NORMAL_CONFIG;

// Liste de toutes les configurations disponibles
export const LINK_CONFIGS: LinkConfig[] = [
	{
		id: 'id_based',
		name: 'Avec ID',
		description: 'Priorité aux liaisons par site + numéro (bon/BSD) et fallback strict sans ID',
		params: ID_CONFIG
	},
	{
		id: 'no_id',
		name: 'Sans ID',
		description: 'Pour les documents sans identifiant : site + presta + nom même jour',
		params: NO_ID_CONFIG
	},
	{
		id: 'link',
		name: 'Link',
		description: 'Optimisé pour linker - critères stricts',
		params: LINK_CONFIG
	},
	{
		id: 'normal',
		name: 'Normal',
		description: 'Configuration par défaut équilibrée',
		params: NORMAL_CONFIG
	},
	{
		id: 'create',
		name: 'Create',
		description: 'Optimisé pour créer - ne link que si N°BSD ou N°BON',
		params: CREATE_CONFIG
	}
];

// Fonction pour obtenir une configuration par ID
export const getLinkConfigById = (id: string): LinkConfig | undefined => {
	return LINK_CONFIGS.find(config => config.id === id);
};
