// Fichier de test pour la nouvelle logique de matching automatique
import { AutoLinkParams } from './link';

// Exemple de paramètres JSON comme fourni par l'utilisateur
export const EXAMPLE_AUTO_LINK_PARAMS: AutoLinkParams = {
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
		}
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

// Fonction utilitaire pour créer des paramètres personnalisés
export const createAutoLinkParams = (customParams?: Partial<AutoLinkParams>): AutoLinkParams => {
	return {
		to_link: customParams?.to_link || EXAMPLE_AUTO_LINK_PARAMS.to_link,
		to_check_by_user: customParams?.to_check_by_user || EXAMPLE_AUTO_LINK_PARAMS.to_check_by_user,
		create: customParams?.create || EXAMPLE_AUTO_LINK_PARAMS.create
	};
};

// Exemples de règles spécifiques pour différents cas d'usage
export const STRICT_MATCHING_PARAMS: AutoLinkParams = {
	to_link: [
		{
			num_bsd: true,
			num_bon: false,
			site: true,
			presta: true,
			ced: true,
			nom_dechet_tresh: 90,
			nom_dechet: true,
			date: true,
			date_tresh: 1
		}
	],
	to_check_by_user: [
		{
			num_bsd: false,
			num_bon: true,
			site: true,
			presta: true,
			ced: true,
			nom_dechet_tresh: 80,
			nom_dechet: true,
			date: true,
			date_tresh: 5
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
			date_tresh: 30
		}
	]
};

export const LOOSE_MATCHING_PARAMS: AutoLinkParams = {
	to_link: [
		{
			num_bsd: true,
			num_bon: false,
			site: false,
			presta: false,
			ced: false,
			nom_dechet_tresh: 0,
			nom_dechet: false,
			date: true,
			date_tresh: 30
		}
	],
	to_check_by_user: [
		{
			num_bsd: false,
			num_bon: true,
			site: true,
			presta: false,
			ced: false,
			nom_dechet_tresh: 0,
			nom_dechet: false,
			date: true,
			date_tresh: 15
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
			date_tresh: 60
		}
	]
};
