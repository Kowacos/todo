import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://xlddivqarpaomvotuurt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsZGRpdnFhcnBhb212b3R1dXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDg4MzYsImV4cCI6MjA3MzAyNDgzNn0.Z7vs4YjhWrc72NBkDcjUfUqfSlyK4oKD7JbprR1GFEw',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
)
