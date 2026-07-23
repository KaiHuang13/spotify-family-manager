import { useState, type FormEvent } from 'react'
import type {
  MemberListItem,
  PaymentCycleFieldErrors,
  PaymentCycleInput,
} from '../../types/member'
import { configureMemberPaymentCycle } from './member-api'
import { validatePaymentCycleInput } from './member-form-model'

interface PaymentCycleFormProps {
  member: MemberListItem
  onCancel(): void
  onSaved(): void
}

export function PaymentCycleForm({
  member,
  onCancel,
  onSaved,
}: PaymentCycleFormProps) {
  const [input, setInput] = useState<PaymentCycleInput>({
    paymentCycle: member.paymentCycle ?? '',
    monthlyShareAmount:
      member.monthlyShareMinor === null
        ? ''
        : String(member.monthlyShareMinor),
  })
  const [fieldErrors, setFieldErrors] = useState<PaymentCycleFieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextFieldErrors = validatePaymentCycleInput(input)

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors)
      setSubmitError(null)
      return
    }

    if (!member.subscriptionMemberId) {
      setSubmitError('找不到有效的成員訂閱期間。')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    const errorMessage = await configureMemberPaymentCycle(
      member.subscriptionMemberId,
      input,
    )

    setIsSubmitting(false)

    if (errorMessage) {
      setSubmitError(errorMessage)
      return
    }

    onSaved()
  }

  return (
    <form className="member-form payment-cycle-form" onSubmit={handleSubmit} noValidate>
      <div className="edit-form-heading">
        <div>
          <h3>設定繳費週期</h3>
          <p>
            為「{member.displayName}」設定週期。Yearly 只代表一次預繳 12
            個月，本次不會建立付款或預繳抵扣。
          </p>
        </div>
        <button
          className="button-secondary"
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          取消
        </button>
      </div>

      <div className="member-form-grid edit-member-form-grid">
        <div className="form-field">
          <label htmlFor="member-payment-cycle">繳費週期</label>
          <select
            id="member-payment-cycle"
            value={input.paymentCycle}
            onChange={(event) => {
              const paymentCycle = event.target.value

              setInput((current) => ({
                ...current,
                paymentCycle:
                  paymentCycle === 'monthly' || paymentCycle === 'yearly'
                    ? paymentCycle
                    : '',
              }))
              setFieldErrors((current) => ({
                ...current,
                paymentCycle: undefined,
              }))
              setSubmitError(null)
            }}
            aria-invalid={Boolean(fieldErrors.paymentCycle)}
            aria-describedby={
              fieldErrors.paymentCycle ? 'member-payment-cycle-error' : undefined
            }
            disabled={isSubmitting}
            required
          >
            <option value="">請選擇</option>
            <option value="monthly">Monthly（月繳）</option>
            <option value="yearly">Yearly（一次預繳 12 個月）</option>
          </select>
          {fieldErrors.paymentCycle ? (
            <span id="member-payment-cycle-error" className="field-error">
              {fieldErrors.paymentCycle}
            </span>
          ) : null}
        </div>

        <div className="form-field">
          <label htmlFor="member-monthly-share-amount">
            每月應分攤金額（最小貨幣單位）
          </label>
          <input
            id="member-monthly-share-amount"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={input.monthlyShareAmount}
            onChange={(event) => {
              setInput((current) => ({
                ...current,
                monthlyShareAmount: event.target.value,
              }))
              setFieldErrors((current) => ({
                ...current,
                monthlyShareAmount: undefined,
              }))
              setSubmitError(null)
            }}
            aria-invalid={Boolean(fieldErrors.monthlyShareAmount)}
            aria-describedby={
              fieldErrors.monthlyShareAmount
                ? 'member-monthly-share-amount-error'
                : 'member-monthly-share-amount-help'
            }
            disabled={isSubmitting}
            required
          />
          <span id="member-monthly-share-amount-help" className="field-help">
            即使選擇 Yearly，此欄仍是單月應分攤金額。
          </span>
          {fieldErrors.monthlyShareAmount ? (
            <span id="member-monthly-share-amount-error" className="field-error">
              {fieldErrors.monthlyShareAmount}
            </span>
          ) : null}
        </div>
      </div>

      {submitError ? (
        <p className="form-message field-error" role="alert">
          {submitError}
        </p>
      ) : null}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? '儲存中…' : '儲存繳費設定'}
      </button>
    </form>
  )
}
