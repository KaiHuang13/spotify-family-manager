import assert from 'node:assert/strict'
import test from 'node:test'
import {
  loginFailedMessage,
  logoutFailedMessage,
  signInWithEmailAndPassword,
  signOutCurrentSession,
} from '../src/features/auth/auth-actions.ts'

test('登入時去除 Email 前後空白但保留原始密碼', async () => {
  let receivedCredentials: { email: string; password: string } | undefined
  const client = {
    auth: {
      async signInWithPassword(credentials: {
        email: string
        password: string
      }) {
        receivedCredentials = credentials
        return { error: null }
      },
      async signOut() {
        return { error: null }
      },
    },
  }

  const result = await signInWithEmailAndPassword(
    client,
    '  admin@example.com  ',
    ' password with spaces ',
  )

  assert.equal(result, null)
  assert.deepEqual(receivedCredentials, {
    email: 'admin@example.com',
    password: ' password with spaces ',
  })
})

test('登入失敗只回傳安全的固定訊息', async () => {
  const sensitiveMessage = 'database connection details must not be exposed'
  const client = {
    auth: {
      async signInWithPassword() {
        return { error: { message: sensitiveMessage } }
      },
      async signOut() {
        return { error: null }
      },
    },
  }

  const result = await signInWithEmailAndPassword(
    client,
    'admin@example.com',
    'incorrect-password',
  )

  assert.equal(result, loginFailedMessage)
  assert.equal(result.includes(sensitiveMessage), false)
})

test('登入請求拋出例外時不洩漏例外內容', async () => {
  const client = {
    auth: {
      async signInWithPassword() {
        throw new Error('sensitive network error')
      },
      async signOut() {
        return { error: null }
      },
    },
  }

  const result = await signInWithEmailAndPassword(
    client,
    'admin@example.com',
    'password',
  )

  assert.equal(result, loginFailedMessage)
})

test('登出成功不回傳錯誤訊息', async () => {
  const client = {
    auth: {
      async signInWithPassword() {
        return { error: null }
      },
      async signOut() {
        return { error: null }
      },
    },
  }

  assert.equal(await signOutCurrentSession(client), null)
})

test('登出失敗只回傳安全的固定訊息', async () => {
  const sensitiveMessage = 'raw provider error'
  const client = {
    auth: {
      async signInWithPassword() {
        return { error: null }
      },
      async signOut() {
        return { error: { message: sensitiveMessage } }
      },
    },
  }

  const result = await signOutCurrentSession(client)

  assert.equal(result, logoutFailedMessage)
  assert.equal(result.includes(sensitiveMessage), false)
})
