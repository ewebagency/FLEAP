import { BSD } from '@/app/analysis/AnalysisProvider';
import { tauxValorisationGlobale, tauxValorisationMatière, treatmentLabels } from '../Analyse/Environnementale/codeTraitement';
import { getFiliere } from '@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new';
import { tailwindToRgba } from '../Analyse/MetaComponent/Colours';
import { ReportData } from './types';
import { codeTraitementDefinitions } from '../Analyse/Environnementale/codeTraitement';
import { supabase } from '@/app/database/supabaseClient';

interface Site {
    orgId: string;
    givenName: string;
    address?: string;
}

interface FiliereStats {
    filiere: string;
    filiereName: string;
    quantity: number;
    materialValorizationRate: number;
    globalValorizationRate: number;
    numberOfCollections: number;
    averageCollectionsPerMonth: number;
}

interface Prestataire {
    name: string;
    siret: string;
    address?: string;
    type: 'transporteur' | 'destinataire';
    percentage: number;
}

// Interfaces pour les données financières
interface Facture {
    id: string;
    user_id: string;
    entreprise_id: string;
    created_at: string;
    infos_json: {
        footer: {
            total_ht: number;
        };
        header: {
            num_facture: string;
            date_facture: string;
            prestataire_nom: string;
            prestataire_siret: string;
            prestataire_num_client: string;
            prestataire_description: string;
        };
        departs: Depart[];
    };
}

interface Depart {
    line_body: LineOperation[];
    line_header: LineHeader;
    linked_to_bsd: boolean;
}

interface LineOperation {
    unite: string;
    quantite: number;
    montant_ht: number;
    prix_unitaire: number;
    type_operation: string;
}

interface LineHeader {
    filiere: string;
    site_nom: string;
    bon_pesee: string;
    site_siret: string;
    code_dechet: string;
    date_depart: string;
    num_dossier: string;
    type_dechet: string;
    bon_intention: string;
    site_description: string;
    site_num_affaire: string;
    dechet_description: string;
}

interface OperationSums {
    [key: string]: number;
    preparation: number;
    transport: number;
    traitement: number;
    gestion_globale: number;
    tgap: number;
    declassement: number;
    penalites: number;
    rachat: number;
    location: number;
    maintenance: number;
    mise_a_disposition: number;
    autres_contenant: number;
    non_expliques: number;
    autres: number;
    total: number;
}

interface FiliereFinancialData {
    [filiere: string]: OperationSums;
}

export class ReportGenerator {
    private bsds: BSD[];
    private site: Site;
    private entrepriseName: string;
    private mappingTable: Array<{ ced: string; filiere: string }>;

    constructor(bsds: BSD[], site: Site, entrepriseName: string, mappingTable: Array<{ ced: string; filiere: string }>) {
        this.bsds = bsds;
        this.site = site;
        this.entrepriseName = entrepriseName;
        this.mappingTable = mappingTable;
    }

    private getDateRange(): { firstDate: Date; lastDate: Date } {
        const dates = this.bsds
            .map(bsd => new Date(bsd.infos_json?.formAPI?.createFormInput?.takenOverAt || bsd.created_at || ''))
            .filter(date => !isNaN(date.getTime()));

        return {
            firstDate: new Date(Math.min(...dates.map(d => d.getTime()))),
            lastDate: new Date(Math.max(...dates.map(d => d.getTime())))
        };
    }

    private getFiliereName(wasteCode: string | undefined): string {
        if (!wasteCode) return 'Autres';
        
        // Nettoyer le code CED
        const cleanCode = wasteCode.replace(/[^\d]/g, '');
        
        // Chercher dans la table de mapping
        const mapping = this.mappingTable.find(m => m.ced === cleanCode);
        if (mapping) {
            return mapping.filiere;
        }

        // Si pas trouvé dans la table de mapping, utiliser getFiliere
        const filiere = getFiliere(wasteCode, this.mappingTable);
        return filiere || 'Autres';
    }

    private getFiliereColor(filiereName: string): string {
        // Couleurs prédéfinies pour les filières (même ordre que dans getColors)
        const filiereColors = [
            'blue-400', 'green-400', 'purple-400', 'yellow-400', 'pink-400',
            'orange-400', 'teal-400', 'cyan-400', 'indigo-400', 'gray-400',
            'blue-700', 'green-700', 'purple-700', 'yellow-700', 'pink-700',
            'orange-700', 'teal-700', 'cyan-700', 'indigo-700', 'gray-700'
        ];

        // Obtenir toutes les filières uniques pour déterminer l'ordre
        const allFilieres = new Set<string>();
        this.bsds.forEach(bsd => {
            const wasteCode = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code;
            const filiere = this.getFiliereName(wasteCode);
            allFilieres.add(filiere);
        });

        // Trier les filières (Autres en dernier)
        const sortedFilieres = Array.from(allFilieres).sort((a, b) => {
            if (a === 'Autres') return 1;
            if (b === 'Autres') return -1;
            return a.localeCompare(b);
        });

        // Trouver l'index de la filière dans la liste triée
        const filiereIndex = sortedFilieres.indexOf(filiereName);
        
        // Retourner la couleur correspondante ou une couleur par défaut
        if (filiereIndex >= 0 && filiereIndex < filiereColors.length) {
            return tailwindToRgba(filiereColors[filiereIndex], 1);
        }
        
        // Couleur par défaut pour les filières non trouvées
        return tailwindToRgba('gray-500', 1);
    }

