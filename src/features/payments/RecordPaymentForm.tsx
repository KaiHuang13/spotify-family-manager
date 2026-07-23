import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type {
  PaymentChargeOption,
  RecordPaymentFieldErrors,
  RecordPaymentInput,
} from '../../types/payment'
import { fetchPaymentChargeOptions, recordPayment } from './payment-api'
import { validateRecordPaymentInput } from './payment-model'

interface RecordPaymentFormProps {
  ownerId: string
  onRecorded(): void
}

const initialInput: RecordPaymentInput = {
  memberId: '',
  memberChargeId: '',
  amount: '',
  paidOn: '',
  paymentMethod: '',
  notes: '',
}

export function RecordPaymentForm({
  ownerId,
  onRecorded,
}: RecordPaymentFormProps) {
  const [options, setOptions] = useState<PaymentChargeOption[]>([])
  const [input, setInput] = useState(initialInput)
  const [fieldErrors, setFieldErrors] = useState<RecordPaymentFieldErrors>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [optionsVersion, setOptionsVersion] = useState(0)

  useEffect(() => {
    let isActive = true

    void fetchPaymentChargeOptions(ownerId).then((result) => {
      if (!isActive) {
        return
      }

      setOptions(result.options)
      setLoadError(result.errorMessage)
      setIsLoading(false)
    })

    return () => {
      isActive = false
    }
  }, [ownerId, optionsVersion])

  const members = useMemo(
    () =>
      Array.from(
        new Map(
          options.map((option) => [
            option.memberId,
            { id: option.memberId, name: option.memberName },
          ]),
        ).values(),
      ).sort((left, right) => left.name.localeCompare(right.name, 'zh-TW')),
    [options],
  )
  const memberChargeOptions = options.filter(
    (option) => option.memberId === input.memberId,
  )

  function updateInput(field: keyof RecordPaymentInput, value: string) {
    setInput((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setSubmitError(null)
    setSuccessMessage(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextFieldErrors = validateRecordPaymentInput(input, options)

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors)
      setSubmitError(null)
      setSuccessMessage(null)
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    setSuccessMessage(null)

    const errorMessage = await recordPayment(input)

    setIsSubmitting(false)

    if (errorMessage) {
      setSubmitError(errorMessage)
      return
    }

    setInput(initialInput)
    setFieldErrors({})
    setSuccessMessage('付款已登記。')
    setIsLoading(true)
    setOptionsVersion((version) => version + 1)
    onRecorded()
  }

  if (isLoading) {
    return (
      <p className="billing-detail-state" role="status" aria-live="polite">
        正在載入付款選項…
      </p>
    )
  }

  if (loadError) {
    return (
      <p className="billing-detail-state members-error" role="alert">
        {loadError}
      </p>
    )
  }

  return (
    <form className="record-payment-form" onSubmit={handleSubmit} noValidate>
      <div className="billing-period-heading">
        <div>
          <p className="eyebrow">手動登記</p>
          <h2>付款</h2>
        </div>
        <p>每次送出都會建立一筆獨立付款紀錄，不會修改原始應收金額。</p>
      </div>

      {options.length === 0 ? (
        <p className="billing-detail-state">目前沒有可登記付款的成員月份費用。</p>
      ) : (
        <>
          <div className="member-form-grid payment-form-grid">
            <div className="form-field">
              <label htmlFor="payment-member">成員</label>
              <select
                id="payment-member"
                value={input.memberId}
                onChange={(event) => {
                  setInput((current) => ({
                    ...current,
                    memberId: event.target.value,
                    memberChargeId: '',
                  }))
                  setFieldErrors((current) => ({
                    ...current,
                    memberId: undefined,
                    memberChargeId: undefined,
                  }))
                  setSubmitError(null)
                  setSuccessMessage(null)
                }}
                aria-invalid={Boolean(fieldErrors.memberId)}
                aria-describedby={
                  fieldErrors.memberId ? 'payment-member-error' : undefined
                }
                disabled={isSubmitting}
                required
              >
                <option value="">請選擇</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
              {fieldErrors.memberId ? (
                <span id="payment-member-error" className="field-error">
                  {fieldErrors.memberId}
                </span>
              ) : null}
            </div>

            <div className="form-field">
              <label htmlFor="payment-member-charge">對應月份</label>
              <select
                id="payment-member-charge"
                value={input.memberChargeId}
                onChange={(event) =>
                  updateInput('memberChargeId', event.target.value)
                }
                aria-invalid={Boolean(fieldErrors.memberChargeId)}
                aria-describedby={
                  fieldErrors.memberChargeId
                    ? 'payment-member-charge-error'
                    : undefined
                }
                disabled={isSubmitting || !input.memberId}
                required
              >
                <option value="">請選擇</option>
                {memberChargeOptions.map((option) => (
                  <option key={option.chargeId} value={option.chargeId}>
                    {option.periodStart} ～ {option.periodEnd}
                  </option>
                ))}
              </select>
              {fieldErrors.memberChargeId ? (
                <span id="payment-member-charge-error" className="field-error">
                  {fieldErrors.memberChargeId}
                </span>
              ) : null}
            </div>

            <div className="form-field">
              <label htmlFor="payment-amount">
                付款金額（最小貨幣單位）
              </label>
              <input
                id="payment-amount"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={input.amount}
                onChange={(event) => updateInput('amount', event.target.value)}
                aria-invalid={Boolean(fieldErrors.amount)}
                aria-describedby={
                  fieldErrors.amount ? 'payment-amount-error' : undefined
                }
                disabled={isSubmitting}
                required
              />
              {fieldErrors.amount ? (
                <span id="payment-amount-error" className="field-error">
                  {fieldErrors.amount}
                </span>
              ) : null}
            </div>

            <div className="form-field">
              <label htmlFor="payment-paid-on">付款日期</label>
              <input
                id="payment-paid-on"
                type="date"
                value={input.paidOn}
                onChange={(event) => updateInput('paidOn', event.target.value)}
                aria-invalid={Boolean(fieldErrors.paidOn)}
                aria-describedby={
                  fieldErrors.paidOn ? 'payment-paid-on-error' : undefined
                }
                disabled={isSubmitting}
                required
              />
              {fieldErrors.paidOn ? (
                <span id="payment-paid-on-error" className="field-error">
                  {fieldErrors.paidOn}
                </span>
              ) : null}
            </div>

            <div className="form-field">
              <label htmlFor="payment-method">付款方式</label>
              <input
                id="payment-method"
                value={input.paymentMethod}
                onChange={(event) =>
                  updateInput('paymentMethod', event.target.value)
                }
                aria-invalid={Boolean(fieldErrors.paymentMethod)}
                aria-describedby={
                  fieldErrors.paymentMethod ? 'payment-method-error' : undefined
                }
                disabled={isSubmitting}
                required
              />
              {fieldErrors.paymentMethod ? (
                <span id="payment-method-error" className="field-error">
                  {fieldErrors.paymentMethod}
                </span>
              ) : null}
            </div>

            <div className="form-field form-field-wide">
              <label htmlFor="payment-notes">備註</label>
              <textarea
                id="payment-notes"
                value={input.notes}
                onChange={(event) => updateInput('notes', event.target.value)}
                disabled={isSubmitting}
                rows={3}
              />
            </div>
          </div>

          {submitError ? (
            <p className="form-message field-error" role="alert">
              {submitError}
            </p>
          ) : null}
          {successMessage ? (
            <p className="form-message form-success" role="status">
              {successMessage}
            </p>
          ) : null}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '登記中…' : '登記付款'}
          </button>
        </>
      )}
    </form>
  )
}
