import { query } from './index.js';

const demoSongs = [
  { title: 'HUMBLE.', artist: 'Kendrick Lamar', album: 'DAMN.', spotify_id: '7KXjTSCq5nL1LoYtL7XAwS', genre: 'hip-hop', album_art_url: 'https://i.scdn.co/image/ab67616d0000b273e2e352d89826aef6dbd5ff8f' },
  { title: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', spotify_id: '0VjIjW4GlUZAMYd2vXMi3b', genre: 'pop', album_art_url: 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36' },
  { title: 'Bad Guy', artist: 'Billie Eilish', album: 'When We All Fall Asleep', spotify_id: '2Fxmhks0bxGSBdJ92vM42m', genre: 'pop', album_art_url: 'https://i.scdn.co/image/ab67616d0000b273c5649add07ed3720be9d5526' },
  { title: 'Levitating', artist: 'Dua Lipa', album: 'Future Nostalgia', spotify_id: '463CkQjx2Zfoiqe8jXkjVa', genre: 'pop', album_art_url: 'https://i.scdn.co/image/ab67616d0000b2736bc58448cbffd50b9d24cc93' },
  { title: 'MONTERO', artist: 'Lil Nas X', album: 'MONTERO', spotify_id: '5Z01UMMf7V1o0MzF86s6WJ', genre: 'pop', album_art_url: 'https://i.scdn.co/image/ab67616d0000b273be82673b5f79d9658ec0a9fd' },
  { title: 'Peaches', artist: 'Justin Bieber', album: 'Justice', spotify_id: '4iJyoBOLtHqaWYs3wyVOfh', genre: 'r&b', album_art_url: 'https://i.scdn.co/image/ab67616d0000b273e6f407c7f3a0ec98845e4431' },
  { title: 'drivers license', artist: 'Olivia Rodrigo', album: 'SOUR', spotify_id: '4Dvkj6JhhA12EX05fT7y2e', genre: 'pop', album_art_url: 'https://i.scdn.co/image/ab67616d0000b273a91c10fe9472d9bd89802e52' },
  { title: 'INDUSTRY BABY', artist: 'Lil Nas X', album: 'MONTERO', spotify_id: '27NovPIUIRrOZoCHxABJwK', genre: 'pop', album_art_url: 'https://i.scdn.co/image/ab67616d0000b273be82673b5f79d9658ec0a9fd' },
];

export async function seedDemoSongs() {
  for (const song of demoSongs) {
    await query(
      `INSERT INTO demo_songs (title, artist, album, spotify_id, genre, album_art_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [song.title, song.artist, song.album, song.spotify_id, song.genre, song.album_art_url]
    );
  }
  console.log('Demo songs seeded');
}
