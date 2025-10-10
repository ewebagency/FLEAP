'use client';

import { useState, useEffect } from "react";

interface TokenResponse {
  data: string | null;
}

const ConnectedToTrack = () => {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const res = await fetch('/api/auth_track_dechet/token');
        const result: TokenResponse = await res.json();
        setToken(result.data);
      } catch (error) {
        console.error("Erreur lors de la récupération du token:", error);
      }
    };
    fetchToken();
  }, []);

  //if (!token) return null;

  return (
    <div>
      {token ?
        <div className="inline-block text-xs text-white py-1 px-2 rounded-md bg-[var(--green-medium)]">
          Connecté à TrackDéchets
        </div>
        :
        <div className="inline-block text-xs text-white py-1 px-2 rounded-md bg-gray-400 hidden">
          Non connecté à TrackDéchets
        </div>
      }
    </div>
  );
};

export default ConnectedToTrack;
