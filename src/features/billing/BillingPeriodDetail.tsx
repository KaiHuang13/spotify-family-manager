import { useEffect, useState } from 'react'
import type { BillingPeriodDetail as BillingPeriodDetailData } from '../../types/billing'
import { fetchBillingPeriodDetails } from './billing-api'
import {
  formatMinorAmount,
  paymentStatusLabels,
} from './billing-period-detail-model'

interface BillingPeriodDetailProps {
  ownerId: string
  periodId: string
  onBack(): void
}

export function BillingPeriodDetail({ ownerId, periodId, onBack }: BillingPeriodDetailProps) {
  const [periods, setPeriods] = useState<BillingPeriodDetailData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    void fetchBillingPeriodDetails(ownerId).then((result) => {
      if (!isActive) {
        return
      }

      setPeriods(result.periods)
      setErrorMessage(result.errorMessage)
      setIsLoading(false)
    })

    return () => {
      isActive = false
    }
  }, [ownerId])

  if (isLoading) {
    return (
      <p className="billing-detail-state" role="status" aria-live="polite">
        正在載入月份費用明細…
      </p>
    )
  }

  if (errorMessage) {
    return (
      <p className="billing-detail-state members-error" role="alert">
        {errorMessage}
      </p>
    )
  }

  if (periods.length === 0) {
    return <p className="billing-detail-state">目前沒有月份費用資料。</p>
  }

  const selectedPeriod = periods.find((period) => period.id === periodId)

  if (!selectedPeriod) {
    return (
      <div className="billing-detail-state">
        <p>找不到指定的月份費用。</p>
        <button type="button" onClick={onBack}>返回月份費用</button>
      </div>
    )
  }

  return (
    <div className="billing-detail-content">
      <div className="billing-detail-toolbar">
        <div>
          <p className="eyebrow">月份費用明細</p>
          <h2>
            {selectedPeriod.periodStart} ～ {selectedPeriod.periodEnd}
          </h2>
        </div>
        <button className="button-secondary" type="button" onClick={onBack}>
          返回月份費用
        </button>
      </div>

      <dl className="billing-summary">
        <div>
          <dt>計費期間</dt>
          <dd>
            {selectedPeriod.periodStart} ～ {selectedPeriod.periodEnd}
          </dd>
        </div>
        <div>
          <dt>付款期限</dt>
          <dd>{selectedPeriod.dueDate ?? '—'}</dd>
        </div>
        <div>
          <dt>Spotify 總費用</dt>
          <dd>
            {formatMinorAmount(
              selectedPeriod.providerCostMinor,
              selectedPeriod.currency,
            )}
          </dd>
        </div>
      </dl>

      {selectedPeriod.charges.length === 0 ? (
        <p className="billing-detail-state">此月份沒有成員應收。</p>
      ) : (
        <div className="member-table-wrapper">
          <table className="member-table billing-detail-table">
            <thead>
              <tr>
                <th scope="col">成員</th>
                <th scope="col">應付金額</th>
                <th scope="col">已付金額</th>
                <th scope="col">未付金額</th>
                <th scope="col">付款狀態</th>
              </tr>
            </thead>
            <tbody>
              {selectedPeriod.charges.map((charge) => (
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
    </div>
  )
}
