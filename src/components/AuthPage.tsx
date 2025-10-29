import { useEffect } from 'react';

export default function AuthPage() {
  useEffect(() => {
    // Redirect any direct visits to /auth to the homepage Join Us section
    try { window.location.href = '/#join-us'; }
    catch { window.location.hash = '#join-us'; }
  }, []);
  return null;
}
