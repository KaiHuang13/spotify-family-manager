import { useState, type FormEvent } from 'react'
import type {
  AddMemberFieldErrors,
  AddMemberInput,
} from '../../types/member'
import { createMember } from './member-api'
import { validateAddMemberInput } from './member-form-model'

interface AddMemberFormProps {
  onCreated(): void
}

const initialInput: AddMemberInput = {
  displayName: '',
  joinedOn: '',
  notes: '',
}

export function AddMemberForm({ onCreated }: AddMemberFormProps) {
  const [input, setInput] = useState(initialInput)
  const [fieldErrors, setFieldErrors] = useState<AddMemberFieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateInput(field: keyof AddMemberInput, value: string) {
    setInput((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setSubmitError(null)
    setSuccessMessage(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextFieldErrors = validateAddMemberInput(input)

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors)
      setSubmitError(null)
      setSuccessMessage(null)
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    setSuccessMessage(null)

    const errorMessage = await createMember(input)

    setIsSubmitting(false)

    if (errorMessage) {
      setSubmitError(errorMessage)
      return
    }

    setInput(initialInput)
    setFieldErrors({})
    setSuccessMessage('成員已新增。')
    onCreated()
  }

  return (
    <form className="member-form" onSubmit={handleSubmit} noValidate>
      <div className="member-form-grid">
        <div className="form-field">
          <label htmlFor="member-display-name">名稱</label>
          <input
            id="member-display-name"
            value={input.displayName}
            onChange={(event) => updateInput('displayName', event.target.value)}
            aria-invalid={Boolean(fieldErrors.displayName)}
            aria-describedby={
              fieldErrors.displayName ? 'member-display-name-error' : undefined
            }
            disabled={isSubmitting}
            required
          />
          {fieldErrors.displayName ? (
            <span id="member-display-name-error" className="field-error">
              {fieldErrors.displayName}
            </span>
          ) : null}
        </div>

        <div className="form-field">
          <label htmlFor="member-joined-on">加入日期</label>
          <input
            id="member-joined-on"
            type="date"
            value={input.joinedOn}
            onChange={(event) => updateInput('joinedOn', event.target.value)}
            aria-invalid={Boolean(fieldErrors.joinedOn)}
            aria-describedby={
              fieldErrors.joinedOn ? 'member-joined-on-error' : undefined
            }
            disabled={isSubmitting}
            required
          />
          {fieldErrors.joinedOn ? (
            <span id="member-joined-on-error" className="field-error">
              {fieldErrors.joinedOn}
            </span>
          ) : null}
        </div>

        <p className="field-help form-field-wide">
          計費起算日會自動設為實際加入日期。
        </p>

        <div className="form-field form-field-wide">
          <label htmlFor="member-notes">備註</label>
          <textarea
            id="member-notes"
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
        {isSubmitting ? '新增中…' : '新增成員'}
      </button>
    </form>
  )
}
