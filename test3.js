const axios = require('axios');
const cheerio = require('cheerio');
axios.get('https://genius.com/The-weeknd-blinding-lights-lyrics', {headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'}}).then(res => {
  const $ = cheerio.load(res.data);
  const el = $('[data-lyrics-container="true"]').eq(0);
  console.log(el.html().substring(0, 500));
}).catch(console.error);
