import { BSD } from '@/app/analysis/AnalysisProvider';
import { tauxValorisationGlobale, tauxValorisationMatière, treatmentLabels } from '../Analyse/Environnementale/codeTraitement';
import { getFiliere } from '@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new';
import { tailwindToRgba } from '../Analyse/MetaComponent/Colours';
import { ReportData } from './types';
import { codeTraitementDefinitions } from '../Analyse/Environnementale/codeTraitement';

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
        // Couleurs prédéfinies pour les datasets
        const colors = [
            'blue-400', 'green-400', 'purple-400', 'yellow-400', 'pink-400',
            'orange-400', 'teal-400', 'cyan-400', 'indigo-400', 'gray-400',
            'blue-700', 'green-700', 'purple-700', 'yellow-700', 'pink-700',
            'orange-700', 'teal-700', 'cyan-700', 'indigo-700', 'gray-700'
        ];

        const chartConfig = {
            type: 'bar',
            data: {
                labels: chartData.labels,
                datasets: chartData.datasets.map((dataset: { label: string; data: number[] }, index: number) => {
                    const colorIndex = index % colors.length;
                    const color = colors[colorIndex];
                    return {
                        label: dataset.label,
                        data: dataset.data,
                        backgroundColor: tailwindToRgba(color, 1),
                        borderColor: tailwindToRgba(color, 1),
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

        // Couleurs prédéfinies pour les datasets
        const colors = [
            'blue-400', 'green-400', 'purple-400', 'yellow-400', 'pink-400',
            'orange-400', 'teal-400', 'cyan-400', 'indigo-400', 'gray-400',
            'blue-700', 'green-700', 'purple-700', 'yellow-700', 'pink-700',
            'orange-700', 'teal-700', 'cyan-700', 'indigo-700', 'gray-700'
        ];

        const chartConfig = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: percentages,
                    backgroundColor: labels.map((_, index) => {
                        const colorIndex = index % colors.length;
                        const color = colors[colorIndex];
                        return tailwindToRgba(color, 1);
                    }),
                    borderColor: labels.map((_, index) => {
                        const colorIndex = index % colors.length;
                        const color = colors[colorIndex];
                        return tailwindToRgba(color, 1);
                    }),
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

        // Générer les images des graphiques
        const [chartImage, treatmentChartImage, pieChartImage] = await Promise.all([
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
                stats: {
                    totalQuantity,
                    sortingRate,
                    materialValorizationRate,
                    globalValorizationRate
                }
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
                stats: {
                    totalQuantity,
                    sortingRate,
                    materialValorizationRate,
                    globalValorizationRate
                }
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
            stats: {
                totalQuantity,
                sortingRate,
                materialValorizationRate,
                globalValorizationRate
            }
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