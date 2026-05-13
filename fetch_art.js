const albums = [
  'Yeh Jawaani Hai Deewani',
  'Rockstar hindi',
  'Kabir Singh',
  '3 Idiots',
  'Zindagi Na Milegi Dobara',
  'Gully Boy',
  'Dil Se',
  'Adele 21',
  'Radiohead OK Computer',
  'Michael Jackson Thriller',
  'Dua Lipa Future Nostalgia',
  'Kendrick Lamar Damn',
  'The Beatles Abbey Road',
  'Ed Sheeran Divide',
  'The Weeknd Starboy',
  'Taylor Swift 1989'
];

async function fetchAll() {
  for (const a of albums) {
    const res = await fetch('https://itunes.apple.com/search?term=' + encodeURIComponent(a) + '&entity=album&limit=1');
    const d = await res.json();
    if (d.results && d.results[0]) {
      console.log("{ id: '" + a.split(' ')[0].toLowerCase() + "', src: '" + d.results[0].artworkUrl100.replace('100x100bb', '600x600bb') + "' },");
    } else {
      console.log('// Not found:', a);
    }
  }
}
fetchAll();
