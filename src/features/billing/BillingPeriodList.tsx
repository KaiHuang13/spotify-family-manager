import { useEffect, useState } from 'react'
import type { BillingPeriodDetail } from '../../types/billing'
import { fetchBillingPeriodDetails } from './billing-api'
import { formatMinorAmount } from './billing-period-detail-model'

interface BillingPeriodListProps {
  ownerId: string
  version: number
  onViewDetail(periodId: string): void
}

function getMonthLabel(periodStart: string) {
  const [year, month] = periodStart.split('-')
  return `${year} 年 ${Number(month)} 月費用`
}

function sumCharges(period: BillingPeriodDetail) {
  return period.charges.reduce(
    (summary, charge) => ({
      receivable: summary.receivable + charge.amountMinor,
      collected: summary.collected + charge.paidMinor,
      outstanding: summary.outstanding + charge.unpaidMinor,
    }),
    { receivable: 0n, collected: 0n, outstanding: 0n },
  )
}

export function BillingPeriodList({
  ownerId,
  version,
  onViewDetail,
}: BillingPeriodListProps) {
  const [periods, setPeriods] = useState<BillingPeriodDetail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true
    void fetchBillingPeriodDetails(ownerId).then((result) => {
      if (!isActive) return
      setPeriods(result.periods)
      setErrorMessage(result.errorMessage)
      setIsLoading(false)
    })
    return () => {
      isActive = false
    }
  }, [ownerId, version])

  if (isLoading) return <p className="billing-detail-state">正在載入月份費用…</p>
  if (errorMessage) return <p className="billing-detail-state members-error">{errorMessage}</p>
  if (periods.length === 0) return <p className="billing-detail-state">目前沒有月份費用。</p>

  return (
    <div className="member-table-wrapper">
      <table className="member-table billing-period-list-table">
        <thead>
          <tr>
            <th scope="col">費用月份</th>
            <th scope="col">Spotify 成本</th>
            <th scope="col">應收</th>
            <th scope="col">已收</th>
            <th scope="col">未收</th>
            <th scope="col">狀態</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => {
            const totals = sumCharges(period)
            return (
              <tr key={period.id}>
                <td data-label="費用月份">{getMonthLabel(period.periodStart)}</td>
                <td data-label="Spotify 成本">
                  {formatMinorAmount(period.providerCostMinor, period.currency)}
                </td>
                <td data-label="應收">
                  {formatMinorAmount(totals.receivable, period.currency)}
                </td>
                <td data-label="已收">
                  {formatMinorAmount(totals.collected, period.currency)}
                </td>
                <td data-label="未收">
                  {formatMinorAmount(totals.outstanding, period.currency)}
                </td>
                <td data-label="狀態">
                  <span className={`payment-status payment-status-${totals.outstanding === 0n ? 'paid' : 'unpaid'}`}>
                    {totals.outstanding === 0n ? '已結清' : '收款中'}
                  </span>
                </td>
                <td data-label="操作">
                  <button className="button-secondary table-action" type="button" onClick={() => onViewDetail(period.id)}>
                    查看明細
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
