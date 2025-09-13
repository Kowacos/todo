import { supabase } from './supabase.js'

export const auth = {
  user: null,

  async login(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      if (error) throw error
      this.user = data.user
      return data
    } catch (error) {
      if (error.message.includes('NetworkError')) {
        throw new Error('Nelze se připojit k serveru. Zkontrolujte připojení k internetu.')
      }
      throw error
    }
  },

  async register(email, password) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      })
      if (error) throw error
      return data
    } catch (error) {
      if (error.message.includes('NetworkError')) {
        throw new Error('Nelze se připojit k serveru. Zkontrolujte připojení k internetu.')
      }
      throw error
    }
  },

  async logout() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    this.user = null
  },

  async getCurrentUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      this.user = user
      return user
    } catch (error) {
      console.error('Error getting user:', error)
      return null
    }
  }
}
