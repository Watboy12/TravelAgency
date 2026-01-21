// api/deposit/bank.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  console.log('BANK DEPOSIT REQUEST RECEIVED');
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);

  const { username, amount, payerName } = req.body || {};

  if (!username || !amount || !payerName) {
    console.log('Missing fields');
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    console.log('Fetching profile for username:', username);

    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('full_name, pending_deposits')
      .eq('username', username.toLowerCase().trim())
      .single();

    if (fetchError) {
      console.error('Supabase fetch error:', fetchError.message);
      throw fetchError;
    }

    if (!profile) {
      console.log('No profile found');
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log('Profile found:', profile.full_name);

    if (profile.full_name?.toLowerCase().trim() !== payerName.toLowerCase().trim()) {
      console.log('Name mismatch');
      return res.status(400).json({ success: false, message: 'Payer name does not match account name' });
    }

    const newDeposit = {
      amount: parseFloat(amount),
      method: 'bank',
      payerName,
      date: new Date().toISOString(),
      status: 'pending'
    };

    const current = Array.isArray(profile.pending_deposits) ? profile.pending_deposits : [];
    const updated = [...current, newDeposit];

    console.log('Updating pending_deposits with:', updated);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ pending_deposits: updated })
      .eq('username', username.toLowerCase().trim());

    if (updateError) {
      console.error('Update error:', updateError.message);
      throw updateError;
    }

    console.log('Deposit saved successfully');
    return res.status(200).json({ success: true, message: 'Deposit submitted — pending approval' });

  } catch (err) {
    console.error('BANK DEPOSIT CRASH:', err.message, err.stack);
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}