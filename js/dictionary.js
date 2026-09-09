// Words with Friends / Scrabble Dictionary Engine
class GameDictionary {
  constructor() {
    this.words = new Set();
    this.trie = {};
    this.loaded = false;
    this.loadingPromise = null;
    // Load embedded words immediately so it works synchronously without waiting for network
    this.loadEmbeddedWords();
  }

  // Insert a word into the set and prefix trie
  insert(word) {
    const w = word.trim().toUpperCase();
    if (w.length < 2) return;
    this.words.add(w);

    let node = this.trie;
    for (let i = 0; i < w.length; i++) {
      const ch = w[i];
      if (!node[ch]) node[ch] = {};
      node = node[ch];
    }
    node['$'] = true; // End-of-word marker
  }

  // Check if an exact word is valid
  isValid(word) {
    if (!word) return false;
    const w = word.trim().toUpperCase();
    return this.words.has(w);
  }

  // Check if a prefix exists in the trie (used by AI solver)
  hasPrefix(prefix) {
    if (!prefix) return true;
    const p = prefix.trim().toUpperCase();
    let node = this.trie;
    for (let i = 0; i < p.length; i++) {
      const ch = p[i];
      if (!node[ch]) return false;
      node = node[ch];
    }
    return true;
  }

  // Load from enable1.txt in background
  async init(url = 'data/enable1.txt') {
    if (this.loaded) return true;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Fetch status: ' + response.status);
        const text = await response.text();
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const w = lines[i].trim();
          if (w.length >= 2) {
            this.insert(w);
          }
        }
        this.loaded = true;
        console.log('[Dictionary] Loaded ' + this.words.size + ' words from ' + url);
        return true;
      } catch (err) {
        console.warn('[Dictionary] Using embedded dictionary (' + err.message + ')');
        this.loaded = true;
        return true;
      }
    })();

    return this.loadingPromise;
  }

  loadEmbeddedWords() {
    const commonWords = [
      "AA","AB","AD","AE","AG","AH","AI","AL","AM","AN","AR","AS","AT","AW","AX","AY","BA","BE","BI","BO","BY",
      "DA","DE","DO","ED","EF","EH","EL","EM","EN","ER","ES","ET","EW","EX","FA","FE","GI","GO","HA","HE","HI",
      "HM","HO","ID","IF","IN","IS","IT","JO","KA","KI","LA","LI","LO","MA","ME","MI","MM","MO","MU","MY","NA",
      "NE","NO","NU","OD","OE","OF","OH","OI","OK","OM","ON","OP","OR","OS","OW","OX","OY","PA","PE","PI","PO",
      "QI","RE","SH","SI","SO","TA","TE","TI","TO","UH","UM","UN","UP","US","UT","WE","WO","XI","XU","YA","YE","YO","ZA",
      "CAT","DOG","THE","AND","FOR","ARE","BUT","NOT","YOU","ALL","ANY","CAN","HAD","HER","WAS","ONE","OUR","OUT","DAY",
      "GET","HAS","HIM","HIS","HOW","MAN","NEW","NOW","OLD","SEE","TWO","WAY","WHO","BOY","DID","ITS","LET","PUT","SAY",
      "SHE","TOO","USE","WORD","PLAY","GAME","TILE","BOARD","FRIEND","SCORE","TRIPLE","DOUBLE","LETTER","BONUS","START",
      "WINNER","POINTS","RACK","PLAYER","PLAYERS","TURN","SOLARIS","SENA","ANT","BEE","CAR","DUCK","EAGLE","FOX","GOAT","HAWK",
      "IBIS","JAY","KOALA","LION","MOOSE","NEWT","OWL","PIG","QUAIL","ROBIN","SWAN","TIGER","URCHIN","VIPER","WOLF",
      "YAK","ZEBRA","ABOUT","ABOVE","ACTOR","ACUTE","ADMIT","ADOPT","ADULT","AFTER","AGAIN","AGENT","AGREE","AHEAD",
      "ALARM","ALBUM","ALERT","ALIKE","ALIVE","ALLOW","ALONE","ALONG","ALTER","AMONG","ANGER","ANGLE","ANGRY","APART",
      "APPLE","APPLY","ARENA","ARGUE","ARISE","ARRAY","ASIDE","ASSET","AUDIO","AUDIT","AVOID","AWAIT","AWAKE","AWARD",
      "AWARE","BADLY","BAKER","BASES","BASIC","BASIS","BEACH","BEGAN","BEGIN","BEGUN","BEING","BELOW","BENCH","BILLY",
      "BIRTH","BLACK","BLAME","BLIND","BLOCK","BLOOD","BOARD","BOOST","BOOTH","BOUND","BRAIN","BRAND","BREAD","BREAK",
      "BREED","BRIEF","BRING","BROAD","BROKE","BROWN","BUILD","BUILT","BUYER","CABLE","CALIF","CARRY","CATCH","CAUSE",
      "CHAIN","CHAIR","CHART","CHASE","CHEAP","CHECK","CHEST","CHIEF","CHILD","CHINA","CHOSE","CIVIL","CLAIM","CLASS",
      "CLEAN","CLEAR","CLICK","CLOCK","CLOSE","COACH","COAST","COULD","COUNT","COURT","COVER","CRAFT","CRANE","CRAZY",
      "CREAM","CRIME","CROSS","CROWD","CROWN","CURVE","CYCLE","DAILY","DANCE","DATED","DEALT","DEATH","DEBUT","DELAY",
      "DEPTH","DOING","DOUBT","DOZEN","DRAFT","DRAMA","DRAWN","DREAM","DRESS","DRILL","DRINK","DRIVE","DROVE","DYING",
      "EAGER","EARLY","EARTH","EIGHT","ELITE","EMPTY","ENEMY","ENJOY","ENTER","ENTRY","EQUAL","ERROR","EVENT","EVERY",
      "EXACT","EXIST","EXTRA","FAITH","FALSE","FAULT","FIBER","FIELD","FIFTH","FIFTY","FIGHT","FINAL","FIRST","FIXED",
      "FLASH","FLEET","FLOOR","FLUID","FOCUS","FORCE","FORTH","FORTY","FORUM","FOUND","FRAME","FRANK","FRAUD","FRESH",
      "FRONT","FRUIT","FULLY","FUNNY","GIANT","GIVEN","GLASS","GLOBE","GOING","GRACE","GRADE","GRAND","GRANT","GRASS",
      "GREAT","GREEN","GROSS","GROUP","GROWN","GUARD","GUESS","GUEST","GUIDE","HAPPY","HARRY","HEART","HEAVY","HENCE",
      "HENRY","HORSE","HOTEL","HOUSE","HUMAN","IDEAL","IMAGE","INDEX","INNER","INPUT","ISSUE","JAPAN","JIMMY","JOINT",
      "JONES","JUDGE","KNOWN","LABEL","LARGE","LASER","LATER","LAUGH","LAYER","LEARN","LEASE","LEAST","LEAVE","LEGAL",
      "LEVEL","LEWIS","LIGHT","LIMIT","LINKS","LIVES","LOCAL","LOGIC","LOOSE","LOWER","LUCKY","LUNCH","LYING","MAGIC",
      "MAJOR","MAKER","MARCH","MARIA","MATCH","MAYBE","MAYOR","MEANT","MEDIA","METAL","MIGHT","MINOR","MINUS","MIXED",
      "MODEL","MONEY","MONTH","MORAL","MOTOR","MOUNT","MOUSE","MOUTH","MOVIE","MUSIC","NEEDS","NEVER","NIGHT","NOISE",
      "NORTH","NOTED","NOVEL","NURSE","OCCUR","OCEAN","OFFER","OFTEN","ORDER","OTHER","OUGHT","PAINT","PANEL","PAPER",
      "PARTY","PEACE","PETER","PHASE","PHONE","PHOTO","PIECE","PILOT","PITCH","PLACE","PLAIN","PLANE","PLANT","PLATE",
      "POINT","POUND","POWER","PRESS","PRICE","PRIDE","PRIME","PRINT","PRIOR","PRIZE","PROOF","PROUD","PROVE","QUEEN",
      "QUICK","QUIET","QUITE","RADIO","RAISE","RANGE","RAPID","RATIO","REACH","READY","REFER","RIGHT","RIVAL","RIVER",
      "ROBIN","ROGER","ROMAN","ROUGH","ROUND","ROUTE","ROYAL","RURAL","SCALE","SCENE","SCOPE","SCORE","SENSE","SERVE",
      "SEVEN","SHALL","SHAPE","SHARE","SHARP","SHEET","SHELF","SHELL","SHIFT","SHIRT","SHOCK","SHOOT","SHORT","SHOWN",
      "SIGHT","SINCE","SIXTH","SIXTY","SIZED","SKILL","SLEEP","SLIDE","SMALL","SMART","SMILE","SMITH","SMOKE","SOLID",
      "SOLVE","SORRY","SOUND","SOUTH","SPACE","SPARE","SPEAK","SPEED","SPEND","SPENT","SPLIT","SPOKE","SPORT","STAFF",
      "STAGE","STAKE","STAND","START","STATE","STEAM","STEEL","STICK","STILL","STOCK","STONE","STOOD","STORE","STORM",
      "STORY","STRIP","STUCK","STUDY","STUFF","STYLE","SUGAR","SUITE","SUPER","SWEET","TABLE","TAKEN","TASTE","TAXES",
      "TEACH","TEETH","TERRY","TEXAS","THANK","THEFT","THEIR","THEME","THERE","THESE","THICK","THING","THINK","THIRD",
      "THOSE","THREE","THREW","THROW","TIGHT","TIMES","TIRED","TITLE","TODAY","TOPIC","TOTAL","TOUCH","TOUGH","TOWER",
      "TRACK","TRADE","TRAIN","TREAT","TREND","TRIAL","TRIED","TRIES","TRUCK","TRULY","TRUST","TRUTH","TWICE","UNDER",
      "UNDUE","UNION","UNITY","UNTIL","UPPER","UPSET","URBAN","USAGE","USUAL","VALID","VALUE","VIDEO","VIRUS","VISIT",
      "VITAL","VOICE","WASTE","WATCH","WATER","WHEEL","WHERE","WHICH","WHILE","WHITE","WHOLE","WHOSE","WOMAN","WOMEN",
      "WORLD","WORRY","WORSE","WORST","WORTH","WOULD","WOUND","WRITE","WRONG","WROTE","YIELD","YOUNG","YOUTH","ZERO"
    ];
    for (const w of commonWords) {
      this.insert(w);
    }
  }
}

const DICTIONARY = new GameDictionary();
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GameDictionary, DICTIONARY };
}
