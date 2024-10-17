import { cookies } from "next/headers";

interface APIOptions extends RequestInit {
  headers?: Record<string, string>;
}

export async function fetchTrackdechetsAPI(endpoint: string, options: APIOptions = {}): Promise<any> {
  const trackdechets_token = cookies().get("trackdechets_token")?.value;

  const response = await fetch(`https://api.trackdechets.beta.gouv.fr${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${trackdechets_token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Erreur API Trackdéchets");
  }

  return response.json();
}
