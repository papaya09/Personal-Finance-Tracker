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

// ตั้งค่า express-session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
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
// ใช้ข้อมูล cache ที่อัปเดตได้เพียงครั้งเดียวต่อวัน
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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
