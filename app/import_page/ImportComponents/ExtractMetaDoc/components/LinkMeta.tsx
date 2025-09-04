"use client";

import { useEffect, useMemo, useState } from 'react';
import { useSession } from '@/app/component/SessionProvider';
import { PdfInfo } from '../interface/pdf_interface';
import { getPdfInfoById, getBSDCandidates } from '../utils/bdd';
import { LinkOrCreate, LINK_RULES_DEFAULT, BSDCandidate, AutoLinkWithParams, AutoLinkParams, AutoLinkResult } from '../utils/link';
import { create_in_bdd, create_in_bdd_preview, link_in_bdd, translateByMapping } from '../utils/link_or_create_bdd';
import { useParamsMapping } from '../utils/extract';

interface LinkMetaProps {
	pdfId: string;
}

type LinkAutoResult = {
	action: 'to_link' | 'to_create' | 'to_check_by_user';
	id_link?: string;
	error?: string;
};

// Paramètres par défaut pour la nouvelle logique
const DEFAULT_AUTO_LINK_PARAMS: AutoLinkParams = {
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
	
	console.log(`Date1: "${date1}" → ${d1Normalized.toISOString()}, Date2: "${date2}" → ${d2Normalized.toISOString()}, Diff: ${diffDays} jours, Max: ${ecartDays} jours`);
	
	return diffDays <= ecartDays;
};

