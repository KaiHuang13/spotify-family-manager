import { useState, type FormEvent } from 'react'
import type {
  CreateBillingPeriodFieldErrors,
  CreateBillingPeriodInput,
} from '../../types/billing'
import { createMonthlyBillingPeriod } from './billing-api'
import {
  addOneCalendarMonth,
  validateCreateBillingPeriodInput,
} from './billing-period-model'

const initialInput: CreateBillingPeriodInput = {
  periodStart: '',
  periodEnd: '',
  dueDate: '',
  providerCostAmount: '298',
}

interface CreateBillingPeriodFormProps {
  onCreated(): void
}

export function CreateBillingPeriodForm({
  onCreated,
}: CreateBillingPeriodFormProps) {
  const [input, setInput] = useState(initialInput)
  const [fieldErrors, setFieldErrors] =
    useState<CreateBillingPeriodFieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateInput(
    field: keyof CreateBillingPeriodInput,
    value: string,
  ) {
    setInput((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setSubmitError(null)
    setSuccessMessage(null)
  }

  function updatePeriodStart(value: string) {
    const suggestedPeriodEnd = addOneCalendarMonth(value)

    setInput((current) => ({
      ...current,
      periodStart: value,
      periodEnd: suggestedPeriodEnd ?? current.periodEnd,
    }))
    setFieldErrors((current) => ({
      ...current,
      periodStart: undefined,
      periodEnd: undefined,
    }))
    setSubmitError(null)
    setSuccessMessage(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextFieldErrors = validateCreateBillingPeriodInput(input)

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors)
      setSubmitError(null)
      setSuccessMessage(null)
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    setSuccessMessage(null)

    const errorMessage = await createMonthlyBillingPeriod(input)

    setIsSubmitting(false)

    if (errorMessage) {
      setSubmitError(errorMessage)
      return
    }

    setInput(initialInput)
    setFieldErrors({})
    setSuccessMessage('月份費用與成員應收已建立。')
    onCreated()
  }

  return (
    <form className="billing-period-form" onSubmit={handleSubmit} noValidate>
      <div className="billing-period-heading">
        <div>
          <p className="eyebrow">手動建立</p>
          <h2>月份費用</h2>
        </div>
        <p>
          只計入計費開始日當時已開始計費的成員；年繳本次不套用預繳抵扣。
        </p>
      </div>

      <div className="member-form-grid billing-period-grid">
        <div className="form-field">
          <label htmlFor="billing-period-start">計費開始日</label>
          <input
            id="billing-period-start"
            type="date"
            value={input.periodStart}
            onChange={(event) => updatePeriodStart(event.target.value)}
            aria-invalid={Boolean(fieldErrors.periodStart)}
            aria-describedby={
              fieldErrors.periodStart ? 'billing-period-start-error' : undefined
            }
            disabled={isSubmitting}
            required
          />
          {fieldErrors.periodStart ? (
            <span id="billing-period-start-error" className="field-error">
              {fieldErrors.periodStart}
            </span>
          ) : null}
        </div>

        <div className="form-field">
          <label htmlFor="billing-period-end">計費結束日</label>
          <input
            id="billing-period-end"
            type="date"
            value={input.periodEnd}
            onChange={(event) => updateInput('periodEnd', event.target.value)}
            aria-invalid={Boolean(fieldErrors.periodEnd)}
            aria-describedby={
              fieldErrors.periodEnd ? 'billing-period-end-error' : undefined
            }
            disabled={isSubmitting}
            required
          />
          {fieldErrors.periodEnd ? (
            <span id="billing-period-end-error" className="field-error">
              {fieldErrors.periodEnd}
            </span>
          ) : null}
        </div>

        <div className="form-field">
          <label htmlFor="billing-period-due-date">付款期限</label>
          <input
            id="billing-period-due-date"
            type="date"
            value={input.dueDate}
            onChange={(event) => updateInput('dueDate', event.target.value)}
            aria-invalid={Boolean(fieldErrors.dueDate)}
            aria-describedby={
              fieldErrors.dueDate ? 'billing-period-due-date-error' : undefined
            }
            disabled={isSubmitting}
            required
          />
          {fieldErrors.dueDate ? (
            <span id="billing-period-due-date-error" className="field-error">
              {fieldErrors.dueDate}
            </span>
          ) : null}
        </div>

        <div className="form-field">
          <label htmlFor="billing-period-provider-cost">
            Spotify 當期總費用（最小貨幣單位）
          </label>
          <input
            id="billing-period-provider-cost"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={input.providerCostAmount}
            onChange={(event) =>
              updateInput('providerCostAmount', event.target.value)
            }
            aria-invalid={Boolean(fieldErrors.providerCostAmount)}
            aria-describedby={
              fieldErrors.providerCostAmount
                ? 'billing-period-provider-cost-error'
                : undefined
            }
            disabled={isSubmitting}
            required
          />
          {fieldErrors.providerCostAmount ? (
            <span id="billing-period-provider-cost-error" className="field-error">
              {fieldErrors.providerCostAmount}
            </span>
          ) : null}
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
        {isSubmitting ? '建立中…' : '新增月份費用'}
      </button>
    </form>
  )
}
