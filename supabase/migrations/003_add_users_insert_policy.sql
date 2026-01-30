-- Allow authenticated users to insert their own profile row
-- This is needed when the DB trigger didn't fire (e.g. user created before migration)
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);
