import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SPLASH_KEY = "splash_seen";

const slides = [
  {
    title: "Welcome to Mapping Filipino Flavors!",
    text: "Discover, review, and explore the unique culinary heritage of Bulacan. By continuing, you agree to our community guidelines and data policy.",
    img: "/log.svg",
  },
  {
    title: "Why We Built This App",
    text: "Our goal is to celebrate and preserve Bulacan's rich food culture. We believe in the power of community-driven discovery and sharing.",
    img: "https://via.placeholder.com/120x120?text=Goal",
  },
  {
    title: "Your Participation Matters",
    text: "User interactions—like reviews, ratings, and suggestions—help us keep the map accurate and vibrant. Please contribute respectfully!",
    img: "https://via.placeholder.com/120x120?text=Interact",
  },
  {
    title: "Disclaimer",
    text: "This is a community-driven project. Data may not be 100% accurate. Always verify information before making plans.",
    img: "https://via.placeholder.com/120x120?text=Info",
  },
];

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [show, setShow] = useState(true);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = sessionStorage.getItem(SPLASH_KEY);
    if (seen) {
      setShow(false);
      onFinish();
    }
  }, [onFinish]);

  function handleContinue() {
    if (step < slides.length - 1) {
      setStep(step + 1);
    } else {
      sessionStorage.setItem(SPLASH_KEY, "1");
      setShow(false);
      onFinish();
    }
  }

  function handleSkip() {
    sessionStorage.setItem(SPLASH_KEY, "1");
    setShow(false);
    onFinish();
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={step}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-primary-100 to-primary-300 text-primary-900"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.img
            src={slides[step].img}
            alt="Splash visual"
            className="mb-6 rounded-full shadow-lg"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          />
          <motion.h1
            className="text-3xl font-bold mb-2 text-center"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {slides[step].title}
          </motion.h1>
          <motion.p
            className="mb-6 text-lg text-center max-w-md"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            {slides[step].text}
          </motion.p>
          <motion.div
            className="flex gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            {step < slides.length - 1 ? (
              <button
                className="px-6 py-2 rounded bg-primary-600 text-white font-semibold hover:bg-primary-700 shadow"
                onClick={handleContinue}
              >
                Next
              </button>
            ) : (
              <>
                <button
                  className="px-6 py-2 rounded bg-primary-600 text-white font-semibold hover:bg-primary-700 shadow"
                  onClick={handleContinue}
                >
                  Create Account
                </button>
                <button
                  className="px-6 py-2 rounded bg-white text-primary-700 font-semibold border border-primary-300 hover:bg-primary-50 shadow"
                  onClick={handleContinue}
                >
                  Continue as Guest
                </button>
              </>
            )}
            {step < slides.length - 1 && (
              <button
                className="px-4 py-2 rounded bg-neutral-200 text-primary-700 font-semibold hover:bg-neutral-300 shadow"
                onClick={handleSkip}
              >
                Skip
              </button>
            )}
          </motion.div>
          <motion.div
            className="mt-8 flex justify-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            {slides.map((_, i) => (
              <span
                key={i}
                className={`inline-block w-3 h-3 rounded-full border border-primary-500 transition-all duration-200 ${i === step ? 'bg-primary-600' : 'bg-white'}`}
                style={{ boxShadow: i === step ? '0 0 0 2px #2563eb' : undefined }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
