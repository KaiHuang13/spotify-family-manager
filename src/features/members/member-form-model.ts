import type {
  AddMemberFieldErrors,
  AddMemberInput,
  DeactivateMemberFieldErrors,
  MemberBasicFieldErrors,
  MemberBasicInput,
  PaymentCycleFieldErrors,
  PaymentCycleInput,
} from '../../types/member'

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

export function validateAddMemberInput(
  input: AddMemberInput,
): AddMemberFieldErrors {
  return validateMemberBasicInput(input)
}

export function validateMemberBasicInput(
  input: MemberBasicInput,
  billingStartedOn?: string | null,
): MemberBasicFieldErrors {
  const errors: MemberBasicFieldErrors = {}

  if (input.displayName.trim() === '') {
    errors.displayName = '請輸入名稱。'
  }

  if (!isIsoCalendarDate(input.joinedOn)) {
    errors.joinedOn = '請輸入有效的加入日期。'
  }

  if (
    !errors.joinedOn &&
    billingStartedOn &&
    input.joinedOn > billingStartedOn
  ) {
    errors.joinedOn = '加入日期不得晚於計費起算日。'
  }

  return errors
}

export function validateDeactivateMemberInput(
  exitedOn: string,
  billingStartedOn: string | null,
): DeactivateMemberFieldErrors {
  const errors: DeactivateMemberFieldErrors = {}

  if (!isIsoCalendarDate(exitedOn)) {
    errors.exitedOn = '請輸入有效的退出日期。'
    return errors
  }

  if (billingStartedOn && exitedOn <= billingStartedOn) {
    errors.exitedOn = '退出日期必須晚於計費起算日。'
  }

  return errors
}

export function validatePaymentCycleInput(
  input: PaymentCycleInput,
): PaymentCycleFieldErrors {
  const errors: PaymentCycleFieldErrors = {}

  if (input.paymentCycle !== 'monthly' && input.paymentCycle !== 'yearly') {
    errors.paymentCycle = '請選擇月繳或年繳。'
  }

  if (!/^(0|[1-9]\d*)$/.test(input.monthlyShareAmount)) {
    errors.monthlyShareAmount = '每月分攤金額必須是非負整數。'
  } else if (!Number.isSafeInteger(Number(input.monthlyShareAmount))) {
    errors.monthlyShareAmount = '每月分攤金額超出可安全處理範圍。'
  }

  return errors
}
