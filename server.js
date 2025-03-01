// server.js
require('dotenv').config(); // โหลด environment variables จาก .env

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { MongoClient } = require('mongodb');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const devmode = process.env.DEVMODE === 'true';

const MongoStore = require('connect-mongo');

let cachedListings = null;
let lastListingsCall = 0; // timestamp ในหน่วยมิลลิวินาที

// ตั้งค่า express-session
// ตั้งค่า express-session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    // ตัวเลือกเพิ่มเติม
    collectionName: 'sessions'
  }),
  // กำหนด cookie ให้มีอายุ 30 วัน (30*24*60*60*1000 = 2592000000 มิลลิวินาที)
  cookie: { 
    maxAge: 30 * 24 * 60 * 60 * 1000,
    // ถ้าต้องการให้ใช้ secure cookie ใน production ให้เปิดใช้งาน secure: true
    // secure: process.env.NODE_ENV === 'production'
  },
  // ใช้ rolling เพื่อรีเซ็ตเวลา cookie ทุกครั้งที่มี request เข้ามา
  rolling: true
}));


// ตั้งค่า Passport
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  console.log('Serializing user:', user.id || user.displayName);
  done(null, user);
});
passport.deserializeUser((user, done) => {
  console.log('Deserializing user:', user.id || user.displayName);
  done(null, user);
});

// ตั้งค่า Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,       
    clientSecret: process.env.GOOGLE_CLIENT_SECRET, 
    callbackURL: '/auth/google/callback'
  },
  (accessToken, refreshToken, profile, done) => {
    console.log('Google strategy callback invoked.');
    console.log('Profile received:', profile);
    return done(null, profile);
  }
));

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- MongoDB Connection Caching ---
let cachedClient = null;
async function getClient() {
  if (cachedClient) {
    return cachedClient;
  }
  cachedClient = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  await cachedClient.connect();
  return cachedClient;
}

// ------------------------
// Caching FNG Data (อัปเดตเพียง 1 ครั้งต่อวัน)
// ------------------------

// สำหรับ historical data
let cachedFngHistorical = null;
let lastFngHistoricalUpdateTime = null;
async function updateFngHistoricalData() {
  try {
    const response = await axios.get(process.env.CMC_FNG_HISTORICAL_URL, {
      headers: {
        'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY,
        'Accept': 'application/json'
      },
      params: { limit: 50 }
    });
    cachedFngHistorical = response.data;
    lastFngHistoricalUpdateTime = new Date();
    console.log("Updated FNG historical data at", lastFngHistoricalUpdateTime);
  } catch (error) {
    console.error("Error updating FNG historical data:", error);
  }
}

// สำหรับ latest data
let cachedFngLatest = null;
let lastFngLatestUpdateTime = null;
async function updateFngLatestData() {
  try {
    const response = await axios.get(process.env.CMC_FNG_LATEST_URL, {
      headers: {
        'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY,
        'Accept': 'application/json'
      }
    });
    cachedFngLatest = response.data;
    lastFngLatestUpdateTime = new Date();
    console.log("Updated FNG latest data at", lastFngLatestUpdateTime);
  } catch (error) {
    console.error("Error updating FNG latest data:", error);
  }
}

// ------------------------
// API Endpoints สำหรับ save/load โดยใช้ MongoDB
// ------------------------
app.post('/save', async (req, res) => {
  if (!devmode && !req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }
  const googleId = req.user ? req.user.id : 'devUser';
  const accountsData = req.body.accounts;
  try {
    const client = await getClient();
    const db = client.db("finance");
    const collection = db.collection("accounts");
    const filter = { googleId: googleId };
    const update = { $set: { accounts: accountsData, updatedAt: new Date() } };
    const options = { upsert: true };
    await collection.updateOne(filter, update, options);
    console.log(`Data saved for user ${googleId}`);
    res.json({ message: 'Data saved successfully.' });
  } catch (err) {
    console.error("Error saving to DB:", err);
    res.status(500).json({ error: 'Failed to save data.' });
  }
});

