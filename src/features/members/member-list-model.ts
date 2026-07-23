import type {
  MemberListItem,
  MemberQueryRow,
  MemberSubscriptionPeriod,
} from '../../types/member'

interface ParticipationRange {
  joinedOn: string
  exitedOn: string | null
}

export function getCurrentOrLatestParticipation(
  periods: MemberSubscriptionPeriod[],
): ParticipationRange | null {
  if (periods.length === 0) {
    return null
  }

  const sortedPeriods = [...periods].sort((left, right) =>
    left.start_date.localeCompare(right.start_date),
  )
  const latestPeriod = sortedPeriods.at(-1)

  if (!latestPeriod) {
    return null
  }

  let joinedOn = latestPeriod.start_date

  for (let index = sortedPeriods.length - 2; index >= 0; index -= 1) {
    const previousPeriod = sortedPeriods[index]

    if (previousPeriod.end_date !== joinedOn) {
      break
    }

    joinedOn = previousPeriod.start_date
  }

  return {
    joinedOn,
    exitedOn: latestPeriod.end_date,
  }
}

export function toMemberListItems(rows: MemberQueryRow[]): MemberListItem[] {
  return rows.map((row) => {
    const participation = getCurrentOrLatestParticipation(
      row.subscription_members,
    )
    const latestPeriod = [...row.subscription_members].sort((left, right) =>
      left.start_date.localeCompare(right.start_date),
    ).at(-1)
    const activePeriod = latestPeriod?.end_date === null ? latestPeriod : null

    return {
      id: row.id,
      displayName: row.display_name,
      status: row.status === 'active' ? 'active' : 'inactive',
      joinedOn: row.joined_on ?? participation?.joinedOn ?? null,
      billingStartedOn: participation?.joinedOn ?? null,
      subscriptionMemberId: activePeriod?.id ?? null,
      paymentCycle: activePeriod?.payment_frequency ?? null,
      monthlyShareMinor: activePeriod?.monthly_share_minor ?? null,
      currency: activePeriod?.currency ?? null,
      exitedOn: participation?.exitedOn ?? row.deactivated_on ?? null,
      notes: row.notes?.trim() || null,
    }
  })
}
