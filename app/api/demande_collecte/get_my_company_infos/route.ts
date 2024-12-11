import { NextResponse } from 'next/server';
import axios from 'axios';
import { cookies } from 'next/headers';

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
    let url_track = process.env.TRACKDECHETS_URL_SANDBOX;
    let token_track = cookies().get('trackdechets_token')?.value;
    if(process.env.NEXT_PUBLIC_TRACK_TYPE === 'app'){
        url_track = process.env.TRACKDECHETS_URL_APP;
    }
    console.log("Token sandbox depuis les cookies", token_track);


    if (!url_track || !token_track) {
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
            url_track,
            { query },
            {
                headers: {
                    Authorization: `Bearer ${token_track}`,
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