// src/pages/HomePage.tsx
 
import { useEffect, useState } from "react";
import useRevealOnScroll from "../hooks/useRevealOnScroll";
import LoginForm from "../components/LoginForm";
import RegisterForm from "../components/RegisterForm";

export default function HomePage() {
  // Keep homepage focused: brief intro + primary CTA to the interactive map
  useRevealOnScroll();

  // Ensure header nav is hidden while the intro runs, and restore when leaving
  useEffect(() => {
    // hide nav while on the homepage intro
    window.dispatchEvent(new CustomEvent('nav:visible', { detail: { visible: false } }));
    return () => {
      // ensure nav is visible again when leaving the homepage
      window.dispatchEvent(new CustomEvent('nav:visible', { detail: { visible: true } }));
    };
  }, []);

  // Emit nav visibility when the last slide is reached
  useEffect(() => {
  // find the last slide dynamically and make nav persist once reached
  const slides = document.querySelectorAll('#intro-slides .snap-start');
    if (!slides || slides.length === 0) return;
    const last = slides[slides.length - 1];
    const obs = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // show nav and stop observing so nav stays visible even if user scrolls up
          window.dispatchEvent(new CustomEvent('nav:visible', { detail: { visible: true } }));
          observer.disconnect();
        }
      });
    }, { threshold: 0.6 });
    obs.observe(last);
    return () => obs.disconnect();
  }, []);

  // no internal carousel; browser handles natural vertical scrolling

  // Toggle bottom CTA visibility when nav becomes visible
  useEffect(() => {
    const el = document.getElementById('bottom-ctas');
    if (!el) return;
    const onNav = (e: Event) => {
      const detail = (e as CustomEvent<{ visible: boolean }>).detail;
      if (detail && detail.visible) {
        el.classList.remove('opacity-0', 'translate-y-6', 'pointer-events-none');
        el.classList.add('opacity-100');
      }
    };
    window.addEventListener('nav:visible', onNav as EventListener);
    return () => window.removeEventListener('nav:visible', onNav as EventListener);
  }, []);

  // Enhanced scroll to Join Us with better animation and focus handling
  const scrollToJoin = () => {
    const el = document.getElementById('join-us');
    if (!el) return;
    
    // Start a subtle animation on the auth panel before scrolling
    const authPanel = el.querySelector('.bg-white/95');
    if (authPanel instanceof HTMLElement) {
      authPanel.style.transform = 'perspective(1000px) rotateX(5deg)';
    }

    // Smooth scroll to the section
    el.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center'
    });

    // After scrolling completes, focus input and reset auth panel
    window.setTimeout(() => {
      // Reset and animate the auth panel
      if (authPanel instanceof HTMLElement) {
        authPanel.style.transform = 'perspective(1000px) rotateX(0deg)';
      }

      // Focus the first input for keyboard users
      try {
        const first = document.querySelector('#join-us input[type="email"], #join-us input') as HTMLElement | null;
        if (first) {
          first.focus();
          // Add a subtle highlight animation to the focused input
          first.classList.add('focus-highlight');
          setTimeout(() => first.classList.remove('focus-highlight'), 1000);
        }
      } catch (err) {
        console.error('Error focusing input:', err);
      }
    }, 800);
  };

  // Reveal sections when scrolled into view
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('.bm-content')) as HTMLElement[];
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const el = en.target as HTMLElement;
        if (en.isIntersecting) el.classList.add('in-view');
        else el.classList.remove('in-view');
      });
    }, { threshold: 0.18 });
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
  }, []);

  // Parallax for background images
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const bgs = Array.from(document.querySelectorAll('.bm-bg')) as HTMLElement[];
        const scTop = window.scrollY;
        bgs.forEach((bg) => {
          const rect = bg.parentElement?.getBoundingClientRect();
          if (!rect) return;
          const speed = 0.12; // parallax factor
          const y = (rect.top + scTop) * speed;
          bg.style.transform = `translateY(${y * 0.06}px)`;
        });
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);

  // Keyboard navigation: ArrowRight or Space to move to next section
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.code === 'Space') {
        // avoid typing into inputs
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable)) return;
        e.preventDefault();
        // find sections and current index (closest to top)
        const sections = Array.from(document.querySelectorAll('.bm-section')) as HTMLElement[];
        if (!sections.length) return;
        const viewportTop = window.innerHeight * 0.12; // small offset
        let bestIdx = 0; let bestScore = Infinity;
        sections.forEach((s, i) => {
          const r = s.getBoundingClientRect();
          const score = Math.abs(r.top - viewportTop);
          if (score < bestScore) { bestScore = score; bestIdx = i; }
        });
        if (bestIdx < sections.length - 1) sections[bestIdx + 1].scrollIntoView({ behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // No modal focus handling needed — login/register are embedded below

  return (
    <div className="w-full">
      <a href="#intro-slides" className="skip-link">Skip to content</a>
      <main id="intro-slides" className="snap-y snap-mandatory scroll-smooth">
  {/* Hero */}
        <section className="bm-section snap-start">
          <div className="bm-bg" style={{ backgroundImage: `url('/images/home/barasoain-1.jpg')` }} aria-hidden />
          <div className="bm-overlay bg-black/40" aria-hidden />
          <div className="bm-content text-center relative">
            <h1 className="bm-hero-title text-4xl md:text-7xl font-bold mb-6 text-white tracking-tight">
              Taste Bulacan's Legacy
            </h1>
            <p className="text-white/90 text-lg md:text-xl max-w-2xl mx-auto mb-8 leading-relaxed font-light" style={{ fontFamily: 'var(--bm-sans)' }}>
              Explore centuries-old recipes, market traditions, and the people who keep Bulacan's flavors alive.
            </p>
            <div className="flex justify-center gap-4">
              <a href="/map" className="bm-hero-cta btn btn-primary px-8 py-4 text-lg font-medium rounded-full hover:scale-105 transition-transform">
                Explore Our Flavors
              </a>
              <button onClick={scrollToJoin} className="btn bg-white/20 backdrop-blur text-white border-2 border-white/30 px-8 py-4 text-lg font-medium rounded-full hover:bg-white/30 transition-all">
                Login
              </button>
            </div>
          </div>
          <NextButton />
        </section>

        {/* Highlights */}
        <section className="bm-section snap-start bg-white">
          <div className="bm-bg" style={{ backgroundImage: `url('/images/home/fiesta-1.jpg')`, filter: 'blur(8px) brightness(0.9)' }} aria-hidden />
          <div className="bm-overlay" aria-hidden />
          <div className="bm-content bm-content-dark">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-neutral-800 tracking-tight">Culinary Highlights</h2>
            <p className="text-neutral-600 text-lg md:text-xl mb-8 max-w-3xl mx-auto leading-relaxed" style={{ fontFamily: 'var(--bm-sans)' }}>
              A taste of what makes Bulacan special — a few signature dishes and treats.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[{
                title: 'Pandesal de Baliuag', img: '/images/dishes/pandesal-de-baliuag.jpg'
              },{
                title: 'Valenciana', img: '/images/dishes/valenciana-sjdm.jpg'
              },{
                title: 'Inipit', img: '/images/placeholders/delicacy.jpg'
              }].map((it) => (
                <article key={it.title} className="group card bg-white/80 backdrop-blur hover:bg-white/95 p-6 rounded-xl transition-all duration-300 hover:shadow-xl transform hover:-translate-y-1">
                  <div className="h-48 bg-neutral-100 rounded-lg overflow-hidden mb-4 shadow-md group-hover:shadow-lg transition-shadow">
                    <img src={it.img} alt={it.title} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-neutral-800" style={{ fontFamily: 'var(--bm-serif)' }}>{it.title}</h3>
                  <p className="text-neutral-600 leading-relaxed">Traditional recipe with local ingredients and community stories behind each bite.</p>
                </article>
              ))}
            </div>
          </div>
        </section>
          <NextButton />

        {/* Culture */}
        <section className="bm-section snap-start">
          <div className="bm-bg" style={{ backgroundImage: `url('/images/home/market-1.jpg')`, filter: 'blur(10px) grayscale(0.05)' }} aria-hidden />
          <div className="bm-overlay" aria-hidden />
          <div className="bm-content max-w-3xl text-center">
            <h2 className="bm-hero-title mb-4">Cultural Significance</h2>
            <p className="text-neutral-700" style={{ fontFamily: 'var(--bm-sans)' }}>Markets, fiestas, and family kitchens shape how recipes are made and passed on. We document the stories, people, and places so traditions remain vibrant.</p>
          </div>
        </section>
          <NextButton />

        {/* Mission */}
        <section className="bm-section snap-start bg-white">
          <div className="bm-content bm-content-dark max-w-4xl text-center">
            <h2 className="bm-hero-title mb-4">Our Mission & Goals</h2>
            <p className="text-neutral-700 mb-4" style={{ fontFamily: 'var(--bm-sans)' }}>We aim to preserve culinary heritage, promote local food tourism, and connect cooks, farmers, and food lovers through stories and an interactive map.</p>
            <div className="flex flex-col md:flex-row gap-4 justify-center mt-6">
              <div className="card bg-white/90 backdrop-blur p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow max-w-sm border border-neutral-100">
                <h4 className="text-xl font-semibold mb-2 text-primary-600">Preserve</h4>
                <p className="text-neutral-600 leading-relaxed">Record recipes, variants, and oral histories.</p>
              </div>
              <div className="card bg-white/90 backdrop-blur p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow max-w-sm border border-neutral-100">
                <h4 className="text-xl font-semibold mb-2 text-primary-600">Promote</h4>
                <p className="text-neutral-600 leading-relaxed">Support small food businesses and food tourism.</p>
              </div>
              <div className="card bg-white/90 backdrop-blur p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow max-w-sm border border-neutral-100">
                <h4 className="text-xl font-semibold mb-2 text-primary-600">Connect</h4>
                <p className="text-neutral-600 leading-relaxed">Bridge cooks, farmers, and food lovers for collaborative growth.</p>
              </div>
            </div>
          </div>
        </section>
          <NextButton />

        {/* Join Us */}
        <section id="join-us" className="bm-section snap-start">
          <div className="bm-bg" style={{ backgroundImage: `url('/images/home/church-facade.jpg')`, filter: 'blur(8px) brightness(0.92)' }} aria-hidden />
          <div className="bm-overlay" aria-hidden />
          <div className="bm-content max-w-md mx-auto">
            <div 
              className="bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-2xl"
              style={{ 
                transform: 'perspective(1000px) rotateX(0deg)',
                transition: 'all 0.4s ease-out',
                backfaceVisibility: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)'
              }}
            >
              <h2 className="text-3xl font-bold mb-3 text-center bg-gradient-to-br from-primary-600 to-primary-800 bg-clip-text text-transparent">
                Join Our Community
              </h2>
              <p className="text-neutral-600 mb-8 text-center text-lg leading-relaxed" style={{ fontFamily: 'var(--bm-sans)' }}>
                Join us to rate dishes, share recipes, and be part of Bulacan's culinary journey.
              </p>
              <AuthPanel />
            </div>
          </div>
        </section>
          <NextButton />
      </main>

      {/* Login modal removed — login is embedded at the end of the page in the Join Us section */}
    </div>
  );
}


