"use client"

import { useState } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      router.push('/register');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <h1 className="text-4xl font-bold text-green-800">FLEAP</h1>
      <div className="mt-10 bg-green-800 rounded-lg shadow-lg p-6 px-24 w-[60%]">
        <h2 className="text-2xl font-bold text-white mb-6">Connexion</h2>
        <form onSubmit={handleSignIn}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-gray-300 p-3 mb-4 w-full rounded"
            required
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-gray-300 p-3 mb-6 w-full rounded"
            required
          />
          <button 
            type="submit" 
            className={`w-full p-3 rounded bg-green-600 hover:bg-green-500 text-white text-lg border-white hover:border-white
              ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={loading}
          >
            {loading ? 'Chargement...' : 'Se connecter'}
          </button>
        </form>
        {/*<div className="mt-6 flex justify-between items-center">
          <div className="text-sm text-gray-200">Vous n&apos;avez pas de compte ?</div>
          <Link 
            href="/auth/signup" 
            className="btn btn-primary text-xs bg-green-600 hover:bg-green-500 text-white border-white hover:border-white"
          >
            S&apos;inscrire
          </Link>
        </div>*/}
      </div>
    </div>
  );
}
