import { useState } from 'react'
import { BillingPeriodDetail } from '../features/billing/BillingPeriodDetail'
import { BillingPeriodList } from '../features/billing/BillingPeriodList'
import { CreateBillingPeriodForm } from '../features/billing/CreateBillingPeriodForm'
import { CurrentSubscriptionDashboard } from '../features/dashboard/CurrentSubscriptionDashboard'
import { AddMemberForm } from '../features/members/AddMemberForm'
import { DeactivateMemberForm } from '../features/members/DeactivateMemberForm'
import { EditMemberForm } from '../features/members/EditMemberForm'
import { MemberList } from '../features/members/MemberList'
import { PaymentCycleForm } from '../features/members/PaymentCycleForm'
import { RecordPaymentForm } from '../features/payments/RecordPaymentForm'
import { SpotifyPlanSettings } from '../features/subscription/SpotifyPlanSettings'
import { useAuth } from '../hooks/useAuth'
import type { MemberListItem } from '../types/member'

type Page = 'dashboard' | 'members' | 'billing' | 'billing-detail' | 'payments' | 'settings'

interface HomePageProps {
  ownerId: string
}

const navigation: { page: Exclude<Page, 'billing-detail'>; label: string }[] = [
  { page: 'dashboard', label: '儀表板' },
  { page: 'members', label: '成員' },
  { page: 'billing', label: '月份費用' },
  { page: 'payments', label: '付款' },
  { page: 'settings', label: '方案設定' },
]

export function HomePage({ ownerId }: HomePageProps) {
  const { signOut } = useAuth()
  const [page, setPage] = useState<Page>('dashboard')
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [memberListVersion, setMemberListVersion] = useState(0)
  const [billingVersion, setBillingVersion] = useState(0)
  const [dashboardVersion, setDashboardVersion] = useState(0)
  const [editingMember, setEditingMember] = useState<MemberListItem | null>(null)
  const [deactivatingMember, setDeactivatingMember] = useState<MemberListItem | null>(null)
  const [paymentMember, setPaymentMember] = useState<MemberListItem | null>(null)

  function refreshMemberList() {
    setMemberListVersion((version) => version + 1)
    setDashboardVersion((version) => version + 1)
  }

  function refreshBillingData() {
    setBillingVersion((version) => version + 1)
    setDashboardVersion((version) => version + 1)
  }

  function navigate(nextPage: Exclude<Page, 'billing-detail'>) {
    setPage(nextPage)
    setSelectedPeriodId(null)
  }

  async function handleSignOut() {
    setErrorMessage(null)
    setIsSigningOut(true)
    const nextErrorMessage = await signOut()
    setErrorMessage(nextErrorMessage)
    setIsSigningOut(false)
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Spotify Family Manager</p>
          <h1>{page === 'billing-detail' ? '月份費用明細' : navigation.find((item) => item.page === page)?.label}</h1>
        </div>
        <button type="button" onClick={handleSignOut} disabled={isSigningOut}>
          {isSigningOut ? '登出中…' : '登出'}
        </button>
      </header>

      <nav className="app-navigation" aria-label="主要功能">
        {navigation.map((item) => (
          <button
            className={page === item.page || (page === 'billing-detail' && item.page === 'billing') ? 'nav-button nav-button-active' : 'nav-button'}
            type="button"
            key={item.page}
            onClick={() => navigate(item.page)}
            aria-current={page === item.page ? 'page' : undefined}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {errorMessage ? <p className="auth-error" role="alert">{errorMessage}</p> : null}

      {page === 'dashboard' ? (
        <section className="dashboard-panel" aria-label="當期訂閱狀態儀表板">
          <CurrentSubscriptionDashboard key={dashboardVersion} ownerId={ownerId} />
        </section>
      ) : null}

      {page === 'members' ? (
        <section className="member-panel" aria-labelledby="member-list-title">
          <div className="member-panel-heading">
            <h2 id="member-list-title">Spotify Premium Family 成員</h2>
            <p>新增成員時，計費起算日預設為實際加入日期。</p>
          </div>
          <AddMemberForm onCreated={refreshMemberList} />
          {editingMember ? <EditMemberForm key={editingMember.id} member={editingMember} ownerId={ownerId} onCancel={() => setEditingMember(null)} onSaved={() => { setEditingMember(null); refreshMemberList() }} /> : null}
          {deactivatingMember ? <DeactivateMemberForm key={deactivatingMember.id} member={deactivatingMember} onCancel={() => setDeactivatingMember(null)} onDeactivated={() => { setDeactivatingMember(null); refreshMemberList() }} /> : null}
          {paymentMember ? <PaymentCycleForm key={paymentMember.id} member={paymentMember} onCancel={() => setPaymentMember(null)} onSaved={() => { setPaymentMember(null); refreshMemberList() }} /> : null}
          <MemberList
            key={memberListVersion}
            ownerId={ownerId}
            onEdit={(member) => { setDeactivatingMember(null); setPaymentMember(null); setEditingMember(member) }}
            onDeactivate={(member) => { setEditingMember(null); setPaymentMember(null); setDeactivatingMember(member) }}
            onConfigurePayment={(member) => { setEditingMember(null); setDeactivatingMember(null); setPaymentMember(member) }}
          />
        </section>
      ) : null}

      {page === 'billing' ? (
        <div className="page-stack">
          <section className="billing-panel" aria-label="新增月份費用">
            <CreateBillingPeriodForm onCreated={refreshBillingData} />
          </section>
          <section className="billing-panel" aria-label="月份費用清單">
            <div className="member-panel-heading">
              <h2>月份費用清單</h2>
              <p>選擇月份後進入獨立明細頁，不再使用持續增長的下拉選單。</p>
            </div>
            <BillingPeriodList ownerId={ownerId} version={billingVersion} onViewDetail={(periodId) => { setSelectedPeriodId(periodId); setPage('billing-detail') }} />
          </section>
        </div>
      ) : null}

      {page === 'billing-detail' && selectedPeriodId ? (
        <section className="billing-panel" aria-label="月份費用明細">
          <BillingPeriodDetail ownerId={ownerId} periodId={selectedPeriodId} onBack={() => navigate('billing')} />
        </section>
      ) : null}

      {page === 'payments' ? (
        <section className="billing-panel" aria-label="登記付款">
          <RecordPaymentForm ownerId={ownerId} onRecorded={refreshBillingData} />
        </section>
      ) : null}

      {page === 'settings' ? (
        <section className="member-panel" aria-label="Spotify 方案設定">
          <SpotifyPlanSettings ownerId={ownerId} />
        </section>
      ) : null}
    </main>
  )
}
