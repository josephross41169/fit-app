const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://biqsvrrnnoyulrrhgitc.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpcXN2cnJubm95dWxycmhnaXRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM4NzQ1NywiZXhwIjoyMDg5OTYzNDU3fQ.bYjx8svAEKg4leNyme_h3-5zhDlX25mrcxpIr7t1wtA';

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Run each CREATE TABLE separately via RPC exec
// We'll use the pg REST interface with service role
async function runSQL(sql) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`HTTP ${response.status}: ${err}`);
  }
  return response.json();
}

async function main() {
  // Test connection by checking existing tables
  const { data, error } = await supabase
    .from('users')
    .select('count')
    .limit(1);
  
  if (error && error.code === 'PGRST116') {
    console.log('Tables do not exist yet - need to create them');
  } else if (error && error.message.includes('does not exist')) {
    console.log('Table "users" not found - schema not yet applied');
  } else if (!error) {
    console.log('users table already exists!');
  } else {
    console.log('Connection status:', error.message);
  }
  
  // Try creating storage buckets (works with service role via admin API)
  console.log('\nAttempting to create storage buckets...');
  const buckets = ['avatars', 'posts', 'activity'];
  for (const bucket of buckets) {
    const res = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: bucket, name: bucket, public: true }),
    });
    const result = await res.json();
    if (res.ok) {
      console.log(`✅ Bucket "${bucket}" created`);
    } else if (result.error === 'The resource already exists') {
      console.log(`ℹ️  Bucket "${bucket}" already exists`);
    } else {
      console.log(`❌ Bucket "${bucket}": ${JSON.stringify(result)}`);
    }
  }
}

main().catch(console.error);
