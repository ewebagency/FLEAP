import { NextResponse } from "next/server";
import { gql } from "@apollo/client";
import { cookies } from 'next/headers';
import { createApolloClient } from "../apollo-client";

export async function GET() {
    try {
        const token_track = cookies().get('trackdechets_token')?.value;
        if (!token_track) {
            return NextResponse.json(
                { success: false, error: 'No authentication token found' },
                { status: 401 }
            );
        }

        const client = createApolloClient(token_track);

        const [webhooksResponse, companiesResponse] = await Promise.all([
            client.query({
                query: gql`
                    query WebHookSettings{
                        webhooksettings {
                            totalCount
                            edges {
                                node {
                                    id
                                    endpointUri
                                    orgId
                                    activated
                                }
                            }
                        }
                    }
                `
            }),
            client.query({
                query: gql`
                    query myCompanies{
                        myCompanies {
                            edges {
                                node {
                                    id
                                    orgId
                                    name
                                    companyTypes
                                    contact
                                    givenName
                                    address
                                }
                            }
                        }
                    }
                `
            })
        ]);

        const etablissementsWithStatus = companiesResponse.data.myCompanies.edges.map((company: {node: {id: string, orgId: string, givenName: string, address: string}}) => {
            const webhook = webhooksResponse.data.webhooksettings.edges.find(
                (webhook: {node: {orgId: string, activated: boolean}}) => webhook.node.orgId === company.node.orgId
            );
            return {
                ...company.node,
                activated: webhook?.node.activated || false
            };
        });

        return NextResponse.json({success: true, data: etablissementsWithStatus});
    } catch (error) {
        console.error('Error fetching data:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch data' },
            { status: 500 }
        );
    }
}