    private calculateFiliereStats(): FiliereStats[] {
        const filiereMap = new Map<string, {
            filiereName: string;
            quantity: number;
            materialValorized: number;
            globalValorized: number;
            total: number;
            processedCount: number;
            collections: number;
            firstDate: Date;
            lastDate: Date;
        }>();

        this.bsds.forEach(bsd => {
            const wasteCode = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code;
            const filiereName = this.getFiliereName(wasteCode);
            const quantity = bsd.infos_json?.formAPI?.createFormInput?.quantityReceived || bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity || 0;
            const processingCode = bsd.infos_json?.formAPI?.createFormInput?.recipient?.processingOperation?.replace(/\s+/g, '');
            const date = new Date(bsd.created_at);

            const current = filiereMap.get(filiereName) || {
                filiereName,
                quantity: 0,
                materialValorized: 0,
                globalValorized: 0,
                total: 0,
                processedCount: 0,
                collections: 0,
                firstDate: date,
                lastDate: date
            };

            current.quantity += quantity;
            current.total += 1;
            current.collections += 1;

            if (date < current.firstDate) current.firstDate = date;
            if (date > current.lastDate) current.lastDate = date;

            if (processingCode) {
                current.processedCount += 1;
                if (tauxValorisationMatière.includes(processingCode)) {
                    current.materialValorized += 1;
                }
                if (tauxValorisationGlobale.includes(processingCode)) {
                    current.globalValorized += 1;
                }
            }

            filiereMap.set(filiereName, current);
        });

        // Convertir en tableau et calculer les statistiques
        const stats = Array.from(filiereMap.entries()).map(([filiere, stats]) => {
            const materialValorizationRate = stats.processedCount > 0 
                ? (stats.materialValorized / stats.processedCount) * 100 
                : 0;
            const globalValorizationRate = stats.processedCount > 0 
                ? (stats.globalValorized / stats.processedCount) * 100 
                : 0;

            const monthsDiff = (stats.lastDate.getFullYear() - stats.firstDate.getFullYear()) * 12 + 
                             (stats.lastDate.getMonth() - stats.firstDate.getMonth()) + 1;
            
            const averageCollectionsPerMonth = monthsDiff > 0 ? stats.collections / monthsDiff : 0;

            return {
                filiere,
                filiereName: stats.filiereName,
                quantity: stats.quantity,
                materialValorizationRate,
                globalValorizationRate,
                numberOfCollections: stats.collections,
                averageCollectionsPerMonth
            };
        });

        // Trier par quantité décroissante
        stats.sort((a, b) => b.quantity - a.quantity);

        // Ajouter la ligne des totaux
        const totalQuantity = stats.reduce((sum, stat) => sum + stat.quantity, 0);
        const totalProcessed = stats.reduce((sum, stat) => sum + stat.numberOfCollections, 0);
        const totalMaterialValorized = stats.reduce((sum, stat) => sum + (stat.materialValorizationRate * stat.numberOfCollections / 100), 0);
        const totalGlobalValorized = stats.reduce((sum, stat) => sum + (stat.globalValorizationRate * stat.numberOfCollections / 100), 0);
        const totalCollections = stats.reduce((sum, stat) => sum + stat.numberOfCollections, 0);

        /*stats.push({
            filiere: 'TOTAL',
            filiereName: 'TOTAL',
            quantity: totalQuantity,
            materialValorizationRate: totalProcessed > 0 ? (totalMaterialValorized / totalProcessed) * 100 : 0,
            globalValorizationRate: totalProcessed > 0 ? (totalGlobalValorized / totalProcessed) * 100 : 0,
            numberOfCollections: totalCollections,
            averageCollectionsPerMonth: 0
        });*/

        return stats;
    }

