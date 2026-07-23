import { useState, type FormEvent } from 'react'
import type {
  MemberBasicFieldErrors,
  MemberBasicInput,
  MemberListItem,
} from '../../types/member'
import { updateMember } from './member-api'
import { validateMemberBasicInput } from './member-form-model'

interface EditMemberFormProps {
  member: MemberListItem
  ownerId: string
  onCancel(): void
  onSaved(): void
}

export function EditMemberForm({
  member,
  ownerId,
  onCancel,
  onSaved,
}: EditMemberFormProps) {
  const [input, setInput] = useState<MemberBasicInput>({
    displayName: member.displayName,
    joinedOn: member.joinedOn ?? '',
    notes: member.notes ?? '',
  })
  const [fieldErrors, setFieldErrors] = useState<MemberBasicFieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateInput(field: keyof MemberBasicInput, value: string) {
    setInput((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setSubmitError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextFieldErrors = validateMemberBasicInput(
      input,
      member.billingStartedOn,
    )

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors)
      setSubmitError(null)
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    const errorMessage = await updateMember(ownerId, member.id, input)

    setIsSubmitting(false)

    if (errorMessage) {
      setSubmitError(errorMessage)
      return
    }

    onSaved()
  }

  return (
    <form className="member-form edit-member-form" onSubmit={handleSubmit} noValidate>
      <div className="edit-form-heading">
        <div>
          <h3>修改成員基本資料</h3>
          <p>只更新名稱、加入日期與備註。</p>
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
          <label htmlFor="edit-member-display-name">名稱</label>
          <input
            id="edit-member-display-name"
            value={input.displayName}
            onChange={(event) => updateInput('displayName', event.target.value)}
            aria-invalid={Boolean(fieldErrors.displayName)}
            aria-describedby={
              fieldErrors.displayName
                ? 'edit-member-display-name-error'
                : undefined
            }
            disabled={isSubmitting}
            required
          />
          {fieldErrors.displayName ? (
            <span id="edit-member-display-name-error" className="field-error">
              {fieldErrors.displayName}
            </span>
          ) : null}
        </div>

        <div className="form-field">
          <label htmlFor="edit-member-joined-on">加入日期</label>
          <input
            id="edit-member-joined-on"
            type="date"
            value={input.joinedOn}
            onChange={(event) => updateInput('joinedOn', event.target.value)}
            aria-invalid={Boolean(fieldErrors.joinedOn)}
            aria-describedby={
              fieldErrors.joinedOn ? 'edit-member-joined-on-error' : undefined
            }
            disabled={isSubmitting}
            required
          />
          {fieldErrors.joinedOn ? (
            <span id="edit-member-joined-on-error" className="field-error">
              {fieldErrors.joinedOn}
            </span>
          ) : null}
        </div>

        <div className="form-field form-field-wide">
          <label htmlFor="edit-member-notes">備註</label>
          <textarea
            id="edit-member-notes"
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

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? '儲存中…' : '儲存修改'}
      </button>
    </form>
  )
}
