import { ApolloClient, InMemoryCache } from "@apollo/client";

export const createApolloClient = (token: string) => {
    let url_track = process.env.TRACKDECHETS_URL_SANDBOX;
    if(process.env.NEXT_PUBLIC_TRACK_TYPE === 'app'){
        url_track = process.env.TRACKDECHETS_URL_APP;
    }

    return new ApolloClient({
        uri: url_track,
        headers: {
            Authorization: `Bearer ${token}`,
        },
        cache: new InMemoryCache()
    });
}; 