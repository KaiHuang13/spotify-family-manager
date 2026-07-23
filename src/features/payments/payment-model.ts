import type {
  PaymentChargeOption,
  PaymentChargeQueryRow,
  RecordPaymentFieldErrors,
  RecordPaymentInput,
} from '../../types/payment'

function firstRelation<T>(relation: T | T[] | null) {
  return Array.isArray(relation) ? relation[0] : relation
}

function isIsoCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    return false
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function toPaymentChargeOptions(
  rows: PaymentChargeQueryRow[],
): PaymentChargeOption[] {
  return rows.flatMap((row) => {
    const membership = firstRelation(row.subscription_members)
    const member = membership ? firstRelation(membership.members) : null
    const billingPeriod = firstRelation(row.billing_periods)

    if (!membership || !member || !billingPeriod || billingPeriod.status === 'void') {
      return []
    }

    return [
      {
        chargeId: row.id,
        memberId: membership.member_id,
        memberName: member.display_name,
        billingPeriodId: billingPeriod.id,
        periodStart: billingPeriod.period_start,
        periodEnd: billingPeriod.period_end,
        amountMinor: BigInt(row.amount_minor),
        currency: row.currency,
      },
    ]
  })
}

export function validateRecordPaymentInput(
  input: RecordPaymentInput,
  options: PaymentChargeOption[],
): RecordPaymentFieldErrors {
  const errors: RecordPaymentFieldErrors = {}
  const selectedCharge = options.find(
    (option) => option.chargeId === input.memberChargeId,
  )

  if (!input.memberId) {
    errors.memberId = '請選擇成員。'
  }

  if (!selectedCharge || selectedCharge.memberId !== input.memberId) {
    errors.memberChargeId = '請選擇該成員的對應月份。'
  }

  if (!/^[1-9]\d*$/.test(input.amount)) {
    errors.amount = '付款金額必須是大於 0 的整數。'
  } else if (!Number.isSafeInteger(Number(input.amount))) {
    errors.amount = '付款金額超出可安全處理範圍。'
  }

  if (!isIsoCalendarDate(input.paidOn)) {
    errors.paidOn = '請輸入有效的付款日期。'
  }

  if (input.paymentMethod.trim() === '') {
    errors.paymentMethod = '請輸入付款方式。'
  }

  return errors
}
