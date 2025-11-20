"use client";

import { useEffect, useMemo, useState } from 'react';
import { useSession } from '@/app/component/SessionProvider';
import { PdfInfo } from '../interface/pdf_interface';
import { getPdfInfoById, getBSDCandidates } from '../utils/bdd';
import { LINK_RULES_DEFAULT, BSDCandidate, ProposeActionAuto, ProposeActionResult, AutoLinkOrCreateThisDoc, isNumberContained, findSiretFromMapping, MatchingRule, normalizePdfData } from '../utils/link';
import PushFactureButton from './PushFactureButton';
import { LINK_CONFIGS, getLinkConfigById } from '../utils/default_auto_link_params';
import { create_in_bdd, create_in_bdd_preview, link_in_bdd, translateByMapping } from '../utils/link_or_create_bdd';
import { useParamsMapping } from '../utils/extract';
import { supabase } from '@/app/database/supabaseClient';

interface LinkMetaProps {
	pdfId: string;
}



type DechetItem = {
	ced?: string;
	d_r?: string;
	nom?: string;
	date?: string;
	facture?: {
		ligne?: Array<{
			unite?: string;
			quantite?: string;
			montant_ht?: string;
			tva_absolute?: string;
			prix_unitaire?: string;
			type_operation?: string;
		}>;
	};
	num_bon?: string;
	num_bsd?: string;
	tonnage?: string;
	contenant?: string;
	volume_m3?: string;
	declassement?: boolean;
	nom_site?: string;
	adresse_site?: string;
};

const isDateInRange = (date1: string, date2: string, ecartDays: number): boolean => {
	if (!date1 || !date2) return true;
	
	// Parser les dates en format DD/MM/YYYY ou MM/DD/YYYY
	const parseDate = (dateStr: string): Date => {
		// Essayer d'abord le format DD/MM/YYYY
		const parts = dateStr.split('/');
		if (parts.length === 3) {
			const day = parseInt(parts[0]);
			const month = parseInt(parts[1]) - 1; // Month est 0-based
			const year = parseInt(parts[2]);
			
			// Si day > 12, c'est probablement DD/MM/YYYY
			if (day > 12) {
				return new Date(year, month, day);
			}
			// Sinon, essayer MM/DD/YYYY
			else {
				return new Date(year, day - 1, month);
			}
		}
		// Fallback sur le parser natif
		return new Date(dateStr);
	};
	
	const d1 = parseDate(date1);
	const d2 = parseDate(date2);
	if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return true;
	
	// Normaliser les dates à minuit pour éviter les problèmes d'heures
	const d1Normalized = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
	const d2Normalized = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
	
	const diffTime = Math.abs(d1Normalized.getTime() - d2Normalized.getTime());
	const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
	
	//console.log(`Date1: "${date1}" → ${d1Normalized.toISOString()}, Date2: "${date2}" → ${d2Normalized.toISOString()}, Diff: ${diffDays} jours, Max: ${ecartDays} jours`);
	
	return diffDays <= ecartDays;
};