function AuthPanel() {
  const [tab, setTab] = useState<'login'|'register'>('login');
  const [message, setMessage] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const switchTab = (newTab: 'login' | 'register') => {
    if (tab === newTab) return;
    setIsTransitioning(true);
    // Small delay to allow animation to play
    setTimeout(() => {
      setTab(newTab);
      setIsTransitioning(false);
    }, 150);
  };

  return (
    <div>
      {/* Tabs at the top */}
      <div className="flex gap-2 mb-6 justify-center">
        <button
          onClick={() => switchTab('login')}
          className={`px-4 py-2 rounded-full transition-all duration-200 ease-out relative ${
            tab === 'login' 
              ? 'bg-primary-600 text-white shadow-md scale-105' 
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          Sign In
        </button>
        <button
          onClick={() => switchTab('register')}
          className={`px-4 py-2 rounded-full transition-all duration-200 ease-out relative ${
            tab === 'register' 
              ? 'bg-primary-600 text-white shadow-md scale-105' 
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          Register
        </button>
      </div>

      {/* Form container with transition */}
      <div className={`transition-all duration-150 ease-out ${
        isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
      }`}>
        {tab === 'login' ? (
          <LoginForm onLogin={() => { 
            setMessage('Welcome back!');
            // Trigger confetti or success animation here if desired
          }} />
        ) : (
          <RegisterForm onSuccess={() => { 
            switchTab('login');
            setMessage('Registration successful — please login');
          }} />
        )}
      </div>

      {/* Animated message */}
      {message && (
        <div className="mt-3 text-sm text-green-600 animate-fade-in">
          {message}
        </div>
      )}
    </div>
  );
}

function NextButton() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll('.bm-section')) as HTMLElement[];
    if (!sections.length) return;
    const obs = new IntersectionObserver((entries) => {
      // find the first section that is mostly visible and hide next when it's the last
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target as HTMLElement;
        const idx = sections.findIndex(s => s === el);
        setHidden(idx === sections.length - 1);
      });
    }, { threshold: 0.6 });
    sections.forEach(s => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  const onNext = (e: React.MouseEvent) => {
    e.preventDefault();
    // find the section this button is inside
  const section = document.elementFromPoint(window.innerWidth/2, window.innerHeight/3)?.closest('.bm-section') as HTMLElement | null;
    const sections = Array.from(document.querySelectorAll('.bm-section')) as HTMLElement[];
    const idx = section ? sections.findIndex(s => s === section) : -1;
    if (idx >= 0 && idx < sections.length - 1) sections[idx + 1].scrollIntoView({ behavior: 'smooth' });
  };
  if (hidden) return null;
  return (
    <button onClick={onNext} className="fixed right-6 bottom-1/2 translate-y-1/2 z-40 bg-white/90 text-bm-brown px-4 py-2 rounded-full shadow-md hover:shadow-lg">
      Next →
    </button>
  );
}
