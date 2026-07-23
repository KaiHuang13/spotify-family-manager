import { supabase } from '../../lib/supabase'
import type {
  AddMemberInput,
  MemberBasicInput,
  MemberListItem,
  MemberQueryRow,
  PaymentCycleInput,
} from '../../types/member'
import { toMemberListItems } from './member-list-model'

interface MemberListResult {
  members: MemberListItem[]
  errorMessage: string | null
}

const memberListErrorMessage = '無法載入成員清單，請稍後再試一次。'
const createMemberErrorMessage = '無法新增成員，請稍後再試一次。'
const updateMemberErrorMessage = '無法更新成員，請稍後再試一次。'
const deactivateMemberErrorMessage = '無法停用成員，請稍後再試一次。'
const paymentCycleErrorMessage = '無法儲存繳費週期，請稍後再試一次。'

export async function fetchMembers(ownerId: string): Promise<MemberListResult> {
  try {
    const { data, error } = await supabase
      .from('members')
      .select(
        `
          id,
          display_name,
          joined_on,
          deactivated_on,
          status,
          notes,
          subscription_members (
            id,
            start_date,
            end_date,
            payment_frequency,
            monthly_share_minor,
            currency
          )
        `,
      )
      .eq('owner_id', ownerId)
      .order('display_name', { ascending: true })

    if (error) {
      return { members: [], errorMessage: memberListErrorMessage }
    }

    return {
      members: toMemberListItems((data ?? []) as MemberQueryRow[]),
      errorMessage: null,
    }
  } catch {
    return { members: [], errorMessage: memberListErrorMessage }
  }
}

export async function createMember(
  input: AddMemberInput,
): Promise<string | null> {
  try {
    const { error } = await supabase.rpc('create_member_with_subscription', {
      p_display_name: input.displayName.trim(),
      p_joined_on: input.joinedOn,
      p_notes: input.notes.trim() || null,
    })

    return error ? createMemberErrorMessage : null
  } catch {
    return createMemberErrorMessage
  }
}

export async function updateMember(
  ownerId: string,
  memberId: string,
  input: MemberBasicInput,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('members')
      .update({
        display_name: input.displayName.trim(),
        joined_on: input.joinedOn,
        notes: input.notes.trim() || null,
      })
      .eq('id', memberId)
      .eq('owner_id', ownerId)
      .select('id')
      .maybeSingle()

    return error || !data ? updateMemberErrorMessage : null
  } catch {
    return updateMemberErrorMessage
  }
}

export async function deactivateMember(
  memberId: string,
  exitedOn: string,
): Promise<string | null> {
  try {
    const { error } = await supabase.rpc('deactivate_member', {
      p_member_id: memberId,
      p_exited_on: exitedOn,
    })

    return error ? deactivateMemberErrorMessage : null
  } catch {
    return deactivateMemberErrorMessage
  }
}

export async function configureMemberPaymentCycle(
  subscriptionMemberId: string,
  input: PaymentCycleInput,
): Promise<string | null> {
  try {
    const { error } = await supabase.rpc('configure_member_payment_cycle', {
      p_subscription_member_id: subscriptionMemberId,
      p_payment_cycle: input.paymentCycle,
      p_monthly_share_amount: Number(input.monthlyShareAmount),
    })

    return error ? paymentCycleErrorMessage : null
  } catch {
    return paymentCycleErrorMessage
  }
}
