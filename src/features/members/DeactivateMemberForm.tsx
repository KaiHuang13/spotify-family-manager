import { useState, type FormEvent } from 'react'
import type {
  DeactivateMemberFieldErrors,
  MemberListItem,
} from '../../types/member'
import { deactivateMember } from './member-api'
import { validateDeactivateMemberInput } from './member-form-model'

interface DeactivateMemberFormProps {
  member: MemberListItem
  onCancel(): void
  onDeactivated(): void
}

export function DeactivateMemberForm({
  member,
  onCancel,
  onDeactivated,
}: DeactivateMemberFormProps) {
  const [exitedOn, setExitedOn] = useState('')
  const [fieldErrors, setFieldErrors] =
    useState<DeactivateMemberFieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextFieldErrors = validateDeactivateMemberInput(
      exitedOn,
      member.billingStartedOn,
    )

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors)
      setSubmitError(null)
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    const errorMessage = await deactivateMember(member.id, exitedOn)

    setIsSubmitting(false)

    if (errorMessage) {
      setSubmitError(errorMessage)
      return
    }

    onDeactivated()
  }

  return (
    <form
      className="member-form deactivate-member-form"
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="edit-form-heading">
        <div>
          <h3>確認成員退出</h3>
          <p>
            確定要將「{member.displayName}」設為停用嗎？計費、費用與付款歷史會完整保留。
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

      <div className="form-field deactivate-date-field">
        <label htmlFor="member-exited-on">退出日期</label>
        <input
          id="member-exited-on"
          type="date"
          value={exitedOn}
          onChange={(event) => {
            setExitedOn(event.target.value)
            setFieldErrors({})
            setSubmitError(null)
          }}
          aria-invalid={Boolean(fieldErrors.exitedOn)}
          aria-describedby={
            fieldErrors.exitedOn ? 'member-exited-on-error' : undefined
          }
          disabled={isSubmitting}
          required
        />
        {fieldErrors.exitedOn ? (
          <span id="member-exited-on-error" className="field-error">
            {fieldErrors.exitedOn}
          </span>
        ) : null}
      </div>

      {submitError ? (
        <p className="form-message field-error" role="alert">
          {submitError}
        </p>
      ) : null}

      <button className="button-danger" type="submit" disabled={isSubmitting}>
        {isSubmitting ? '停用中…' : '確認退出並停用'}
      </button>
    </form>
  )
}
