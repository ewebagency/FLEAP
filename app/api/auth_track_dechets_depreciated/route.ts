import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    const { redirect_uri, client_id } = req.query;

    if (!redirect_uri || !client_id) {
        return res.status(400).json({ error: 'Missing required query parameters' });
    }

    
    const url = `https://app.trackdechets.beta.gouv.fr/oauth2/authorize/dialog?response_type=code&redirect_uri=${redirect_uri}&client_id=${client_id}`;
    console.log('url fin', url);
    res.redirect(url);
}