    private getPrestataires(): { transporteurs: Prestataire[]; destinataires: Prestataire[] } {
        const transporteurs: Prestataire[] = [];
        const destinataires: Prestataire[] = [];

        // Maps pour stocker les informations des prestataires et leurs quantités
        const transporteurMap = new Map<string, {
            name: string;
            siret: string;
            quantity: number;
        }>();
        const destinataireMap = new Map<string, {
            name: string;
            siret: string;
            quantity: number;
        }>();

        // Calculer les quantités totales par prestataire
        this.bsds.forEach(bsd => {
            const transporter = bsd.infos_json?.formAPI?.createFormInput?.transporter?.company;
            const recipient = bsd.infos_json?.formAPI?.createFormInput?.recipient?.company;
            const quantity = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity || 0;

            if (transporter?.siret) {
                const current = transporteurMap.get(transporter.siret) || {
                    name: transporter.name,
                    siret: transporter.siret,
                    quantity: 0
                };
                current.quantity += quantity;
                transporteurMap.set(transporter.siret, current);
            }

            if (recipient?.siret) {
                const current = destinataireMap.get(recipient.siret) || {
                    name: recipient.name,
                    siret: recipient.siret,
                    quantity: 0
                };
                current.quantity += quantity;
                destinataireMap.set(recipient.siret, current);
            }
        });

        // Calculer les totaux pour les pourcentages
        const totalTransporteurQuantity = Array.from(transporteurMap.values())
            .reduce((sum, t) => sum + t.quantity, 0);
        const totalDestinataireQuantity = Array.from(destinataireMap.values())
            .reduce((sum, d) => sum + d.quantity, 0);

        // Créer les listes de prestataires avec leurs pourcentages
        transporteurMap.forEach((info, siret) => {
            transporteurs.push({
                name: info.name,
                siret: info.siret,
                type: 'transporteur',
                percentage: totalTransporteurQuantity > 0 ? (info.quantity / totalTransporteurQuantity) * 100 : 0
            });
        });

        destinataireMap.forEach((info, siret) => {
            destinataires.push({
                name: info.name,
                siret: info.siret,
                type: 'destinataire',
                percentage: totalDestinataireQuantity > 0 ? (info.quantity / totalDestinataireQuantity) * 100 : 0
            });
        });

        // Trier par pourcentage décroissant
        transporteurs.sort((a, b) => b.percentage - a.percentage);
        destinataires.sort((a, b) => b.percentage - a.percentage);

        return { transporteurs, destinataires };
    }

