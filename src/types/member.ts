export interface MemberSubscriptionPeriod {
  id?: string
  start_date: string
  end_date: string | null
  payment_frequency?: PaymentCycle | null
  monthly_share_minor?: number | null
  currency?: string | null
}

export type PaymentCycle = 'monthly' | 'yearly'

export interface MemberQueryRow {
  id: string
  display_name: string
  joined_on: string | null
  deactivated_on: string | null
  status: string
  notes: string | null
  subscription_members: MemberSubscriptionPeriod[]
}

export interface MemberBasicInput {
  displayName: string
  joinedOn: string
  notes: string
}

export type AddMemberInput = MemberBasicInput

export interface DeactivateMemberInput {
  exitedOn: string
}

export interface PaymentCycleInput {
  paymentCycle: PaymentCycle | ''
  monthlyShareAmount: string
}

export type PaymentCycleFieldErrors = Partial<
  Record<keyof PaymentCycleInput, string>
>

export type DeactivateMemberFieldErrors = Partial<
  Record<keyof DeactivateMemberInput, string>
>

export type MemberBasicFieldErrors = Partial<
  Record<keyof MemberBasicInput, string>
>

export type AddMemberFieldErrors = Partial<
  Record<keyof AddMemberInput, string>
>

export interface MemberListItem {
  id: string
  displayName: string
  status: 'active' | 'inactive'
  joinedOn: string | null
  billingStartedOn: string | null
  subscriptionMemberId: string | null
  paymentCycle: PaymentCycle | null
  monthlyShareMinor: number | null
  currency: string | null
  exitedOn: string | null
  notes: string | null
}
