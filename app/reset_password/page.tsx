'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../database/supabaseClient';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const accessToken = useMemo(() => searchParams?.get('access_token') ?? '', [searchParams]);
  const refreshToken = useMemo(() => searchParams?.get('refresh_token') ?? '', [searchParams]);
  const type = useMemo(() => searchParams?.get('type') ?? '', [searchParams]);

  const [isSettingSession, setIsSettingSession] = useState<boolean>(true);
  const [password, setPassword] = useState<string>('');
  const [passwordConfirm, setPasswordConfirm] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  // Rendez la page accessible même sans session: on tente de créer une session temporaire avec le token
  useEffect(() => {
    let isMounted = true;

    const ensureSessionFromUrl = async () => {
      try {
        // Fallback: si les tokens ne sont pas en query (cas accès direct via hash), tente de lire depuis le hash
        let aTok = accessToken;
        let rTok = refreshToken;
        if ((!aTok || !rTok) && typeof window !== 'undefined' && window.location.hash) {
          const params = new URLSearchParams(window.location.hash.slice(1));
          aTok = aTok || params.get('access_token') || '';
          rTok = rTok || params.get('refresh_token') || '';
        }

        // Si des tokens sont fournis (cas lien de récupération via email)
        if (aTok && rTok) {
          const { error } = await supabase.auth.setSession({
            access_token: aTok,
            refresh_token: rTok,
          });
          if (error && isMounted) {
            setMessageType('error');
            setMessage("Impossible d'initialiser la session avec le lien. Réessayez.");
          }
        }
        // Certains liens peuvent avoir seulement type=signup_reset_password (ou recovery)
        // Dans ce cas, si pas de session active, l'utilisateur devra cliquer à nouveau le lien valide qui inclut les tokens.
      } catch (_e) {
        if (isMounted) {
          setMessageType('error');
          setMessage("Une erreur s'est produite lors de l'initialisation du lien.");
        }
      } finally {
        if (isMounted) setIsSettingSession(false);
      }
    };

    ensureSessionFromUrl();
    return () => {
      isMounted = false;
    };
  }, [accessToken, refreshToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setMessageType('');

    if (!password || password.length < 4) {
      setMessageType('error');
      setMessage('Le mot de passe doit contenir au moins 4 caractères.');
      return;
    }
    if (password !== passwordConfirm) {
      setMessageType('error');
      setMessage('Les mots de passe ne correspondent pas.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Tentative de mise à jour du mot de passe via Supabase
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setMessageType('error');
        setMessage(`Échec de la mise à jour du mot de passe: ${error.message}`);
        return;
      }

      setMessageType('success');
      setMessage('Mot de passe mis à jour avec succès ! Redirection en cours...');
      // Redirige vers /login après un court délai
      setTimeout(() => {
        router.push('/login');
      }, 1200);
    } catch (_e) {
      setMessageType('error');
      setMessage("Une erreur inattendue est survenue. Réessayez plus tard.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-md p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">
          Réinitialiser votre mot de passe
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          {type === 'signup_reset_password'
            ? 'Définissez un nouveau mot de passe pour finaliser la réinitialisation.'
            : "Saisissez un nouveau mot de passe pour votre compte."}
        </p>

        {isSettingSession ? (
          <div className="w-full text-center text-gray-600">Initialisation du lien…</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Nouveau mot de passe
              </label>
              <input
                id="password"
                type="password"
                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={4}
                autoComplete="new-password"
                required
              />
            </div>

            <div>
              <label
                htmlFor="passwordConfirm"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Confirmer le mot de passe
              </label>
              <input
                id="passwordConfirm"
                type="password"
                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="********"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                minLength={4}
                autoComplete="new-password"
                required
              />
            </div>

            {message && (
              <div
                className={`text-sm rounded-md px-3 py-2 ${
                  messageType === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : messageType === 'error'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-gray-50 text-gray-700 border border-gray-200'
                }`}
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center rounded-md bg-blue-600 text-white px-4 py-2.5 font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            >
              {isSubmitting ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
            </button>
          </form>
        )}

        <div className="mt-6 text-xs text-gray-500">
          Cette page est accessible sans être connecté. Si le lien a expiré, relancez une
          réinitialisation depuis l’écran de connexion.
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen w-full flex items-center justify-center bg-gray-50 px-4">Initialisation…</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}