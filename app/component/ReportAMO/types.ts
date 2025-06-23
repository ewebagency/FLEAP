export interface ReportData {
    header: {
        siteName: string;
        firstDate: Date;
        lastDate: Date;
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
    treatmentChartImage: string;
    pieChartImage: string;
    financialChartImage: string;
    stats: {
        totalQuantity: number;
        sortingRate: number;
        materialValorizationRate: number;
        globalValorizationRate: number;
    };
    financialData: {
        [filiere: string]: {
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
        };
    };
} 