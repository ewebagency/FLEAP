"use client"

import { useState } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { useRouter } from 'next/navigation';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); // État de chargement
  const router = useRouter();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); // Démarrer le chargement
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false); // Arrêter le chargement

    if (error) {
      alert(error.message);
    } else {
      console.log('Sign in successful, redirecting...');
      router.push('/analysis');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <form onSubmit={handleSignIn} className="bg-white p-6 rounded shadow-md w-96">
        <h2 className="text-2xl font-bold mb-4">Sign In</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border border-gray-300 p-2 mb-4 w-full rounded"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-gray-300 p-2 mb-4 w-full rounded"
          required
        />
        <button 
          type="submit" 
          className={`bg-blue-500 text-white p-2 rounded w-full ${loading ? 'opacity-50 cursor-not-allowed' : ''}`} 
          disabled={loading} // Désactiver le bouton pendant le chargement
        >
          {loading ? 'Chargement...' : 'Se connecter'}
        </button>
        {loading && <div className="mt-2 text-center text-gray-500">Veuillez patienter...</div>} {/* Loader message */}
      </form>
    </div>
  );
}
