import { NextResponse } from 'next/server';
import axios from 'axios';

interface CompanyResponse {
    data: {
        myCompanies: {
            edges: Array<{
                node: {
                    orgId: string;
                    siret: string;
                    vatNumber: string;
                    address: string;
                    name: string;
                    givenName: string;
                    naf: string;
                    libelleNaf: string;
                    installation: {
                        codeS3ic: string;
                        urlFiche: string;
                    };
                    contact: string;
                    contactEmail: string;
                    contactPhone: string;
                    website: string;
                    companyTypes: string[];
                    collectorTypes: string[];
                    wasteProcessorTypes: string[];
                    wasteVehiclesTypes: string[];
                    ecoOrganismeAgreements: string[];
                    allowBsdasriTakeOverWithoutSignature: boolean;
                    transporterReceipt: {
                        id: string;
                    };
                    traderReceipt: {
                        id: string;
                    };
                    brokerReceipt: {
                        id: string;
                    };
                    vhuAgrementDemolisseur: {
                        id: string;
                    };
                    vhuAgrementBroyeur: {
                        id: string;
                    };
                    workerCertification: {
                        id: string;
                    };
                }
            }>
        }
    }
}

export async function POST() {
    const url_sandbox = process.env.TRACKDECHETS_URL_SANDBOX;
    const token_sandbox = process.env.TRACKDECHETS_TOKEN_SANDBOX;

    if (!url_sandbox || !token_sandbox) {
        return NextResponse.json({ error: 'Environment variables are not defined' }, { status: 500 });
    }

    const query = `
        query {
            myCompanies {
                edges {
                    node {
                        orgId
                        siret
                        vatNumber
                        address
                        name
                        givenName
                        naf
                        libelleNaf
                        installation {
                            codeS3ic
                            urlFiche
                        }
                        contact
                        contactEmail
                        contactPhone
                        website
                        companyTypes
                        collectorTypes
                        wasteProcessorTypes
                        wasteVehiclesTypes
                        ecoOrganismeAgreements
                        allowBsdasriTakeOverWithoutSignature
                        transporterReceipt {
                            id
                        }
                        traderReceipt {
                            id
                        }
                        brokerReceipt {
                            id
                        }
                        vhuAgrementDemolisseur {
                            id
                        }
                        vhuAgrementBroyeur {
                            id
                        }
                        workerCertification {
                            id
                        }
                    }
                }
            }
        }
    `;

    try {
        const response = await axios.post<CompanyResponse>(
            url_sandbox,
            { query },
            {
                headers: {
                    Authorization: `Bearer ${token_sandbox}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.status === 200 && response.data?.data?.myCompanies?.edges?.[0]?.node) {
            return NextResponse.json(response.data.data.myCompanies.edges[0].node);
        } else {
            return NextResponse.json({ error: 'Error fetching data' }, { status: response.status });
        }
    } catch (error) {
        return NextResponse.json({ error: 'Error during GraphQL request' }, { status: 500 });
    }
}