app.get('/load', async (req, res) => {
  if (!devmode && !req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }
  const googleId = req.user ? req.user.id : 'devUser';
  try {
    const client = await getClient();
    const db = client.db("finance");
    const collection = db.collection("accounts");
    const doc = await collection.findOne({ googleId: googleId });
    if (doc) {
      res.json({ accounts: doc.accounts });
    } else {
      res.json({ accounts: [] });
    }
  } catch (err) {
    console.error("Error loading from DB:", err);
    res.status(500).json({ error: 'Failed to load data.' });
  }
});

// ------------------------
// Endpoint สำหรับดึงข้อมูล Coin Listings จาก CoinMarketCap
// ------------------------
app.get('/cmc/listings', async (req, res) => {
  try {
    const oneHour = 3600000; // 1 ชั่วโมง = 3600000 มิลลิวินาที
    const now = Date.now();
    // ถ้ามี cache และเวลาที่ผ่านไปยังไม่เกิน 1 ชั่วโมง
    if (cachedListings && (now - lastListingsCall < oneHour)) {
      console.log("Returning cached coin listings.");
      return res.json(cachedListings);
    }
    // ถ้าไม่มี cache หรือ cache หมดอายุ ให้เรียก API ใหม่
    const response = await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest', {
      params: {
        start: 1,
        limit: 100, // ปรับจำนวนรายการได้ตามต้องการ
        convert: 'USD'
      },
      headers: {
        'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY,
        'Accept': 'application/json'
      }
    });
    // อัปเดต cache
    cachedListings = response.data;
    lastListingsCall = now;
    console.log("Fetched new coin listings from CoinMarketCap.");
    res.json(cachedListings);
  } catch (error) {
    console.error("Error fetching coin listings:", error);
    res.status(500).json({ error: 'Failed to fetch coin listings' });
  }
});


// ------------------------
// Routes สำหรับ Google OAuth และหน้าอื่นๆ
// ------------------------
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    console.log('Google authentication successful.');
    res.redirect('/');
  }
);

app.get('/logout', (req, res) => {
  req.logout(() => {
    console.log('User logged out.');
    res.redirect('/');
  });
});

