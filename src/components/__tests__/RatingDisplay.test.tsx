import React from 'react';
import { render, screen } from '@testing-library/react';
import RatingDisplay from '../RatingDisplay';

describe('RatingDisplay', () => {
  it('renders rating with correct number of stars', () => {
    render(<RatingDisplay rating={3.5} />);
    const stars = screen.getAllByRole('img', { hidden: true });
    expect(stars).toHaveLength(5); // Total number of stars should always be 5
  });

  it('shows count when specified', () => {
    render(<RatingDisplay rating={4.2} totalRatings={10} />);
    expect(screen.getByText(/4.2 \(10\)/)).toBeInTheDocument();
  });

  it('hides count when showCount is false', () => {
    render(<RatingDisplay rating={4.2} totalRatings={10} showCount={false} />);
    expect(screen.queryByText(/4.2 \(10\)/)).not.toBeInTheDocument();
  });

  it('applies custom size to stars', () => {
    render(<RatingDisplay rating={4} size={20} />);
    const stars = screen.getAllByRole('img', { hidden: true });
    stars.forEach(star => {
      expect(star).toHaveAttribute('width', '20');
      expect(star).toHaveAttribute('height', '20');
    });
  });

  it('applies custom className', () => {
    const className = 'test-class';
    render(<RatingDisplay rating={4} className={className} />);
    expect(screen.getByTestId('rating-display')).toHaveClass(className);
  });

  it('renders half stars correctly', () => {
    render(<RatingDisplay rating={3.7} />);
    const stars = screen.getAllByRole('img', { hidden: true });
    expect(stars[3]).toHaveClass('text-gray-300'); // 4th star should be empty
    expect(stars[4]).toHaveClass('text-gray-300'); // 5th star should be empty
  });
});