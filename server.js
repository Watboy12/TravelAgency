const express = require('express');
const app = express();
app.set('trust proxy', 1);
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const session = require('express-session');
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('JWT_SECRET is missing in environment variables');
  // Optional: crash early so you see it clearly in logs
  // process.exit(1);
}

// lib/supabase.js (or wherever your client is created)
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;  // ← new key

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase URL or Service Role Key');
}

// Create admin client with service_role key (bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

module.exports = { supabaseAdmin };  // Export the admin client



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


app.post('/api/create-account', createAccountLimiter, async (req, res) => {
  const { name, username, email, phone, password } = req.body;

  // Validation (unchanged)
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
    console.log('Proxying create-account request for:', username);

    const functionUrl = 'https://yktgsxfpvmloocrlvuhb.supabase.co/functions/v1/create-user-profile';

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ name, username, email, phone, password })
    });

    const data = await response.json();

    console.log('Edge function returned:', { status: response.status, data });

    if (!response.ok || !data.success) {
      return res.status(response.status || 500).json(data || { message: 'Edge function failed' });
    }

    // IMPORTANT: Fetch the newly created profile so we have the correct username
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (profileError || !profile) {
      console.error('Failed to fetch new profile after signup:', profileError?.message);
      // Continue anyway – we can still use the provided username
    }

    const finalUsername = profile?.username || username.toLowerCase().trim();

    // Generate secure JWT token for immediate login after signup
    const token = jwt.sign(
      {
        username: finalUsername,
        role: 'user'  // default role – you can change later
      },
      JWT_SECRET,
      { expiresIn: '1h' }  // token valid for 1 hour
    );

    // Return success + token + basic user info
    res.json({
      success: true,
      message: 'Account created successfully',
      token,
      user: {
        username: finalUsername,
        email: email.toLowerCase().trim(),
        name: name.trim()
      }
    });

  } catch (err) {
    console.error('Signup proxy error:', err.message, err.stack);
    res.status(500).json({ success: false, message: 'Server error during account creation' });
  }
});

