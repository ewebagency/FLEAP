import { redirect } from "next/navigation";

export default function Login() {
  async function handleLogin() {
    "use server";
    const clientId = process.env.NEXT_PUBLIC_TRACKDECHETS_CLIENT_ID;
    const redirectUri = encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`);
    const authUrl = `https://app.trackdechets.beta.gouv.fr/oauth2/authorize/dialog?response_type=code&redirect_uri=${redirectUri}&client_id=${clientId}`;

    redirect(authUrl);
  }

  return (
    <form action={handleLogin}>
      <button type="submit">Se connecter avec Trackdéchets</button>
    </form>
  );
}
