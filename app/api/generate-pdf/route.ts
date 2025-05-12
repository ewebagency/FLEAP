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
    };
    filiereStats: Array<{
        filiere: string;
        filiereName: string;
        quantity: number;
        materialValorizationRate: number;
        globalValorizationRate: number;
    }>;
    transporteurs: Array<{
        name: string;
        siret: string;
        address?: string;
        type: 'transporteur';
    }>;
    destinataires: Array<{
        name: string;
        siret: string;
        address?: string;
        type: 'destinataire';
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
}

async function generateChartImage(chartData: ReportData['chartData']): Promise<string> {
    const chartConfig = {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: chartData.datasets.map((dataset, index) => ({
                label: dataset.label,
                data: dataset.data,
                backgroundColor: `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.7)`,
                borderColor: `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 1)`,
                borderWidth: 1,
                stack: 'stack0'
            }))
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

export async function POST(request: Request) {
    try {
        const data: ReportData = await request.json();
        
        // Générer l'image du graphique
        const chartImage = await generateChartImage(data.chartData);

        // Créer le document PDF avec react-pdf
        const pdfDoc = PDFDocument({ data, chartImage });
        const stream = await renderToStream(pdfDoc);

        // Convertir le stream en buffer
        const chunks: Uint8Array[] = [];
        for await (const chunk of stream) {
            if (chunk instanceof Uint8Array) {
                chunks.push(chunk);
            }
        }
        const buffer = Buffer.concat(chunks);

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="rapport.pdf"'
            }
        });
    } catch (error) {
        console.error('Error generating PDF:', error);
        return new NextResponse('Error generating PDF', { status: 500 });
    }
} 