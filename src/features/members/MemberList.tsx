import { useEffect, useState } from 'react'
import type { MemberListItem } from '../../types/member'
import { fetchMembers } from './member-api'

interface MemberListProps {
  ownerId: string
  onEdit(member: MemberListItem): void
  onDeactivate(member: MemberListItem): void
  onConfigurePayment(member: MemberListItem): void
}

function displayDate(value: string | null) {
  return value ?? '—'
}

export function MemberList({
  ownerId,
  onEdit,
  onDeactivate,
  onConfigurePayment,
}: MemberListProps) {
  const [members, setMembers] = useState<MemberListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    void fetchMembers(ownerId).then((result) => {
      if (!isActive) {
        return
      }

      setMembers(result.members)
      setErrorMessage(result.errorMessage)
      setIsLoading(false)
    })

    return () => {
      isActive = false
    }
  }, [ownerId])

  if (isLoading) {
    return (
      <p className="members-state" role="status" aria-live="polite">
        正在載入成員清單…
      </p>
    )
  }

  if (errorMessage) {
    return (
      <p className="members-state members-error" role="alert">
        {errorMessage}
      </p>
    )
  }

  if (members.length === 0) {
    return <p className="members-state">目前沒有成員資料。</p>
  }

  return (
    <div className="member-table-wrapper">
      <table className="member-table">
        <thead>
          <tr>
            <th scope="col">名稱</th>
            <th scope="col">狀態</th>
            <th scope="col">加入日期</th>
            <th scope="col">計費起算日</th>
            <th scope="col">退出日期</th>
            <th scope="col">繳費週期</th>
            <th scope="col">每月分攤</th>
            <th scope="col">備註</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <td>{member.displayName}</td>
              <td>
                <span className={`status-badge status-${member.status}`}>
                  {member.status === 'active' ? '啟用' : '停用'}
                </span>
              </td>
              <td>{displayDate(member.joinedOn)}</td>
              <td>{displayDate(member.billingStartedOn)}</td>
              <td>{displayDate(member.exitedOn)}</td>
              <td>
                {member.paymentCycle === 'monthly'
                  ? '月繳'
                  : member.paymentCycle === 'yearly'
                    ? '年繳'
                    : '尚未設定'}
              </td>
              <td>
                {member.monthlyShareMinor === null
                  ? '—'
                  : `${member.currency ?? 'TWD'} ${member.monthlyShareMinor.toLocaleString('zh-TW')}`}
              </td>
              <td className="member-notes">{member.notes ?? '—'}</td>
              <td>
                <div className="member-actions">
                  <button
                    className="button-secondary table-action"
                    type="button"
                    onClick={() => onEdit(member)}
                  >
                    修改
                  </button>
                  {member.status === 'active' ? (
                    <>
                      {member.subscriptionMemberId && !member.paymentCycle ? (
                        <button
                          className="button-secondary table-action"
                          type="button"
                          onClick={() => onConfigurePayment(member)}
                        >
                          繳費設定
                        </button>
                      ) : null}
                      <button
                        className="button-danger table-action"
                        type="button"
                        onClick={() => onDeactivate(member)}
                      >
                        退出
                      </button>
                    </>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
