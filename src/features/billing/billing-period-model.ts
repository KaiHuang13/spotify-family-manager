import type {
  CreateBillingPeriodFieldErrors,
  CreateBillingPeriodInput,
} from '../../types/billing'

function parseIsoCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return { year, month, day }
}

export function addOneCalendarMonth(value: string): string | null {
  const parsedDate = parseIsoCalendarDate(value)

  if (!parsedDate) {
    return null
  }

  const targetMonthIndex = parsedDate.month
  const targetYear =
    parsedDate.year + Math.floor(targetMonthIndex / 12)
  const normalizedTargetMonthIndex = targetMonthIndex % 12
  const lastTargetDay = new Date(
    Date.UTC(targetYear, normalizedTargetMonthIndex + 1, 0),
  ).getUTCDate()
  const targetDay = Math.min(parsedDate.day, lastTargetDay)

  return [
    String(targetYear).padStart(4, '0'),
    String(normalizedTargetMonthIndex + 1).padStart(2, '0'),
    String(targetDay).padStart(2, '0'),
  ].join('-')
}

export function validateCreateBillingPeriodInput(
  input: CreateBillingPeriodInput,
): CreateBillingPeriodFieldErrors {
  const errors: CreateBillingPeriodFieldErrors = {}
  const expectedPeriodEnd = addOneCalendarMonth(input.periodStart)

  if (!expectedPeriodEnd) {
    errors.periodStart = '請輸入有效的計費開始日。'
  }

  if (!parseIsoCalendarDate(input.periodEnd)) {
    errors.periodEnd = '請輸入有效的計費結束日。'
  } else if (expectedPeriodEnd && input.periodEnd !== expectedPeriodEnd) {
    errors.periodEnd = '計費結束日必須是開始日的一個月後。'
  }

  if (!parseIsoCalendarDate(input.dueDate)) {
    errors.dueDate = '請輸入有效的到期日。'
  } else if (!errors.periodStart && input.dueDate < input.periodStart) {
    errors.dueDate = '付款期限不得早於計費開始日。'
  }

  if (!/^(0|[1-9]\d*)$/.test(input.providerCostAmount)) {
    errors.providerCostAmount = 'Spotify 當期總費用必須是非負整數。'
  } else if (!Number.isSafeInteger(Number(input.providerCostAmount))) {
    errors.providerCostAmount = 'Spotify 當期總費用超出可安全處理範圍。'
  }

  return errors
}
