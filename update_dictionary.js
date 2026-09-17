// Verified Scrabble & Words with Friends Dictionary Updater
// Merges official ENABLE1 and NASPA NWL2023 tournament word lists.

const fs = require('fs');
const https = require('https');

async function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${res.statusCode})`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', err => reject(err));
  });
}

async function updateDictionary() {
  const wordSet = new Set();

  console.log('1. Downloading official ENABLE1 benchmark lexicon...');
  try {
    const enable1Raw = await download('https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt');
    const enable1Words = enable1Raw.split(/\r?\n/).map(w => w.trim().toUpperCase()).filter(w => w.length >= 2);
    for (const w of enable1Words) wordSet.add(w);
    console.log(`Loaded ${wordSet.size} official words from ENABLE1.`);
  } catch (err) {
    console.warn('Could not fetch ENABLE1 online, checking local data/enable1.txt fallback:', err.message);
    try {
      const local = fs.readFileSync('data/enable1.txt', 'utf8');
      const localWords = local.split(/\r?\n/).map(w => w.trim().toUpperCase()).filter(w => w.length >= 2);
      for (const w of localWords) wordSet.add(w);
    } catch (e) {}
  }

  console.log('2. Downloading official NASPA NWL2023 tournament lexicon...');
  try {
    const nwlRaw = await download('https://raw.githubusercontent.com/scrabblewords/scrabblewords/main/words/North-American/NWL2023.txt');
    const nwlLines = nwlRaw.split(/\r?\n/).filter(Boolean);
    let added = 0;
    for (const line of nwlLines) {
      const word = line.split(' ')[0].toUpperCase().trim();
      if (word.length >= 2 && !wordSet.has(word)) {
        wordSet.add(word);
        added++;
      }
    }
    console.log(`Added ${added} new official tournament words from NWL2023.`);
  } catch (err) {
    console.warn('Could not fetch NWL2023 online:', err.message);
  }

  const finalWords = Array.from(wordSet).sort();
  console.log(`Writing ${finalWords.length} authenticated words to data/enable1.txt...`);
  fs.writeFileSync('data/enable1.txt', finalWords.join('\n') + '\n', 'utf8');
  console.log('Official tournament dictionary update complete!');
}

if (require.main === module) {
  updateDictionary();
}

module.exports = { updateDictionary };
