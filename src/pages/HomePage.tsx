// src/pages/HomePage.tsx
 
import { useEffect, useState } from "react";
import { assetUrl } from "../utils/assets";
import useRevealOnScroll from "../hooks/useRevealOnScroll";
import LoginForm from "../components/LoginForm";
import AuthPanel from "../components/AuthPanel";
import { getAnalyticsSummary, getPerMunicipalityCounts, getLinkStats } from "../utils/adminApi";
import { useAuth } from '../hooks/useAuth';
import { WelcomeToast } from '../components/welcome/WelcomeToast';
import { Confetti } from '../components/welcome/Confetti';
import '../components/welcome/welcome-animations.css';

export default function HomePage() {
  const { user } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [stats, setStats] = useState<{
    dishes: number;
    restaurants: number;
    municipalities: number;
    reviewCount: number;
  }>({
    dishes: 0,
    restaurants: 0,
    municipalities: 21, // Bulacan has 21 municipalities
    reviewCount: 0
  });

  // Fetch statistics
  useEffect(() => {
    const fetchStats = async () => {
      setIsLoadingStats(true);
      try {
        const [summary, linkStats] = await Promise.all([
          getAnalyticsSummary(),
          getLinkStats()
        ]);

        console.log('Summary from API:', summary);
        console.log('Link stats from API:', linkStats);

        if (!summary) {
          console.error('No summary data received from API');
          return;
        }

        setStats(prev => {
          const newStats = {
            ...prev,
            dishes: summary.dishes ?? 0,
            restaurants: summary.restaurants ?? 0,
            reviewCount: linkStats?.totalReviews ?? 0
          };
          console.log('Setting stats to:', newStats);
          return newStats;
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchStats();
  }, []);

  // Handle touch gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isSwipe = Math.abs(distance) > 50;

    if (isSwipe) {
      const sections = Array.from(document.querySelectorAll('.bm-section')) as HTMLElement[];
      const currentSection = document.elementFromPoint(window.innerWidth/2, window.innerHeight/2)?.closest('.bm-section') as HTMLElement;
      const currentIndex = sections.findIndex(section => section === currentSection);

      if (distance > 0 && currentIndex < sections.length - 1) {
        // Swipe up - go to next section
        sections[currentIndex + 1].scrollIntoView({ behavior: 'smooth' });
      } else if (distance < 0 && currentIndex > 0) {
        // Swipe down - go to previous section
        sections[currentIndex - 1].scrollIntoView({ behavior: 'smooth' });
      }
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  // Welcome experience logic
  useEffect(() => {
    if (user) {
      // Check if we've shown the welcome message for this session
      const hasShownWelcome = sessionStorage.getItem('hasShownWelcome');
      if (!hasShownWelcome) {
        setShowWelcome(true);
        setShowConfetti(true);
        sessionStorage.setItem('hasShownWelcome', 'true');
        
        // Auto-hide welcome toast after 5 seconds
        const timer = setTimeout(() => {
          setShowWelcome(false);
        }, 5000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  // Handle tour start
  const handleStartTour = () => {
    setShowWelcome(false);
    // Implement tour logic here
    // You can use a library like react-joyride for guided tours
  };

  // Keep homepage focused: brief intro + primary CTA to the interactive map
  useRevealOnScroll();

  // Track scroll progress
  useEffect(() => {
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;
      const scrollPercent = (scrollTop / (documentHeight - windowHeight)) * 100;
      setScrollProgress(scrollPercent);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Ensure header nav is visible by default
  useEffect(() => {
    // Make nav visible by default
    window.dispatchEvent(new CustomEvent('nav:visible', { detail: { visible: true } }));
    return () => {
      // Also ensure nav is visible when leaving
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
  const scrollToSection = (sectionId: string, callback?: () => void) => {
    const el = document.getElementById(sectionId);
    if (!el) return;

    // Prepare all sections for transition
    document.querySelectorAll('.bm-section').forEach(section => {
      (section as HTMLElement).style.transition = 'opacity 0.5s ease-out';
      (section as HTMLElement).style.opacity = '0.3';
    });

    // Highlight target section
    el.style.opacity = '1';
    el.style.transition = 'opacity 0.5s ease-out';

    // Smooth scroll with easing
    window.scrollTo({
      top: el.offsetTop,
      behavior: 'smooth'
    });

    // Reset sections after animation
    setTimeout(() => {
      document.querySelectorAll('.bm-section').forEach(section => {
        (section as HTMLElement).style.opacity = '1';
      });
      if (callback) callback();
    }, 500);
  };

  const scrollToJoin = () => {
    // Start a subtle animation on the auth panel before scrolling
    const authPanel = document.querySelector('#join-us .bg-white/95');
    if (authPanel instanceof HTMLElement) {
      authPanel.style.transform = 'perspective(1000px) rotateX(5deg)';
    }

    scrollToSection('join-us', () => {
      // Reset and animate the auth panel
      const authPanel = document.querySelector('#join-us .bg-white/95');
      if (authPanel instanceof HTMLElement) {
        authPanel.style.transform = 'perspective(1000px) rotateX(0deg)';
      }

      // Focus the first input for keyboard users
      try {
        const first = document.querySelector('#join-us input[type="email"], #join-us input') as HTMLElement | null;
        if (first) {
          first.focus();
          first.classList.add('focus-highlight');
          setTimeout(() => first.classList.remove('focus-highlight'), 1000);
        }
      } catch (err) {
        console.error('Error focusing input:', err);
      }
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

  // Enhanced reveal animations when scrolled into view
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('.bm-content')) as HTMLElement[];
    if (!els.length) return;
    
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const el = en.target as HTMLElement;
        if (en.isIntersecting) {
          // Add staggered animations to children
          el.classList.add('in-view');
          Array.from(el.children).forEach((child, index) => {
            (child as HTMLElement).style.animationDelay = `${index * 0.1}s`;
          });
        } else {
          el.classList.remove('in-view');
        }
      });
    }, { 
      threshold: 0.18,
      rootMargin: '0px 0px -10% 0px' // Trigger slightly before element comes into view
    });
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
    <div 
      className="w-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {showWelcome && user && (
        <WelcomeToast
          user={user}
          isNewUser={user.isNewUser}
          onStartTour={handleStartTour}
        />
      )}
      {showConfetti && <Confetti duration={3000} />}
      <div 
        className="fixed top-0 left-0 w-full h-1 bg-neutral-200 z-50"
        style={{ transform: 'translateZ(0)' }}
      >
        <div 
          className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-transform duration-150 ease-out"
          style={{ 
            transform: `translateX(${scrollProgress - 100}%)`,
            boxShadow: '0 0 8px rgba(0,0,0,0.1)'
          }}
        />
      </div>
      <a href="#intro-slides" className="skip-link">Skip to content</a>
      <main 
        id="intro-slides" 
        className="snap-y snap-mandatory scroll-smooth"
        style={{
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'y mandatory',
          scrollPaddingTop: '1rem',
          scrollPaddingBottom: '1rem'
        }}
      >
  {/* Hero */}
        <section className="bm-section snap-start">
          <div className="bm-bg" style={{ backgroundImage: `url(${assetUrl('images/home/barasoain-1.jpg')})` }} aria-hidden />
          <div className="bm-overlay bg-black/40" aria-hidden />
          <div className="bm-content text-center relative">
            <span className="text-primary-300 uppercase tracking-wider text-sm md:text-base font-medium mb-4 block animate-[fadeInUp_1s_ease-out]">
              Welcome to Bulacan's Culinary Journey
            </span>
            <h1 className="bm-hero-title text-4xl md:text-7xl font-bold mb-6 text-white tracking-tight">
              Discover the Heart of Filipino Flavors
            </h1>
            <p className="text-white/90 text-lg md:text-xl max-w-2xl mx-auto mb-6 leading-relaxed font-light" style={{ fontFamily: 'var(--bm-sans)' }}>
              Immerse yourself in Bulacan's rich culinary heritage, where every dish tells a story of tradition, family, and passion. From century-old recipes to modern interpretations, experience the authentic tastes that have made our province a gastronomic destination.
            </p>
            <p className="text-white/80 text-base md:text-lg max-w-xl mx-auto mb-8 leading-relaxed font-light italic" style={{ fontFamily: 'var(--bm-serif)' }}>
              "Where every bite connects you to generations of Filipino culinary artistry"
            </p>
            <div className="flex flex-col md:flex-row justify-center gap-4 md:gap-6">
              <a href="/map" className="bm-hero-cta btn btn-primary px-8 py-4 text-lg font-medium rounded-full hover:scale-105 transition-transform group">
                <span className="flex items-center gap-2">
                  Explore Our Flavors
                  <svg className="w-5 h-5 transform transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              </a>
              <button onClick={scrollToJoin} className="btn bg-white/20 backdrop-blur text-white border-2 border-white/30 px-8 py-4 text-lg font-medium rounded-full hover:bg-white/30 transition-all group">
                <span className="flex items-center gap-2">
                  Join Our Community
                  <svg className="w-5 h-5 opacity-0 transform -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </span>
              </button>
            </div>
            <div className="mt-12 flex justify-center gap-8">
              <div className="text-center">
                <div className="text-white/90 text-2xl md:text-3xl font-bold mb-1">
                  {isLoadingStats ? (
                    <span className="inline-block w-12 h-8 bg-white/20 animate-pulse rounded"></span>
                  ) : stats.dishes > 0 ? (
                    `${stats.dishes}+`
                  ) : (
                    '50+'
                  )}
                </div>
                <div className="text-white/70 text-sm">Local Dishes</div>
              </div>
              <div className="text-center">
                <div className="text-white/90 text-2xl md:text-3xl font-bold mb-1">
                  {isLoadingStats ? (
                    <span className="inline-block w-12 h-8 bg-white/20 animate-pulse rounded"></span>
                  ) : stats.restaurants > 0 ? (
                    `${stats.restaurants}+`
                  ) : (
                    '100+'
                  )}
                </div>
                <div className="text-white/70 text-sm">Restaurants</div>
              </div>
              <div className="text-center">
                <div className="text-white/90 text-2xl md:text-3xl font-bold mb-1">
                  {isLoadingStats ? (
                    <span className="inline-block w-12 h-8 bg-white/20 animate-pulse rounded"></span>
                  ) : (
                    stats.municipalities
                  )}
                </div>
                <div className="text-white/70 text-sm">Municipalities</div>
              </div>
            </div>
          </div>
          <NextButton />
        </section>

        {/* Highlights */}
        <section className="bm-section snap-start bg-white">
          <div className="bm-bg" style={{ backgroundImage: `url(${assetUrl('images/home/fiesta-1.jpg')})`, filter: 'blur(8px) brightness(0.9)' }} aria-hidden />
          <div className="bm-overlay" aria-hidden />
          <div className="bm-content bm-content-dark">
            <span className="text-primary-600/90 uppercase tracking-wider text-sm font-medium mb-3 block">Featured Delicacies</span>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-neutral-800 tracking-tight">Culinary Treasures of Bulacan</h2>
            <p className="text-neutral-600 text-lg md:text-xl mb-4 max-w-3xl mx-auto leading-relaxed" style={{ fontFamily: 'var(--bm-sans)' }}>
              Journey through our province's most beloved dishes, each telling a unique story of heritage, craftsmanship, and local pride.
            </p>
            <p className="text-neutral-500 text-base mb-8 max-w-2xl mx-auto" style={{ fontFamily: 'var(--bm-sans)' }}>
              From centuries-old bakeries to family-guarded recipes, discover the authentic flavors that have shaped our culinary identity.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[{
                title: 'Pandesal de Baliuag', img: assetUrl('images/dishes/pandesal-de-baliuag.jpg')
              },{
                title: 'Valenciana', img: assetUrl('images/dishes/valenciana-sjdm.jpg')
              },{
                title: 'Inipit', img: assetUrl('images/placeholders/delicacy.jpg')
              }].map((it) => (
                <article key={it.title} className="group card bg-white/80 backdrop-blur hover:bg-white/95 p-6 rounded-xl transition-all duration-300 hover:shadow-xl transform hover:-translate-y-1">
                  <div className="h-48 bg-neutral-100 rounded-lg overflow-hidden mb-4 shadow-md group-hover:shadow-lg transition-shadow relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10"></div>
                    <div className="absolute inset-0 bg-neutral-100 animate-pulse">
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-neutral-300 animate-spin" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                    </div>
                    <img 
                      src={it.img} 
                      alt={it.title} 
                      loading="lazy"
                      onLoad={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.opacity = '1';
                        const loader = target.previousElementSibling;
                        if (loader) loader.remove();
                      }}
                      className="w-full h-full object-cover transform group-hover:scale-110 transition-all duration-700 ease-out opacity-0" 
                    />
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
          <div className="bm-bg" style={{ backgroundImage: `url(${assetUrl('images/home/market-1.jpg')})`, filter: 'blur(10px) grayscale(0.05)' }} aria-hidden />
          <div className="bm-overlay" aria-hidden />
          <div className="bm-content max-w-3xl text-center">
            <span className="text-white/90 uppercase tracking-wider text-sm font-medium mb-3 block">Living Heritage</span>
            <h2 className="bm-hero-title mb-6">A Legacy of Flavors</h2>
            <div className="max-w-4xl mx-auto space-y-6">
              <p className="text-white/90 text-lg md:text-xl leading-relaxed" style={{ fontFamily: 'var(--bm-sans)' }}>
                In Bulacan, our culinary heritage is alive in every bustling market, vibrant fiesta, and family kitchen. Each recipe carries centuries of tradition, passed down through generations with pride and care.
              </p>
              <p className="text-white/80 text-lg leading-relaxed" style={{ fontFamily: 'var(--bm-sans)' }}>
                From the early morning rituals of traditional bakeries to the cherished family gatherings where age-old recipes come to life, we're preserving these precious traditions for future generations.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
                  <h3 className="text-white text-xl font-semibold mb-3">Markets & Traditions</h3>
                  <p className="text-white/80">Where local ingredients tell stories of seasons, harvests, and community connections.</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
                  <h3 className="text-white text-xl font-semibold mb-3">Family Recipes</h3>
                  <p className="text-white/80">Treasured culinary knowledge passed down through generations of Bulakeño families.</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
                  <h3 className="text-white text-xl font-semibold mb-3">Local Artisans</h3>
                  <p className="text-white/80">Skilled hands keeping traditional cooking methods and recipes alive.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
          <NextButton />

        {/* Mission */}
        <section className="bm-section snap-start bg-white">
          <div className="bm-content bm-content-dark max-w-4xl text-center">
            <span className="text-primary-600/90 uppercase tracking-wider text-sm font-medium mb-3 block">Our Purpose</span>
            <h2 className="bm-hero-title mb-4">Preserving Our Culinary Heritage</h2>
            <p className="text-neutral-700 text-lg md:text-xl mb-6 max-w-3xl mx-auto" style={{ fontFamily: 'var(--bm-sans)' }}>
              We're on a mission to safeguard Bulacan's rich culinary traditions while fostering connections between local communities, food artisans, and enthusiasts.
            </p>
            <div className="flex flex-col md:flex-row gap-6 justify-center mt-8 max-w-5xl mx-auto">
              <div className="card bg-white/90 backdrop-blur p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 max-w-sm border border-neutral-100 group hover:-translate-y-2">
                <div className="w-12 h-12 mb-4 rounded-lg bg-primary-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h4 className="text-xl font-semibold mb-3 text-primary-600">Preserve Our Heritage</h4>
                <p className="text-neutral-600 leading-relaxed mb-4">Documenting centuries-old recipes, cooking techniques, and the stories behind every dish that makes Bulacan unique.</p>
                <ul className="text-sm text-neutral-500 space-y-2">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Record traditional recipes
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Document oral histories
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Capture cooking techniques
                  </li>
                </ul>
              </div>
              
              <div className="card bg-white/90 backdrop-blur p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 max-w-sm border border-neutral-100 group hover:-translate-y-2">
                <div className="w-12 h-12 mb-4 rounded-lg bg-primary-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <h4 className="text-xl font-semibold mb-3 text-primary-600">Promote Local Flavors</h4>
                <p className="text-neutral-600 leading-relaxed mb-4">Supporting local food businesses and promoting Bulacan as a prime destination for culinary tourism and cultural experiences.</p>
                <ul className="text-sm text-neutral-500 space-y-2">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Showcase local restaurants
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Support food artisans
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Drive culinary tourism
                  </li>
                </ul>
              </div>
              
              <div className="card bg-white/90 backdrop-blur p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 max-w-sm border border-neutral-100 group hover:-translate-y-2">
                <div className="w-12 h-12 mb-4 rounded-lg bg-primary-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <h4 className="text-xl font-semibold mb-3 text-primary-600">Connect Communities</h4>
                <p className="text-neutral-600 leading-relaxed mb-4">Building bridges between food artisans, local producers, and food enthusiasts to create a vibrant culinary ecosystem.</p>
                <ul className="text-sm text-neutral-500 space-y-2">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Foster collaboration
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Share knowledge
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Build networks
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
          <NextButton />

        {/* Join Us */}
        <section id="join-us" className="bm-section snap-start">
          <div className="bm-bg" style={{ backgroundImage: `url(${assetUrl('images/home/church-facade.jpg')})`, filter: 'blur(8px) brightness(0.92)' }} aria-hidden />
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
              <span className="text-primary-600/90 uppercase tracking-wider text-sm font-medium mb-3 block text-center">Become Part of Our Story</span>
              <h2 className="text-3xl font-bold mb-3 text-center bg-gradient-to-br from-primary-600 to-primary-800 bg-clip-text text-transparent">
                Join Our Culinary Community
              </h2>
              <p className="text-neutral-600 mb-4 text-center text-lg leading-relaxed" style={{ fontFamily: 'var(--bm-sans)' }}>
                Be part of a growing community dedicated to preserving and celebrating Bulacan's rich culinary heritage.
              </p>
              <p className="text-neutral-500 mb-8 text-center text-base" style={{ fontFamily: 'var(--bm-sans)' }}>
                Share your stories, discover local favorites, and connect with fellow food enthusiasts.
              </p>
              <div className="flex justify-center gap-12 mb-8">
                <div className="text-center">
                  <div className="text-primary-600 text-2xl font-bold mb-1">
                    <svg className="inline-block w-5 h-5 mr-1 -translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Growing
                  </div>
                  <div className="text-neutral-500 text-sm">Community Members</div>
                </div>
                <div className="text-center">
                  <div className="text-primary-600 text-2xl font-bold mb-1">
                    <svg className="inline-block w-5 h-5 mr-1 -translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    Active
                  </div>
                  <div className="text-neutral-500 text-sm">Community Reviews</div>
                </div>
              </div>
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
    // Find current and next sections
    const section = document.elementFromPoint(window.innerWidth/2, window.innerHeight/3)?.closest('.bm-section') as HTMLElement | null;
    const sections = Array.from(document.querySelectorAll('.bm-section')) as HTMLElement[];
    const idx = section ? sections.findIndex(s => s === section) : -1;
    
    if (idx >= 0 && idx < sections.length - 1) {
      const nextSection = sections[idx + 1];
      
      // Prepare transition
      sections.forEach(s => {
        s.style.transition = 'opacity 0.5s ease-out';
        s.style.opacity = '0.3';
      });
      
      // Highlight next section
      nextSection.style.opacity = '1';
      
      // Smooth scroll with easing
      window.scrollTo({
        top: nextSection.offsetTop,
        behavior: 'smooth'
      });
      
      // Reset sections after animation
      setTimeout(() => {
        sections.forEach(s => {
          s.style.opacity = '1';
        });
      }, 500);
    }
  };
  if (hidden) return null;
  return (
    <button onClick={onNext} className="fixed right-6 bottom-1/2 translate-y-1/2 z-40 bg-white/90 text-bm-brown px-4 py-2 rounded-full shadow-md hover:shadow-lg">
      Next →
    </button>
  );
}
