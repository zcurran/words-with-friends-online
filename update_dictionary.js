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
  console.log('Reading existing enable1.txt...');
  let existingContent = '';
  try {
    existingContent = fs.readFileSync('data/enable1.txt', 'utf8');
  } catch (e) {
    console.log('Could not read existing enable1.txt, proceeding without it.');
  }

  const existingWords = existingContent.split(/\r?\n/).map(w => w.trim().toUpperCase()).filter(w => w.length >= 2);
  const wordSet = new Set(existingWords);
  console.log(`Current dictionary has ${wordSet.size} words.`);

  console.log('Downloading comprehensive English dictionary (dwyl/english-words)...');
  try {
    const newData = await download('https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt');
    const newWords = newData.split(/\r?\n/).map(w => w.trim().toUpperCase()).filter(w => w.length >= 2);
    
    let added = 0;
    for (const word of newWords) {
      if (!wordSet.has(word)) {
        wordSet.add(word);
        added++;
      }
    }
    
    console.log(`Downloaded dictionary. Added ${added} new valid words.`);
    
    const finalWords = Array.from(wordSet).sort();
    console.log(`Writing ${finalWords.length} total words to data/enable1.txt...`);
    fs.writeFileSync('data/enable1.txt', finalWords.join('\n'), 'utf8');
    console.log('Dictionary update complete!');
  } catch (error) {
    console.error('Error downloading or writing dictionary:', error);
  }
}

updateDictionary();
