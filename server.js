// server.js
require('dotenv').config(); // โหลด environment variables จาก .env

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

// Dependencies สำหรับ Passport และ Session
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();
const PORT = process.env.PORT || 3000;

// ตั้งค่า dev mode จาก environment variable (กำหนดใน .env ด้วย DEVMODE=true หรือ false)
const devmode = process.env.DEVMODE === 'true';

// ตั้งค่า express-session โดยใช้ SESSION_SECRET จาก environment
app.use(session({
  secret: process.env.SESSION_SECRET, // ใช้ค่า secret จาก .env
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // สำหรับ HTTP ในการพัฒนา
}));

// ตั้งค่า Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// ตั้งค่า Passport Serialization/Deserialization พร้อม log
passport.serializeUser((user, done) => {
  console.log('Serializing user:', user.id || user.displayName);
  done(null, user);
});
passport.deserializeUser((user, done) => {
  console.log('Deserializing user:', user.id || user.displayName);
  done(null, user);
});

// ตั้งค่า Google OAuth Strategy โดยใช้ environment variables สำหรับ Client ID/Secret
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

// ใช้ middleware สำหรับ parse JSON
app.use(bodyParser.json());

// เซิร์ฟไฟล์ static จากโฟลเดอร์ public
app.use(express.static(path.join(__dirname, 'public')));

// ------------------------
// API สำหรับ save/load (เหมือนเดิม)
// ------------------------
app.post('/save', (req, res) => {
  const data = req.body;
  const saveFolder = path.join(__dirname, 'save');
  if (!fs.existsSync(saveFolder)) {
    fs.mkdirSync(saveFolder, { recursive: true });
  }
  const filePath = path.join(saveFolder, 'accounts.json');
  fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
    if (err) {
      console.error('Error saving file:', err);
      return res.status(500).json({ error: 'Failed to save data.' });
    }
    res.json({ message: 'Data saved successfully.' });
  });
});

app.get('/load', (req, res) => {
  const filePath = path.join(__dirname, 'save', 'accounts.json');
  if (fs.existsSync(filePath)) {
    fs.readFile(filePath, 'utf8', (err, fileData) => {
      if (err) {
        console.error('Error reading file:', err);
        return res.status(500).json({ error: 'Failed to load data.' });
      }
      try {
        const data = JSON.parse(fileData);
        res.json(data);
      } catch (parseErr) {
        console.error('Error parsing JSON:', parseErr);
        res.status(500).json({ error: 'Invalid data format.' });
      }
    });
  } else {
    res.json({ accounts: [] });
  }
});

// ------------------------
// Routes สำหรับ Google OAuth
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
  // หากอยู่ใน dev mode ให้ผ่านการตรวจสอบได้เลย
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

// Route หน้า home (ตรวจสอบว่าผู้ใช้ login แล้ว)
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
  // หากอยู่ใน dev mode ให้ถือว่า login แล้ว
  if (devmode || req.isAuthenticated()) {
    res.json({ loggedIn: true, user: req.user || { displayName: 'Admin (dev)' } });
  } else {
    res.json({ loggedIn: false });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
