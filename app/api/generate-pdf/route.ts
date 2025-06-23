import { NextResponse } from 'next/server';
import { renderToStream } from '@react-pdf/renderer';
import { PDFDocument } from './PDFDocument';

interface ReportData {
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

export async function POST(request: Request) {
    try {
        console.log('Received PDF generation request');
        const data: ReportData = await request.json();
        
        // Validation des données
        if (!data.header || !data.header.siteName || !data.header.entrepriseName) {
            throw new Error('Données d\'en-tête manquantes');
        }

        if (!data.filiereStats || data.filiereStats.length === 0) {
            throw new Error('Aucune statistique de filière fournie');
        }

        if (!data.chartImage) {
            throw new Error('Image du graphique manquante');
        }

        if (!data.treatmentChartImage) {
            throw new Error('Image du graphique de traitement manquante');
        }

        if (!data.pieChartImage) {
            throw new Error('Image du graphique circulaire manquante');
        }

        console.log('Chart image length:', data.chartImage.length);
        console.log('Treatment chart image length:', data.treatmentChartImage.length);
        console.log('Pie chart image length:', data.pieChartImage.length);

        // Vérifier que les URLs des graphiques sont valides
        console.log('Chart image URL:', data.chartImage.substring(0, 100) + '...');
        console.log('Treatment chart image URL:', data.treatmentChartImage.substring(0, 100) + '...');
        console.log('Pie chart image URL:', data.pieChartImage.substring(0, 100) + '...');

        // Créer le document PDF avec react-pdf
        console.log('Creating PDF document...');
        const pdfDoc = PDFDocument({ data });
        
        console.log('Rendering PDF to stream...');
        const stream = await renderToStream(pdfDoc);

        // Convertir le stream en buffer
        console.log('Converting stream to buffer...');
        const chunks: Uint8Array[] = [];
        for await (const chunk of stream) {
            if (chunk instanceof Uint8Array) {
                chunks.push(chunk);
            }
        }
        const buffer = Buffer.concat(chunks);

        console.log('PDF generation completed successfully');
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="rapport.pdf"'
            }
        });
    } catch (error) {
        console.error('Error generating PDF:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue lors de la génération du PDF';
        return new NextResponse(JSON.stringify({ error: errorMessage }), { 
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
} 