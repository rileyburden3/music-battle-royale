import { query } from '../db/index.js';

// Single-elimination bracket: 8 songs → Round 1 (4 matches) → Round 2 (2 matches) → Final (1 match)
// Seeded by average ranking score from the voting round

export async function calculateBracket(battleId: string) {
  // Get all songs in this battle
  const songsRes = await query('SELECT id FROM songs WHERE battle_id = $1', [battleId]);
  let songs = songsRes.rows;
  if (songs.length < 2) throw new Error('Need at least 2 songs to calculate bracket');
  // Pad to 8 with dummy bye slots if needed, or trim to 8 if over
  if (songs.length > 8) songs = songs.slice(0, 8);
  while (songs.length < 8) songs.push({ id: songs[songs.length - 1].id }); // duplicate last song as bye

  // Calculate average scores for each song across all voters (excluding self-rankings)
  const scoresRes = await query(
    `SELECT r.song_id, AVG(r.score) as avg_score
     FROM rankings r
     JOIN songs s ON s.id = r.song_id
     WHERE r.battle_id = $1 AND r.ranked_by != s.submitted_by
     GROUP BY r.song_id
     ORDER BY avg_score DESC`,
    [battleId]
  );

  const scores = scoresRes.rows;
  // Songs with no rankings (not voted on by anyone) get 0
  const songScoreMap: Record<string, number> = {};
  for (const s of scores) songScoreMap[s.song_id] = parseFloat(s.avg_score);
  for (const s of songs) {
    if (!songScoreMap[s.id]) songScoreMap[s.id] = 0;
  }

  // Sort by score descending for seeding (1st seed vs 8th, 2nd vs 7th, etc.)
  const seeded = songs.sort((a, b) => (songScoreMap[b.id] || 0) - (songScoreMap[a.id] || 0));

  // Round 1 matchups: 1v8, 2v7, 3v6, 4v5
  const round1Matches = [
    { song1: seeded[0], song2: seeded[7], match: 1 },
    { song1: seeded[1], song2: seeded[6], match: 2 },
    { song1: seeded[2], song2: seeded[5], match: 3 },
    { song1: seeded[3], song2: seeded[4], match: 4 },
  ];

  for (const m of round1Matches) {
    const s1score = songScoreMap[m.song1.id] || 0;
    const s2score = songScoreMap[m.song2.id] || 0;
    const winner = s1score >= s2score ? m.song1.id : m.song2.id;

    await query(
      `INSERT INTO bracket_matches (battle_id, round, match_number, song1_id, song2_id, winner_id, song1_avg_score, song2_avg_score, completed)
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7, true)
       ON CONFLICT (battle_id, round, match_number) DO UPDATE SET winner_id = $5, completed = true`,
      [battleId, m.match, m.song1.id, m.song2.id, winner, s1score.toFixed(2), s2score.toFixed(2)]
    );
  }

  // Get round 1 winners in match order
  const r1Winners = await query(
    'SELECT winner_id FROM bracket_matches WHERE battle_id = $1 AND round = 1 ORDER BY match_number',
    [battleId]
  );
  const w1 = r1Winners.rows.map((r: { winner_id: string }) => r.winner_id);

  // Round 2 matchups: winner1 vs winner2, winner3 vs winner4
  const round2Matches = [
    { song1: w1[0], song2: w1[1], match: 1 },
    { song1: w1[2], song2: w1[3], match: 2 },
  ];

  for (const m of round2Matches) {
    const s1score = songScoreMap[m.song1] || 0;
    const s2score = songScoreMap[m.song2] || 0;
    const winner = s1score >= s2score ? m.song1 : m.song2;

    await query(
      `INSERT INTO bracket_matches (battle_id, round, match_number, song1_id, song2_id, winner_id, song1_avg_score, song2_avg_score, completed)
       VALUES ($1, 2, $2, $3, $4, $5, $6, $7, true)
       ON CONFLICT (battle_id, round, match_number) DO UPDATE SET winner_id = $5, completed = true`,
      [battleId, m.match, m.song1, m.song2, winner, s1score.toFixed(2), s2score.toFixed(2)]
    );
  }

  // Get round 2 winners
  const r2Winners = await query(
    'SELECT winner_id FROM bracket_matches WHERE battle_id = $1 AND round = 2 ORDER BY match_number',
    [battleId]
  );
  const w2 = r2Winners.rows.map((r: { winner_id: string }) => r.winner_id);

  // Final (Round 3)
  const s1score = songScoreMap[w2[0]] || 0;
  const s2score = songScoreMap[w2[1]] || 0;
  const champion = s1score >= s2score ? w2[0] : w2[1];

  await query(
    `INSERT INTO bracket_matches (battle_id, round, match_number, song1_id, song2_id, winner_id, song1_avg_score, song2_avg_score, completed)
     VALUES ($1, 3, 1, $2, $3, $4, $5, $6, true)
     ON CONFLICT (battle_id, round, match_number) DO UPDATE SET winner_id = $4, completed = true`,
    [battleId, w2[0], w2[1], champion, s1score.toFixed(2), s2score.toFixed(2)]
  );

  // Mark battle as completed
  await query(
    "UPDATE battles SET status = 'completed', completed_at = NOW(), current_round = 3 WHERE id = $1",
    [battleId]
  );

  // Award points: rank all 8 songs by average score
  const allScores = songs
    .map(s => ({ id: s.id, score: songScoreMap[s.id] || 0 }))
    .sort((a, b) => b.score - a.score);

  const pointMap: Record<number, number> = { 0: 30, 1: 25, 2: 10 };

  for (let i = 0; i < allScores.length; i++) {
    const points = pointMap[i] || 0;
    if (points > 0) {
      const songSubmitter = await query('SELECT submitted_by FROM songs WHERE id = $1', [allScores[i].id]);
      if (songSubmitter.rows[0]) {
        await query(
          'UPDATE users SET total_points = total_points + $1 WHERE id = $2',
          [points, songSubmitter.rows[0].submitted_by]
        );
        if (i === 0) {
          await query('UPDATE users SET battles_won = battles_won + 1 WHERE id = $1', [songSubmitter.rows[0].submitted_by]);
        }
      }
    }
  }

  // Increment battles_played for all participants
  await query(
    `UPDATE users SET battles_played = battles_played + 1
     WHERE id IN (SELECT user_id FROM battle_participants WHERE battle_id = $1 AND status = 'accepted')`,
    [battleId]
  );

  return champion;
}

export async function getBracketData(battleId: string) {
  const matches = await query(
    `SELECT bm.*,
      s1.title as song1_title, s1.artist as song1_artist, s1.album_art_url as song1_art,
      s2.title as song2_title, s2.artist as song2_artist, s2.album_art_url as song2_art,
      sw.title as winner_title, sw.artist as winner_artist, sw.album_art_url as winner_art
     FROM bracket_matches bm
     JOIN songs s1 ON s1.id = bm.song1_id
     JOIN songs s2 ON s2.id = bm.song2_id
     LEFT JOIN songs sw ON sw.id = bm.winner_id
     WHERE bm.battle_id = $1
     ORDER BY bm.round, bm.match_number`,
    [battleId]
  );
  return matches.rows;
}
