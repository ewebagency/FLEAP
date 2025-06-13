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
    };
}

export function PDFDocument({ data }: PDFDocumentProps) {
    const formatDate = (date: Date | string) => {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        return dateObj.toLocaleDateString('fr-FR');
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