import type { DatabaseMoneyValue, QueryRelation } from './billing'

export interface PaymentChargeQueryRow {
  id: string
  amount_minor: DatabaseMoneyValue
  currency: string
  subscription_members: QueryRelation<{
    member_id: string
    members: QueryRelation<{ display_name: string }>
  }>
  billing_periods: QueryRelation<{
    id: string
    period_start: string
    period_end: string
    status: string
  }>
}

export interface PaymentChargeOption {
  chargeId: string
  memberId: string
  memberName: string
  billingPeriodId: string
  periodStart: string
  periodEnd: string
  amountMinor: bigint
  currency: string
}

export interface RecordPaymentInput {
  memberId: string
  memberChargeId: string
  amount: string
  paidOn: string
  paymentMethod: string
  notes: string
}

export type RecordPaymentFieldErrors = Partial<
  Record<keyof RecordPaymentInput, string>
>
