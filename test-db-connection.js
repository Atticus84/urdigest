// Quick test to verify Supabase connection and database setup
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testConnection() {
  console.log('🔍 Testing Supabase connection...\n')
  
  // Test 1: Check if we can connect
  console.log('1. Testing connection...')
  const { data: { user }, error: authError } = await supabase.auth.admin.listUsers()
  if (authError) {
    console.log('❌ Connection failed:', authError.message)
    return
  }
  console.log('✅ Connection successful!\n')
  
  // Test 2: Check if tables exist
  console.log('2. Checking if tables exist...')
  const tables = ['users', 'saved_posts', 'digests', 'subscription_events']
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1)
    
    if (error) {
      console.log(`❌ Table "${table}" not found or error:`, error.message)
      console.log('\n⚠️  You need to run the database migration!')
      console.log('   Go to your Supabase dashboard → SQL Editor')
      console.log('   Copy contents of: supabase/migrations/001_initial_schema.sql')
      console.log('   Paste and execute\n')
      return
    } else {
      console.log(`✅ Table "${table}" exists`)
    }
  }
  
  console.log('\n🎉 Database is set up correctly!')
  console.log('\n📝 Next steps:')
  console.log('   1. Open http://localhost:3000')
  console.log('   2. Sign up for an account')
  console.log('   3. Test the dashboard')
}

testConnection().catch(console.error)