    // Fonction pour normaliser les types d'opérations
    private normalizeOperationType(type: string): string {
        // Convertir en minuscules et remplacer les espaces par des underscores
        const normalized = type.toLowerCase().replace(/ /g, '_');
        
        // Gérer les cas spécifiques mentionnés
        if (normalized === 'gestion_global') return 'gestion_globale';
        if (normalized === 'préparation') return 'preparation';
        if (normalized === 'non_expliqués') return 'non_expliques';
        if (normalized.includes('contenant')) return 'autres_contenant';
        
        // Supprimer les accents pour d'autres cas potentiels
        return normalized
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    private async getFinancialData(): Promise<FiliereFinancialData> {
        // Récupérer l'entreprise_id depuis les BSDs
        const entreprise_id = this.bsds[0]?.entreprise_id;
        if (!entreprise_id) {
            return {};
        }

        // Récupérer les SIRETs des sites sélectionnés depuis les BSDs
        const selectedSiteSirets = new Set(
            this.bsds
                .map(bsd => bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.siret)
                .filter(siret => siret && siret !== '')
        );

        // Récupérer toutes les factures de l'entreprise
        let allFactures: Facture[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('facture')
                .select('*')
                .eq('entreprise_id', entreprise_id)
                .range(page * pageSize, (page + 1) * pageSize - 1);
            
            if (error) {
                console.error('Error fetching factures:', error);
                break;
            }

            if (data && data.length > 0) {
                allFactures = [...allFactures, ...data];
                page++;
            } else {
                hasMore = false;
            }
        }

        // Filtrer les factures selon la période des BSDs
        const { firstDate, lastDate } = this.getDateRange();
        const filteredFactures = allFactures.filter(facture => {
            const factureDate = new Date(facture.created_at);
            return factureDate >= firstDate && factureDate <= lastDate;
        });

        // Calculer les données financières par filière
        const filiereData = filteredFactures.reduce((acc: FiliereFinancialData, facture) => {
            facture.infos_json.departs.forEach(depart => {
                // Filtrer sur les sites sélectionnés
                const siteSiret = depart.line_header.site_siret;
                if (selectedSiteSirets.size > 0 && (!siteSiret || !selectedSiteSirets.has(siteSiret))) {
                    return; // Ignorer ce départ si le site n'est pas sélectionné
                }

                const cleanedCed = depart.line_header.code_dechet?.replaceAll(' ', '').replace('*', '').trim() || '';
                
                // Déterminer la filière
                const mapping = this.mappingTable.find(m => 
                    m.ced.replaceAll(' ', '').replace('*', '').trim() === cleanedCed
                );
                const filiere = mapping?.filiere || 'Autres';
                
                if (!acc[filiere]) {
                    acc[filiere] = {
                        preparation: 0,
                        transport: 0,
                        traitement: 0,
                        gestion_globale: 0,
                        tgap: 0,
                        declassement: 0,
                        penalites: 0,
                        rachat: 0,
                        location: 0,
                        maintenance: 0,
                        mise_a_disposition: 0,
                        autres_contenant: 0,
                        non_expliques: 0,
                        autres: 0,
                        total: 0
                    };
                }

                // Traiter chaque ligne du body individuellement
                depart.line_body.forEach(line => {
                    const montant = line.montant_ht;
                    const type = this.normalizeOperationType(line.type_operation);

                    // Si c'est un type d'opération connu
                    if (type in acc[filiere]) {
                        acc[filiere][type] += montant;
                    } else {
                        // Si type inconnu, mettre dans "autres"
                        acc[filiere].autres += montant;
                    }
                });

                // Calculer le total pour cette filière
                acc[filiere].total = Object.entries(acc[filiere])
                    .filter(([key]) => key !== 'total') // Exclure le total lui-même
                    .reduce((sum, [key, value]) => {
                        // Les rachats sont comptés négativement dans le total
                        if (key === 'rachat') {
                            return sum - Math.abs(value);
                        }
                        return sum + value;
                    }, 0);
            });

            return acc;
        }, {});

        return filiereData;
    }

    private prepareChartData() {
        const siteBSDs = this.bsds;
        const { firstDate, lastDate } = this.getDateRange();
        
        // Générer les labels de mois
        const monthLabels: string[] = [];
        const currentDate = new Date(firstDate);
        while (currentDate <= lastDate) {
            const label = currentDate.toLocaleString('fr-FR', { 
                month: 'short',
                year: '2-digit'
            });
            monthLabels.push(label.charAt(0).toUpperCase() + label.slice(1));
            currentDate.setMonth(currentDate.getMonth() + 1);
        }

        // Préparer les données par filière
        const quantitiesByFiliere: { [key: string]: number[] } = {};
        
        siteBSDs.forEach(bsd => {
            const date = new Date(bsd.created_at);
            if (date < firstDate || date > lastDate) return;

            const wasteCode = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code;
            const filiereName = this.getFiliereName(wasteCode);
            const quantity = bsd.infos_json?.formAPI?.createFormInput?.quantityReceived || 
                           bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity || 0;

            if (!quantitiesByFiliere[filiereName]) {
                quantitiesByFiliere[filiereName] = Array(monthLabels.length).fill(0);
            }

            const monthIndex = Math.floor(
                (date.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
            );
            
            if (monthIndex >= 0 && monthIndex < monthLabels.length) {
                quantitiesByFiliere[filiereName][monthIndex] += Number(quantity) || 0;
            }
        });

        // Trier les filières par quantité totale
        const sortedFilieres = Object.entries(quantitiesByFiliere)
            .sort((a, b) => {
                if (a[0] === 'Autres') return 1;
                if (b[0] === 'Autres') return -1;
                const totalA = a[1].reduce((sum, val) => sum + val, 0);
                const totalB = b[1].reduce((sum, val) => sum + val, 0);
                return totalB - totalA;
            });

        return {
            labels: monthLabels,
            datasets: sortedFilieres.map(([filiere, data]) => ({
                label: filiere,
                data: data
            }))
        };
    }

    private async generateChartImage(chartData: ReportData['chartData']): Promise<string> {
        const chartConfig = {
            type: 'bar',
            data: {
                labels: chartData.labels,
                datasets: chartData.datasets.map((dataset: { label: string; data: number[] }) => {
                    // Utiliser la couleur de la filière basée sur son nom
                    const filiereColor = this.getFiliereColor(dataset.label);
                    return {
                        label: dataset.label,
                        data: dataset.data,
                        backgroundColor: filiereColor,
                        borderColor: filiereColor,
                        borderWidth: 0,
                        stack: 'stack0'
                    };
                })
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Mois'
                        }
                    },
                    y: {
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Tonnes'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Évolution des tonnages par filière'
                    },
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        };

        const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=800&height=400`;
        
        try {
            const response = await fetch(chartUrl);
            const arrayBuffer = await response.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            return `data:image/png;base64,${base64}`;
        } catch (error) {
            console.error('Error generating chart:', error);
            throw new Error('Failed to generate chart');
        }
    }

    private calculateTreatmentStats(bsds: BSD[]): Record<string, { tonnage: number; count: number }> {
        const treatmentStats: Record<string, { tonnage: number; count: number }> = {};
        
        bsds.forEach(bsd => {
            const processingCode = bsd.infos_json?.formAPI?.createFormInput?.recipient?.processingOperation
                ?.replace(/\s+/g, '');
            const quantity = bsd.infos_json?.formAPI?.createFormInput?.quantityReceived || 
                           bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity || 0;

            if (processingCode) {
                if (!treatmentStats[processingCode]) {
                    treatmentStats[processingCode] = { tonnage: 0, count: 0 };
                }
                treatmentStats[processingCode].tonnage += quantity;
                treatmentStats[processingCode].count += 1;
            }
        });

        // Trier les traitements par tonnage décroissant
        const sortedStats = Object.entries(treatmentStats)
            .sort((a, b) => b[1].tonnage - a[1].tonnage)
            .reduce((acc, [code, stat]) => {
                acc[code] = stat;
                return acc;
            }, {} as Record<string, { tonnage: number; count: number }>);

        return sortedStats;
    }

    private calculateAllSitesTreatmentStats(): Record<string, { tonnage: number; count: number }> {
        return this.calculateTreatmentStats(this.bsds);
    }

    private async generateTreatmentChartImage(data: ReportData): Promise<string> {
        
        // Calculer les stats sur tous les BSDs
        const treatmentStats: Record<string, { tonnage: number; count: number }> = {};
        this.bsds.forEach(bsd => {
            const processingCode = bsd.infos_json?.formAPI?.createFormInput?.recipient?.processingOperation
                ?.replace(/\s+/g, '');
            const quantity = bsd.infos_json?.formAPI?.createFormInput?.quantityReceived || 
                           bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity || 0;

            if (processingCode) {
                if (!treatmentStats[processingCode]) {
                    treatmentStats[processingCode] = { tonnage: 0, count: 0 };
                }
                treatmentStats[processingCode].tonnage += quantity;
                treatmentStats[processingCode].count += 1;
            }
        });

        // Trier les traitements par tonnage décroissant
        const sortedStats = Object.entries(treatmentStats)
            .sort((a, b) => b[1].tonnage - a[1].tonnage)
            .reduce((acc, [code, stat]) => {
                acc[code] = stat;
                return acc;
            }, {} as Record<string, { tonnage: number; count: number }>);

        
        const totalTonnage = Object.values(sortedStats).reduce((sum, stat) => sum + stat.tonnage, 0);
        
        // Préparation des données pour le graphique
        const chartData = Object.entries(sortedStats)
            .map(([code, stat]) => {
                const treatment = codeTraitementDefinitions.find(t => t.code === code);
                const percentage = ((stat.tonnage / totalTonnage) * 100).toFixed(1);
                return {
                    code,
                    label: treatment?.code + " - " + treatment?.nom,
                    percentage: parseFloat(percentage),
                    color: treatment?.couleur || '#808080',
                    tonnage: stat.tonnage
                };
            })
            .sort((a, b) => b.percentage - a.percentage); // Trier par pourcentage décroissant

        
        const chartConfig = {
            type: 'horizontalBar',
            data: {
                labels: chartData.map(d => d.label),
                datasets: [{
                    data: chartData.map(d => d.percentage),
                    backgroundColor: chartData.map(d => d.color),
                    borderColor: chartData.map(d => d.color),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false,
                    },
                    title: {
                        display: false
                    }
                }
            }
        };

        const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=800&height=400`;
        return chartUrl;
    }

    private async generatePieChartImage(data: ReportData): Promise<string> {
        const filiereStats = this.calculateFiliereStats();
        
        // Filtrer pour exclure la filière TOTAL
        const filteredStats = filiereStats.filter(stat => stat.filiere !== 'TOTAL');
        const totalTonnage = filteredStats.reduce((sum, stat) => sum + stat.quantity, 0);

        // Préparer les données pour le graphique
        const labels = filteredStats.map(stat => stat.filiereName);
        const percentages = filteredStats.map(stat => 
            ((stat.quantity / totalTonnage) * 100).toFixed(1)
        );

        const chartConfig = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: percentages,
                    backgroundColor: labels.map(label => this.getFiliereColor(label)),
                    borderColor: labels.map(label => this.getFiliereColor(label)),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context: { raw: number }) {
                                return context.raw + '%';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value: number) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        };

