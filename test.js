const cheerio = require('cheerio');
const $ = cheerio.load('<div data-lyrics-container="true">Hello<a href="#">World</a><br>New line<span>Here</span></div>');
$('[data-lyrics-container="true"]').each((i, el) => {
  $(el).find('br').replaceWith('\n');
  console.log($(el).text());
});
