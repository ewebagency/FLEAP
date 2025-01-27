"use client"
import { useState } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      router.push('/auth/merci');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <h1 className="text-3xl md:text-4xl font-bold text-green-800">FLEAP</h1>
      <div className="mt-10 bg-green-800 rounded-lg shadow-lg p-4 md:p-6 w-full max-w-md md:px-12">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-6">Inscription</h2>
        <form onSubmit={handleSignUp}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-gray-300 p-2 md:p-3 mb-4 w-full rounded"
            required
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-gray-300 p-2 md:p-3 mb-6 w-full rounded"
            required
          />
          <button 
            type="submit" 
            className={`w-full p-2 md:p-3 rounded bg-green-600 hover:bg-green-500 text-white text-base md:text-lg border-white hover:border-white
              ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={loading}
          >
            {loading ? 'Chargement...' : 'S\'inscrire'}
          </button>
        </form>
        <div className="mt-6 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
          <div className="text-sm text-gray-200">Déjà un compte ?</div>
          <Link 
            href="/auth/signin" 
            className="btn btn-primary text-xs bg-green-600 hover:bg-green-500 text-white border-white hover:border-white px-4 py-2"
          >
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
}
