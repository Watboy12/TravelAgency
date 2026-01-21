// api/deposit/crypto.js - Vercel Serverless Function
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  console.log('Crypto deposit request received');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    console.log('Missing token');
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  // Optional JWT verification (uncomment when ready)
  /*
  const jwt = require('jsonwebtoken');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);
  } catch (err) {
    console.error('Token verification failed:', err.message);
    return res.status(403).json({ success: false, message: 'Invalid or expired token' });
  }
  */

  const { username, amount, userBtcAddress } = req.body;

  if (!username || !amount || !userBtcAddress) {
    console.log('Missing fields:', { username, amount, userBtcAddress });
    return res.status(400).json({ success: false, message: 'Missing required fields (username, amount, sender BTC address)' });
  }

  try {
    // Fetch user profile (we don't check name for crypto)
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('pending_deposits')
      .eq('username', username.toLowerCase().trim())
      .single();

    if (fetchError) {
      console.error('Supabase fetch error:', fetchError);
      throw fetchError;
    }

    if (!profile) {
      console.log('User not found:', username);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Prepare new deposit entry
    const newDeposit = {
      amount: parseFloat(amount),
      method: 'crypto',
      senderBtcAddress: userBtcAddress.trim(),
      date: new Date().toISOString(),
      status: 'pending'
    };

    // Safely append
    const currentDeposits = Array.isArray(profile.pending_deposits) ? profile.pending_deposits : [];
    const updatedDeposits = [...currentDeposits, newDeposit];

    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ pending_deposits: updatedDeposits })
      .eq('username', username.toLowerCase().trim());

    if (updateError) {
      console.error('Supabase update error:', updateError);
      throw updateError;
    }

    console.log('Crypto deposit added successfully for:', username);
    return res.status(200).json({ success: true, message: 'Crypto deposit submitted — awaiting confirmation' });

  } catch (err) {
    console.error('Crypto deposit crash:', err.message, err.stack);
    return res.status(500).json({ success: false, message: 'Server error: ' + (err.message || 'Unknown') });
  }
}