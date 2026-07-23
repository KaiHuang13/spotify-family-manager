import type {
  BillingChargeDetail,
  BillingMemberChargeQueryRow,
  BillingPeriodDetail,
  BillingPeriodQueryRow,
  ChargePaymentSummary,
  ChargePaymentStatus,
  DatabaseMoneyValue,
} from '../../types/billing'

function toMoneyInteger(value: DatabaseMoneyValue) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new Error('Money value is outside the safe integer range.')
  }

  return BigInt(value)
}

export function calculateChargePaymentSummary(
  amountMinorValue: DatabaseMoneyValue,
  payments: BillingMemberChargeQueryRow['payments'],
  dueDate: string,
  businessDate: string,
): ChargePaymentSummary {
  const amountMinor = toMoneyInteger(amountMinorValue)
  const paidMinor = payments
    .filter((payment) => payment.status === 'posted')
    .reduce(
      (total, payment) => total + toMoneyInteger(payment.amount_minor),
      0n,
    )
  const unpaidMinor = amountMinor > paidMinor ? amountMinor - paidMinor : 0n

  if (paidMinor > amountMinor) {
    return { paidMinor, unpaidMinor, paymentStatus: 'overpaid' }
  }

  if (paidMinor === amountMinor) {
    return { paidMinor, unpaidMinor, paymentStatus: 'paid' }
  }

  if (dueDate < businessDate) {
    return { paidMinor, unpaidMinor, paymentStatus: 'overdue' }
  }

  if (paidMinor > 0n) {
    return { paidMinor, unpaidMinor, paymentStatus: 'partially_paid' }
  }

  return { paidMinor, unpaidMinor, paymentStatus: 'unpaid' }
}

function toChargeDetail(
  charge: BillingMemberChargeQueryRow,
  businessDate: string,
): BillingChargeDetail {
  const membership = Array.isArray(charge.subscription_members)
    ? charge.subscription_members[0]
    : charge.subscription_members
  const memberRelation = membership?.members
  const member = Array.isArray(memberRelation)
    ? memberRelation[0]
    : memberRelation
  const amountMinor = toMoneyInteger(charge.amount_minor)
  const summary = calculateChargePaymentSummary(
    charge.amount_minor,
    charge.payments,
    charge.due_date,
    businessDate,
  )
  const paymentStatus: ChargePaymentStatus = charge.voided_at
    ? 'void'
    : summary.paymentStatus

  return {
    id: charge.id,
    memberName: member?.display_name ?? '未知成員',
    amountMinor,
    paidMinor: summary.paidMinor,
    unpaidMinor: summary.unpaidMinor,
    currency: charge.currency,
    paymentStatus,
  }
}

export function toBillingPeriodDetails(
  rows: BillingPeriodQueryRow[],
  businessDate: string,
): BillingPeriodDetail[] {
  return rows.map((row) => ({
    id: row.id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    dueDate: row.due_date,
    providerCostMinor: toMoneyInteger(row.provider_cost_minor),
    currency: row.currency,
    charges: row.member_charges.map((charge) =>
      toChargeDetail(charge, businessDate),
    ),
  }))
}

export function getTaipeiBusinessDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const valueByPart = new Map(parts.map((part) => [part.type, part.value]))

  return `${valueByPart.get('year')}-${valueByPart.get('month')}-${valueByPart.get('day')}`
}

export function formatMinorAmount(amount: bigint, currency: string) {
  return `${currency} ${amount.toLocaleString('zh-TW')}`
}

export const paymentStatusLabels: Record<ChargePaymentStatus, string> = {
  unpaid: '未付款',
  partially_paid: '部分付款',
  paid: '已付',
  overpaid: '溢付',
  overdue: '逾期',
  void: '作廢',
}
