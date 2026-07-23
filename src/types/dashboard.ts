import type {
  BillingChargeDetail,
  BillingPeriodDetail,
  DatabaseMoneyValue,
  QueryRelation,
} from './billing'

export interface DashboardRecentPaymentQueryRow {
  id: string
  amount_minor: DatabaseMoneyValue
  currency: string
  paid_at: string
  payment_method: string | null
  member_charges: QueryRelation<{
    subscription_members: QueryRelation<{
      members: QueryRelation<{ display_name: string }>
    }>
    billing_periods: QueryRelation<{
      period_start: string
      period_end: string
    }>
  }>
}

export interface DashboardRecentPayment {
  id: string
  memberName: string
  amountMinor: bigint
  currency: string
  paidAt: string
  paymentMethod: string | null
  periodStart: string | null
  periodEnd: string | null
}

export interface CurrentSubscriptionDashboard {
  periodId: string
  periodStart: string
  periodEnd: string
  dueDate: string | null
  providerCostMinor: bigint
  currency: string
  activeMemberCount: number
  receivableMinor: bigint
  collectedMinor: bigint
  outstandingMinor: bigint
  memberCharges: BillingChargeDetail[]
  incompleteMemberCharges: BillingChargeDetail[]
  recentPayments: DashboardRecentPayment[]
}

export interface CurrentDashboardSource {
  billingPeriod: BillingPeriodDetail
  activeMemberCount: number
  recentPayments: DashboardRecentPaymentQueryRow[]
}