export default function LinkMeta({ pdfId }: LinkMetaProps) {
	const { user_id, entreprise_id } = useSession();
	const entrepriseIdNum = useMemo(() => (entreprise_id ? Number(entreprise_id) : null), [entreprise_id]);

	const { data: mappings } = useParamsMapping(entrepriseIdNum);

	const [pdfInfo, setPdfInfo] = useState<PdfInfo | null>(null);
	const [loadingPdf, setLoadingPdf] = useState(false);
	const [errors, setErrors] = useState<string | null>(null);

	const [proposeActionResults, setProposeActionResults] = useState<Record<number, ProposeActionResult | undefined>>({});
	const [candidatesByIndex, setCandidatesByIndex] = useState<Record<number, BSDCandidate[]>>({});
	const [allCandidates, setAllCandidates] = useState<BSDCandidate[] | null>(null);
	const [rawCandidatesByIndex, setRawCandidatesByIndex] = useState<Record<number, BSDCandidate[]>>({});
	const [filtersByIndex, setFiltersByIndex] = useState<Record<number, { site: boolean; presta: boolean; numBon: boolean; numBsd: boolean; ced: boolean; wasteName: boolean; date: boolean }>>({});
	const [daysByIndex, setDaysByIndex] = useState<Record<number, number>>({});
	const [busyIndex, setBusyIndex] = useState<number | null>(null);
	const [actionMsg, setActionMsg] = useState<string | null>(null);
	const [openIndex, setOpenIndex] = useState<number | null>(null);
	const [showRules, setShowRules] = useState<boolean>(false);
	const [busyAll, setBusyAll] = useState(false);
	const [autoAllResults, setAutoAllResults] = useState<Record<number, ProposeActionResult | undefined>>({});
	
    // Configuration de linkage sélectionnée
    const [selectedConfigId, setSelectedConfigId] = useState<string>('id_based');

	const dechets: DechetItem[] = useMemo(() => {
		const raw = (pdfInfo?.infos_raw || {}) as Record<string, unknown>;
		const maybe = (raw as { dechet?: unknown }).dechet;
		return Array.isArray(maybe) ? (maybe as DechetItem[]) : [];
	}, [pdfInfo]);

	const normalConfig = useMemo(() => {
		return getLinkConfigById('normal') || LINK_CONFIGS[0];
	}, []);
	
	// Rôle du prestataire (déterminé via table_autocompletion comme dans create_in_bdd)
	const [prestaRole, setPrestaRole] = useState<'destinataire' | 'transporteur' | null>(null);
	
	// Obtenir la configuration actuelle
	const currentConfig = useMemo(() => {
		return getLinkConfigById(selectedConfigId) || normalConfig; // fallback sur Normal
	}, [selectedConfigId, normalConfig]);
	
	// Dictionnaire des explications pour chaque action
	// (removed unused actionExplanations to satisfy linter)
	const [previewModal, setPreviewModal] = useState<{ open: boolean; index: number; data: Record<string, unknown> | null }>({ open: false, index: -1, data: null });
	
	// State local pour le statut des déchets liés/créés (même structure que bsd_linked en BDD)
	const [bsdLinked, setBsdLinked] = useState<Array<{ bsd_id?: number; index_dechet: number; status: 'linked' | 'created' | 'check_by_user' | 'pushed' }>>([]);

	useEffect(() => {
		const fetchPdf = async () => {
			if (!entrepriseIdNum) return;
			setLoadingPdf(true);
			setErrors(null);
			try {
				const { data, error } = await getPdfInfoById(pdfId, entrepriseIdNum);
				if (error || !data) throw new Error(error?.message || 'PDF introuvable');
				setPdfInfo(data as PdfInfo);
				
				// Récupérer et synchroniser le statut bsd_linked depuis la BDD
				const pdfData = data as PdfInfo;
				if (pdfData.bsd_linked && Array.isArray(pdfData.bsd_linked)) {
					// Convertir le format BDD en format local (inclure 'pushed')
					const initialStatus = pdfData.bsd_linked.map(item => ({
						bsd_id: item.bsd_id,
						index_dechet: item.index_dechet,
						status: (item.status as 'linked' | 'created' | 'check_by_user' | 'pushed') || 'linked'
					}));
					setBsdLinked(initialStatus);
				}
			} catch (e) {
				setErrors(e instanceof Error ? e.message : 'Erreur inconnue');
			} finally {
				setLoadingPdf(false);
			}
		};
		fetchPdf();
	}, [pdfId, entrepriseIdNum]);

	// Prefetch all BSD candidates once with wide window: [min(pdf dates) - 100d, max(pdf dates) + 100d]
	useEffect(() => {
		const fetchAllCandidates = async () => {
			if (!entrepriseIdNum || !pdfInfo) return;
			try {
				const ecart = 31; //1 mois avant et 1 mois après
				// derive min/max dates across dechets
				const dates = dechets
					.map(d => (d?.date ? new Date(d.date) : null))
					.filter((d): d is Date => !!d && !isNaN(d.getTime()));
				const today = new Date();
				const minDate = dates.length ? new Date(Math.min(...dates.map(d => d.getTime()))) : today;
				const maxDate = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : today;
				const start = new Date(minDate);
				start.setDate(start.getDate() - ecart);
				const end = new Date(maxDate);
				end.setDate(end.getDate() + ecart);

				const { data, error } = await getBSDCandidates(
					entrepriseIdNum,
					start.toISOString(),
					end.toISOString(),
					1000
				);
				if (error || !data) throw new Error(error?.message || 'Aucun candidat');
				setAllCandidates(data as BSDCandidate[]);
			} catch (e) {
				console.error('Erreur chargement candidats globaux', e);
			}
		};
		fetchAllCandidates();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [entrepriseIdNum, pdfInfo]);

	const rawSite = useMemo(() => {
		const raw = (pdfInfo?.infos_raw || {}) as Record<string, unknown>;
		return (raw.site_raw as string) || '';
	}, [pdfInfo]);

	const rawPresta = useMemo(() => {
		const raw = (pdfInfo?.infos_raw || {}) as Record<string, unknown>;
		return (raw.presta_raw as string) || '';
	}, [pdfInfo]);

	const typeDoc = useMemo(() => {
		const raw = (pdfInfo?.infos_raw || {}) as Record<string, unknown>;
		return ((raw.type_doc as string) || '').toLowerCase() || 'bon';
	}, [pdfInfo]);

	const translated = useMemo(() => {
		const site = mappings ? translateByMapping(rawSite, mappings.params_mapping_site || {}) : { name: rawSite, siret: '' };
		const presta = mappings ? translateByMapping(rawPresta, mappings.params_mapping_presta || {}) : { name: rawPresta, siret: '' };
		return { site, presta };
	}, [mappings, rawSite, rawPresta]);

	// Indicateurs: si une traduction via mapping a abouti (siret non vide)
	const siteTranslatedOk = useMemo(() => !!(translated.site?.siret && translated.site.siret.trim() !== ''), [translated]);
	const prestaTranslatedOk = useMemo(() => !!(translated.presta?.siret && translated.presta.siret.trim() !== ''), [translated]);

	// Déterminer le rôle du prestataire (même logique que create_in_bdd)
	useEffect(() => {
		const getPrestaRole = async () => {
			if (!entrepriseIdNum || !translated.presta.name) {
				setPrestaRole(null);
				return;
			}
			
			try {
				const nameNorm = translated.presta.name.toLowerCase().trim();
				const { data, error } = await supabase
					.from('table_autocompletion')
					.select('transporteur, destinataire')
					.eq('entreprise_id', entrepriseIdNum);
				
				if (error || !data) {
					setPrestaRole(null);
					return;
				}

				const extractNomBoites = (node: unknown): string[] => {
					const results: string[] = [];
					if (!node) return results;
					if (Array.isArray(node)) {
						for (const item of node) {
							results.push(...extractNomBoites(item));
						}
					} else if (typeof node === 'object') {
						const obj = node as Record<string, unknown>;
						if (typeof obj.nomBoite === 'string') {
							results.push(obj.nomBoite);
						}
						for (const v of Object.values(obj)) {
							results.push(...extractNomBoites(v));
						}
					}
					return results;
				};

				let foundRole: 'destinataire' | 'transporteur' | null = null;
				for (const row of data as Array<{ transporteur: unknown; destinataire: unknown }>) {
					const transNames = extractNomBoites(row.transporteur).map(s => s.toLowerCase().trim());
					if (transNames.includes(nameNorm)) {
						foundRole = 'transporteur';
						break;
					}
					const destNames = extractNomBoites(row.destinataire).map(s => s.toLowerCase().trim());
					if (destNames.includes(nameNorm)) {
						foundRole = 'destinataire';
						break;
					}
				}
				setPrestaRole(foundRole);
			} catch {
				setPrestaRole(null);
			}
		};
		
		getPrestaRole();
	}, [entrepriseIdNum, translated.presta.name]);


	const runProposeActionAuto = async (index: number) => {
		if (!pdfInfo || entrepriseIdNum == null || !allCandidates || !mappings) return;
		setBusyIndex(index);
		setActionMsg(null);
		try {
			const result = ProposeActionAuto(
				pdfInfo.infos_raw || {},
				allCandidates,
				mappings,
				currentConfig.params,
				index
			);
			setProposeActionResults(prev => ({ ...prev, [index]: result }));
			
			// Toujours calculer le nombre de candidats et appliquer les filtres
			let filteredCandidates = allCandidates;
			const usedRule = result.matched_rule;
			const ruleInfo = result.rule_info || 'Règle par défaut';
			
			// Fonction locale pour extraire les chiffres d'un CED (comme dans link.ts)
			const extractNumbersFromCed = (ced: string): string => {
				return ced.replace(/[^\d]/g, '').replace(/\s/g, '');
			};
			
			// Utiliser la MÊME logique que ProposeActionAuto pour la cohérence
			// Créer une condition basée sur la règle utilisée
			const createCondition = (rule: MatchingRule) => {
				return (bsdCandidate: BSDCandidate): boolean => {
					// Normaliser les données du PDF comme dans ProposeActionAuto
					const normalizedPdf = normalizePdfData(
						pdfInfo.infos_raw || {},
						mappings?.params_mapping_site || {},
						mappings?.params_mapping_presta || {},
						index
					);

					// Vérification num_bsd
					if (rule.num_bsd) {
						const pdfNumBsd = normalizedPdf.num_bsd || '';
						const candidateNumBsd = (bsdCandidate.readable_id_track_dechets || '').trim();
						if (!isNumberContained(pdfNumBsd, candidateNumBsd)) {
							return false;
						}
					}

					// Vérification num_bon
					if (rule.num_bon) {
						const pdfNumBon = normalizedPdf.num_bon || '';
						const candidateNumBon = (bsdCandidate.other_infos?.numeroBon || '').trim();
						if (!isNumberContained(pdfNumBon, candidateNumBon)) {
							return false;
						}
					}

					// Vérification site (comparaison SIRET via mapping)
					if (rule.site) {
						const pdfSiteName = normalizedPdf.site || '';
						const pdfSiteSiret = findSiretFromMapping(pdfSiteName, mappings?.params_mapping_site || {});
						const candidateSiteSiret = (bsdCandidate.infos_json.formAPI.createFormInput.emitter.company?.siret || '').trim();
						
						if (!pdfSiteSiret || !candidateSiteSiret || pdfSiteSiret !== candidateSiteSiret) {
							return false;
						}
					}

					// Vérification prestataire (comparaison SIRET via mapping - destinataire OU transporteur)
					if (rule.presta) {
						const pdfDestinataireName = normalizedPdf.destinataire || '';
						const pdfTransporteurName = normalizedPdf.transporteur || '';
						const pdfDestinataireSiret = findSiretFromMapping(pdfDestinataireName, mappings?.params_mapping_presta || {});
						const pdfTransporteurSiret = findSiretFromMapping(pdfTransporteurName, mappings?.params_mapping_presta || {});
						
						const candidateRecipientSiret = (bsdCandidate.infos_json.formAPI.createFormInput.recipient.company.siret || '').trim();
						const candidateTransporterSiret = (bsdCandidate.infos_json.formAPI.createFormInput.transporter.company.siret || '').trim();
						
						const recipientOk = pdfDestinataireSiret && candidateRecipientSiret && pdfDestinataireSiret === candidateRecipientSiret;
						const transporterOk = pdfTransporteurSiret && candidateTransporterSiret && pdfTransporteurSiret === candidateTransporterSiret;
						
						if (!recipientOk && !transporterOk) {
							return false;
						}
					}

					// Vérification CED
					if (rule.ced) {
						const pdfCedNumbers = extractNumbersFromCed(normalizedPdf.ced || '');
						const candidateCedNumbers = extractNumbersFromCed(bsdCandidate.infos_json.formAPI.createFormInput.wasteDetails.code || '');
						if (!pdfCedNumbers || !candidateCedNumbers || pdfCedNumbers !== candidateCedNumbers) {
							return false;
						}
					}

					// Vérification nom de déchet (fuzzy matching)
					if (rule.nom_dechet) {
						const pdfWaste = normalizedPdf.waste_name || '';
						const candidateWaste = (bsdCandidate.infos_json.formAPI.createFormInput.wasteDetails.name || '').toLowerCase().trim();
						const similarity = computeSimilarity(pdfWaste, candidateWaste);
						if (!pdfWaste || !candidateWaste || similarity < (rule.nom_dechet_tresh / 100)) {
							return false;
						}
					}

					// Vérification date
					if (rule.date) {
						const takenOverAt = bsdCandidate.infos_json?.formAPI?.createFormInput?.takenOverAt || '';
						const candidateDate = takenOverAt || bsdCandidate.created_at;
						const dateMatch = isDateInRange(candidateDate, normalizedPdf.date, rule.date_tresh);
						if (!normalizedPdf.date || !dateMatch) {
							return false;
						}
					}

					return true;
				};
			};

			// Appliquer la condition avec la règle utilisée
			if (usedRule) {
				const isInCondition = createCondition(usedRule);
				filteredCandidates = allCandidates.filter(isInCondition);
				
				// Configurer les filtres selon la règle
				const filters = {
					site: usedRule.site,
					presta: usedRule.presta,
					numBon: usedRule.num_bon,
					numBsd: usedRule.num_bsd,
					ced: usedRule.ced,
					wasteName: usedRule.nom_dechet,
					date: usedRule.date
				};
				
				// Mettre à jour les states
				setFiltersByIndex(prev => ({ ...prev, [index]: filters }));
				setDaysByIndex(prev => ({ ...prev, [index]: usedRule.date_tresh }));
				setRawCandidatesByIndex(prev => ({ ...prev, [index]: allCandidates }));
				
				// Afficher l'info de la règle utilisée
				setActionMsg(`Filtres configurés avec ${ruleInfo}`);
			} else {
				// Pas de règle utilisée (to_create par défaut) - utiliser la dernière règle to_check_by_user testée
				// Cela donne plus de sens à l'utilisateur de voir les filtres de la règle la plus stricte
				const lastCheckedRule = currentConfig.params.to_check_by_user[currentConfig.params.to_check_by_user.length - 1];
				
				if (lastCheckedRule) {
					const filters = {
						site: lastCheckedRule.site,
						presta: lastCheckedRule.presta,
						numBon: lastCheckedRule.num_bon,
						numBsd: lastCheckedRule.num_bsd,
						ced: lastCheckedRule.ced,
						wasteName: lastCheckedRule.nom_dechet,
						date: lastCheckedRule.date
					};
					
					// Appliquer le filtrage avec la dernière règle to_check_by_user
					const isInCondition = createCondition(lastCheckedRule);
					filteredCandidates = allCandidates.filter(isInCondition);
					
					// Mettre à jour les states
					setFiltersByIndex(prev => ({ ...prev, [index]: filters }));
					setDaysByIndex(prev => ({ ...prev, [index]: lastCheckedRule.date_tresh }));
					setRawCandidatesByIndex(prev => ({ ...prev, [index]: allCandidates }));
					
					// Afficher l'info
					setActionMsg(`Aucune règle spécifique - filtres de la dernière règle to_check_by_user (${filteredCandidates.length} candidats)`);
				} else {
					// Fallback si pas de règle to_check_by_user
					const filters = {
						site: false,
						presta: false,
						numBon: false,
						numBsd: false,
						ced: false,
						wasteName: false,
						date: false
					};
					
					// Mettre à jour les states
					setFiltersByIndex(prev => ({ ...prev, [index]: filters }));
					setDaysByIndex(prev => ({ ...prev, [index]: LINK_RULES_DEFAULT.looseDays }));
					setRawCandidatesByIndex(prev => ({ ...prev, [index]: allCandidates }));
					
					// Afficher l'info
					setActionMsg(`Aucune règle spécifique - tous les candidats affichés (${allCandidates.length})`);
				}
			}
			
			setCandidatesByIndex(prev => ({ ...prev, [index]: filteredCandidates }));
			
			// Ouvrir automatiquement la section des candidats
			setOpenIndex(index);
		} catch (error) {
			console.error('Erreur dans runProposeActionAuto:', error);
			setProposeActionResults(prev => ({ ...prev, [index]: { action: 'to_create' } }));
		} finally {
			setBusyIndex(null);
		}
	};

	const openForIndex = (index: number) => {
		if (!dechets[index]) return;
		// toggle behavior
		setOpenIndex(prev => (prev === index ? null : index));
		// prepare candidates/filters for this index using preloaded global list
		if (!allCandidates) return;
		const d = dechets[index] as DechetItem;
		const rawList = allCandidates;
		setRawCandidatesByIndex(prev => ({ ...prev, [index]: rawList }));
		setFiltersByIndex(prev => ({ ...prev, [index]: prev[index] || { site: true, presta: true, numBon: true, numBsd: true, ced: true, wasteName: true, date: true } }));
		setDaysByIndex(prev => ({ ...prev, [index]: prev[index] ?? LINK_RULES_DEFAULT.looseDays }));
		const filtered = applyFilters(index, rawList, d);
		setCandidatesByIndex(prev => ({ ...prev, [index]: filtered }));
	};

	// Fuzzy matching pour les noms de déchets (même logique que LinkAuto)
	const computeSimilarity = (a: string, b: string): number => {
		if (!a || !b) return 0;
		const s = a.toLowerCase().trim();
		const t = b.toLowerCase().trim();
		const m = s.length;
		const n = t.length;
		if (m === 0) return n;
		if (n === 0) return m;
		const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
		for (let i = 0; i <= m; i++) dp[i][0] = i;
		for (let j = 0; j <= n; j++) dp[0][j] = j;
		for (let i = 1; i <= m; i++) {
			for (let j = 1; j <= n; j++) {
				const cost = s[i - 1] === t[j - 1] ? 0 : 1;
				dp[i][j] = Math.min(
					dp[i - 1][j] + 1,
					dp[i][j - 1] + 1,
					dp[i - 1][j - 1] + cost
				);
			}
		}
		const dist = dp[m][n];
		const maxLen = Math.max(m, n);
		return maxLen === 0 ? 1 : 1 - dist / maxLen;
	};

	const applyFilters = (index: number, rawList: BSDCandidate[], d: DechetItem, overrideDays?: number): BSDCandidate[] => {
		const active = filtersByIndex[index] || { site: false, presta: false, numBon: false, numBsd: false, ced: false, wasteName: false, date: false };
		
		// V2: Pour les factures, utiliser nom_site du déchet (sinon rawSite global)
		const docType = (pdfInfo?.infos_raw as Record<string, unknown> | undefined)?.type_doc as string | undefined;
		const siteForThisDechet = (docType === 'facture' && d.nom_site) 
			? d.nom_site 
			: rawSite;
		
		// Calculer les traductions pour ce déchet spécifique
		const siteTranslated = translateByMapping(siteForThisDechet, mappings?.params_mapping_site || {});
		const prestaTranslated = translateByMapping(rawPresta, mappings?.params_mapping_presta || {});
		const translatedForThisDechet = { site: siteTranslated, presta: prestaTranslated };
		
		const siteName = translatedForThisDechet.site.name || '';
		const prestaName = translatedForThisDechet.presta.name || '';
		const numBon = (d?.num_bon || '').trim();
		const numBsd = (d?.num_bsd || '').trim();
		const cedNumbers = (d?.ced || '').replace(/[^\d]/g, '').trim();
		const wasteNameLc = (d?.nom || '').toLowerCase().trim();
		const pdfDate = d?.date || '';
		const nDays = overrideDays ?? daysByIndex[index] ?? LINK_RULES_DEFAULT.looseDays;
		
		return rawList.filter(c => {
			// Récupérer les SIRET des candidats
			const candidateSiteSiret = (c.infos_json?.formAPI?.createFormInput?.emitter?.company?.siret || '').trim();
			const candidateRecipientSiret = (c.infos_json?.formAPI?.createFormInput?.recipient?.company?.siret || '').trim();
			const candidateTransporterSiret = (c.infos_json?.formAPI?.createFormInput?.transporter?.company?.siret || '').trim();
			
			const candNumBon = (c.other_infos?.numeroBon || '').trim();
			const candNumBsd = (c.readable_id_track_dechets || '').trim();
			const candCed = (c.infos_json?.formAPI?.createFormInput?.wasteDetails?.code || '').replace(/[^\d]/g, '').trim();
			const candWaste = (c.infos_json?.formAPI?.createFormInput?.wasteDetails?.name || '').toLowerCase().trim();
			const takenOverAt = (c.infos_json?.formAPI?.createFormInput?.takenOverAt || '') as string;
			const candDate = takenOverAt || c.created_at;
			
			// Logique cohérente avec LinkAuto : si le filtre est coché, la donnée PDF doit exister ET correspondre
			// Si le filtre est coché mais que le PDF n'a pas la donnée, le BSD est automatiquement filtré
			
			// Site : comparaison SIRET
			const pdfSiteSiret = findSiretFromMapping(siteName, mappings?.params_mapping_site || {});
			const bySite = !active.site || (pdfSiteSiret && pdfSiteSiret === candidateSiteSiret);
			
			// Prestataire : comparaison SIRET (destinataire OU transporteur)
			const pdfDestinataireSiret = findSiretFromMapping(prestaName, mappings?.params_mapping_presta || {});
			const pdfTransporteurSiret = findSiretFromMapping(prestaName, mappings?.params_mapping_presta || {});
			const byPresta = !active.presta || (
				(pdfDestinataireSiret && pdfDestinataireSiret === candidateRecipientSiret) ||
				(pdfTransporteurSiret && pdfTransporteurSiret === candidateTransporterSiret)
			);
			
			// Numéros : test de contenu mutuel (min 5 chiffres)
			const byNumBon = !active.numBon || (numBon && isNumberContained(numBon, candNumBon));
			const byNumBsd = !active.numBsd || (numBsd && isNumberContained(numBsd, candNumBsd));
			const byCed = !active.ced || (cedNumbers && cedNumbers === candCed);
			
			// Fuzzy matching pour les noms de déchets (même seuil que LinkAuto)
			const wasteSimilarity = computeSimilarity(wasteNameLc, candWaste);
			const byWaste = !active.wasteName || (wasteNameLc && wasteSimilarity >= LINK_RULES_DEFAULT.wasteNameThresholdStrict);
			
			const byDate = !active.date || (pdfDate && isDateInRange(candDate, pdfDate, nDays));
			
			return bySite && byPresta && byNumBon && byNumBsd && byCed && byWaste && byDate;
		});
	};

	const toggleFilter = (index: number, key: 'site' | 'presta' | 'numBon' | 'numBsd' | 'ced' | 'wasteName' | 'date') => {
		const d = dechets[index];
		if (!d) return;
		const current = filtersByIndex[index] || { site: true, presta: true, numBon: true, numBsd: true, ced: true, wasteName: true, date: true };
		const newValue = !current[key];
		
		// Mettre à jour le state immédiatement
		setFiltersByIndex(prev => ({ ...prev, [index]: { ...current, [key]: newValue } }));
		
		// Appliquer le filtre avec la nouvelle valeur
		const rawList = rawCandidatesByIndex[index] || [];
		const newFilters = { ...current, [key]: newValue };
		const currentDays = daysByIndex[index] ?? LINK_RULES_DEFAULT.looseDays;
		
		// V2: Pour les factures, utiliser nom_site du déchet
		const docType = (pdfInfo?.infos_raw as Record<string, unknown> | undefined)?.type_doc as string | undefined;
		const siteForThisDechet = (docType === 'facture' && d.nom_site) 
			? d.nom_site 
			: rawSite;
		
		// Calculer les traductions pour ce déchet spécifique
		const siteTranslated = translateByMapping(siteForThisDechet, mappings?.params_mapping_site || {});
		const prestaTranslated = translateByMapping(rawPresta, mappings?.params_mapping_presta || {});
		const translatedForThisDechet = { site: siteTranslated, presta: prestaTranslated };
		
		const filtered = rawList.filter(c => {
			const siteName = translatedForThisDechet.site.name || '';
			const prestaName = translatedForThisDechet.presta.name || '';
			const numBon = (d?.num_bon || '').trim();
			const numBsd = (d?.num_bsd || '').trim();
			const cedNumbers = (d?.ced || '').replace(/[^\d]/g, '').trim();
			const wasteNameLc = (d?.nom || '').toLowerCase().trim();
			const pdfDate = d?.date || '';
			
			// Récupérer les SIRET des candidats
			const candidateSiteSiret = (c.infos_json?.formAPI?.createFormInput?.emitter?.company?.siret || '').trim();
			const candidateRecipientSiret = (c.infos_json?.formAPI?.createFormInput?.recipient?.company?.siret || '').trim();
			const candidateTransporterSiret = (c.infos_json?.formAPI?.createFormInput?.transporter?.company?.siret || '').trim();
			
			const candNumBon = (c.other_infos?.numeroBon || '').trim();
			const candNumBsd = (c.readable_id_track_dechets || '').trim();
			const candCed = (c.infos_json?.formAPI?.createFormInput?.wasteDetails?.code || '').replace(/[^\d]/g, '').trim();
			const candWaste = (c.infos_json?.formAPI?.createFormInput?.wasteDetails?.name || '').toLowerCase().trim();
			const takenOverAt = (c.infos_json?.formAPI?.createFormInput?.takenOverAt || '') as string;
			const candDate = takenOverAt || c.created_at;
			
			// Site : comparaison SIRET
			const pdfSiteSiret = findSiretFromMapping(siteName, mappings?.params_mapping_site || {});
			const bySite = !newFilters.site || (pdfSiteSiret && pdfSiteSiret === candidateSiteSiret);
			
			// Prestataire : comparaison SIRET (destinataire OU transporteur)
			const pdfDestinataireSiret = findSiretFromMapping(prestaName, mappings?.params_mapping_presta || {});
			const pdfTransporteurSiret = findSiretFromMapping(prestaName, mappings?.params_mapping_presta || {});
			const byPresta = !newFilters.presta || (
				(pdfDestinataireSiret && pdfDestinataireSiret === candidateRecipientSiret) ||
				(pdfTransporteurSiret && pdfTransporteurSiret === candidateTransporterSiret)
			);
			
			// Numéros : test de contenu mutuel (min 5 chiffres)
			const byNumBon = !newFilters.numBon || (numBon && isNumberContained(numBon, candNumBon));
			const byNumBsd = !newFilters.numBsd || (numBsd && isNumberContained(numBsd, candNumBsd));
			const byCed = !newFilters.ced || (cedNumbers && cedNumbers === candCed);
			
			// Fuzzy matching pour les noms de déchets (même seuil que LinkAuto)
			// Si le filtre est coché mais que le PDF n'a pas de nom, le BSD est filtré
			const wasteSimilarity = computeSimilarity(wasteNameLc, candWaste);
			const byWaste = !newFilters.wasteName || (wasteNameLc && wasteSimilarity >= LINK_RULES_DEFAULT.wasteNameThresholdStrict);
			
			const byDate = !newFilters.date || (pdfDate && isDateInRange(candDate, pdfDate, currentDays));
			
			return bySite && byPresta && byNumBon && byNumBsd && byCed && byWaste && byDate;
		});
		setCandidatesByIndex(prev => ({ ...prev, [index]: filtered }));
	};

	const onDaysChange = (index: number, value: number) => {
		const d = dechets[index];
		if (!d) return;
		const newDays = Math.max(0, Math.min(365, value || 0));
		
		// Mettre à jour le state immédiatement
		setDaysByIndex(prev => ({ ...prev, [index]: newDays }));
		
		// Appliquer le filtre avec la nouvelle valeur
		const rawList = rawCandidatesByIndex[index] || [];
		const currentFilters = filtersByIndex[index] || { site: true, presta: true, numBon: true, numBsd: true, ced: true, wasteName: true, date: true };
		
		// V2: Pour les factures, utiliser nom_site du déchet
		const docType = (pdfInfo?.infos_raw as Record<string, unknown> | undefined)?.type_doc as string | undefined;
		const siteForThisDechet = (docType === 'facture' && d.nom_site) 
			? d.nom_site 
			: rawSite;
		
		// Calculer les traductions pour ce déchet spécifique
		const siteTranslated = translateByMapping(siteForThisDechet, mappings?.params_mapping_site || {});
		const prestaTranslated = translateByMapping(rawPresta, mappings?.params_mapping_presta || {});
		const translatedForThisDechet = { site: siteTranslated, presta: prestaTranslated };
		
		const filtered = rawList.filter(c => {
			const siteName = translatedForThisDechet.site.name || '';
			const prestaName = translatedForThisDechet.presta.name || '';
			const numBon = (d?.num_bon || '').trim();
			const numBsd = (d?.num_bsd || '').trim();
			const cedNumbers = (d?.ced || '').replace(/[^\d]/g, '').trim();
			const wasteNameLc = (d?.nom || '').toLowerCase().trim();
			const pdfDate = d?.date || '';
			
			// Récupérer les SIRET des candidats
			const candidateSiteSiret = (c.infos_json?.formAPI?.createFormInput?.emitter?.company?.siret || '').trim();
			const candidateRecipientSiret = (c.infos_json?.formAPI?.createFormInput?.recipient?.company?.siret || '').trim();
			const candidateTransporterSiret = (c.infos_json?.formAPI?.createFormInput?.transporter?.company?.siret || '').trim();
			
			const candNumBon = (c.other_infos?.numeroBon || '').trim();
			const candNumBsd = (c.readable_id_track_dechets || '').trim();
			const candCed = (c.infos_json?.formAPI?.createFormInput?.wasteDetails?.code || '').replace(/[^\d]/g, '').trim();
			const candWaste = (c.infos_json?.formAPI?.createFormInput?.wasteDetails?.name || '').toLowerCase().trim();
			const takenOverAt = (c.infos_json?.formAPI?.createFormInput?.takenOverAt || '') as string;
			const candDate = takenOverAt || c.created_at;
			
			// Site : comparaison SIRET
			const pdfSiteSiret = findSiretFromMapping(siteName, mappings?.params_mapping_site || {});
			const bySite = !currentFilters.site || (pdfSiteSiret && pdfSiteSiret === candidateSiteSiret);
			
			// Prestataire : comparaison SIRET (destinataire OU transporteur)
			const pdfDestinataireSiret = findSiretFromMapping(prestaName, mappings?.params_mapping_presta || {});
			const pdfTransporteurSiret = findSiretFromMapping(prestaName, mappings?.params_mapping_presta || {});
			const byPresta = !currentFilters.presta || (
				(pdfDestinataireSiret && pdfDestinataireSiret === candidateRecipientSiret) ||
				(pdfTransporteurSiret && pdfTransporteurSiret === candidateTransporterSiret)
			);
			
			// Numéros : test de contenu mutuel (min 5 chiffres)
			const byNumBon = !currentFilters.numBon || (numBon && isNumberContained(numBon, candNumBon));
			const byNumBsd = !currentFilters.numBsd || (numBsd && isNumberContained(numBsd, candNumBsd));
			const byCed = !currentFilters.ced || (cedNumbers && cedNumbers === candCed);
			
			// Fuzzy matching pour les noms de déchets (même seuil que LinkAuto)
			// Si le filtre est coché mais que le PDF n'a pas de nom, le BSD est filtré
			const wasteSimilarity = computeSimilarity(wasteNameLc, candWaste);
			const byWaste = !currentFilters.wasteName || (wasteNameLc && wasteSimilarity >= LINK_RULES_DEFAULT.wasteNameThresholdStrict);
			
			const byDate = !currentFilters.date || (pdfDate && isDateInRange(candDate, pdfDate, newDays));
			
			return bySite && byPresta && byNumBon && byNumBsd && byCed && byWaste && byDate;
		});
		setCandidatesByIndex(prev => ({ ...prev, [index]: filtered }));
	};

	// Fonction pour mettre à jour le statut local d'un déchet
	const updateDechetStatus = (index: number, bsdId: number, status: 'linked' | 'created' | 'pushed') => {
		setBsdLinked(prev => {
			// Retirer l'ancien statut s'il existe
			const filtered = prev.filter(item => item.index_dechet !== index);
			// Ajouter le nouveau statut
			return [...filtered, { bsd_id: bsdId, index_dechet: index, status }];
		});
	};

	// Fonction pour obtenir le statut d'un déchet
	const getDechetStatus = (index: number) => {
		return bsdLinked.find(item => item.index_dechet === index);
	};

	const doLink = async (index: number, bsdId: string) => {
		if (entrepriseIdNum == null || !pdfInfo) return;
		setBusyIndex(index);
		setActionMsg(null);
		try {
			await link_in_bdd(entrepriseIdNum, bsdId, pdfId, index);
			// Mettre à jour le statut local
			updateDechetStatus(index, parseInt(bsdId), 'linked');
			setActionMsg('Liaison effectuée');
		} catch (e) {
			setActionMsg(e instanceof Error ? e.message : 'Erreur lors de la liaison');
		} finally {
			setBusyIndex(null);
		}
	};

	const doCreate = async (index: number) => {
		if (entrepriseIdNum == null || !user_id) return;
		setBusyIndex(index);
		setActionMsg(null);
		try {
			const result = await create_in_bdd_preview(entrepriseIdNum, pdfId, index, user_id);
			setPreviewModal({ open: true, index, data: result.preview || null });
		} catch (e) {
			setActionMsg(e instanceof Error ? e.message : 'Erreur lors de la création');
		} finally {
			setBusyIndex(null);
		}
	};

	const confirmCreate = async () => {
		if (previewModal.index === -1) return;
		setBusyIndex(previewModal.index);
		setActionMsg(null);
		try {
			const result = await create_in_bdd(entrepriseIdNum!, pdfId, previewModal.index, { user_id: user_id! });
			// Mettre à jour le statut local avec l'ID du BSD créé
			if (result && result.bsd_id) {
				updateDechetStatus(previewModal.index, parseInt(result.bsd_id), 'created');
			}
			setActionMsg('Création effectuée');
			setPreviewModal({ open: false, index: -1, data: null });
		} catch (e) {
			setActionMsg(e instanceof Error ? e.message : 'Erreur lors de la création');
		} finally {
			setBusyIndex(null);
		}
	};

	const runAutoForAll = async () => {
		if (!pdfInfo || entrepriseIdNum == null || !allCandidates || !mappings) return;
		setBusyAll(true);
		setActionMsg(null);
		try {
			const outcome = await AutoLinkOrCreateThisDoc(
				pdfInfo.infos_raw || {},
				allCandidates,
				mappings,
				currentConfig.params,
				{ entrepriseId: entrepriseIdNum, pdfId, userId: user_id || undefined }
			);
			// Store results per index
			const next: Record<number, ProposeActionResult> = {};
			for (const item of outcome.results) {
				next[item.index_dechet] = item.result;
			}
			setAutoAllResults(next);
			// Refresh pdfInfo and local bsdLinked state
			const { data, error } = await getPdfInfoById(pdfId, entrepriseIdNum);
			if (!error && data) {
				setPdfInfo(data as PdfInfo);
				const pdfData = data as PdfInfo;
				if (pdfData.bsd_linked && Array.isArray(pdfData.bsd_linked)) {
					const nextStatus = pdfData.bsd_linked.map(item => ({
						bsd_id: item.bsd_id,
						index_dechet: item.index_dechet,
						status: (item.status as 'linked' | 'created') || 'linked'
					}));
					setBsdLinked(nextStatus);
				}
			}
			setActionMsg('Auto-link terminé');
		} catch (e) {
			setActionMsg(e instanceof Error ? e.message : 'Erreur lors de l\'auto-link');
		} finally {
			setBusyAll(false);
		}
	};

	if (!entrepriseIdNum) return <div className="p-4 text-sm text-gray-600">Aucune entreprise dans la session.</div>;
	if (loadingPdf) return <div className="p-4">Chargement...</div>;
	if (errors) return <div className="p-4 text-red-600">{errors}</div>;
	if (!pdfInfo) return <div className="p-4">PDF introuvable.</div>;

	return (
		<>
			<div className="space-y-4">
				<div className="bg-white rounded-lg border shadow-sm p-3">
					<div className="flex items-center justify-between mb-3">
						<div className="flex flex-col">
							<span className="text-xs font-semibold text-purple-600">Association aux BSD</span>
							<span className="text-[11px] text-gray-600">{typeDoc.toUpperCase()} · {pdfInfo.name_pdf}</span>
						</div>
						
						{/* Sélecteur de configuration */}
						<div className="flex items-center space-x-2">
							<span className="text-xs text-gray-600">Config:</span>
							<select
								value={selectedConfigId}
								onChange={(e) => setSelectedConfigId(e.target.value)}
								className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
							>
								{LINK_CONFIGS.map(config => (
									<option key={config.id} value={config.id}>
										{config.name}
									</option>
								))}
							</select>
						</div>
					</div>
					<div className="flex items-center justify-between">
						<div className="flex flex-col">
							<span className="text-xs text-gray-500">{currentConfig.description}</span>
						</div>
						<div className="flex items-center gap-2">
							{typeDoc === 'facture' && (
								<PushFactureButton
									entrepriseId={entrepriseIdNum!}
									pdfId={pdfId}
									userId={user_id || undefined}
									doc={(pdfInfo?.infos_raw as Record<string, unknown>) || null}
									disabled={!pdfInfo?.infos_raw}
								/>
							)}
							<button onClick={runAutoForAll} disabled={busyAll} className="px-3 py-1 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
								Auto-linker tout
							</button>
						</div>
					</div>
				</div>

				{/* Tableau des déchets */}
				<div className="bg-white border rounded-lg overflow-hidden">
					{/* Header sticky */}
					<div className="sticky top-0 z-10 grid grid-cols-[36px_52px_1.3fr_1.1fr_1.1fr_1fr_90px_100px_1fr_1fr_140px] items-center gap-2 px-3 py-2 text-[11px] font-semibold text-gray-600 bg-gray-50 border-b">
						<div></div>
						<div>#</div>
						<div>Nom déchet</div>
						<div>Transporteur</div>
						<div>Destinataire</div>
						<div>Site</div>
						<div>CED</div>
						<div>Date</div>
						<div>N° Bon</div>
						<div>N° BSD</div>
						<div>Actions</div>
					</div>
 
				{dechets.map((d, idx) => {
					const nom = d?.nom || '';
					const ced = d?.ced || '';
					const date = d?.date || '';
					const num_bon = d?.num_bon || '';
					const num_bsd = d?.num_bsd || '';
				const proposeResult = proposeActionResults[idx];
				const cands = candidatesByIndex[idx] || [];
				const dechetStatus = getDechetStatus(idx);
				
				// V2: Calculer le site spécifique pour ce déchet (factures)
				const docType = (pdfInfo?.infos_raw as Record<string, unknown> | undefined)?.type_doc as string | undefined;
				const siteForThisDechet = (docType === 'facture' && d.nom_site) 
					? d.nom_site 
					: rawSite;
				const siteTranslatedForDechet = mappings ? translateByMapping(siteForThisDechet, mappings.params_mapping_site || {}) : { name: siteForThisDechet, siret: '' };
				const siteTranslatedOkForDechet = !!(siteTranslatedForDechet?.siret && siteTranslatedForDechet.siret.trim() !== '');
				
				return (
					<div key={idx} className="border-b">
						{/* Row principale en grille */}
						<div className={`grid grid-cols-[36px_52px_1.3fr_1.1fr_1.1fr_1fr_90px_100px_1fr_1fr_140px] items-center gap-2 px-3 py-2 hover:bg-blue-200 ${openIndex === idx ? 'bg-blue-100 ring-1 ring-blue-300' : 'bg-white'}`}>
							<button onClick={() => openForIndex(idx)} className="text-gray-500 hover:text-gray-700 text-xs px-1 py-0.5 rounded hover:bg-gray-100" aria-label="toggle">
								{openIndex === idx ? '▾' : '▸'}
							</button>
							<div className="text-xs font-semibold text-gray-700">{idx + 1}</div>
							<div className="truncate text-[12px] text-gray-800">{nom}</div>
							<div className={`truncate text-[12px] ${prestaTranslatedOk && prestaRole === 'transporteur' ? 'bg-amber-50 text-amber-800 px-1 py-0.5 rounded' : 'text-gray-700'}`}>
								{prestaRole === 'transporteur' ? translated.presta.name : ''}
							</div>
							<div className={`truncate text-[12px] ${prestaTranslatedOk && (prestaRole === 'destinataire' || !prestaRole) ? 'bg-amber-50 text-amber-800 px-1 py-0.5 rounded' : 'text-gray-700'}`}>
								{prestaRole === 'destinataire' || !prestaRole ? translated.presta.name : ''}
							</div>
							<div className={`truncate text-[12px] ${siteTranslatedOkForDechet ? 'bg-amber-50 text-amber-800 px-1 py-0.5 rounded' : 'text-gray-700'}`}>{siteTranslatedForDechet.name}</div>
								<div className="text-[12px] text-gray-800">{ced}</div>
								<div className="text-[12px] text-gray-800">{date ? new Date(date).toLocaleDateString('fr-FR') : ''}</div>
								<div className="text-[12px] text-gray-800">{num_bon}</div>
								<div className="text-[12px] text-gray-800 truncate">{num_bsd || ''}</div>
								<div className="flex items-center gap-2">
						{dechetStatus && (
							<span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${dechetStatus.status === 'linked' ? 'bg-green-50 text-green-700 border border-green-200' : dechetStatus.status === 'created' ? 'bg-blue-50 text-blue-700 border border-blue-200' : dechetStatus.status === 'pushed' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>{dechetStatus.status === 'linked' ? '🔗 Lié' : dechetStatus.status === 'created' ? '✨ Créé' : dechetStatus.status === 'pushed' ? '⬆︎ Pushed' : '👀 À vérifier'}</span>
						)}
							<button onClick={() => runProposeActionAuto(idx)} disabled={busyIndex === idx || (dechetStatus?.status === 'linked' || dechetStatus?.status === 'created' || dechetStatus?.status === 'pushed')} className="px-2.5 py-1 text-[11px] rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50">Proposer</button>
							<button onClick={() => doCreate(idx)} disabled={busyIndex === idx || (dechetStatus?.status === 'linked' || dechetStatus?.status === 'created' || dechetStatus?.status === 'pushed')} className="px-2.5 py-1 text-[11px] rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">Créer</button>
								</div>
							</div>

							{/* moved proposition UI into filters bar below */}

							{openIndex === idx && (
								<div className="mt-0">
									{!allCandidates && (
										<div className="text-sm text-gray-600 px-3 py-2">Préchargement des candidats...</div>
									)}
									{allCandidates && (
									<>
									{/* Affichage des règles de configuration (conditionnel) */}
									{showRules && (
										<div className="mx-3 mb-3 p-3 bg-blue-50 rounded border">
											<div className="text-sm font-semibold mb-2">Règles de configuration :</div>
											<div className="text-xs space-y-1">
												<div><strong>to_link :</strong></div>
												{currentConfig.params.to_link.map((rule: MatchingRule, i: number) => {
													const isActive = proposeResult?.action === 'to_link' && proposeResult?.matched_rule === rule;
													const enabled: string[] = [];
													if (rule.site) enabled.push('site ✓');
													if (rule.presta) enabled.push('presta ✓');
													if (rule.num_bon) enabled.push('num_bon ✓');
													if (rule.num_bsd) enabled.push('num_bsd ✓');
													if (rule.ced) enabled.push('ced ✓');
													if (rule.nom_dechet) enabled.push('nom_dechet ✓');
													if (rule.date) enabled.push(`date ±${rule.date_tresh}j ✓`);
													return (
														<div key={i} className={`ml-2 text-gray-600 ${isActive ? 'bg-yellow-100 border border-yellow-400 rounded px-1 font-semibold' : ''}`}>
															#{i + 1}: {enabled.join(', ')}
															{isActive && <span className="ml-2 text-yellow-800">← utilisée</span>}
														</div>
													);
												})}
												<div><strong>to_check_by_user :</strong></div>
												{currentConfig.params.to_check_by_user.map((rule: MatchingRule, i: number) => {
													const isActive = proposeResult?.action === 'to_check_by_user' && proposeResult?.matched_rule === rule;
													const enabled: string[] = [];
													if (rule.site) enabled.push('site ✓');
													if (rule.presta) enabled.push('presta ✓');
													if (rule.num_bon) enabled.push('num_bon ✓');
													if (rule.num_bsd) enabled.push('num_bsd ✓');
													if (rule.ced) enabled.push('ced ✓');
													if (rule.nom_dechet) enabled.push('nom_dechet ✓');
													if (rule.date) enabled.push(`date ±${rule.date_tresh}j ✓`);
													return (
														<div key={i} className={`ml-2 text-gray-600 ${isActive ? 'bg-yellow-100 border border-yellow-400 rounded px-1 font-semibold' : ''}`}>
															#{i + 1}: {enabled.join(', ')}
															{isActive && <span className="ml-2 text-yellow-800">← utilisée</span>}
														</div>
													);
												})}
												<div><strong>create :</strong></div>
												{currentConfig.params.create.map((rule: MatchingRule, i: number) => {
													const isActive = proposeResult?.action === 'to_create' && proposeResult?.matched_rule === rule;
													const enabled: string[] = [];
													if (rule.site) enabled.push('site ✓');
													if (rule.presta) enabled.push('presta ✓');
													if (rule.num_bon) enabled.push('num_bon ✓');
													if (rule.num_bsd) enabled.push('num_bsd ✓');
													if (rule.ced) enabled.push('ced ✓');
													if (rule.nom_dechet) enabled.push('nom_dechet ✓');
													if (rule.date) enabled.push(`date ±${rule.date_tresh}j ✓`);
													return (
														<div key={i} className={`ml-2 text-gray-600 ${isActive ? 'bg-yellow-100 border border-yellow-400 rounded px-1 font-semibold' : ''}`}>
															#{i + 1}: {enabled.join(', ')}
															{isActive && <span className="ml-2 text-yellow-800">← utilisée</span>}
														</div>
													);
												})}
											</div>
										</div>
									)}
										<div className="px-3 py-2">
											{/* Filtres + Proposition alignés */}
											<div className="flex items-start justify-between gap-4 text-[12px]">
												<div className="flex flex-wrap items-center gap-3">
													<div className="font-semibold">Candidats {`(${cands.length})`} </div>
													<label className="inline-flex items-center gap-1"><input type="checkbox" checked={(filtersByIndex[idx]?.site) ?? true} onChange={() => toggleFilter(idx, 'site')} /><span>Site</span></label>
													<label className="inline-flex items-center gap-1"><input type="checkbox" checked={(filtersByIndex[idx]?.presta) ?? true} onChange={() => toggleFilter(idx, 'presta')} /><span>Prestataire</span></label>
													<label className="inline-flex items-center gap-1"><input type="checkbox" checked={(filtersByIndex[idx]?.numBon) ?? true} onChange={() => toggleFilter(idx, 'numBon')} /><span>N°Bon</span></label>
													<label className="inline-flex items-center gap-1"><input type="checkbox" checked={(filtersByIndex[idx]?.numBsd) ?? true} onChange={() => toggleFilter(idx, 'numBsd')} /><span>N°BSD</span></label>
													<label className="inline-flex items-center gap-1"><input type="checkbox" checked={(filtersByIndex[idx]?.ced) ?? true} onChange={() => toggleFilter(idx, 'ced')} /><span>CED</span></label>
													<label className="inline-flex items-center gap-1"><input type="checkbox" checked={(filtersByIndex[idx]?.wasteName) ?? true} onChange={() => toggleFilter(idx, 'wasteName')} /><span>Nom de déchet</span></label>
													<label className="inline-flex items-center gap-1"><input type="checkbox" checked={(filtersByIndex[idx]?.date) ?? true} onChange={() => toggleFilter(idx, 'date')} /><span>Date ±</span></label>
													<input type="number" className="w-20 px-2 py-1 border rounded" value={daysByIndex[idx] ?? LINK_RULES_DEFAULT.looseDays} onChange={e => onDaysChange(idx, Number(e.target.value))} />
												</div>
												<div className="flex items-center gap-2">
													{autoAllResults[idx] && (
														<span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-medium ${autoAllResults[idx]?.action === 'to_link' ? 'bg-green-50 text-green-700 border border-green-200' : autoAllResults[idx]?.action === 'to_create' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>
															Auto: {autoAllResults[idx]?.action}{autoAllResults[idx]?.nb_candidats !== undefined ? ` (${autoAllResults[idx]?.nb_candidats})` : ''}
														</span>
													)}
													{proposeResult && (
														<>
															<span className="text-[12px] font-semibold text-orange-700">Proposition: {proposeResult.action} ({proposeResult.nb_candidats !== undefined ? proposeResult.nb_candidats : cands.length})</span>
															{proposeResult.action === 'to_link' && proposeResult.id_candidat && (
																<button onClick={() => doLink(idx, proposeResult.id_candidat!)} disabled={busyIndex === idx || (dechetStatus?.status === 'linked' || dechetStatus?.status === 'created')} className="px-3 py-1 text-xs rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50">Lier</button>
															)}
															{proposeResult.action === 'to_create' && (
																<button onClick={() => doCreate(idx)} disabled={busyIndex === idx || (dechetStatus?.status === 'linked' || dechetStatus?.status === 'created')} className="px-3 py-1 text-xs rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">Créer</button>
															)}
															<button onClick={() => setShowRules(!showRules)} className="px-2 py-1 text-[11px] rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700">{showRules ? 'Masquer' : 'Afficher'} règles</button>
														</>
													)}
												</div>
											</div>
										</div>
										
										{/* Tableau des candidats */}
										{cands.length > 0 && (
											<div className="px-3 py-2">
												<div className="bg-gray-200 rounded-md border border-gray-300">
													{/* Header du tableau candidats */}
													<div className="grid grid-cols-[36px_52px_1.3fr_1.1fr_1.1fr_1fr_90px_100px_1fr_1fr_140px] items-center gap-2 px-3 py-1.5 text-[11px] font-semibold text-black bg-gray-300 rounded-t-md border-b border-gray-400">
														<div></div>
														<div>#</div>
														<div>Nom déchet</div>
														<div>Transporteur</div>
														<div>Destinataire</div>
														<div>Site</div>
														<div>CED</div>
														<div>Date</div>
														<div>N° Bon</div>
														<div>N° BSD</div>
														<div>Actions</div>
													</div>
													
													{/* Rows des candidats */}
													{cands.map((c) => (
														<div key={c.id} className="grid grid-cols-[36px_52px_1.3fr_1.1fr_1.1fr_1fr_90px_100px_1fr_1fr_140px] items-center gap-2 px-3 py-1.5 text-[12px] bg-gray-200 border-b border-gray-300 last:rounded-b-md hover:bg-gray-300">
															<div></div>
															<div className="text-black font-mono">{c.id}</div>
															<div className="truncate text-black font-mono">{c.infos_json?.formAPI?.createFormInput?.wasteDetails?.name || ''}</div>
															<div className="truncate text-black font-mono">{c.infos_json?.formAPI?.createFormInput?.transporter?.company?.name || ''}</div>
															<div className="truncate text-black font-mono">{c.infos_json?.formAPI?.createFormInput?.recipient?.company?.name || ''}</div>
															<div className="truncate text-black font-mono">{c.infos_json?.formAPI?.createFormInput?.emitter?.company?.name || ''}</div>
															<div className="text-black font-mono">{c.infos_json?.formAPI?.createFormInput?.wasteDetails?.code || ''}</div>
															<div className="text-black font-mono">{new Date(c.infos_json?.formAPI?.createFormInput?.takenOverAt || c.created_at).toLocaleDateString('fr-FR')}</div>
															<div className="text-black font-mono">{c.other_infos?.numeroBon || ''}</div>
															<div className="text-black font-mono">{c.readable_id_track_dechets || ''}</div>
															<div className="flex items-center justify-end gap-1">
																<button onClick={() => doLink(idx, c.id)} disabled={busyIndex === idx || (dechetStatus?.status === 'linked' || dechetStatus?.status === 'created')} className="px-2 py-1 text-[11px] rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">Lier</button>
															</div>
														</div>
													))}
												</div>
											</div>
										)}
									</>
									)}
								</div>
							)}

							{actionMsg && <div className="px-3 pb-3 text-[12px] text-gray-700">{actionMsg}</div>}
						</div>
					);
				})}
				</div>
			</div>
			{previewModal.open && (
				<div className="fixed inset-0 z-50">
					<div className="absolute inset-0 bg-black/40" onClick={() => setPreviewModal({ open: false, index: -1, data: null })} />
					<div className="absolute inset-0 flex items-center justify-center p-4">
						<div className="w-[95vw] max-w-[95vw] h-[95vh] max-h-[95vh] overflow-auto rounded bg-white shadow-lg">
							<div className="flex items-center justify-between border-b p-3">
								<div className="font-semibold">Prévisualisation BSD à créer</div>
								<button onClick={() => setPreviewModal({ open: false, index: -1, data: null })} className="px-2 py-1 text-sm rounded bg-gray-200">Fermer</button>
							</div>
							<div className="p-3">
								<pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-96">{JSON.stringify(previewModal.data, null, 2)}</pre>
								<div className="flex gap-2 mt-3 justify-end">
									<button onClick={() => setPreviewModal({ open: false, index: -1, data: null })} className="px-3 py-1 text-sm rounded bg-gray-200">Annuler</button>
									<button onClick={confirmCreate} disabled={busyIndex === previewModal.index} className="px-3 py-1 text-sm rounded bg-green-600 text-white disabled:opacity-50">Confirmer et créer</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</>
	);
}

