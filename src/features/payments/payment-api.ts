import { supabase } from '../../lib/supabase'
import type {
  PaymentChargeOption,
  PaymentChargeQueryRow,
  RecordPaymentInput,
} from '../../types/payment'
import { toPaymentChargeOptions } from './payment-model'

const paymentOptionsErrorMessage = '無法載入可付款的成員月份費用，請稍後再試一次。'
const recordPaymentErrorMessage = '無法登記付款，請稍後再試一次。'

interface PaymentOptionsResult {
  options: PaymentChargeOption[]
  errorMessage: string | null
}

export async function fetchPaymentChargeOptions(
  ownerId: string,
): Promise<PaymentOptionsResult> {
  try {
    const { data, error } = await supabase
      .from('member_charges')
      .select(
        `
          id,
          amount_minor,
          currency,
          payments (
            amount_minor,
            status
          ),
          subscription_members (
            member_id,
            members (
              display_name
            )
          ),
          billing_periods (
            id,
            period_start,
            period_end,
            status
          )
        `,
      )
      .eq('owner_id', ownerId)
      .is('voided_at', null)
      .order('due_date', { ascending: false })

    if (error) {
      return { options: [], errorMessage: paymentOptionsErrorMessage }
    }

    return {
      options: toPaymentChargeOptions(
        (data ?? []) as unknown as PaymentChargeQueryRow[],
      ),
      errorMessage: null,
    }
  } catch {
    return { options: [], errorMessage: paymentOptionsErrorMessage }
  }
}

export async function recordPayment(
  input: RecordPaymentInput,
): Promise<string | null> {
  try {
    const { error } = await supabase.rpc('record_member_payment', {
      p_member_charge_id: input.memberChargeId,
      p_amount_minor: Number(input.amount),
      p_paid_on: input.paidOn,
      p_payment_method: input.paymentMethod.trim(),
      p_notes: input.notes.trim() || null,
    })

    return error ? recordPaymentErrorMessage : null
  } catch {
    return recordPaymentErrorMessage
  }
}
