// api/deposit/agent.js - Vercel Serverless Function
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  console.log('Agent deposit request received');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    console.log('Missing token');
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const { username, amount, transactionId, paymentMethod } = req.body;

  if (!username || !amount || !transactionId || !paymentMethod) {
    console.log('Missing fields:', { username, amount, transactionId, paymentMethod });
    return res.status(400).json({ success: false, message: 'Missing required fields (username, amount, transactionId, paymentMethod)' });
  }

  try {
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('pending_deposits')
      .eq('username', username.toLowerCase().trim())
      .single();

    if (fetchError) throw fetchError;
    if (!profile) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const newDeposit = {
      amount: parseFloat(amount),
      method: 'agent',
      paymentMethod,
      transactionId: transactionId.trim(),
      date: new Date().toISOString(),
      status: 'pending'
    };

    const currentDeposits = Array.isArray(profile.pending_deposits) ? profile.pending_deposits : [];
    const updatedDeposits = [...currentDeposits, newDeposit];

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ pending_deposits: updatedDeposits })
      .eq('username', username.toLowerCase().trim());

    if (updateError) throw updateError;

    console.log('Agent deposit added successfully for:', username);
    return res.status(200).json({ success: true, message: 'Agent payment submitted — awaiting approval' });

  } catch (err) {
    console.error('Agent deposit crash:', err.message, err.stack);
    return res.status(500).json({ success: false, message: 'Server error: ' + (err.message || 'Unknown') });
  }
}