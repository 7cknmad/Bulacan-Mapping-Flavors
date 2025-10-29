import React from 'react';
import { motion } from 'framer-motion';

interface StarRatingProps {
  rating: number;
  setRating: (rating: number) => void;
}

const StarRating: React.FC<StarRatingProps> = ({ rating, setRating }) => {
  // Tunable animation parameters
  const HOVER_SCALE = 1.35; // larger pop on hover
  const HOVER_Y = -6; // lift slightly more
  const TAP_SCALE = 0.92; // stronger tap feedback
  const SPRING = { type: 'spring', stiffness: 600, damping: 30 } as const;

  return (
    <div className="flex gap-2 items-center" role="radiogroup" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= rating;
        return (
          <motion.button
            key={star}
            onClick={() => setRating(star)}
            whileHover={{ scale: HOVER_SCALE, y: HOVER_Y }}
            whileTap={{ scale: TAP_SCALE }}
            transition={SPRING}
            className={`text-2xl focus:outline-none ${filled ? 'text-yellow-400' : 'text-gray-400'}`}
            aria-checked={filled}
            role="radio"
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
          >
            ★
          </motion.button>
        );
      })}
    </div>
  );
};

export default StarRating;