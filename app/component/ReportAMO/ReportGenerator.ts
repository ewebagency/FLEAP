import { BSD } from '@/app/analysis/AnalysisProvider';
import { tauxValorisationGlobale, tauxValorisationMatière } from '../Analyse/Environnementale/codeTraitement';
import { getFiliere } from '@/app/register/RegisterComponents/Modal/FormulaireFull/utils_new';

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
}

interface Prestataire {
    name: string;
    siret: string;
    address?: string;
    type: 'transporteur' | 'destinataire';
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
        }>();

        this.getSiteBSDs().forEach(bsd => {
            const wasteCode = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code;
            const filiereName = this.getFiliereName(wasteCode);
            const quantity = bsd.infos_json?.formAPI?.createFormInput?.quantityReceived || bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity || 0;
            const processingCode = bsd.infos_json?.formAPI?.createFormInput?.recipient?.processingOperation?.replace(/\s+/g, '');

            const current = filiereMap.get(filiereName) || {
                filiereName,
                quantity: 0,
                materialValorized: 0,
                globalValorized: 0,
                total: 0,
                processedCount: 0
            };

            current.quantity += quantity;
            current.total += 1;

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

        const stats = Array.from(filiereMap.entries()).map(([filiere, stats]) => {
            totalQuantity += stats.quantity;
            totalProcessed += stats.processedCount;
            totalMaterialValorized += stats.materialValorized;
            totalGlobalValorized += stats.globalValorized;

            // Calculer les taux de valorisation pour chaque filière
            const materialValorizationRate = stats.processedCount > 0 
                ? (stats.materialValorized / stats.processedCount) * 100 
                : 0;
            const globalValorizationRate = stats.processedCount > 0 
                ? (stats.globalValorized / stats.processedCount) * 100 
                : 0;

            return {
                filiere,
                filiereName: stats.filiereName,
                quantity: stats.quantity,
                materialValorizationRate,
                globalValorizationRate
            };
        });

        // Trier les filières par quantité (décroissant)
        stats.sort((a, b) => b.quantity - a.quantity);

        // Ajouter la ligne des totaux avec les taux moyens pondérés
        const totalMaterialValorizationRate = totalProcessed > 0 
            ? (totalMaterialValorized / totalProcessed) * 100 
            : 0;
        const totalGlobalValorizationRate = totalProcessed > 0 
            ? (totalGlobalValorized / totalProcessed) * 100 
            : 0;

        stats.push({
            filiere: 'TOTAL',
            filiereName: 'TOTAL',
            quantity: totalQuantity,
            materialValorizationRate: totalMaterialValorizationRate,
            globalValorizationRate: totalGlobalValorizationRate
        });

        return stats;
    }

    private getPrestataires(): { transporteurs: Prestataire[]; destinataires: Prestataire[] } {
        const prestataires = new Set<string>();
        const transporteurs: Prestataire[] = [];
        const destinataires: Prestataire[] = [];

        this.getSiteBSDs().forEach(bsd => {
            const transporter = bsd.infos_json?.formAPI?.createFormInput?.transporter?.company;
            const recipient = bsd.infos_json?.formAPI?.createFormInput?.recipient?.company;

            if (transporter && !prestataires.has(transporter.siret)) {
                prestataires.add(transporter.siret);
                transporteurs.push({
                    name: transporter.name,
                    siret: transporter.siret,
                    address: transporter.address,
                    type: 'transporteur'
                });
            }

            if (recipient && !prestataires.has(recipient.siret)) {
                prestataires.add(recipient.siret);
                destinataires.push({
                    name: recipient.name,
                    siret: recipient.siret,
                    address: recipient.address,
                    type: 'destinataire'
                });
            }
        });

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

    public async generateReportData(): Promise<Blob> {
        const siteBSDs = this.getSiteBSDs();
        const { firstDate, lastDate } = this.getDateRange();
        const filiereStats = this.calculateFiliereStats();
        const { transporteurs, destinataires } = this.getPrestataires();
        const chartData = this.prepareChartData();

        const data = {
            header: {
                siteName: this.getSiteName(),
                firstDate,
                lastDate,
                siteAddress: this.site.address,
                entrepriseName: this.entrepriseName
            },
            filiereStats,
            transporteurs,
            destinataires,
            chartData,
            registre: siteBSDs.map(bsd => ({
                wasteName: bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.name || '',
                wasteCode: bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code || '',
                quantity: bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.quantity || 0,
                date: bsd.created_at || new Date().toISOString(),
                processingCode: bsd.infos_json?.formAPI?.createFormInput?.recipient?.processingOperation || ''
            }))
        };

        const response = await fetch('/api/generate-pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error('Failed to generate PDF');
        }

        return response.blob();
    }
} 