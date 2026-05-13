const axios = require('axios');
const cheerio = require('cheerio');
axios.get('https://genius.com/The-weeknd-blinding-lights-lyrics', {headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'}}).then(res => {
  const $ = cheerio.load(res.data);
  let lyricsText = '';
  $('[data-lyrics-container="true"]').each((i, el) => {
    $(el).find('[data-exclude-from-selection="true"]').remove();
    $(el).find('br').replaceWith('\n');
    $(el).find('div').each((_, div) => $(div).prepend('\n'));
    lyricsText += $(el).text() + '\n';
  });
  console.log(lyricsText.substring(0, 500));
}).catch(console.error);
