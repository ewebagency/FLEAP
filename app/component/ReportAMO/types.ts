export interface ReportData {
    header: {
        siteName: string;
        firstDate: Date | string;
        lastDate: Date | string;
        siteAddress?: string;
        entrepriseName: string;
        selectedSites?: string[];
    };
    filiereStats: Array<{
        filiere: string;
        filiereName: string;
        quantity: number;
        materialValorizationRate: number;
        globalValorizationRate: number;
        numberOfCollections: number;
        averageCollectionsPerMonth: number;
    }>;
    transporteurs: Array<{
        name: string;
        siret: string;
        type: 'transporteur';
        percentage: number;
    }>;
    destinataires: Array<{
        name: string;
        siret: string;
        type: 'destinataire';
        percentage: number;
    }>;
    registre: Array<{
        wasteName: string;
        wasteCode: string;
        quantity: number;
        date: string;
        processingCode: string;
    }>;
    chartData: {
        labels: string[];
        datasets: Array<{
            label: string;
            data: number[];
        }>;
    };
    chartImage: string;
} 