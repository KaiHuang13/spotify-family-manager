import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export interface AuthContextValue {
  session: Session | null
  isLoading: boolean
  signIn(email: string, password: string): Promise<string | null>
  signOut(): Promise<string | null>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
