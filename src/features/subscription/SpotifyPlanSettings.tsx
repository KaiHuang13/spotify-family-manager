import { useEffect, useState, type FormEvent } from 'react'
import type { SpotifyPlan } from '../../types/subscription'
import { formatMinorAmount } from '../billing/billing-period-detail-model'
import {
  fetchSpotifyPlan,
  updateSpotifyPlanStartDate,
} from './subscription-api'

interface SpotifyPlanSettingsProps {
  ownerId: string
}

export function SpotifyPlanSettings({ ownerId }: SpotifyPlanSettingsProps) {
  const [plan, setPlan] = useState<SpotifyPlan | null>(null)
  const [startedOn, setStartedOn] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    void fetchSpotifyPlan(ownerId).then((result) => {
      if (!isActive) return
      setPlan(result.plan)
      setStartedOn(result.plan?.startedOn ?? '')
      setErrorMessage(result.errorMessage)
      setIsLoading(false)
    })

    return () => {
      isActive = false
    }
  }, [ownerId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!plan || !/^\d{4}-\d{2}-\d{2}$/.test(startedOn)) {
      setErrorMessage('請輸入有效的方案開始日。')
      return
    }

    setIsSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    const nextError = await updateSpotifyPlanStartDate(
      ownerId,
      plan.id,
      startedOn,
    )
    setIsSaving(false)

    if (nextError) {
      setErrorMessage(nextError)
      return
    }

    setPlan({ ...plan, startedOn })
    setSuccessMessage('方案開始日已更新。')
  }

  if (isLoading) {
    return <p className="members-state">正在載入方案設定…</p>
  }

  if (!plan) {
    return <p className="members-state members-error">{errorMessage}</p>
  }

  return (
    <form className="member-form" onSubmit={handleSubmit} noValidate>
      <div className="member-panel-heading settings-heading">
        <h2>Spotify 方案設定</h2>
        <p>方案日期屬於整體訂閱，不會當成個別成員的加入日期。</p>
      </div>
      <dl className="billing-summary">
        <div>
          <dt>方案</dt>
          <dd>{plan.planName}</dd>
        </div>
        <div>
          <dt>目前方案費用</dt>
          <dd>{formatMinorAmount(plan.currentCostMinor, plan.currency)}</dd>
        </div>
      </dl>
      <div className="form-field settings-date-field">
        <label htmlFor="spotify-plan-started-on">方案開始日</label>
        <input
          id="spotify-plan-started-on"
          type="date"
          value={startedOn}
          onChange={(event) => {
            setStartedOn(event.target.value)
            setErrorMessage(null)
            setSuccessMessage(null)
          }}
          disabled={isSaving}
          required
        />
        <span className="field-help">
          新成員的加入日與計費起算日不得早於此日期。
        </span>
      </div>
      {errorMessage ? <p className="form-message field-error">{errorMessage}</p> : null}
      {successMessage ? <p className="form-message form-success">{successMessage}</p> : null}
      <button type="submit" disabled={isSaving}>
        {isSaving ? '儲存中…' : '儲存方案開始日'}
      </button>
    </form>
  )
}

