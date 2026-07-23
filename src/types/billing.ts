export interface CreateBillingPeriodInput {
  periodStart: string
  periodEnd: string
  dueDate: string
  providerCostAmount: string
}

export type CreateBillingPeriodFieldErrors = Partial<
  Record<keyof CreateBillingPeriodInput, string>
>

export type DatabaseMoneyValue = number | string

export interface BillingPaymentQueryRow {
  amount_minor: DatabaseMoneyValue
  status: string
}

export type QueryRelation<T> = T | T[] | null

export interface BillingMemberRelationQueryRow {
  members: QueryRelation<{ display_name: string }>
}

export interface BillingMemberChargeQueryRow {
  id: string
  amount_minor: DatabaseMoneyValue
  currency: string
  due_date: string
  voided_at: string | null
  subscription_members: QueryRelation<BillingMemberRelationQueryRow>
  payments: BillingPaymentQueryRow[]
}

export interface BillingPeriodQueryRow {
  id: string
  period_start: string
  period_end: string
  due_date: string | null
  provider_cost_minor: DatabaseMoneyValue
  currency: string
  member_charges: BillingMemberChargeQueryRow[]
}

export type ChargePaymentStatus =
  | 'unpaid'
  | 'partially_paid'
  | 'paid'
  | 'overpaid'
  | 'overdue'
  | 'void'

export interface ChargePaymentSummary {
  paidMinor: bigint
  unpaidMinor: bigint
  paymentStatus: Exclude<ChargePaymentStatus, 'void'>
}

export interface BillingChargeDetail {
  id: string
  memberName: string
  amountMinor: bigint
  paidMinor: bigint
  unpaidMinor: bigint
  currency: string
  paymentStatus: ChargePaymentStatus
}

export interface BillingPeriodDetail {
  id: string
  periodStart: string
  periodEnd: string
  dueDate: string | null
  providerCostMinor: bigint
  currency: string
  charges: BillingChargeDetail[]
}