export default function LinkMeta({ pdfId }: LinkMetaProps) {
	const { user_id, entreprise_id } = useSession();
	const entrepriseIdNum = useMemo(() => (entreprise_id ? Number(entreprise_id) : null), [entreprise_id]);

	const { data: mappings } = useParamsMapping(entrepriseIdNum);

	const [pdfInfo, setPdfInfo] = useState<PdfInfo | null>(null);
	const [loadingPdf, setLoadingPdf] = useState(false);
	const [errors, setErrors] = useState<string | null>(null);

	const [autoResults, setAutoResults] = useState<Record<number, LinkAutoResult | undefined>>({});
	const [newAutoResults, setNewAutoResults] = useState<Record<number, AutoLinkResult | undefined>>({});
	const [candidatesByIndex, setCandidatesByIndex] = useState<Record<number, BSDCandidate[]>>({});
	const [allCandidates, setAllCandidates] = useState<BSDCandidate[] | null>(null);
	const [rawCandidatesByIndex, setRawCandidatesByIndex] = useState<Record<number, BSDCandidate[]>>({});
	const [filtersByIndex, setFiltersByIndex] = useState<Record<number, { site: boolean; presta: boolean; numBon: boolean; numBsd: boolean; ced: boolean; wasteName: boolean; date: boolean }>>({});
	const [daysByIndex, setDaysByIndex] = useState<Record<number, number>>({});
	const [busyIndex, setBusyIndex] = useState<number | null>(null);
	const [actionMsg, setActionMsg] = useState<string | null>(null);
	const [openIndex, setOpenIndex] = useState<number | null>(null);
	const [previewModal, setPreviewModal] = useState<{ open: boolean; index: number; data: Record<string, unknown> | null }>({ open: false, index: -1, data: null });
	
	// State local pour le statut des déchets liés/créés (même structure que bsd_linked en BDD)
	const [bsdLinked, setBsdLinked] = useState<Array<{ bsd_id: number; index_dechet: number; status: 'linked' | 'created' }>>([]);

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
					// Convertir le format BDD en format local
					const initialStatus = pdfData.bsd_linked.map(item => ({
						bsd_id: item.bsd_id,
						index_dechet: item.index_dechet,
						status: item.status as 'linked' | 'created'
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
				// derive min/max dates across dechets
				const dates = dechets
					.map(d => (d?.date ? new Date(d.date) : null))
					.filter((d): d is Date => !!d && !isNaN(d.getTime()));
				const today = new Date();
				const minDate = dates.length ? new Date(Math.min(...dates.map(d => d.getTime()))) : today;
				const maxDate = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : today;
				const start = new Date(minDate);
				start.setDate(start.getDate() - 100);
				const end = new Date(maxDate);
				end.setDate(end.getDate() + 100);

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

	const dechets: DechetItem[] = useMemo(() => {
		const raw = (pdfInfo?.infos_raw || {}) as Record<string, unknown>;
		const maybe = (raw as { dechet?: unknown }).dechet;
		return Array.isArray(maybe) ? (maybe as DechetItem[]) : [];
	}, [pdfInfo]);

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

	const runLinkAuto = async (index: number) => {
		if (!pdfInfo || entrepriseIdNum == null) return;
		setBusyIndex(index);
		setActionMsg(null);
		try {
			const res = await LinkOrCreate(pdfInfo as PdfInfo, entrepriseIdNum, index, undefined, LINK_RULES_DEFAULT);
			setAutoResults(prev => ({ ...prev, [index]: res }));
		} catch (e) {
			setAutoResults(prev => ({ ...prev, [index]: { action: 'to_check_by_user', error: e instanceof Error ? e.message : 'Erreur' } }));
		} finally {
			setBusyIndex(null);
		}
	};

	const runNewLinkAuto = async (index: number) => {
		if (!pdfInfo || entrepriseIdNum == null) return;
		setBusyIndex(index);
		setActionMsg(null);
		try {
			const res = await AutoLinkWithParams(pdfInfo as PdfInfo, entrepriseIdNum, index, DEFAULT_AUTO_LINK_PARAMS);
			setNewAutoResults(prev => ({ ...prev, [index]: res }));
		} catch (error) {
			console.error('Erreur dans runNewLinkAuto:', error);
			setNewAutoResults(prev => ({ ...prev, [index]: { result: 'create', pluto: 'create' } }));
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

	const applyFilters = (index: number, rawList: BSDCandidate[], d: DechetItem): BSDCandidate[] => {
		const active = filtersByIndex[index] || { site: true, presta: true, numBon: true, numBsd: true, ced: true, wasteName: true, date: true };
		const siteLc = (translated.site.name || '').toLowerCase().trim();
		const prestaLc = (translated.presta.name || '').toLowerCase().trim();
		const numBonLc = (d?.num_bon || '').toLowerCase().trim();
		const numBsdLc = (d?.num_bsd || '').toLowerCase().trim();
		const cedNumbers = (d?.ced || '').replace(/[^\d]/g, '').trim();
		const wasteNameLc = (d?.nom || '').toLowerCase().trim();
		const pdfDate = d?.date || '';
		const nDays = daysByIndex[index] ?? LINK_RULES_DEFAULT.looseDays;
		
		return rawList.filter(c => {
			const siteName = (c.infos_json?.formAPI?.createFormInput?.emitter?.company?.name || '').toLowerCase().trim();
			const recip = (c.infos_json?.formAPI?.createFormInput?.recipient?.company?.name || '').toLowerCase().trim();
			const transp = (c.infos_json?.formAPI?.createFormInput?.transporter?.company?.name || '').toLowerCase().trim();
			const candNumBon = (c.other_infos?.numeroBon || '').toLowerCase().trim();
			const candNumBsd = (c.readable_id_track_dechets || '').toLowerCase().trim();
			const candCed = (c.infos_json?.formAPI?.createFormInput?.wasteDetails?.code || '').replace(/[^\d]/g, '').trim();
			const candWaste = (c.infos_json?.formAPI?.createFormInput?.wasteDetails?.name || '').toLowerCase().trim();
			const takenOverAt = (c.infos_json?.formAPI?.createFormInput?.takenOverAt || '') as string;
			const candDate = takenOverAt || c.created_at;
			
			// Logique cohérente avec LinkAuto : si le filtre est coché, la donnée PDF doit exister ET correspondre
			// Si le filtre est coché mais que le PDF n'a pas la donnée, le BSD est automatiquement filtré
			const bySite = !active.site || (siteLc && siteLc === siteName);
			const byPresta = !active.presta || (prestaLc && (prestaLc === recip || prestaLc === transp));
			const byNumBon = !active.numBon || (numBonLc && numBonLc === candNumBon);
			const byNumBsd = !active.numBsd || (numBsdLc && numBsdLc === candNumBsd);
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
		const filtered = rawList.filter(c => {
			const siteLc = (translated.site.name || '').toLowerCase().trim();
			const prestaLc = (translated.presta.name || '').toLowerCase().trim();
			const numBonLc = (d?.num_bon || '').toLowerCase().trim();
			const numBsdLc = (d?.num_bsd || '').toLowerCase().trim();
			const cedNumbers = (d?.ced || '').replace(/[^\d]/g, '').trim();
			const wasteNameLc = (d?.nom || '').toLowerCase().trim();
			const pdfDate = d?.date || '';
			
			const siteName = (c.infos_json?.formAPI?.createFormInput?.emitter?.company?.name || '').toLowerCase().trim();
			const recip = (c.infos_json?.formAPI?.createFormInput?.recipient?.company?.name || '').toLowerCase().trim();
			const transp = (c.infos_json?.formAPI?.createFormInput?.transporter?.company?.name || '').toLowerCase().trim();
			const candNumBon = (c.other_infos?.numeroBon || '').toLowerCase().trim();
			const candNumBsd = (c.readable_id_track_dechets || '').toLowerCase().trim();
			const candCed = (c.infos_json?.formAPI?.createFormInput?.wasteDetails?.code || '').replace(/[^\d]/g, '').trim();
			const candWaste = (c.infos_json?.formAPI?.createFormInput?.wasteDetails?.name || '').toLowerCase().trim();
			const takenOverAt = (c.infos_json?.formAPI?.createFormInput?.takenOverAt || '') as string;
			const candDate = takenOverAt || c.created_at;
			
			const bySite = !newFilters.site || (siteLc && siteLc === siteName);
			const byPresta = !newFilters.presta || (prestaLc && (prestaLc === recip || prestaLc === transp));
			const byNumBon = !newFilters.numBon || (numBonLc && numBonLc === candNumBon);
			const byNumBsd = !newFilters.numBsd || (numBsdLc && numBsdLc === candNumBsd);
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
		const filtered = rawList.filter(c => {
			const siteLc = (translated.site.name || '').toLowerCase().trim();
			const prestaLc = (translated.presta.name || '').toLowerCase().trim();
			const numBonLc = (d?.num_bon || '').toLowerCase().trim();
			const numBsdLc = (d?.num_bsd || '').toLowerCase().trim();
			const cedNumbers = (d?.ced || '').replace(/[^\d]/g, '').trim();
			const wasteNameLc = (d?.nom || '').toLowerCase().trim();
			const pdfDate = d?.date || '';
			
			const siteName = (c.infos_json?.formAPI?.createFormInput?.emitter?.company?.name || '').toLowerCase().trim();
			const recip = (c.infos_json?.formAPI?.createFormInput?.recipient?.company?.name || '').toLowerCase().trim();
			const transp = (c.infos_json?.formAPI?.createFormInput?.transporter?.company?.name || '').toLowerCase().trim();
			const candNumBon = (c.other_infos?.numeroBon || '').toLowerCase().trim();
			const candNumBsd = (c.readable_id_track_dechets || '').toLowerCase().trim();
			const candCed = (c.infos_json?.formAPI?.createFormInput?.wasteDetails?.code || '').replace(/[^\d]/g, '').trim();
			const candWaste = (c.infos_json?.formAPI?.createFormInput?.wasteDetails?.name || '').toLowerCase().trim();
			const takenOverAt = (c.infos_json?.formAPI?.createFormInput?.takenOverAt || '') as string;
			const candDate = takenOverAt || c.created_at;
			
			const bySite = !currentFilters.site || (siteLc && siteLc === siteName);
			const byPresta = !currentFilters.presta || (prestaLc && (prestaLc === recip || prestaLc === transp));
			const byNumBon = !currentFilters.numBon || (numBonLc && numBonLc === candNumBon);
			const byNumBsd = !currentFilters.numBsd || (numBsdLc && numBsdLc === candNumBsd);
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
	const updateDechetStatus = (index: number, bsdId: number, status: 'linked' | 'created') => {
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

	if (!entrepriseIdNum) return <div className="p-4 text-sm text-gray-600">Aucune entreprise dans la session.</div>;
	if (loadingPdf) return <div className="p-4">Chargement...</div>;
	if (errors) return <div className="p-4 text-red-600">{errors}</div>;
	if (!pdfInfo) return <div className="p-4">PDF introuvable.</div>;

	return (
		<>
			<div className="space-y-4">
				<div className="rounded border p-3 bg-gray-50">
					<div className="text-sm text-gray-700">{typeDoc.toUpperCase()} : {pdfInfo.name_pdf}</div>
				</div>

				{dechets.map((d, idx) => {
					const ced = d?.ced || '';
					const nom = d?.nom || '';
					const date = d?.date || '';
					const num_bon = d?.num_bon || '';
					const num_bsd = d?.num_bsd || '';
					const result = autoResults[idx];
					const newResult = newAutoResults[idx];
					const cands = candidatesByIndex[idx] || [];
					const dechetStatus = getDechetStatus(idx);
					return (
						<div key={idx} className="rounded border p-4 bg-gray-200">
							<div className="flex items-center justify-between">
								<div onClick={() => openForIndex(idx)} className="cursor-pointer select-none">
									<div className="flex items-center gap-2">
										<div className="font-semibold">Déchet N°{idx + 1}</div>
										{dechetStatus && (
											<span className={`px-2 py-1 rounded text-xs font-medium ${
												dechetStatus.status === 'linked' 
													? 'bg-green-100 text-green-800' 
													: 'bg-blue-100 text-blue-800'
											}`}>
												{dechetStatus.status === 'linked' ? '🔗 Lié' : '✨ Créé'} (BSD #{dechetStatus.bsd_id})
											</span>
										)}
									</div>
									<div className="text-sm space-x-2">
										<span className="px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs">{new Date(date).toLocaleDateString('fr-FR')}</span>
										<span className="px-2 py-1 rounded bg-gray-100 text-gray-800 text-xs">{translated.site.name}</span>
										<span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800 text-xs">{translated.presta.name}</span>
										<span className="px-2 py-1 rounded bg-green-100 text-green-800 text-xs">{ced}</span>
										<span className="px-2 py-1 rounded bg-indigo-100 text-indigo-800 text-xs">{nom}</span>
										<span className="px-2 py-1 rounded bg-purple-100 text-purple-800 text-xs">{d?.tonnage || 'N/A'}</span>
										<span className="px-2 py-1 rounded bg-orange-100 text-orange-800 text-xs">Bon: {num_bon}</span>
										<span className="px-2 py-1 rounded bg-red-100 text-red-800 text-xs">BSD: {num_bsd || 'N/A'}</span>
									</div>
								</div>
								<div className="flex gap-2">
									<button onClick={() => runLinkAuto(idx)} disabled={busyIndex === idx || !!dechetStatus} className="px-3 py-1 text-sm rounded bg-blue-600 text-white disabled:opacity-50">Link auto (ancien)</button>
									<button onClick={() => runNewLinkAuto(idx)} disabled={busyIndex === idx || !!dechetStatus} className="px-3 py-1 text-sm rounded bg-purple-600 text-white disabled:opacity-50">Link auto (nouveau)</button>
									<button onClick={() => doCreate(idx)} disabled={busyIndex === idx || !!dechetStatus} className="px-3 py-1 text-sm rounded bg-green-600 text-white disabled:opacity-50">Créer</button>
								</div>
							</div>

							{result && (
								<div className="mt-0.5 text-sm font-bold flex justify-end mr-2">
									<div><span className="font-medium">Ancien: {result.action}</span>{result.id_link ? ` → ${result.id_link}` : ''}{result.error ? ` • ${result.error}` : ''}</div>
									{result.action === 'to_link' && result.id_link && (
										<div className="mt-2">
											<button onClick={() => doLink(idx, result.id_link!)} disabled={busyIndex === idx || !!dechetStatus} className="px-3 py-1 text-sm rounded bg-indigo-600 text-white disabled:opacity-50">Lier au BSD suggéré</button>
										</div>
									)}
								</div>
							)}

							{newResult && (
								<div className="mt-0.5 text-sm font-bold flex justify-end mr-2">
									<div><span className="font-medium text-purple-600">Nouveau: {newResult.result}</span>{newResult.id ? ` → ${newResult.id}` : ''}{newResult.pluto ? ` (${newResult.pluto})` : ''}</div>
									{newResult.result === 'to_link' && newResult.id && (
										<div className="mt-2">
											<button onClick={() => doLink(idx, newResult.id!)} disabled={busyIndex === idx || !!dechetStatus} className="px-3 py-1 text-sm rounded bg-purple-600 text-white disabled:opacity-50">Lier au BSD suggéré (nouveau)</button>
										</div>
									)}
								</div>
							)}

							{openIndex === idx && (
								<div className="mt-0">
									{!allCandidates && (
										<div className="text-sm text-gray-600">Préchargement des candidats...</div>
									)}
									{allCandidates && (
									<>
									<div className="flex flex-wrap items-center gap-4 mb-3 text-sm">
									<div className="text-sm font-semibold">Candidats {allCandidates ? `(${cands.length})` : '(chargement...)'}</div>
										<label className="inline-flex items-center gap-2">
											<input type="checkbox" checked={(filtersByIndex[idx]?.site) ?? true} onChange={() => toggleFilter(idx, 'site')} />
											<span>Site</span>
										</label>
										<label className="inline-flex items-center gap-2">
											<input type="checkbox" checked={(filtersByIndex[idx]?.presta) ?? true} onChange={() => toggleFilter(idx, 'presta')} />
											<span>Prestataire</span>
										</label>
										<label className="inline-flex items-center gap-2">
											<input type="checkbox" checked={(filtersByIndex[idx]?.numBon) ?? true} onChange={() => toggleFilter(idx, 'numBon')} />
											<span>N°Bon</span>
										</label>
										<label className="inline-flex items-center gap-2">
											<input type="checkbox" checked={(filtersByIndex[idx]?.numBsd) ?? true} onChange={() => toggleFilter(idx, 'numBsd')} />
											<span>N°BSD</span>
										</label>										
										<label className="inline-flex items-center gap-2">
											<input type="checkbox" checked={(filtersByIndex[idx]?.ced) ?? true} onChange={() => toggleFilter(idx, 'ced')} />
											<span>CED</span>
										</label>
										<label className="inline-flex items-center gap-2">
											<input type="checkbox" checked={(filtersByIndex[idx]?.wasteName) ?? true} onChange={() => toggleFilter(idx, 'wasteName')} />
											<span>Nom de déchet</span>
										</label>
										<label className="inline-flex items-center gap-2">
											<input type="checkbox" checked={(filtersByIndex[idx]?.date) ?? true} onChange={() => toggleFilter(idx, 'date')} />
											<span>Date ±</span>
										</label>
										<input type="number" className="w-20 px-2 py-1 border rounded" value={daysByIndex[idx] ?? LINK_RULES_DEFAULT.looseDays} onChange={e => onDaysChange(idx, Number(e.target.value))} />
									</div>
									<div className="space-y-2">
										{cands.map(c => (
											<div key={c.id} className="rounded border p-2 text-sm flex items-center justify-between bg-white">
																							<div>
												<div className="font-medium mb-2">{c.readable_id_track_dechets || 'Sans numéro'} <span className="text-gray-500 text-xs">(ID: {c.id})</span></div>
												<div className="text-sm space-x-2">
													<span className="px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs">{new Date(c.infos_json?.formAPI?.createFormInput?.takenOverAt || c.created_at).toLocaleDateString('fr-FR')}</span>
													<span className="px-2 py-1 rounded bg-gray-100 text-gray-800 text-xs">{c.infos_json.formAPI.createFormInput.emitter.company?.name || ''}</span>
													<span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800 text-xs">{c.infos_json.formAPI.createFormInput.recipient.company?.name || ''}</span>
													<span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800 text-xs">{c.infos_json.formAPI.createFormInput.transporter.company?.name || ''}</span>
													<span className="px-2 py-1 rounded bg-green-100 text-green-800 text-xs">{c.infos_json.formAPI.createFormInput.wasteDetails.code}</span>
													<span className="px-2 py-1 rounded bg-indigo-100 text-indigo-800 text-xs">{c.infos_json.formAPI.createFormInput.wasteDetails.name}</span>
													<span className="px-2 py-1 rounded bg-orange-100 text-orange-800 text-xs">{c.other_infos?.numeroBon || ''}</span>
												</div>
											</div>
												<div className="flex gap-2">
													<button onClick={() => doLink(idx, c.id)} disabled={busyIndex === idx} className="px-3 py-1 rounded bg-indigo-600 text-white disabled:opacity-50">Lier</button>
												</div>
											</div>
										))}
									</div>
									</>
									)}
								</div>
							)}

							{actionMsg && <div className="mt-3 text-xs text-gray-700">{actionMsg}</div>}
						</div>
					);
				})}
			</div>
			{previewModal.open && (
				<div className="fixed inset-0 z-50">
					<div className="absolute inset-0 bg-black/40" onClick={() => setPreviewModal({ open: false, index: -1, data: null })} />
					<div className="absolute inset-0 flex items-center justify-center p-4">
						<div className="w-full max-w-4xl max-h-[85vh] overflow-auto rounded bg-white shadow-lg">
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

