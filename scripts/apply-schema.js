const fs = require('fs');
const path = require('path');

const pat = 'sbp_88b2633b1c01e550158e372a104929eca2db514f';
const projectRef = 'biqsvrrnnoyulrrhgitc';
const schemaPath = path.join(__dirname, '..', 'lib', 'schema.sql');

async function runSQL(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${pat}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function main() {
  console.log('🚀 Applying schema to Supabase...\n');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  // Remove comment-only lines and split on ;
  // But keep function bodies ($$...$$) intact
  // Strategy: run the whole thing at once via Management API
  try {
    await runSQL(sql);
    console.log('✅ Full schema applied successfully!');
  } catch (err) {
    const msg = err.message;
    // If some statements already exist, try splitting and running individually
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      console.log('Some objects already exist, running idempotently...');
      // Split on double newline + statement boundaries (not inside $$ blocks)
      const statements = splitSQL(sql);
      let ok = 0, skip = 0, fail = 0;
      for (const stmt of statements) {
        const trimmed = stmt.trim();
        if (!trimmed || trimmed.startsWith('--')) continue;
        try {
          await runSQL(trimmed);
          ok++;
        } catch (e) {
          const errMsg = e.message;
          if (errMsg.includes('already exists') || errMsg.includes('duplicate') || errMsg.includes('42710') || errMsg.includes('42P07')) {
            skip++;
          } else {
            console.log(`  ⚠️  ${trimmed.substring(0, 60)}...`);
            console.log(`     Error: ${errMsg.substring(0, 120)}`);
            fail++;
          }
        }
      }
      console.log(`\n✅ Done: ${ok} created, ${skip} already existed, ${fail} failed`);
    } else {
      console.error('❌ Schema error:', msg.substring(0, 500));
    }
  }

  // Create storage buckets
  console.log('\n📦 Creating storage buckets...');
  const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpcXN2cnJubm95dWxycmhnaXRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM4NzQ1NywiZXhwIjoyMDg5OTYzNDU3fQ.bYjx8svAEKg4leNyme_h3-5zhDlX25mrcxpIr7t1wtA';
  for (const bucket of ['avatars', 'posts', 'activity']) {
    const res = await fetch(`https://${projectRef}.supabase.co/storage/v1/bucket`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceKey}`, 'apikey': serviceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: bucket, name: bucket, public: true }),
    });
    const r = await res.json();
    if (res.ok) console.log(`  ✅ Bucket "${bucket}" created`);
    else if (r.error === 'The resource already exists') console.log(`  ℹ️  Bucket "${bucket}" already exists`);
    else console.log(`  ❌ Bucket "${bucket}": ${r.message || r.error}`);
  }

  // Verify tables were created
  console.log('\n🔍 Verifying tables...');
  const tables = ['users', 'posts', 'activity_logs', 'follows', 'likes', 'comments', 'badges', 'groups', 'analytics_events'];
  for (const table of tables) {
    try {
      const r = await runSQL(`SELECT count(*) FROM public.${table}`);
      console.log(`  ✅ ${table}`);
    } catch (e) {
      console.log(`  ❌ ${table} — ${e.message.substring(0,80)}`);
    }
  }
}

function splitSQL(sql) {
  // Simple split: preserve $$ blocks
  const stmts = [];
  let current = '';
  let inDollarQuote = false;
  const lines = sql.split('\n');
  for (const line of lines) {
    if (line.includes('$$')) inDollarQuote = !inDollarQuote;
    current += line + '\n';
    if (!inDollarQuote && current.trim().endsWith(';')) {
      stmts.push(current.trim());
      current = '';
    }
  }
  if (current.trim()) stmts.push(current.trim());
  return stmts;
}

main().catch(console.error);