        const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=1200&height=600`;
        return chartUrl;
    }

    private async generateFinancialChartImage(data: ReportData): Promise<string> {
        const { firstDate, lastDate } = this.getDateRange();
        const financialData = data.financialData;
        
        // Générer les labels de mois
        const monthLabels: string[] = [];
        const currentDate = new Date(firstDate);
        while (currentDate <= lastDate) {
            const label = currentDate.toLocaleString('fr-FR', { 
                month: 'short',
                year: '2-digit'
            });
            monthLabels.push(label.charAt(0).toUpperCase() + label.slice(1));
            currentDate.setMonth(currentDate.getMonth() + 1);
        }

        // Préparer les données par filière et par mois
        const positiveAmountsByFiliere: { [key: string]: { [key: string]: number } } = {};
        const negativeAmountsByFiliere: { [key: string]: { [key: string]: number } } = {};

        // Récupérer l'entreprise_id depuis les BSDs
        const entreprise_id = this.bsds[0]?.entreprise_id;
        if (!entreprise_id) {
            return '';
        }

        // Récupérer les SIRETs des sites sélectionnés depuis les BSDs
        const selectedSiteSirets = new Set(
            this.bsds
                .map(bsd => bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.siret)
                .filter(siret => siret && siret !== '')
        );

        // Récupérer toutes les factures de l'entreprise
        let allFactures: Facture[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('facture')
                .select('*')
                .eq('entreprise_id', entreprise_id)
                .range(page * pageSize, (page + 1) * pageSize - 1);
            
            if (error) {
                console.error('Error fetching factures:', error);
                break;
            }

            if (data && data.length > 0) {
                allFactures = [...allFactures, ...data];
                page++;
            } else {
                hasMore = false;
            }
        }

        // Filtrer les factures selon la période des BSDs
        const filteredFactures = allFactures.filter(facture => {
            const factureDate = new Date(facture.created_at);
            return factureDate >= firstDate && factureDate <= lastDate;
        });

        // Traiter les factures pour extraire les données financières par mois
        filteredFactures.forEach(facture => {
            facture.infos_json.departs.forEach(depart => {
                // Filtrer sur les sites sélectionnés
                const siteSiret = depart.line_header.site_siret;
                if (selectedSiteSirets.size > 0 && (!siteSiret || !selectedSiteSirets.has(siteSiret))) {
                    return; // Ignorer ce départ si le site n'est pas sélectionné
                }

                const cleanedCed = depart.line_header.code_dechet?.replaceAll(' ', '').replace('*', '').trim() || '';
                
                // Déterminer la filière
                const mapping = this.mappingTable.find(m => 
                    m.ced.replaceAll(' ', '').replace('*', '').trim() === cleanedCed
                );
                const filiere = mapping?.filiere || 'Autres';
                
                // Traiter chaque ligne du body individuellement
                depart.line_body.forEach(line => {
                    const montant = line.montant_ht;
                    const type = this.normalizeOperationType(line.type_operation);
                    const dateDepart = new Date(depart.line_header?.date_depart);
                    
                    // Extraire les composants de la date en UTC
                    const utcYear = dateDepart.getUTCFullYear();
                    const utcMonth = dateDepart.getUTCMonth();
                    // Créer une nouvelle date avec les composants UTC
                    dateDepart.setUTCFullYear(utcYear, utcMonth, 1);
                    dateDepart.setUTCHours(0, 0, 0, 0);

                    // Vérifier si la date est dans l'intervalle
                    if (dateDepart >= firstDate && dateDepart <= lastDate) {
                        const monthKey = dateDepart.toISOString().slice(0, 7); // Format YYYY-MM

                        // Les rachats sont considérés comme négatifs
                        if (type === 'rachat') {
                            if (!negativeAmountsByFiliere[filiere]) {
                                negativeAmountsByFiliere[filiere] = {};
                            }
                            negativeAmountsByFiliere[filiere][monthKey] = (negativeAmountsByFiliere[filiere][monthKey] || 0) + montant;
                        } else {
                            if (!positiveAmountsByFiliere[filiere]) {
                                positiveAmountsByFiliere[filiere] = {};
                            }
                            positiveAmountsByFiliere[filiere][monthKey] = (positiveAmountsByFiliere[filiere][monthKey] || 0) + montant;
                        }
                    }
                });
            });
        });

        const datasets = [
            ...Object.entries(positiveAmountsByFiliere).map(([filiere, data]) => {
                // Utiliser la couleur de la filière basée sur son nom plutôt que sur l'index
                const filiereColor = this.getFiliereColor(filiere);
                const mappedData = monthLabels.map(label => {
                    const [monthStr, yearStr] = label.split(' ');
                    const cleanMonthStr = monthStr.replace('.', '');
                    const monthMap = {
                        'Janv': 0, 'Févr': 1, 'Mars': 2, 'Avr': 3, 'Mai': 4, 'Juin': 5,
                        'Juil': 6, 'Août': 7, 'Sept': 8, 'Oct': 9, 'Nov': 10, 'Déc': 11
                    };
                    const monthIndex = monthMap[cleanMonthStr as keyof typeof monthMap];
                    const year = parseInt(yearStr, 10) + 2000;
                    const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
                    const value = data[monthKey] || 0;
                    
                    return value;
                });
                
                return {
                    label: filiere,
                    data: mappedData,
                    backgroundColor: filiereColor,
                    stack: 'negative',
                    borderRadius: 4
                };
            }),
            ...Object.entries(negativeAmountsByFiliere).map(([filiere, data]) => {
                // Utiliser la couleur de la filière basée sur son nom plutôt que sur l'index
                const filiereColor = this.getFiliereColor(filiere);
                const mappedData = monthLabels.map(label => {
                    const [monthStr, yearStr] = label.split(' ');
                    const cleanMonthStr = monthStr.replace('.', '');
                    const monthMap = {
                        'Janv': 0, 'Févr': 1, 'Mars': 2, 'Avr': 3, 'Mai': 4, 'Juin': 5,
                        'Juil': 6, 'Août': 7, 'Sept': 8, 'Oct': 9, 'Nov': 10, 'Déc': 11
                    };
                    const monthIndex = monthMap[cleanMonthStr as keyof typeof monthMap];
                    const year = parseInt(yearStr, 10) + 2000;
                    const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
                    // Les rachats sont comptés négativement dans le total
                    const value = -(data[monthKey] || 0);
                    
                    return value;
                });
                
                return {
                    label: filiere,
                    data: mappedData,
                    backgroundColor: filiereColor,
                    stack: 'positive',
                    borderRadius: 4
                };
            })
        ];

        const chartConfig = {
            type: 'bar',
            data: {
                labels: monthLabels,
                datasets: datasets
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Évolution des coûts et revenus mensuels par filière',
                        color: 'gray',
                        align: 'center',
                        padding: {
                            top: 10,
                            bottom: 10
                        },
                        font: {
                            size: 14,
                            weight: 'normal'
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(tooltipItem: { raw: number; dataset: { stack: string; label: string } }) {
                                const value = Math.abs(tooltipItem.raw);
                                const isNegative = tooltipItem.dataset.stack === 'positive';
                                const symbol = isNegative ? '+' : '-';
                                return `${symbol} ${tooltipItem.dataset.label}: ${value.toLocaleString('fr-FR')} €`;
                            },
                            footer: function(tooltipItems: Array<{ raw: number; dataset: { stack: string } }>) {
                                const positiveTotal = tooltipItems
                                    .filter(item => item.dataset.stack === 'positive')
                                    .reduce((sum, item) => sum + Math.abs(item.raw), 0);
                                
                                const negativeTotal = tooltipItems
                                    .filter(item => item.dataset.stack === 'negative')
                                    .reduce((sum, item) => sum + Math.abs(item.raw), 0);

                                return [
                                    `Total coûts : -${negativeTotal.toLocaleString('fr-FR')} €`,
                                    `Total revenus : +${positiveTotal.toLocaleString('fr-FR')} €`,
                                    `Bilan : ${(positiveTotal - negativeTotal).toLocaleString('fr-FR')} €`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'Euros'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        };

        const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=1200&height=400`;
        
