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
        marginBottom: 20,
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
        margin: 10,
        padding: 15,
        backgroundColor: '#ffffff',
        borderRadius: 5,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
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
        marginTop: 20,
        marginBottom: 20,
        height: 200,
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
    };
    chartImage: string;
}

export function PDFDocument({ data, chartImage }: PDFDocumentProps) {
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
                </View>

                {/* Chart */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Évolution des tonnages par filière</Text>
                    <Image src={chartImage} style={styles.chart} />
                </View>

                {/* Filières Stats */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Tableau récapitulatif des filières</Text>
                    <View style={styles.table}>
                        <View style={[styles.tableRow, styles.tableHeader]}>
                            <View style={styles.tableCol}>
                                <Text style={[styles.tableCell, { color: '#ffffff' }]}>Filière</Text>
                            </View>
                            <View style={styles.tableCol}>
                                <Text style={[styles.tableCell, { color: '#ffffff' }]}>Quantité (t)</Text>
                            </View>
                            <View style={styles.tableCol}>
                                <Text style={[styles.tableCell, { color: '#ffffff' }]}>Val. Matière (%)</Text>
                            </View>
                            <View style={styles.tableCol}>
                                <Text style={[styles.tableCell, { color: '#ffffff' }]}>Val. Globale (%)</Text>
                            </View>
                        </View>
                        {data.filiereStats.map((stat, index) => (
                            <View key={index} style={styles.tableRow}>
                                <View style={styles.tableCol}>
                                    <Text style={styles.tableCell}>{stat.filiereName}</Text>
                                </View>
                                <View style={styles.tableCol}>
                                    <Text style={styles.tableCell}>{stat.quantity.toFixed(2)}</Text>
                                </View>
                                <View style={styles.tableCol}>
                                    <Text style={styles.tableCell}>{stat.materialValorizationRate.toFixed(1)}</Text>
                                </View>
                                <View style={styles.tableCol}>
                                    <Text style={styles.tableCell}>{stat.globalValorizationRate.toFixed(1)}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Transporteurs */}
                {data.transporteurs.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Transporteurs</Text>
                        <View style={styles.table}>
                            <View style={[styles.tableRow, styles.tableHeader]}>
                                <View style={styles.tableCol}>
                                    <Text style={[styles.tableCell, { color: '#ffffff' }]}>Nom</Text>
                                </View>
                                <View style={styles.tableCol}>
                                    <Text style={[styles.tableCell, { color: '#ffffff' }]}>SIRET</Text>
                                </View>
                                <View style={styles.tableCol}>
                                    <Text style={[styles.tableCell, { color: '#ffffff' }]}>Adresse</Text>
                                </View>
                            </View>
                            {data.transporteurs.map((transporteur, index) => (
                                <View key={index} style={styles.tableRow}>
                                    <View style={styles.tableCol}>
                                        <Text style={styles.tableCell}>{transporteur.name}</Text>
                                    </View>
                                    <View style={styles.tableCol}>
                                        <Text style={styles.tableCell}>{transporteur.siret}</Text>
                                    </View>
                                    <View style={styles.tableCol}>
                                        <Text style={styles.tableCell}>{transporteur.address || '-'}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Destinataires */}
                {data.destinataires.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Destinataires</Text>
                        <View style={styles.table}>
                            <View style={[styles.tableRow, styles.tableHeader]}>
                                <View style={styles.tableCol}>
                                    <Text style={[styles.tableCell, { color: '#ffffff' }]}>Nom</Text>
                                </View>
                                <View style={styles.tableCol}>
                                    <Text style={[styles.tableCell, { color: '#ffffff' }]}>SIRET</Text>
                                </View>
                                <View style={styles.tableCol}>
                                    <Text style={[styles.tableCell, { color: '#ffffff' }]}>Adresse</Text>
                                </View>
                            </View>
                            {data.destinataires.map((destinataire, index) => (
                                <View key={index} style={styles.tableRow}>
                                    <View style={styles.tableCol}>
                                        <Text style={styles.tableCell}>{destinataire.name}</Text>
                                    </View>
                                    <View style={styles.tableCol}>
                                        <Text style={styles.tableCell}>{destinataire.siret}</Text>
                                    </View>
                                    <View style={styles.tableCol}>
                                        <Text style={styles.tableCell}>{destinataire.address || '-'}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Registre des déchets */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Registre des déchets</Text>
                    <View style={styles.table}>
                        <View style={[styles.tableRow, styles.tableHeader]}>
                            <View style={[styles.tableCol, { width: '30%' }]}>
                                <Text style={[styles.tableCell, { color: '#ffffff' }]}>Déchet</Text>
                            </View>
                            <View style={[styles.tableCol, { width: '15%' }]}>
                                <Text style={[styles.tableCell, { color: '#ffffff' }]}>Code</Text>
                            </View>
                            <View style={[styles.tableCol, { width: '15%' }]}>
                                <Text style={[styles.tableCell, { color: '#ffffff' }]}>Tonnage</Text>
                            </View>
                            <View style={[styles.tableCol, { width: '20%' }]}>
                                <Text style={[styles.tableCell, { color: '#ffffff' }]}>Date</Text>
                            </View>
                            <View style={[styles.tableCol, { width: '20%' }]}>
                                <Text style={[styles.tableCell, { color: '#ffffff' }]}>Code Traitement</Text>
                            </View>
                        </View>
                        {data.registre.map((entry, index) => (
                            <View key={index} style={styles.tableRow}>
                                <View style={[styles.tableCol, { width: '30%' }]}>
                                    <Text style={styles.tableCell}>{entry.wasteName}</Text>
                                </View>
                                <View style={[styles.tableCol, { width: '15%' }]}>
                                    <Text style={styles.tableCell}>{entry.wasteCode}</Text>
                                </View>
                                <View style={[styles.tableCol, { width: '15%' }]}>
                                    <Text style={styles.tableCell}>{entry.quantity.toFixed(2)} T</Text>
                                </View>
                                <View style={[styles.tableCol, { width: '20%' }]}>
                                    <Text style={styles.tableCell}>{new Date(entry.date).toLocaleDateString('fr-FR')}</Text>
                                </View>
                                <View style={[styles.tableCol, { width: '20%' }]}>
                                    <Text style={styles.tableCell}>{entry.processingCode}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            </Page>
        </Document>
    );
} 