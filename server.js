const express = require('express');
const app = express();
app.set('trust proxy', 1);
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const session = require('express-session');
require('dotenv').config();

const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/exploreworld';

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000
})
.then(() => console.log('Connected to MongoDB successfully'))
.catch(err => console.error('MongoDB connection error:', err));

  // User Schema and Model
const userSchema = new mongoose.Schema({
  name: String,
  username: { type: String, unique: true, lowercase: true },
  email: { type: String, unique: true, lowercase: true },
  phone: String,
  password: String,
  balance: { type: Number, default: 0 },
  deposits: { type: Number, default: 0 },
  bonus: { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
  verificationMethod: String,
  pendingVacations: [Object],
  upcomingVacations: [Object],
  completedVacations: [Object],
  transactions: [Object],
  usageHistory: [Object],
  profilePic: { type: String, default: 'images/default-pic.jpg' },
  pendingDeposits: [Object],
  lastDepositAccepted: Object,
  personalInfo: {
    email: String,
    phone: String,
    address: String
  },
  role: { type: String, default: 'user' }
});

const User = mongoose.model('User', userSchema);



// Token verification middleware
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// Session Setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'NewTravelu11J4vlJYKQFXZNf',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));

// Middleware
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy",
    "default-src 'self'; " +
    "media-src 'self' data:; " +
    "style-src 'self' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; " +
    "img-src 'self' data: https://via.placeholder.com https://*.tile.openstreetmap.org; " +
    "connect-src 'self' https://jsonplaceholder.typicode.com"
  );
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use('/fonts', express.static(path.join(__dirname, 'fonts')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Rate Limiting
const createAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { success: false, message: 'Too many account creation attempts. Please try again later.' }
});
app.use('/api/create-account', createAccountLimiter);

