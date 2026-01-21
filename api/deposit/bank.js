// api/deposit/bank.js (Vercel serverless function)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { username, amount, payerName } = req.body;

  if (!username || !amount || !payerName) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    // Fetch user profile
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('full_name, pending_deposits')
      .eq('username', username.toLowerCase().trim())
      .single();

    if (fetchError || !profile) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check name match
    if (profile.full_name?.toLowerCase().trim() !== payerName.toLowerCase().trim()) {
      return res.status(400).json({ success: false, message: 'Payer name does not match account name' });
    }

    // Add to pending_deposits array
    const newDeposit = {
      amount: parseFloat(amount),
      method: 'bank',
      payerName,
      date: new Date().toISOString().split('T')[0],
      status: 'pending'
    };

    const updatedDeposits = [...(profile.pending_deposits || []), newDeposit];

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ pending_deposits: updatedDeposits })
      .eq('username', username.toLowerCase().trim());

    if (updateError) throw updateError;

    return res.status(200).json({ success: true, message: 'Deposit submitted — pending approval' });
  } catch (err) {
    console.error('Deposit error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}