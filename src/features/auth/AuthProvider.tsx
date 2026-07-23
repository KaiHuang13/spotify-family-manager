import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import {
  signInWithEmailAndPassword,
  signOutCurrentSession,
} from './auth-actions'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isActive = true
    let hasReceivedAuthEvent = false

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isActive) {
        return
      }

      hasReceivedAuthEvent = true
      setSession(nextSession)
      setIsLoading(false)
    })

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isActive || hasReceivedAuthEvent) {
          return
        }

        setSession(data.session)
        setIsLoading(false)
      })
      .catch(() => {
        if (!isActive || hasReceivedAuthEvent) {
          return
        }

        setSession(null)
        setIsLoading(false)
      })

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(
    (email: string, password: string) =>
      signInWithEmailAndPassword(supabase, email, password),
    [],
  )

  const signOut = useCallback(() => signOutCurrentSession(supabase), [])

  const value = useMemo<AuthContextValue>(
    () => ({ session, isLoading, signIn, signOut }),
    [session, isLoading, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
