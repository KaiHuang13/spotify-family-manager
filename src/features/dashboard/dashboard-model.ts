import type {
  CurrentDashboardSource,
  CurrentSubscriptionDashboard,
  DashboardRecentPayment,
  DashboardRecentPaymentQueryRow,
} from '../../types/dashboard'
import type { DatabaseMoneyValue, QueryRelation } from '../../types/billing'

function firstRelation<T>(relation: QueryRelation<T>) {
  return Array.isArray(relation) ? relation[0] : relation
}

function toMoneyInteger(value: DatabaseMoneyValue) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new Error('Money value is outside the safe integer range.')
  }

  return BigInt(value)
}

export function toRecentPayments(
  rows: DashboardRecentPaymentQueryRow[],
): DashboardRecentPayment[] {
  return rows.slice(0, 5).map((row) => {
    const charge = firstRelation(row.member_charges)
    const membership = firstRelation(charge?.subscription_members ?? null)
    const member = firstRelation(membership?.members ?? null)
    const period = firstRelation(charge?.billing_periods ?? null)

    return {
      id: row.id,
      memberName: member?.display_name ?? '未知成員',
      amountMinor: toMoneyInteger(row.amount_minor),
      currency: row.currency,
      paidAt: row.paid_at,
      paymentMethod: row.payment_method,
      periodStart: period?.period_start ?? null,
      periodEnd: period?.period_end ?? null,
    }
  })
}

export function buildCurrentSubscriptionDashboard(
  source: CurrentDashboardSource,
): CurrentSubscriptionDashboard {
  const period = source.billingPeriod

  const memberCharges = period.charges.filter(
    (charge) => charge.paymentStatus !== 'void',
  )
  const receivableMinor = memberCharges.reduce(
    (total, charge) => total + charge.amountMinor,
    0n,
  )
  const collectedMinor = memberCharges.reduce(
    (total, charge) => total + charge.paidMinor,
    0n,
  )
  const outstandingMinor = memberCharges.reduce(
    (total, charge) => total + charge.unpaidMinor,
    0n,
  )
  const incompleteMemberCharges = memberCharges.filter((charge) =>
    ['unpaid', 'partially_paid', 'overdue'].includes(charge.paymentStatus),
  )

  return {
    periodId: period.id,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    dueDate: period.dueDate,
    providerCostMinor: period.providerCostMinor,
    currency: period.currency,
    activeMemberCount: source.activeMemberCount,
    receivableMinor,
    collectedMinor,
    outstandingMinor,
    memberCharges,
    incompleteMemberCharges,
    recentPayments: toRecentPayments(source.recentPayments),
  }
}
