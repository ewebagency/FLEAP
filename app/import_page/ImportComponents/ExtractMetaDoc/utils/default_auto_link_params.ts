import { AutoLinkParams } from './link';

// Paramètres par défaut pour la nouvelle logique de matching automatique
export const DEFAULT_AUTO_LINK_PARAMS: AutoLinkParams = {
	to_link: [
		{
			num_bsd: true,
			num_bon: false,
			site: true,
			presta: true,
			ced: false,
			nom_dechet_tresh: 0,
			nom_dechet: false,
			date: true,
			date_tresh: 10
		},    
		{
			num_bsd: false,
			num_bon: true,
			site: true,
			presta: true,
			ced: false,
			nom_dechet_tresh: 0,
			nom_dechet: false,
			date: true,
			date_tresh: 10
		},	
		{
			num_bsd: false,
			num_bon: false,
			site: true,
			presta: true,
			ced: true,
			nom_dechet_tresh: 0,
			nom_dechet: false,
			date: true,
			date_tresh: 0
		},
	],
	to_check_by_user: [
		{
			num_bsd: false,
			num_bon: false,
			site: true,
			presta: true,
			ced: true,
			nom_dechet_tresh: 0,
			nom_dechet: false,
			date: true,
			date_tresh: 2
		},	
		{
			num_bsd: false,
			num_bon: false,
			site: true,
			presta: true,
			ced: false,
			nom_dechet_tresh: 80,
			nom_dechet: true,
			date: true,
			date_tresh: 3
		},
		{
			num_bsd: false,
			num_bon: false,
			site: true,
			presta: true,
			ced: false,
			nom_dechet_tresh: 80,
			nom_dechet: true,
			date: true,
			date_tresh: 8
		}        
	],
	create: [
		{
			num_bsd: false,
			num_bon: false,
			site: true,
			presta: true,
			ced: false,
			nom_dechet_tresh: 0,
			nom_dechet: false,
			date: true,
			date_tresh: 10
		}
	]
};
