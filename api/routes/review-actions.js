// Review vote endpoints
app.post('/api/reviews/:reviewId/vote', authRequired, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { voteType } = req.body;
    const userId = req.user.uid;

    if (!reviewId || !voteType || !['helpful', 'report'].includes(voteType)) {
      return res.status(400).json({ error: 'Invalid vote type' });
    }

    // Check if the review exists
    const [[review]] = await pool.query('SELECT id FROM ratings WHERE id = ?', [reviewId]);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Check if the user has already voted
    const [[existingVote]] = await pool.query(
      'SELECT id FROM review_votes WHERE review_id = ? AND user_id = ? AND vote_type = ?',
      [reviewId, userId, voteType]
    );

    if (existingVote) {
      // Remove vote if it already exists (toggle behavior)
      await pool.query(
        'DELETE FROM review_votes WHERE review_id = ? AND user_id = ? AND vote_type = ?',
        [reviewId, userId, voteType]
      );
      res.json({ message: 'Vote removed' });
    } else {
      // Add new vote
      await pool.query(
        'INSERT INTO review_votes (review_id, user_id, vote_type) VALUES (?, ?, ?)',
        [reviewId, userId, voteType]
      );
      res.json({ message: 'Vote recorded' });
    }

  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Failed to process vote' });
  }
});

// Restaurant owner response endpoint
app.post('/api/reviews/:reviewId/respond', authRequired, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { response } = req.body;
    const userId = req.user.uid;

    // Verify restaurant ownership (assuming restaurant owners are marked in users table)
    const [[user]] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (!user || user.role !== 'owner') {
      return res.status(403).json({ error: 'Only restaurant owners can respond to reviews' });
    }

    // Save the response
    await pool.query(
      'UPDATE ratings SET response_text = ?, response_by = ?, response_date = NOW() WHERE id = ?',
      [response, userId, reviewId]
    );

    res.json({ message: 'Response saved' });
  } catch (error) {
    console.error('Response error:', error);
    res.status(500).json({ error: 'Failed to save response' });
  }
});

// Mark review as verified visit
app.post('/api/reviews/:reviewId/verify', authRequired, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.uid;

    // Verify admin/owner permissions
    const [[user]] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (!user || !['admin', 'owner'].includes(user.role)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Mark the review as verified
    await pool.query(
      'UPDATE ratings SET is_verified_visit = TRUE WHERE id = ?',
      [reviewId]
    );

    // Recalculate weights
    await pool.query('CALL update_rating_weights()');

    res.json({ message: 'Review verified' });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Failed to verify review' });
  }
});