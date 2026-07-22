import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

const missingEnvironmentVariables = [
  !supabaseUrl && 'VITE_SUPABASE_URL',
  !supabaseAnonKey && 'VITE_SUPABASE_ANON_KEY',
].filter((variableName): variableName is string => Boolean(variableName))

if (missingEnvironmentVariables.length > 0) {
  throw new Error(
    `缺少必要的 Supabase 環境變數：${missingEnvironmentVariables.join(', ')}。請依照 .env.example 設定本機 .env.local。`,
  )
}

function isPrivilegedSupabaseKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) {
    return true
  }

  const jwtParts = key.split('.')

  if (jwtParts.length !== 3) {
    return false
  }

  try {
    const encodedPayload = jwtParts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(jwtParts[1].length / 4) * 4, '=')
    const payload = JSON.parse(atob(encodedPayload)) as { role?: unknown }

    return payload.role === 'service_role'
  } catch {
    return false
  }
}

if (isPrivilegedSupabaseKey(supabaseAnonKey)) {
  throw new Error(
    'VITE_SUPABASE_ANON_KEY 不可使用 Supabase secret 或 service_role key。請改用 publishable 或 anon key。',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type SupabaseConnectionStatus =
  | { connected: true }
  | { connected: false; message: string }

const connectionErrorMessage = '無法連線至 Supabase，請檢查網路或環境設定。'

export async function checkSupabaseConnection(): Promise<SupabaseConnectionStatus> {
  try {
    const healthUrl = new URL('/auth/v1/health', supabaseUrl)
    const response = await fetch(healthUrl, {
      headers: {
        apikey: supabaseAnonKey,
      },
    })

    if (!response.ok) {
      return { connected: false, message: connectionErrorMessage }
    }

    return { connected: true }
  } catch {
    return { connected: false, message: connectionErrorMessage }
  }
}