function isLoggedIn(req, res, next) {
  console.log('isAuthenticated:', req.isAuthenticated());
  if (devmode || req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

app.get('/login', (req, res) => {
  res.send(`
    <h1>Login</h1>
    <a href="/auth/google">Login with Google</a>
  `);
});

app.get('/', isLoggedIn, (req, res) => {
  console.log('User is authenticated. Rendering home page.');
  console.log('req.user:', req.user);
  res.send(`
    <h1>Welcome ${req.user ? req.user.displayName : 'Admin (dev)'}!</h1>
    <p>Email: ${req.user && req.user.emails ? req.user.emails[0].value : 'N/A'}</p>
    <a href="/logout">Logout</a>
    <br/><br/>
    <a href="/index.html">Go to Portfolio App</a>
  `);
});

app.get('/user', (req, res) => {
  if (devmode || req.isAuthenticated()) {
    res.json({ loggedIn: true, user: req.user || { displayName: 'Admin (dev)' } });
  } else {
    res.json({ loggedIn: false });
  }
});

// ------------------------
// Endpoint สำหรับดึงข้อมูล FNG (รวม Latest และ Historical)
// ------------------------
app.get('/fng', async (req, res) => {
  try {
    const now = new Date();
    if (!lastFngHistoricalUpdateTime || (now - lastFngHistoricalUpdateTime) >= 86400000) {
      await updateFngHistoricalData();
    }
    if (!lastFngLatestUpdateTime || (now - lastFngLatestUpdateTime) >= 86400000) {
      await updateFngLatestData();
    }
    if (cachedFngLatest && cachedFngHistorical) {
      res.json({
        latest: cachedFngLatest,
        historical: cachedFngHistorical
      });
    } else {
      res.status(500).json({ error: 'No FNG data available.' });
    }
  } catch (error) {
    console.error("Error in /fng endpoint:", error);
    res.status(500).json({ error: 'Failed to retrieve FNG data.' });
  }
});

async function autoLoadDataFromServer() {
  if (!devmode && !loggedIn) return;
  if (isLoadingData) return;

  isLoadingData = true;
  showLoading(true);

  try {
    const res = await fetch('/load');
    
    if (res.status === 401) {
      // ผู้ใช้ไม่ได้รับอนุญาต -> redirect หรือโชว์ modal
      window.location.href = '/login';
      return; // หรือ return เพื่อหยุดการทำงานต่อ
    }

    if (!res.ok) {
      throw new Error("Server load failed with status " + res.status);
    }
    
    const data = await res.json();
    accounts = data.accounts || [];
    saveAccountsLocal();
    await fetchExchangeRates();
    renderAccounts();
    updateTotals();
    logActivity('Data auto-loaded from server');
    showToast('Data loaded successfully from server!', 'success');
  } catch (error) {
    console.error('Auto-load error:', error);
    showToast('Error loading data.', 'error');
  }

  showLoading(false);
  isLoadingData = false;
}

// GOLD
// ========== ตัวแปรและค่าคงที่สำหรับคำนวณทอง ==========
let cachedGoldData = null; // เก็บผลลัพธ์ทั้งหมด (ราคาต่อ oz, ต่อบาท, etc.)
let lastGoldFetchTime = 0;
const CACHE_LIFETIME = 4 * 60 * 60 * 1000; // 4 ชั่วโมง

// น้ำหนัก
const GRAMS_PER_TROY_OUNCE = 31.1034768;
const GRAMS_PER_BAHT_GOLD  = 15.244;
const TROY_OZ_PER_BAHT     = GRAMS_PER_BAHT_GOLD / GRAMS_PER_TROY_OUNCE; // ~0.490105993

/**
 * Endpoint: /goldprice
 *  - ถ้า cache ยังไม่หมดอายุ (4 ชม.) -> ส่งจาก cache
 *  - เกิน 4 ชม. -> เรียก CurrencyLayer แล้วคำนวณ
 */
app.get('/goldprice', async (req, res) => {
  const now = Date.now();

  // 1) เช็ค cache
  if (cachedGoldData && (now - lastGoldFetchTime < CACHE_LIFETIME)) {
    return res.json({
      ...cachedGoldData,
      lastUpdate: new Date(lastGoldFetchTime).toISOString(),
      source: 'cache'
    });
  }

  // 2) ถ้าไม่มี cache หรือเกิน 4 ชม. -> เรียก API ใหม่
  try {
    // ขอกับ apilayer.net/api/live โดยจะขอ currencies = XAU,THB
    const response = await axios.get('http://apilayer.net/api/live', {
      params: {
        access_key: process.env.Free_Forex_API,  // ใส่ key ของคุณในไฟล์ .env
        currencies: 'XAU,THB',
        source: 'USD',
        format: 1
      }
    });
    // ตัวอย่าง quotes: { "USDXAU": 0.00056..., "USDTHB": 34.12... }
    const quotes = response.data.quotes;
    if (!quotes || !quotes.USDXAU || !quotes.USDTHB) {
      return res.status(500).json({ error: 'API response invalid' });
    }

    // 1 USD = quotes.USDXAU XAU -> 1 XAU = 1 / quotes.USDXAU USD
    const goldPricePerOzUSD = 1 / quotes.USDXAU;
    // ถ้ารู้ 1 USD = quotes.USDTHB THB => 1 XAU = goldPricePerOzUSD * quotes.USDTHB (THB/oz)
    const goldPricePerOzTHB = goldPricePerOzUSD * quotes.USDTHB;
    
    // คำนวณราคา "1 บาททอง" ในหน่วย USD และ THB
    // 1 บาททอง ~ 0.490105993 oz
    const goldPricePerBahtUSD = goldPricePerOzUSD * TROY_OZ_PER_BAHT;
    const goldPricePerBahtTHB = goldPricePerOzTHB * TROY_OZ_PER_BAHT;
    
    // เก็บใน cache
    cachedGoldData = {
      goldPricePerOzUSD,
      goldPricePerOzTHB,
      goldPricePerBahtUSD,
      goldPricePerBahtTHB
    };
    lastGoldFetchTime = now;

    return res.json({
      ...cachedGoldData,
      lastUpdate: new Date(now).toISOString(),
      source: 'api'
    });
  } catch (error) {
    console.error('Error fetching gold price:', error);
    return res.status(500).json({ error: 'Failed to fetch gold price.' });
  }
});






app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
