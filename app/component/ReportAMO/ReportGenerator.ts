import { BSD } from '@/app/analysis/AnalysisProvider';
import { tauxValorisationGlobale, tauxValorisationMatière } from '../Analyse/Environnementale/codeTraitement';
import { getFiliere } from '@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new';
import { tailwindToRgba } from '../Analyse/MetaComponent/Colours';
import { ReportData } from './types';

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

    private getSiteBSDs(): BSD[] {
        return this.bsds.filter(bsd => 
            bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.orgId === this.site.orgId
        );
    }

    private getSiteName(): string {
        const siteBSDs = this.getSiteBSDs();
        const siteName = siteBSDs.find(bsd => 
            bsd.infos_json?.formAPI?.createFormInput?.emitter?.company?.name
        )?.infos_json?.formAPI?.createFormInput?.emitter?.company?.name;
        
        return siteName || this.site.givenName;
    }

    private getDateRange(): { firstDate: Date; lastDate: Date } {
        const dates = this.getSiteBSDs()
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

        this.getSiteBSDs().forEach(bsd => {
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

            // Mettre à jour les dates
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

        // Calculer les totaux
        let totalQuantity = 0;
        let totalProcessed = 0;
        let totalMaterialValorized = 0;
        let totalGlobalValorized = 0;
        let totalCollections = 0;
        let globalFirstDate = new Date();
        let globalLastDate = new Date(0);

        const stats = Array.from(filiereMap.entries()).map(([filiere, stats]) => {
            totalQuantity += stats.quantity;
            totalProcessed += stats.processedCount;
            totalMaterialValorized += stats.materialValorized;
            totalGlobalValorized += stats.globalValorized;
            totalCollections += stats.collections;

            // Mettre à jour les dates globales
            if (stats.firstDate < globalFirstDate) globalFirstDate = stats.firstDate;
            if (stats.lastDate > globalLastDate) globalLastDate = stats.lastDate;

            // Calculer les taux de valorisation pour chaque filière
            const materialValorizationRate = stats.processedCount > 0 
                ? (stats.materialValorized / stats.processedCount) * 100 
                : 0;
            const globalValorizationRate = stats.processedCount > 0 
                ? (stats.globalValorized / stats.processedCount) * 100 
                : 0;

            // Calculer le nombre de mois entre la première et la dernière collecte
            const monthsDiff = (stats.lastDate.getFullYear() - stats.firstDate.getFullYear()) * 12 + 
                             (stats.lastDate.getMonth() - stats.firstDate.getMonth()) + 1;
            
            // Calculer la moyenne mensuelle de collectes
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

        // Trier les filières par quantité (décroissant)
        stats.sort((a, b) => b.quantity - a.quantity);

        // Calculer la moyenne mensuelle globale
        const globalMonthsDiff = (globalLastDate.getFullYear() - globalFirstDate.getFullYear()) * 12 + 
                               (globalLastDate.getMonth() - globalFirstDate.getMonth()) + 1;
        const globalAverageCollectionsPerMonth = globalMonthsDiff > 0 ? totalCollections / globalMonthsDiff : 0;

        // Ajouter la ligne des totaux
        stats.push({
            filiere: 'TOTAL',
            filiereName: 'TOTAL',
            quantity: totalQuantity,
            materialValorizationRate: totalProcessed > 0 ? (totalMaterialValorized / totalProcessed) * 100 : 0,
            globalValorizationRate: totalProcessed > 0 ? (totalGlobalValorized / totalProcessed) * 100 : 0,
            numberOfCollections: totalCollections,
            averageCollectionsPerMonth: globalAverageCollectionsPerMonth
        });

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
        this.getSiteBSDs().forEach(bsd => {
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
        const siteBSDs = this.getSiteBSDs();
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

    private async prepareReportData(): Promise<ReportData> {
        console.log('Getting site BSDs...');
        const siteBSDs = this.getSiteBSDs();
        if (siteBSDs.length === 0) {
            throw new Error('Aucun BSD trouvé pour ce site');
        }

        console.log('Calculating date range...');
        const { firstDate, lastDate } = this.getDateRange();
        if (!firstDate || !lastDate || isNaN(firstDate.getTime()) || isNaN(lastDate.getTime())) {
            throw new Error('Dates invalides dans les BSDs');
        }

        console.log('Calculating filiere stats...');
        const filiereStats = this.calculateFiliereStats();
        if (filiereStats.length === 0) {
            throw new Error('Aucune statistique de filière calculée');
        }

        console.log('Getting prestataires...');
        const { transporteurs, destinataires } = this.getPrestataires();

        // Filtrer/caster pour garantir le type
        const transporteursTyped = transporteurs.filter(t => t.type === 'transporteur').map(t => ({
            name: t.name,
            siret: t.siret,
            type: 'transporteur' as const,
            percentage: t.percentage
        }));
        const destinatairesTyped = destinataires.filter(d => d.type === 'destinataire').map(d => ({
            name: d.name,
            siret: d.siret,
            type: 'destinataire' as const,
            percentage: d.percentage
        }));

        console.log('Preparing chart data...');
        const chartData = this.prepareChartData();

        console.log('Generating chart image...');
        const chartImage = await this.generateChartImage(chartData);

        return {
            header: {
                siteName: this.getSiteName(),
                firstDate,
                lastDate,
                siteAddress: this.site.address,
                entrepriseName: this.entrepriseName
            },
            filiereStats,
            transporteurs: transporteursTyped,
            destinataires: destinatairesTyped,
            registre: [],
            chartData,
            chartImage
        };
    }

    public async generateReportData(): Promise<Blob> {
        try {
            const data = await this.prepareReportData();

            console.log('Sending data to PDF generation endpoint...');
            const response = await fetch('/api/generate-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erreur serveur (${response.status}): ${errorText}`);
            }

            console.log('PDF generated successfully');
            return response.blob();
        } catch (error) {
            console.error('Error in generateReportData:', error);
            if (error instanceof Error) {
                throw new Error(`Erreur lors de la génération du rapport: ${error.message}`);
            }
            throw error;
        }
    }

    public async getReportData(): Promise<ReportData> {
        return this.prepareReportData();
    }
} 