// Multer for File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'images/'),
  filename: (req, file, cb) => {
    const fieldName = file.fieldname;
    cb(null, `${fieldName}-${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage });

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/destinations', (req, res) => res.sendFile(path.join(__dirname, 'destinations.html')));
app.get('/client', (req, res) => res.sendFile(path.join(__dirname, 'client.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/create-account.html', (req, res) => res.sendFile(path.join(__dirname, 'create-account.html')));
app.get('/deposit.html', (req, res) => res.sendFile(path.join(__dirname, 'deposit.html')));
app.get('/partners.html', (req, res) => res.sendFile(path.join(__dirname, 'partners.html')));
app.get('/terms.html', (req, res) => res.sendFile(path.join(__dirname, 'terms.html')));
app.get('/about.html', (req, res) => res.sendFile(path.join(__dirname, 'about.html')));

app.post('/api/create-account', createAccountLimiter, async (req, res) => {
  const { name, username, email, phone, password } = req.body;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

  if (!name || !username || !email || !password) {
    return res.status(400).json({ success: false, message: 'All required fields must be provided' });
  }
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email format' });
  }
  if (!passwordRegex.test(password)) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long and include one uppercase letter, one lowercase letter, and one number' });
  }

  try {
    const existingUser = await User.findOne({
      $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }]
    });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      phone: phone || '',
      password: hashedPassword,
      balance: 0,
      deposits: 0,
      bonus: 0,
      verified: false,
      verificationMethod: '',
      pendingVacations: [],
      upcomingVacations: [],
      completedVacations: [],
      transactions: [],
      usageHistory: [],
      profilePic: 'images/default-pic.jpg',
      pendingDeposits: [],
      lastDepositAccepted: {},
      personalInfo: { email: email.toLowerCase(), phone: phone || 'Not set', address: 'Not set' },
      role: 'user'
    });

    await newUser.save();

    const token = jwt.sign({ username: newUser.username, role: newUser.role }, JWT_SECRET, { expiresIn: '1h' });
    req.session.user = { username: newUser.username, role: newUser.role };
    res.json({ success: true, message: 'Account created', token });
  } catch (err) {
    console.error('Error creating account:', err);
    res.status(500).json({ success: false, message: 'Error creating account' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
      res.status(200).json({
        success: true,
        token,
        user: { ...user.toObject(), password: undefined }
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

app.get('/api/user/:username', verifyToken, async (req, res) => {
  const { username } = req.params;
  if (req.user.username.toLowerCase() !== username.toLowerCase()) {
    return res.status(403).json({ success: false, message: 'Unauthorized access' });
  }
  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (user) {
      const userObj = user.toObject();
      delete userObj.password;
      res.json(userObj);
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/user/:username/update', verifyToken, async (req, res) => {
  const { username } = req.params;
  if (req.user.username.toLowerCase() !== username.toLowerCase()) {
    return res.status(403).json({ success: false, message: 'Unauthorized access' });
  }
  const { deposit, vacation, bonus } = req.body;

  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (deposit) {
      user.balance += deposit;
      user.deposits += deposit;
      user.transactions.push({
        date: new Date().toISOString().split('T')[0],
        type: 'Deposit',
        amount: deposit
      });
      user.usageHistory.push({
        date: new Date().toISOString().split('T')[0],
        action: `Deposited $${deposit}`,
        cost: 0
      });
    }

    if (vacation) {
      if (user.balance < vacation.cost) {
        return res.status(400).json({ success: false, message: 'Insufficient balance' });
      }
      user.balance -= vacation.cost;
      user.pendingVacations.push({
        name: vacation.name,
        cost: vacation.cost,
        date: new Date().toISOString().split('T')[0]
      });
      user.transactions.push({
        date: new Date().toISOString().split('T')[0],
        type: 'Booking',
        amount: vacation.cost
      });
      user.usageHistory.push({
        date: new Date().toISOString().split('T')[0],
        action: `Requested ${vacation.name}`,
        cost: vacation.cost
      });
      user.bonus = (user.bonus || 0) + (bonus || 500);
    }

    await user.save();
    const userObj = user.toObject();
    delete userObj.password;
    res.json({ success: true, user: userObj });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username: username.toLowerCase(), role: 'admin' });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      const token = jwt.sign({ username: user.username, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
      res.json({ success: true, token });
    } else {
      res.json({ success: false, message: 'Invalid admin credentials' });
    }
  } catch (err) {
    console.error('Error during admin login:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get All Users (Admin)
app.get('/api/admin/users', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Unauthorized access' });
  }
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  try {
    const users = await User.find().skip(skip).limit(limit).select('-password');
    const total = await User.countDocuments();
    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Verify User (Admin)
app.post('/api/admin/verify/:username', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Unauthorized' });
  const { username } = req.params;
  const { verified } = req.body;

  try {
    const user = await User.findOneAndUpdate(
      { username: username.toLowerCase() },
      { verified },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update User (Admin)
app.post('/api/admin/update-user/:username', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Unauthorized' });
  const { username } = req.params;
  const updates = req.body;

  try {
    const user = await User.findOneAndUpdate(
      { username: username.toLowerCase() },
      updates,
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Clear Vacations (Admin)
app.post('/api/admin/clear-vacations/:username', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Unauthorized' });
  const { username } = req.params;

  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.pendingVacations = [];
    user.upcomingVacations = [];
    user.completedVacations = [];
    user.transactions = user.transactions.filter(tx => tx.type !== 'Booking');
    user.usageHistory = user.usageHistory.filter(h => !h.action.includes('Requested') && !h.action.includes('Approved') && !h.action.includes('Completed'));

    await user.save();
    const userObj = user.toObject();
    delete userObj.password;
    res.json({ success: true, user: userObj });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Clear Transactions (Admin)
app.post('/api/admin/clear-transactions/:username', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Unauthorized' });
  const { username } = req.params;

  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.transactions = [];
    user.usageHistory = [];

    await user.save();
    const userObj = user.toObject();
    delete userObj.password;
    res.json({ success: true, user: userObj });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Accept Vacation (Admin)
app.post('/api/admin/accept-vacation/:username', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Unauthorized' });
  const { username } = req.params;
  const { vacationIndex } = req.body;

  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user || !user.pendingVacations[vacationIndex]) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    const vacation = user.pendingVacations.splice(vacationIndex, 1)[0];
    user.upcomingVacations.push(vacation);
    user.usageHistory.push({
      date: new Date().toISOString().split('T')[0],
      action: `Approved ${vacation.name}`,
      cost: vacation.cost
    });
    await user.save();
    const userObj = user.toObject();
    delete userObj.password;
    res.json({ success: true, user: userObj });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Complete Vacation (Admin)
app.post('/api/admin/complete-vacation/:username', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Unauthorized' });
  const { username } = req.params;
  const { vacationIndex } = req.body;

  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user || !user.upcomingVacations[vacationIndex]) {
      return res.status(404).json({ success: false, message: 'User or vacation not found' });
    }

    const vacation = user.upcomingVacations.splice(vacationIndex, 1)[0];
    user.completedVacations.push({ ...vacation, completedDate: new Date().toISOString().split('T')[0] });
    user.usageHistory.push({
      date: new Date().toISOString().split('T')[0],
      action: `Completed ${vacation.name}`,
      cost: vacation.cost
    });

    await user.save();
    const userObj = user.toObject();
    delete userObj.password;
    res.json({ success: true, user: userObj });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update Past Vacation (Admin)
app.post('/api/admin/update-past-vacation/:username', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Unauthorized' });
  const { username } = req.params;
  const { index, add, ...updatedVacation } = req.body;

  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (add) {
      user.completedVacations.push(add);
      user.usageHistory.push({
        date: new Date().toISOString().split('T')[0],
        action: `Added past vacation ${add.name}`,
        cost: add.cost
      });
    } else if (index !== undefined && user.completedVacations[index]) {
      Object.assign(user.completedVacations[index], updatedVacation);
      user.usageHistory.push({
        date: new Date().toISOString().split('T')[0],
        action: `Updated past vacation ${updatedVacation.name || user.completedVacations[index].name}`,
        cost: updatedVacation.cost || user.completedVacations[index].cost
      });
    } else {
      return res.status(404).json({ success: false, message: 'Vacation not found' });
    }

    await user.save();
    const userObj = user.toObject();
    delete userObj.password;
    res.json({ success: true, user: userObj });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Clear Users (Admin)
app.post('/api/admin/clear-users', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Unauthorized' });

  try {
    await User.deleteMany({ role: { $ne: 'admin' } });
    res.json({ success: true, message: 'All non-admin users cleared' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Clear Past Vacations (Admin)
app.post('/api/admin/clear-past-vacations/:username', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Unauthorized' });
  const { username } = req.params;

  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.completedVacations = [];
    user.usageHistory = user.usageHistory.filter(h => 
      !h.action.includes('Completed') && 
      !h.action.includes('Added past vacation') && 
      !h.action.includes('Updated past vacation')
    );

    await user.save();
    const userObj = user.toObject();
    delete userObj.password;
    res.json({ success: true, user: userObj });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/deposit/bank', verifyToken, async (req, res) => {
  const { username, amount, payerName } = req.body;
  if (req.user.username.toLowerCase() !== username.toLowerCase()) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user || user.name !== payerName) {
      return res.json({ success: false, message: 'Payer name does not match or user not found' });
    }

    user.pendingDeposits.push({ amount, method: 'Bank', date: new Date().toISOString().split('T')[0], payerName });
    user.usageHistory.push({
      date: new Date().toISOString().split('T')[0],
      action: `Pending Deposit $${amount} via Bank`,
      cost: 0
    });
    await user.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/deposit/crypto', verifyToken, async (req, res) => {
  const { username, amount } = req.body;
  if (req.user.username.toLowerCase() !== username.toLowerCase()) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) return res.json({ success: false, message: 'User not found' });

    user.pendingDeposits.push({ amount, method: 'Crypto', date: new Date().toISOString().split('T')[0] });
    user.usageHistory.push({
      date: new Date().toISOString().split('T')[0],
      action: `Pending Deposit $${amount} via Crypto`,
      cost: 0
    });
    await user.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/deposit/agent', verifyToken, async (req, res) => {
  const { username, amount, transactionId, paymentMethod } = req.body;
  if (req.user.username.toLowerCase() !== username.toLowerCase()) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) return res.json({ success: false, message: 'User not found' });

    user.pendingDeposits.push({ 
      amount, 
      method: 'Agent', 
      date: new Date().toISOString().split('T')[0], 
      transactionId, 
      paymentMethod 
    });
    user.usageHistory.push({
      date: new Date().toISOString().split('T')[0],
      action: `Pending Deposit $${amount} via Agent (${paymentMethod})`,
      cost: 0
    });
    await user.save();

    res.json({ success: true, message: 'Agent deposit submitted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Accept Deposit (Admin)
app.post('/api/admin/accept-deposit/:username', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Unauthorized' });
  const { username } = req.params;
  const { depositIndex } = req.body;

  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user || !user.pendingDeposits[depositIndex]) {
      return res.status(404).json({ success: false, message: 'User or deposit not found' });
    }

    const deposit = user.pendingDeposits.splice(depositIndex, 1)[0];
    user.balance += deposit.amount;
    user.deposits += deposit.amount;
    user.transactions.push({
      date: new Date().toISOString().split('T')[0],
      type: 'Deposit',
      amount: deposit.amount
    });
    user.usageHistory.push({
      date: new Date().toISOString().split('T')[0],
      action: `Approved Deposit $${deposit.amount} via ${deposit.method}`,
      cost: 0
    });
    user.lastDepositAccepted = { amount: deposit.amount, timestamp: new Date().toISOString() };

    await user.save();
    const userObj = user.toObject();
    delete userObj.password;
    res.json({ success: true, user: userObj });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Rate Vacation
app.post('/api/user/:username/rate-vacation', verifyToken, async (req, res) => {
  const { username } = req.params;
  if (req.user.username.toLowerCase() !== username.toLowerCase()) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  const { index, rating, comment } = req.body;

  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user || !user.completedVacations[index]) {
      return res.status(404).json({ success: false, message: 'User or vacation not found' });
    }

    user.completedVacations[index].rating = rating;
    user.completedVacations[index].comment = comment;
    user.usageHistory.push({
      date: new Date().toISOString().split('T')[0],
      action: `Rated ${user.completedVacations[index].name} (${rating}/5)`,
      cost: 0
    });

    await user.save();
    const userObj = user.toObject();
    delete userObj.password;
    res.json({ success: true, user: userObj });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Define the hot destinations file path
const HOT_DESTINATIONS_FILE = path.join(__dirname, 'hotDestinations.json');

// Load hot destinations from hotDestinations.json
function loadHotDestinations() {
  try {
    const data = fs.readFileSync(HOT_DESTINATIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error loading hot destinations:', err);
    return [];
  }
}

// Save hot destinations to hotDestinations.json
function saveHotDestinations(destinations) {
  try {
    fs.writeFileSync(HOT_DESTINATIONS_FILE, JSON.stringify(destinations, null, 2));
  } catch (err) {
    console.error('Error saving hot destinations:', err);
  }
}

// Initialize default hot destinations if the file is empty or doesn't exist
function initHotDestinations() {
    let destinations = loadHotDestinations();
    if (destinations.length === 0) {
      const defaults = [
        { name: "Oslo, Norway", packageName: "Nordic Fjord Expedition", image: "images/oslo.jpg", booked: 120, date: "2025-12-15", deadline: "2025-11-30", bonus: "10% off for couples", cost: 28999, fullyBooked: false },
        { name: "Athens, Greece", packageName: "Hellenic Isles Odyssey", image: "images/athens.jpg", booked: 85, date: "2026-01-20", deadline: "2025-12-20", bonus: "Free upgrade to deluxe package", cost: 27999, fullyBooked: false },
        { name: "Kyoto, Japan", packageName: "Japanese Zen Journey", image: "images/kyoto.jpg", booked: 200, date: "2025-06-10", deadline: "2025-05-10", bonus: "Complimentary spa day", cost: 27999, fullyBooked: true },
        { name: "Beijing, China", packageName: "Silk Road & Sea Adventure", image: "images/beijing.jpg", booked: 150, date: "2025-09-05", deadline: "2025-08-05", bonus: "Exclusive cultural tour", cost: 22999, fullyBooked: false }
      ];
      saveHotDestinations(defaults);
    }
  }
  
  // Run initialization on server start
  initHotDestinations();
  
  // Get hot destinations
  app.get('/api/hot-destinations', (req, res) => {
    try {
      const destinations = loadHotDestinations();
      res.json(destinations);
    } catch (err) {
      console.error('Error fetching hot destinations:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });
  
  // Update hot destination (admin only)
  app.post('/api/admin/update-hot-destination', verifyToken, (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized access' });
    }
    const { name, fullyBooked } = req.body;
  
    let destinations = loadHotDestinations();
    const destinationIndex = destinations.findIndex(d => d.name === name);
    if (destinationIndex === -1) {
      return res.status(404).json({ success: false, message: 'Destination not found' });
    }
  
    destinations[destinationIndex].fullyBooked = fullyBooked;
    saveHotDestinations(destinations);
  
    res.json({ success: true, hotDestinations: destinations });
  });

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Endpoint not found' });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

module.exports = app;