app.post('/api/login', async (req, res) => {
  let { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Email/Username and password are required' });
  }

  username = username.trim().toLowerCase();

  try {
    // Step 1: Determine if input is email or username
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username);

    let user;

    if (isEmail) {
      // Login with email
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email: username,
        password,
      });

      if (error || !data.user || !data.session) {
        console.error('Supabase email login error:', error?.message);
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      user = data.user;
    } else {
      // Login with username → first find email from profiles
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('username', username)
        .single();

      if (profileError || !profile?.email) {
        console.error('Username not found or no email:', profileError?.message);
        return res.status(401).json({ success: false, message: 'Invalid username or password' });
      }

      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email: profile.email,
        password,
      });

      if (error || !data.user || !data.session) {
        console.error('Supabase username login error:', error?.message);
        return res.status(401).json({ success: false, message: 'Invalid username or password' });
      }

      user = data.user;
    }

    // Step 2: Fetch full profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError?.message);
      // Continue without profile data
    }

    // Step 3: Create JWT with consistent username
    const tokenUsername = profile?.username || username;

    const token = jwt.sign(
      {
        username: tokenUsername,
        userId: user.id,
        role: profile?.role || 'user'
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Step 4: Return success
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: profile?.full_name || 'User',
        username: tokenUsername,
        role: profile?.role || 'user',
        balance: profile?.balance || 0,
        bonus: profile?.bonus || 0,
        verified: profile?.verified || false
      }
    });

  } catch (err) {
    console.error('Login server error:', err.message, err.stack);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

app.get('/api/user/:username', verifyToken, async (req, res) => {
  const { username } = req.params;

  // Security: only allow users to fetch their own profile
  if (req.user.username.toLowerCase().trim() !== username.toLowerCase().trim()) {
  return res.status(403).json({ success: false, message: 'Unauthorized access' });
}

  try {
    // Fetch profile from Supabase 'profiles' table
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')                          // gets name, balance, bonus, verified, pendingDeposits, etc.
      .eq('username', username.toLowerCase().trim())
      .single();                            // expect one matching row

    if (error || !profile) {
      console.error('Supabase profile error:', error?.message || 'No profile found');
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    // Safety: remove any sensitive field (you don't have password)
    const safeProfile = {
      ...profile,
      password: undefined
    };

    res.json(safeProfile);

  } catch (err) {
    console.error('Error in /api/user route:', err.message, err.stack);
    res.status(500).json({ success: false, message: 'Server error while loading profile' });
  }
});

app.post('/api/user/:username/update', verifyToken, async (req, res) => {
  const { username } = req.params;

  // Security check
  if (req.user.username.toLowerCase().trim() !== username.toLowerCase().trim()) {
    return res.status(403).json({ success: false, message: 'Unauthorized access' });
  }

  const { deposit, vacation, bonus } = req.body;

  try {
    // Fetch current profile
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('username', username.toLowerCase().trim())
      .single();

    if (fetchError || !profile) {
      console.error('Profile fetch error:', fetchError?.message);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let updates = { ...profile }; // We'll build changes here

    // Handle deposit (if any)
    if (deposit) {
      const depositAmount = Number(deposit);
      updates.balance = (profile.balance || 0) + depositAmount;
      updates.deposits = (profile.deposits || 0) + depositAmount;

      // Optional: record transaction
      const newTx = {
        date: new Date().toISOString().split('T')[0],
        type: 'Deposit',
        amount: depositAmount
      };
      updates.transactions = [...(profile.transactions || []), newTx];
    }

    // Handle vacation booking
    if (vacation) {
      const vacationCost = Number(vacation.cost);
      const currentBalance = profile.balance || 0;

      if (currentBalance < vacationCost) {
        return res.status(400).json({ success: false, message: 'Insufficient balance' });
      }

      // Deduct cost
      updates.balance = currentBalance - vacationCost;

      // Create vacation object
      const newVacation = {
        name: vacation.name,
        cost: vacationCost,
        date: new Date().toISOString().split('T')[0]
      };

      // Add to pending_vacations
      updates.pending_vacations = [...(profile.pending_vacations || []), newVacation];

      // Add bonus if provided
      if (bonus) {
        updates.bonus = (profile.bonus || 0) + Number(bonus);
      }

      // Optional: log to usage_history
      const newLog = {
        date: new Date().toISOString().split('T')[0],
        action: `Requested ${vacation.name}`,
        cost: vacationCost
      };
      updates.usage_history = [...(profile.usage_history || []), newLog];
    }

    // Apply updates to Supabase
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('username', username.toLowerCase().trim());

    if (updateError) {
      console.error('Supabase update error:', updateError.message);
      return res.status(500).json({ success: false, message: 'Failed to save booking' });
    }

    // Return fresh profile
    const { data: updatedProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('username', username.toLowerCase().trim())
      .single();

    res.json({
      success: true,
      user: updatedProfile
    });

  } catch (err) {
    console.error('Booking update error:', err.message, err.stack);
    res.status(500).json({ success: false, message: 'Server error during booking' });
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

// Update User (Admin) - FIXED VERSION
app.post('/api/admin/update-user/:username', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }
  const { username } = req.params;
  let updates = req.body;

  try {
    // Build the update object safely
    const updateObj = { $set: {} };

    // Top-level fields
    if (updates.name !== undefined) updateObj.$set.name = updates.name;
    if (updates.balance !== undefined) updateObj.$set.balance = Number(updates.balance);
    if (updates.bonus !== undefined) updateObj.$set.bonus = Number(updates.bonus);
    if (updates.deposits !== undefined) updateObj.$set.deposits = Number(updates.deposits);

    // Nested personalInfo fields
    if (updates.personalInfo) {
      if (updates.personalInfo.email !== undefined) updateObj.$set['personalInfo.email'] = updates.personalInfo.email;
      if (updates.personalInfo.phone !== undefined) updateObj.$set['personalInfo.phone'] = updates.personalInfo.phone || '';
      if (updates.personalInfo.address !== undefined) updateObj.$set['personalInfo.address'] = updates.personalInfo.address || '';
    }

    const user = await User.findOneAndUpdate(
      { username: username.toLowerCase() },
      updateObj,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error('Error updating user (admin):', err);
    res.status(500).json({ success: false, message: 'Server error while updating user' });
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


module.exports = app;