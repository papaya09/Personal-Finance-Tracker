// server.js
require('dotenv').config(); // โหลด environment variables จาก .env

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { MongoClient } = require('mongodb'); // Import MongoDB driver

const app = express();
const PORT = process.env.PORT || 3000;
const devmode = process.env.DEVMODE === 'true';

// ตั้งค่า express-session โดยใช้ SESSION_SECRET จาก environment
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // สำหรับ HTTP ในการพัฒนา
}));

// ตั้งค่า Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Passport Serialization/Deserialization
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

// --- MongoDB Connection Caching --- //
let cachedClient = null;
async function getClient() {
  if (cachedClient && cachedClient.isConnected && cachedClient.isConnected()) {
    return cachedClient;
  }
  cachedClient = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  await cachedClient.connect();
  return cachedClient;
}

// --- API Endpoints สำหรับ save/load โดยใช้ MongoDB --- //

// Save Endpoint: บันทึกข้อมูล accounts ลงใน MongoDB
app.post('/save', async (req, res) => {
  // ตรวจสอบว่าผู้ใช้ได้ล็อกอิน (ถ้าไม่ได้อยู่ใน dev mode)
  if (!devmode && !req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }
  // ใช้ Google ID จาก req.user หรือใช้ค่า fallback สำหรับ dev mode
  const googleId = req.user ? req.user.id : 'devUser';
  const accountsData = req.body.accounts;
  try {
    const client = await getClient();
    const db = client.db("finance");
    const collection = db.collection("accounts");
    // อัปเดต (หรือแทรก) document ที่มี googleId ตรงกัน
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

// Load Endpoint: โหลดข้อมูล accounts ของผู้ใช้จาก MongoDB
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

// เริ่มต้นการ login ด้วย Google
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Callback หลังจาก Google login
app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    console.log('Google authentication successful.');
    res.redirect('/');
  }
);

// Route สำหรับ logout
app.get('/logout', (req, res) => {
  req.logout(() => {
    console.log('User logged out.');
    res.redirect('/');
  });
});

// Middleware ตรวจสอบการเข้าสู่ระบบ
function isLoggedIn(req, res, next) {
  console.log('isAuthenticated:', req.isAuthenticated());
  if (devmode || req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

// Route สำหรับหน้า login
app.get('/login', (req, res) => {
  res.send(`
    <h1>Login</h1>
    <a href="/auth/google">Login with Google</a>
  `);
});

// Route หน้า home (ตรวจสอบว่าผู้ใช้ได้ login แล้ว)
app.get('/', isLoggedIn, (req, res) => {
  console.log('User is authenticated. Rendering home page.');
  console.log('req.user:', req.user);
  res.send(`
    <h1>Welcome ${req.user ? req.user.displayName : 'Admin (dev)'}</h1>
    <p>Email: ${req.user && req.user.emails ? req.user.emails[0].value : 'N/A'}</p>
    <a href="/logout">Logout</a>
    <br/><br/>
    <a href="/index.html">Go to Portfolio App</a>
  `);
});

// Endpoint สำหรับตรวจสอบสถานะผู้ใช้
app.get('/user', (req, res) => {
  if (devmode || req.isAuthenticated()) {
    res.json({ loggedIn: true, user: req.user || { displayName: 'Admin (dev)' } });
  } else {
    res.json({ loggedIn: false });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
