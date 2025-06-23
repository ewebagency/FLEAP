import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Register fonts
Font.register({
    family: 'Helvetica',
    fonts: [
        { src: 'Helvetica' },
        { src: 'Helvetica-Bold', fontWeight: 'bold' }
    ]
});

// Create styles
const styles = StyleSheet.create({
    page: {
        padding: 30,
        fontSize: 12,
        fontFamily: 'Helvetica',
    },
    header: {
        marginBottom: 0,
        borderBottom: 1,
        paddingBottom: 10,
        backgroundColor: '#f8f9fa',
        padding: 15,
        borderRadius: 5,
    },
    title: {
        fontSize: 24,
        marginBottom: 10,
        fontWeight: 'bold',
        color: '#1a365d',
    },
    subtitle: {
        fontSize: 14,
        marginBottom: 5,
        color: '#4a5568',
    },
    section: {
        margin: 0,
        padding: 15,
        backgroundColor: '#ffffff',
        borderRadius: 5,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },
    sectionTableau: {
        marginTop: -400,
        padding: 15,
        backgroundColor: '#ffffff',
        borderRadius: 5,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: 'medium',
        marginBottom: 5,
        color: '#2d3748',
    },
    table: {
        display: 'flex',
        width: 'auto',
        borderStyle: 'solid',
        borderWidth: 1,
        borderRightWidth: 0,
        borderBottomWidth: 0,
        borderRadius: 5,
        overflow: 'hidden',
    },          
    tableRow: {
        margin: 'auto',
        flexDirection: 'row',
    },
    tableCol: {
        width: '25%',
        borderStyle: 'solid',
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
    },
    tableCell: {
        margin: 'auto',
        padding: 8,
        fontSize: 10,
    },
    tableHeader: {
        backgroundColor: '#2d3748',
        color: '#ffffff',
        fontWeight: 'bold',
    },
    chart: {
        marginTop: 0,
        marginBottom: 0,
        height: 200,
        width: '100%',
    },
    chartsContainer: {
        flexDirection: 'row',
        marginTop: 60,
        marginBottom: 20,
        height: 600,
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    barChartContainer: {
        width: '55%',
        height: '150%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    pieChartContainer: {
        width: '45%',
        height: '130%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginTop: -50,
    },
    chartTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#2d3748',
        marginBottom: 10,
        textAlign: 'center',
    },
    chartTitleFinanciel: {
        marginTop: 100,
        fontSize: 14,
        fontWeight: 'bold',
        color: '#2d3748',
        marginBottom: 10,
        textAlign: 'center',
    },
    newChartTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#2d3748',
        marginBottom: -60,
        textAlign: 'center',
    },
    statsContainer: {
        marginTop: 10,
        marginBottom: 0,
        padding: 15,
        backgroundColor: '#f8f9fa',
        borderRadius: 5,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statItem: {
        flex: 1,
        padding: 10,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2d3748',
        marginBottom: 5,
    },
    statLabel: {
        fontSize: 12,
        color: '#4a5568',
        textAlign: 'center',
    },
});

interface PDFDocumentProps {
    data: {
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
        stats: {
            totalQuantity: number;
            sortingRate: number;
            materialValorizationRate: number;
            globalValorizationRate: number;
        };
        chartImage: string;
        treatmentChartImage: string;
        pieChartImage: string;
        financialChartImage: string;
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
    };
}

