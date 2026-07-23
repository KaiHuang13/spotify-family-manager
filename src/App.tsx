import { useAuth } from './hooks/useAuth'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'

function App() {
  const { session, isLoading } = useAuth()

  if (isLoading) {
    return (
      <main className="home">
        <p role="status" aria-live="polite">
          正在確認登入狀態…
        </p>
      </main>
    )
  }

  if (!session) {
    return <LoginPage />
  }

  return <HomePage key={session.user.id} ownerId={session.user.id} />
}

export default App
