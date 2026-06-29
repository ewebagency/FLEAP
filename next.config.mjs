/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        domains: [process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '')]
    },
    async rewrites() {
      return [
        {
          source: '/api/auth_track_dechets',
          destination: 'https://app.trackdechets.beta.gouv.fr/oauth2/authorize/dialog?response_type=code&redirect_uri=:redirect_uri&client_id=:client_id', // Point to the server-side API route
        },
      ];
    },
};

export default nextConfig;