export function PDFDocument({ data }: PDFDocumentProps) {
    const formatDate = (date: Date | string) => {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        return dateObj.toLocaleDateString('fr-FR');
    };

    // Fonction de formatage personnalisée pour les nombres
    const formatNumber = (num: number) => {
        return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    };

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Site : {data.header.siteName}</Text>
                    <Text style={styles.subtitle}>
                        Période : du {formatDate(data.header.firstDate)} au {formatDate(data.header.lastDate)}
                    </Text>
                    {data.header.siteAddress && (
                        <Text style={styles.subtitle}>Adresse : {data.header.siteAddress}</Text>
                    )}
                    <Text style={styles.subtitle}>Entreprise : {data.header.entrepriseName}</Text>
                    {Array.isArray(data.header.selectedSites) && data.header.selectedSites.length > 1 && (
                        <View style={{ marginTop: 10 }}>
                            <Text style={[styles.subtitle, { fontWeight: 'bold' }]}>Sites inclus dans le rapport :</Text>
                            {data.header.selectedSites.map((site, index) => (
                                <Text key={index} style={[styles.subtitle, { marginLeft: 10 }]}>
                                    • {site}
                                </Text>
                            ))}
                        </View>
                    )}
                </View>

                {/* Stats Block */}
                <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{data.stats.totalQuantity.toFixed(1)} T</Text>
                        <Text style={styles.statLabel}>Tonnage total</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{data.stats.sortingRate.toFixed(1)}%</Text>
                        <Text style={styles.statLabel}>Taux de tri</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{data.stats.materialValorizationRate.toFixed(1)}%</Text>
                        <Text style={styles.statLabel}>Valorisation matière</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{data.stats.globalValorizationRate.toFixed(1)}%</Text>
                        <Text style={styles.statLabel}>Valorisation globale</Text>
                    </View>
                </View>
                
                {/* Chart */}
                <View style={styles.section}>
                    <Text style={styles.chartTitle}>Répartition des tonnages par filières</Text>
                    <Image source={data.chartImage} style={styles.chart} />
                </View>   

                {/* Horizontal & Pie charts */}
                <View style={styles.section}>
                    <View style={styles.chartsContainer}>
                        <View style={styles.barChartContainer}>
                            <Text style={styles.newChartTitle}>Répartition par méthode de traitement</Text>
                            <Image source={data.treatmentChartImage} style={[styles.chart, { height: '90%', width: '100%', objectFit: 'contain' }]} />
                        </View>
                        <View style={styles.pieChartContainer}>
                            <div style={{ marginTop: 8 }}></div>
                            <Text style={styles.newChartTitle}>Répartition par filière</Text>
                            <Image source={data.pieChartImage} style={[styles.chart, { height: '105%', width: '100%', objectFit: 'contain' }]} />
                        </View>
                    </View>
                </View>

                {/* Filières Stats */}
                <View style={styles.sectionTableau}>
                    <Text style={styles.chartTitle}>Tableau récapitulatif des filières</Text>
                    <View style={styles.table}>
                        <View style={[styles.tableRow, styles.tableHeader]}>
                            <View style={[styles.tableCol, { width: '22%' }]}>
                                <Text style={[styles.tableCell, { color: '#ffffff' }]}>Filière</Text>
                            </View>
                            <View style={[styles.tableCol, { width: '19%' }]}>
                                <Text style={[styles.tableCell, { color: '#ffffff' }]}>Quantité (t)</Text>
                            </View>
                            <View style={[styles.tableCol, { width: '20%' }]}>
                                <Text style={[styles.tableCell, { color: '#ffffff' }]}>Val. Matière (%)</Text>
                            </View>
                            <View style={[styles.tableCol, { width: '20%' }]}>
                                <Text style={[styles.tableCell, { color: '#ffffff' }]}>Val. Globale (%)</Text>
                            </View>
                            <View style={[styles.tableCol, { width: '19%' }]}>
                                <Text style={[styles.tableCell, { color: '#ffffff' }]}>Nb Collectes</Text>
                            </View>
                        </View>
                        {data.filiereStats.reverse().map((stat, index) => (
                            <View key={index} style={styles.tableRow}>
                                <View style={[styles.tableCol, { width: '22%' }]}>
                                    <Text style={styles.tableCell}>{stat.filiereName}</Text>
                                </View>
                                <View style={[styles.tableCol, { width: '19%' }]}>
                                    <Text style={styles.tableCell}>{stat.quantity.toFixed(2)}</Text>
                                </View>
                                <View style={[styles.tableCol, { width: '20%' }]}>
                                    <Text style={styles.tableCell}>{stat.materialValorizationRate.toFixed(1)}</Text>
                                </View>
                                <View style={[styles.tableCol, { width: '20%' }]}>
                                    <Text style={styles.tableCell}>{stat.globalValorizationRate.toFixed(1)}</Text>
                                </View>
                                <View style={[styles.tableCol, { width: '19%' }]}>
                                    <Text style={styles.tableCell}>{stat.numberOfCollections}</Text>
                                </View>
                            </View>
                        ))}
                        {/* Ligne de total */}
                        <View style={[styles.tableRow, { backgroundColor: '#f8f9fa' }]}>
                            <View style={[styles.tableCol, { width: '22%' }]}>
                                <Text style={[styles.tableCell, { fontWeight: 'bold' }]}>TOTAL</Text>
                            </View>
                            <View style={[styles.tableCol, { width: '19%' }]}>
                                <Text style={[styles.tableCell, { fontWeight: 'bold' }]}>
                                    {data.filiereStats.reduce((sum, stat) => sum + stat.quantity, 0).toFixed(2)}
                                </Text>
                            </View>
                            <View style={[styles.tableCol, { width: '20%' }]}>
                                <Text style={[styles.tableCell, { fontWeight: 'bold' }]}>
                                    {data.stats.materialValorizationRate.toFixed(1)}
                                </Text>
                            </View>
                            <View style={[styles.tableCol, { width: '20%' }]}>
                                <Text style={[styles.tableCell, { fontWeight: 'bold' }]}>
                                    {data.stats.globalValorizationRate.toFixed(1)}
                                </Text>
                            </View>
                            <View style={[styles.tableCol, { width: '19%' }]}>
                                <Text style={[styles.tableCell, { fontWeight: 'bold' }]}>
                                    {data.filiereStats.reduce((sum, stat) => sum + stat.numberOfCollections, 0)}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Section Financière */}
                {Object.keys(data.financialData).length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.chartTitleFinanciel}>Détails financiers par filière</Text>
                        <View style={styles.table}>
                            {(() => {
                                // Calculer les colonnes actives
                                const activeColumns = [
                                    { key: 'preparation', label: 'Préparation', condition: Object.values(data.financialData).some(f => f.preparation > 0) },
                                    { key: 'transport', label: 'Transport', condition: Object.values(data.financialData).some(f => f.transport > 0) },
                                    { key: 'traitement', label: 'Traitement', condition: Object.values(data.financialData).some(f => f.traitement > 0) },
                                    { key: 'gestion_globale', label: 'Gestion Globale', condition: Object.values(data.financialData).some(f => f.gestion_globale > 0) },
                                    { key: 'tgap', label: 'TGAP', condition: Object.values(data.financialData).some(f => f.tgap > 0) },
                                    { key: 'declassement', label: 'Déclassement', condition: Object.values(data.financialData).some(f => f.declassement > 0) },
                                    { key: 'penalites', label: 'Pénalités', condition: Object.values(data.financialData).some(f => f.penalites > 0) },
                                    { key: 'rachat', label: 'Rachat', condition: Object.values(data.financialData).some(f => f.rachat > 0) },
                                    { key: 'location', label: 'Location', condition: Object.values(data.financialData).some(f => f.location > 0) },
                                    { key: 'maintenance', label: 'Maintenance', condition: Object.values(data.financialData).some(f => f.maintenance > 0) },
                                    { key: 'mise_a_disposition', label: 'Mise à disposition', condition: Object.values(data.financialData).some(f => f.mise_a_disposition > 0) },
                                    { key: 'autres_contenant', label: 'Autres Contenant', condition: Object.values(data.financialData).some(f => f.autres_contenant > 0) },
                                    { key: 'autres', label: 'Autres', condition: Object.values(data.financialData).some(f => f.non_expliques > 0 || f.autres > 0) }
                                ].filter(col => col.condition);

                                const totalColumns = activeColumns.length + 2; // +2 pour Filière et Total
                                const filiereWidth = '20%';
                                const remainingWidth = 93; // 80% restant à répartir
                                const operationWidth = `${Math.floor(remainingWidth / totalColumns)}%`;
                                const totalWidth = `${remainingWidth - (Math.floor(remainingWidth / totalColumns) * (totalColumns - 1))}%`; // Le reste pour la dernière colonne

                                return (
                                    <>
                                        {/* En-tête du tableau */}
                                        <View style={[styles.tableRow, styles.tableHeader]}>
                                            <View style={[styles.tableCol, { width: filiereWidth }]}>
                                                <Text style={[styles.tableCell, { color: '#ffffff', fontSize: 8, textAlign: 'center' }]}>Filière</Text>
                                            </View>
                                            {activeColumns.map((col, index) => (
                                                <View key={index} style={[styles.tableCol, { width: operationWidth }]}>
                                                    <Text style={[styles.tableCell, { color: '#ffffff', fontSize: 8, textAlign: 'center' }]}>{col.label}</Text>
                                                </View>
                                            ))}
                                            <View style={[styles.tableCol, { width: totalWidth }]}>
                                                <Text style={[styles.tableCell, { color: '#ffffff', fontSize: 8, textAlign: 'center' }]}>Total</Text>
                                            </View>
                                        </View>

                                        {/* Lignes de données */}
                                        {Object.entries(data.financialData)
                                            .sort((a, b) => {
                                                if (a[0] === 'Autres') return 1;
                                                if (b[0] === 'Autres') return -1;
                                                return b[1].total - a[1].total;
                                            })
                                            .map(([filiere, filiereData], index) => (
                                                <View key={index} style={styles.tableRow}>
                                                    <View style={[styles.tableCol, { width: filiereWidth }]}>
                                                        <Text style={[styles.tableCell, { fontSize: 8, textAlign: 'center' }]}>{filiere}</Text>
                                                    </View>
                                                    {activeColumns.map((col, colIndex) => (
                                                        <View key={colIndex} style={[styles.tableCol, { width: operationWidth }]}>
                                                            <Text style={[styles.tableCell, { fontSize: 8, textAlign: 'center' }]}>
                                                                {col.key === 'autres' 
                                                                    ? `${formatNumber(filiereData.non_expliques + filiereData.autres)}€`
                                                                    : `${formatNumber(filiereData[col.key as keyof typeof filiereData])}€`
                                                                }
                                                            </Text>
                                                        </View>
                                                    ))}
                                                    <View style={[styles.tableCol, { width: totalWidth }]}>
                                                        <Text style={[
                                                            styles.tableCell, 
                                                            { 
                                                                fontSize: 8, 
                                                                textAlign: 'center',
                                                                fontWeight: filiereData.total >= 0 ? 'normal' : 'bold',
                                                                color: filiereData.total >= 0 ? '#000000' : '#16a34a'
                                                            }
                                                        ]}>
                                                            {formatNumber(filiereData.total)}€
                                                        </Text>
                                                    </View>
                                                </View>
                                            ))}

                                        {/* Ligne de total */}
                                        <View style={[styles.tableRow, { backgroundColor: '#f8f9fa' }]}>
                                            <View style={[styles.tableCol, { width: filiereWidth }]}>
                                                <Text style={[styles.tableCell, { fontWeight: 'bold', fontSize: 8, textAlign: 'center' }]}>TOTAL</Text>
                                            </View>
                                            {activeColumns.map((col, colIndex) => (
                                                <View key={colIndex} style={[styles.tableCol, { width: operationWidth }]}>
                                                    <Text style={[styles.tableCell, { fontWeight: 'bold', fontSize: 8, textAlign: 'center' }]}>
                                                        {col.key === 'autres' 
                                                            ? `${formatNumber(Object.values(data.financialData).reduce((sum, f) => sum + f.non_expliques + f.autres, 0))}€`
                                                            : `${formatNumber(Object.values(data.financialData).reduce((sum, f) => sum + f[col.key as keyof typeof f], 0))}€`
                                                        }
                                                    </Text>
                                                </View>
                                            ))}
                                            <View style={[styles.tableCol, { width: totalWidth }]}>
                                                <Text style={[
                                                    styles.tableCell, 
                                                    { 
                                                        fontWeight: 'bold', 
                                                        fontSize: 8, 
                                                        textAlign: 'center',
                                                        color: Object.values(data.financialData).reduce((sum, f) => sum + f.total, 0) >= 0 ? '#000000' : '#16a34a'
                                                    }
                                                ]}>
                                                    {formatNumber(Object.values(data.financialData).reduce((sum, f) => sum + f.total, 0))}€
                                                </Text>
                                            </View>
                                        </View>
                                    </>
                                );
                            })()}
                        </View>
                    </View>
                )}

                {/* Graphique Financier */}
                {data.financialChartImage && Object.keys(data.financialData).length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.chartTitle}>Évolution des coûts et revenus mensuels par filière</Text>
                        <Image source={data.financialChartImage} style={styles.chart} />
                    </View>
                )}

                {/* Transporteurs */}
                {/* Temporairement masqué
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Transporteurs</Text>
                    <View style={styles.table}>
                        <View style={[styles.tableRow, styles.tableHeader]}>
                            <View style={[styles.tableCol, { width: '60%' }]}>
                                <Text style={[styles.tableCell, { color: '#ffffff' }]}>Nom</Text>
                            </View>
                            <View style={[styles.tableCol, { width: '40%' }]}>
                                <Text style={[styles.tableCell, { color: '#ffffff' }]}>% Tonnage</Text>
                            </View>
                        </View>
                        {data.transporteurs.map((transporteur, index) => (
                            <View key={index} style={styles.tableRow}>
                                <View style={[styles.tableCol, { width: '60%' }]}>
                                    <Text style={styles.tableCell}>{transporteur.name}</Text>
                                </View>
                                <View style={[styles.tableCol, { width: '40%' }]}>
                                    <Text style={styles.tableCell}>{transporteur.percentage.toFixed(1)}%</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
                */}

                {/* Destinataires */}
                {/* Temporairement masqué
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Destinataires</Text>
                    <View style={styles.table}>
                        <View style={[styles.tableRow, styles.tableHeader]}>
                            <View style={[styles.tableCol, { width: '60%' }]}>
                                <Text style={[styles.tableCell, { color: '#ffffff' }]}>Nom</Text>
                            </View>
                            <View style={[styles.tableCol, { width: '40%' }]}>
                                <Text style={[styles.tableCell, { color: '#ffffff' }]}>% Tonnage</Text>
                            </View>
                        </View>
                        {data.destinataires.map((destinataire, index) => (
                            <View key={index} style={styles.tableRow}>
                                <View style={[styles.tableCol, { width: '60%' }]}>
                                    <Text style={styles.tableCell}>{destinataire.name}</Text>
                                </View>
                                <View style={[styles.tableCol, { width: '40%' }]}>
                                    <Text style={styles.tableCell}>{destinataire.percentage.toFixed(1)}%</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
                */}
            </Page>
        </Document>
    );
} 