import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import Chart from 'chart.js/auto';

interface ReportData {
    header: {
        siteName: string;
        firstDate: Date;
        lastDate: Date;
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

function generateHTML(data: ReportData): string {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                }
                .header h1 {
                    color: #2c3e50;
                    margin: 0;
                }
                .header p {
                    color: #7f8c8d;
                    margin: 5px 0;
                }
                .section {
                    margin-bottom: 30px;
                }
                .section h2 {
                    color: #2c3e50;
                    border-bottom: 2px solid #3498db;
                    padding-bottom: 5px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 15px 0;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                }
                th {
                    background-color: #f5f6fa;
                }
                tr:nth-child(even) {
                    background-color: #f9f9f9;
                }
                .chart-container {
                    width: 100%;
                    height: 400px;
                    margin: 20px 0;
                    position: relative;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Rapport de Gestion des Déchets</h1>
                <p>Site: ${data.header.siteName}</p>
                <p>Entreprise: ${data.header.entrepriseName}</p>
                <p>Période: ${new Date(data.header.firstDate).toLocaleDateString('fr-FR')} - ${new Date(data.header.lastDate).toLocaleDateString('fr-FR')}</p>
            </div>

            <div class="section">
                <h2>Évolution des tonnages par filière</h2>
                <div class="chart-container">
                    <canvas id="mainChart"></canvas>
                </div>
            </div>

            <div class="section">
                <h2>Résumé des filières</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Filière</th>
                            <th>Quantité (T)</th>
                            <th>Taux de valorisation matière (%)</th>
                            <th>Taux de valorisation globale (%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.filiereStats.map((stat) => `
                            <tr>
                                <td>${stat.filiereName}</td>
                                <td>${stat.quantity.toFixed(2)}</td>
                                <td>${stat.materialValorizationRate.toFixed(1)}</td>
                                <td>${stat.globalValorizationRate.toFixed(1)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            ${data.transporteurs.length > 0 && `<div class="section">
                <h2>Transporteurs</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Nom</th>
                            <th>SIRET</th>
                            <th>Adresse</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.transporteurs.map((t) => `
                            <tr>
                                <td>${t.name}</td>
                                <td>${t.siret}</td>
                                <td>${t.address || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            `}

            ${data.destinataires.length > 0 && `<div class="section">
                <h2>Destinataires</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Nom</th>
                            <th>SIRET</th>
                            <th>Adresse</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.destinataires.map((d) => `
                            <tr>
                                <td>${d.name}</td>
                                <td>${d.siret}</td>
                                <td>${d.address || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            `}

            <div class="section">
                <h2>Registre des déchets</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Déchet</th>
                            <th>Code</th>
                            <th>Quantité (T)</th>
                            <th>Date</th>
                            <th>Code de traitement</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.registre.map((r) => `
                            <tr>
                                <td>${r.wasteName}</td>
                                <td>${r.wasteCode}</td>
                                <td>${r.quantity.toFixed(2)}</td>
                                <td>${new Date(r.date).toLocaleDateString('fr-FR')}</td>
                                <td>${r.processingCode}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <script>
                console.log('Starting chart initialization...');
                
                // Vérifier que Chart.js est chargé
                if (typeof Chart === 'undefined') {
                    console.error('Chart.js is not loaded!');
                } else {
                    console.log('Chart.js is loaded successfully');
                }

                // Vérifier que le canvas existe
                const canvas = document.getElementById('mainChart');
                if (!canvas) {
                    console.error('Canvas element not found!');
                } else {
                    console.log('Canvas element found');
                }

                // Données du graphique
                const chartData = {
                    labels: ${JSON.stringify(data.chartData.labels)},
                    datasets: ${JSON.stringify(data.chartData.datasets.map((dataset, index) => ({
                        label: dataset.label,
                        data: dataset.data,
                        backgroundColor: `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.7)`,
                        borderColor: `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 1)`,
                        borderWidth: 1
                    })))}
                };

                console.log('Chart data:', chartData);

                try {
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        console.error('Could not get canvas context');
                    } else {
                        console.log('Canvas context obtained');
                        const chart = new Chart(ctx, {
                            type: 'bar',
                            data: chartData,
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
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
                        });
                        console.log('Chart created successfully');
                    }
                } catch (error) {
                    console.error('Error creating chart:', error);
                }
            </script>
        </body>
        </html>
    `;
}

export async function POST(request: Request) {
    try {
        const data = await request.json();
        const html = generateHTML(data);

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Configurer la taille de la page
        await page.setViewport({
            width: 1200,
            height: 800
        });

        // Capturer les logs de la console
        page.on('console', msg => {
            console.log('PAGE LOG:', msg.type(), msg.text());
        });

        // Attendre que le contenu soit chargé
        await page.setContent(html, { 
            waitUntil: ['networkidle0', 'domcontentloaded']
        });

        // Attendre que le canvas soit rendu
        await page.waitForSelector('#mainChart', { visible: true });

        // Attendre que le graphique soit complètement rendu
        await page.evaluate(() => {
            return new Promise((resolve) => {
                const chart = document.querySelector('#mainChart') as HTMLCanvasElement;
                if (chart) {
                    const ctx = chart.getContext('2d');
                    if (ctx) {
                        const checkChart = setInterval(() => {
                            if (chart.width > 0 && chart.height > 0) {
                                clearInterval(checkChart);
                                resolve(true);
                            }
                        }, 100);
                    }
                }
            });
        });

        // Attendre un peu plus longtemps
        await new Promise(resolve => setTimeout(resolve, 2000));

        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '20px',
                left: '20px'
            }
        });

        await browser.close();

        return new NextResponse(pdf, {
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