        try {
            const response = await fetch(chartUrl);
            const arrayBuffer = await response.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            return `data:image/png;base64,${base64}`;
        } catch (error) {
            console.error('Error generating financial chart:', error);
            throw new Error('Failed to generate financial chart');
        }
    }

    private async prepareReportData(): Promise<ReportData> {
        if (this.bsds.length === 0) {
            throw new Error('Aucun BSD trouvé pour les sites sélectionnés');
        }

        const { firstDate, lastDate } = this.getDateRange();
        if (!firstDate || !lastDate || isNaN(firstDate.getTime()) || isNaN(lastDate.getTime())) {
            throw new Error('Dates invalides dans les BSDs');
        }

        const filiereStats = this.calculateFiliereStats();
        if (filiereStats.length === 0) {
            throw new Error('Aucune statistique de filière calculée');
        }

        // Calculer les statistiques globales
        const totalQuantity = filiereStats.reduce((sum, stat) => sum + stat.quantity, 0);
        const nonTriQuantity = filiereStats.find(stat => 
            (stat.filiere === 'DIB' || stat.filiere === 'DAOM' || stat.filiere === 'DASRI')
        )?.quantity || 0;
        const sortingRate = totalQuantity > 0 ? (1 - (nonTriQuantity / totalQuantity)) * 100 : 0;

        // Calculer les taux de valorisation
        const bsdsWithProcessingOperation = this.bsds.filter(bsd => 
            bsd.infos_json?.formAPI?.createFormInput?.recipient?.processingOperation
        );

        const globallyValorizedBsds = bsdsWithProcessingOperation.filter(bsd => {
            const processingCode = bsd.infos_json?.formAPI?.createFormInput?.recipient?.processingOperation
                ?.replace(/\s+/g, '');
            return processingCode && tauxValorisationGlobale.includes(processingCode);
        });

        const materiallyValorizedBsds = bsdsWithProcessingOperation.filter(bsd => {
            const processingCode = bsd.infos_json?.formAPI?.createFormInput?.recipient?.processingOperation
                ?.replace(/\s+/g, '');
            return processingCode && tauxValorisationMatière.includes(processingCode);
        });

        const materialValorizationRate = bsdsWithProcessingOperation.length > 0 
            ? (materiallyValorizedBsds.length / bsdsWithProcessingOperation.length) * 100 
            : 0;

        const globalValorizationRate = bsdsWithProcessingOperation.length > 0 
            ? (globallyValorizedBsds.length / bsdsWithProcessingOperation.length) * 100 
            : 0;

        // Préparer les données pour les graphiques
        const chartData = this.prepareChartData();

        // Récupérer les données financières
        const financialData = await this.getFinancialData();

        // Générer les images des graphiques
        const [chartImage, treatmentChartImage, pieChartImage, financialChartImage] = await Promise.all([
            this.generateChartImage(chartData),
            this.generateTreatmentChartImage({
                header: {
                    siteName: this.site.givenName,
                    firstDate,
                    lastDate,
                    siteAddress: this.site.address,
                    entrepriseName: this.entrepriseName,
                    selectedSites: this.getSitesInfo().map(site => site.name)
                },
                filiereStats,
                transporteurs: [],
                destinataires: [],
                registre: [],
                chartData,
                chartImage: '',
                treatmentChartImage: '',
                pieChartImage: '',
                financialChartImage: '',
                stats: {
                    totalQuantity,
                    sortingRate,
                    materialValorizationRate,
                    globalValorizationRate
                },
                financialData
            }),
            this.generatePieChartImage({
                header: {
                    siteName: this.site.givenName,
                    firstDate,
                    lastDate,
                    siteAddress: this.site.address,
                    entrepriseName: this.entrepriseName,
                    selectedSites: this.getSitesInfo().map(site => site.name)
                },
                filiereStats,
                transporteurs: [],
                destinataires: [],
                registre: [],
                chartData,
                chartImage: '',
                treatmentChartImage: '',
                pieChartImage: '',
                financialChartImage: '',
                stats: {
                    totalQuantity,
                    sortingRate,
                    materialValorizationRate,
                    globalValorizationRate
                },
                financialData
            }),
            this.generateFinancialChartImage({
                header: {
                    siteName: this.site.givenName,
                    firstDate,
                    lastDate,
                    siteAddress: this.site.address,
                    entrepriseName: this.entrepriseName,
                    selectedSites: this.getSitesInfo().map(site => site.name)
                },
                filiereStats,
                transporteurs: [],
                destinataires: [],
                registre: [],
                chartData,
                chartImage: '',
                treatmentChartImage: '',
                pieChartImage: '',
                financialChartImage: '',
                stats: {
                    totalQuantity,
                    sortingRate,
                    materialValorizationRate,
                    globalValorizationRate
                },
                financialData
            })
        ]);

        return {
            header: {
                siteName: this.site.givenName,
                firstDate,
                lastDate,
                siteAddress: this.site.address,
                entrepriseName: this.entrepriseName,
                selectedSites: this.getSitesInfo().map(site => site.name)
            },
            filiereStats,
            transporteurs: [],
            destinataires: [],
            registre: [],
            chartData,
            chartImage,
            treatmentChartImage,
            pieChartImage,
            financialChartImage,
            stats: {
                totalQuantity,
                sortingRate,
                materialValorizationRate,
                globalValorizationRate
            },
            financialData
        };
    }

    private getSitesInfo(): Array<{ name: string; firstDate: Date; lastDate: Date }> {
        const sitesMap = new Map<string, { name: string; firstDate: Date; lastDate: Date }>();

        this.bsds.forEach(bsd => {
            const siteId = bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.siret;
            const siteName = bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.name;
            const date = new Date(bsd.infos_json?.formAPI?.createFormInput?.takenOverAt || bsd.created_at || '');

            if (siteId && siteName && !isNaN(date.getTime())) {
                const current = sitesMap.get(siteId) || {
                    name: siteName,
                    firstDate: date,
                    lastDate: date
                };

                if (date < current.firstDate) current.firstDate = date;
                if (date > current.lastDate) current.lastDate = date;

                sitesMap.set(siteId, current);
            }
        });

        return Array.from(sitesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }

    public async getReportData(): Promise<ReportData> {
        return this.prepareReportData();
    }
}