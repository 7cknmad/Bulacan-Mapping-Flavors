import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

// Lightweight top progress bar. Starts when location changes and completes after a short delay.
export default function NavigationProgress() {
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // when the location changes, show the bar
    setVisible(true);
    setProgress(6);
    const t1 = setTimeout(() => setProgress(28), 120);
    const t2 = setTimeout(() => setProgress(58), 360);
    const t3 = setTimeout(() => setProgress(82), 700);

    // complete shortly after navigation type changes
    const done = setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 260);
    }, 950);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(done);
    };
  }, [location.key]);

  if (!visible) return null;

  return (
    <div aria-hidden className="fixed top-0 left-0 right-0 z-50 h-0.5 pointer-events-none">
      <div
        className="h-0.5 bg-gradient-to-r from-indigo-400 via-pink-400 to-yellow-300 shadow-lg"
        style={{ width: `${progress}%`, transition: 'width 220ms cubic-bezier(.22,1,.36,1)' }}
      />
    </div>
  );
}
