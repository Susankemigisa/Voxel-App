import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

const SUPABASE_URL     = 'https://ekxshsrkyadcmkhecuaw.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVreHNoc3JreWFkY21raGVjdWF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDUxMjQsImV4cCI6MjA4ODgyMTEyNH0.SbU9-arJtaTs3MsLjAnfh-j7Dgd-3rp0dJKk8YzmqzI'

const ExpoSecureStoreAdapter = {
  getItem:    (key: string) => SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage:          ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession:   true,
    detectSessionInUrl: false,
  },
})