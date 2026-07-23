import { useEffect, useState } from 'react'
import type { CurrentSubscriptionDashboard as DashboardData } from '../../types/dashboard'
import {
  formatMinorAmount,
  paymentStatusLabels,
} from '../billing/billing-period-detail-model'
import { fetchCurrentSubscriptionDashboard } from './dashboard-api'

interface CurrentSubscriptionDashboardProps {
  ownerId: string
}

function formatPaymentDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function CurrentSubscriptionDashboard({
  ownerId,
}: CurrentSubscriptionDashboardProps) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    void fetchCurrentSubscriptionDashboard(ownerId).then((result) => {
      if (!isActive) {
        return
      }

      setDashboard(result.dashboard)
      setErrorMessage(result.errorMessage)
      setIsLoading(false)
    })

    return () => {
      isActive = false
    }
  }, [ownerId])

  if (isLoading) {
    return (
      <p className="dashboard-state" role="status" aria-live="polite">
        正在載入當期訂閱狀態…
      </p>
    )
  }

  if (errorMessage) {
    return (
      <p className="dashboard-state members-error" role="alert">
        {errorMessage}
      </p>
    )
  }

  if (!dashboard) {
    return (
      <div className="dashboard-state">
        <h2>目前沒有進行中的月份費用</h2>
        <p>新增涵蓋今日的月份費用後，這裡會顯示訂閱與收款摘要。</p>
      </div>
    )
  }

  return (
    <div className="dashboard-content">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">當期訂閱狀態</p>
          <h2>
            {dashboard.periodStart.slice(0, 7).replace('-', ' 年 ')} 月費用
          </h2>
        </div>
        <p>付款期限：{dashboard.dueDate ?? '未設定'}</p>
      </div>

      <dl className="dashboard-summary-grid">
        <div>
          <dt>Spotify 當期方案總費用</dt>
          <dd>
            {formatMinorAmount(
              dashboard.providerCostMinor,
              dashboard.currency,
            )}
          </dd>
        </div>
        <div>
          <dt>有效成員數</dt>
          <dd>{dashboard.activeMemberCount}</dd>
        </div>
        <div>
          <dt>當期總應收</dt>
          <dd>
            {formatMinorAmount(dashboard.receivableMinor, dashboard.currency)}
          </dd>
        </div>
        <div>
          <dt>當期總已收</dt>
          <dd>
            {formatMinorAmount(dashboard.collectedMinor, dashboard.currency)}
          </dd>
        </div>
        <div>
          <dt>當期總未收</dt>
          <dd>
            {formatMinorAmount(dashboard.outstandingMinor, dashboard.currency)}
          </dd>
        </div>
      </dl>

      <section className="dashboard-section" aria-labelledby="current-charges-title">
        <h3 id="current-charges-title">每位成員當期應收</h3>
        {dashboard.memberCharges.length === 0 ? (
          <p className="dashboard-inline-empty">當期沒有成員應收資料。</p>
        ) : (
          <div className="member-table-wrapper">
            <table className="member-table dashboard-table">
              <thead>
                <tr>
                  <th scope="col">成員</th>
                  <th scope="col">應付</th>
                  <th scope="col">已付</th>
                  <th scope="col">未付</th>
                  <th scope="col">狀態</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.memberCharges.map((charge) => (
                  <tr key={charge.id}>
                    <td>{charge.memberName}</td>
                    <td>{formatMinorAmount(charge.amountMinor, charge.currency)}</td>
                    <td>{formatMinorAmount(charge.paidMinor, charge.currency)}</td>
                    <td>{formatMinorAmount(charge.unpaidMinor, charge.currency)}</td>
                    <td>
                      <span
                        className={`payment-status payment-status-${charge.paymentStatus}`}
                      >
                        {paymentStatusLabels[charge.paymentStatus]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dashboard-section" aria-labelledby="incomplete-payments-title">
        <h3 id="incomplete-payments-title">尚未完成付款的成員</h3>
        {dashboard.incompleteMemberCharges.length === 0 ? (
          <p className="dashboard-inline-empty">當期款項皆已完成。</p>
        ) : (
          <ul className="incomplete-payment-list">
            {dashboard.incompleteMemberCharges.map((charge) => (
              <li key={charge.id}>
                <span>{charge.memberName}</span>
                <strong>
                  尚欠 {formatMinorAmount(charge.unpaidMinor, charge.currency)} ·{' '}
                  {paymentStatusLabels[charge.paymentStatus]}
                </strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dashboard-section" aria-labelledby="recent-payments-title">
        <h3 id="recent-payments-title">最近 5 筆付款</h3>
        {dashboard.recentPayments.length === 0 ? (
          <p className="dashboard-inline-empty">目前沒有付款紀錄。</p>
        ) : (
          <div className="member-table-wrapper">
            <table className="member-table dashboard-table">
              <thead>
                <tr>
                  <th scope="col">付款時間</th>
                  <th scope="col">成員</th>
                  <th scope="col">對應月份</th>
                  <th scope="col">金額</th>
                  <th scope="col">付款方式</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recentPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatPaymentDateTime(payment.paidAt)}</td>
                    <td>{payment.memberName}</td>
                    <td>
                      {payment.periodStart && payment.periodEnd
                        ? `${payment.periodStart} ～ ${payment.periodEnd}`
                        : '—'}
                    </td>
                    <td>
                      {formatMinorAmount(payment.amountMinor, payment.currency)}
                    </td>
                    <td>{payment.paymentMethod ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
