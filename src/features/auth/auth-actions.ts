interface AuthFailure {
  message?: string
}

interface PasswordAuthClient {
  auth: {
    signInWithPassword(credentials: {
      email: string
      password: string
    }): Promise<{ error: AuthFailure | null }>
    signOut(): Promise<{ error: AuthFailure | null }>
  }
}

export const loginFailedMessage =
  '登入失敗，請確認 Email 與密碼後再試一次。'
export const logoutFailedMessage = '登出失敗，請稍後再試一次。'

export async function signInWithEmailAndPassword(
  client: PasswordAuthClient,
  email: string,
  password: string,
): Promise<string | null> {
  try {
    const { error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    return error ? loginFailedMessage : null
  } catch {
    return loginFailedMessage
  }
}

export async function signOutCurrentSession(
  client: PasswordAuthClient,
): Promise<string | null> {
  try {
    const { error } = await client.auth.signOut()

    return error ? logoutFailedMessage : null
  } catch {
    return logoutFailedMessage
  }
}
