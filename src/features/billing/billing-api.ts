import { supabase } from '../../lib/supabase'
import type {
  BillingPeriodDetail,
  BillingPeriodQueryRow,
  CreateBillingPeriodInput,
} from '../../types/billing'
import {
  getTaipeiBusinessDate,
  toBillingPeriodDetails,
} from './billing-period-detail-model'

const createBillingPeriodErrorMessage =
  '無法新增月份費用，請確認計費期間未重複且所有有效成員都已設定繳費週期。'
const billingPeriodDetailErrorMessage = '無法載入月份費用明細，請稍後再試一次。'

interface BillingPeriodDetailResult {
  periods: BillingPeriodDetail[]
  errorMessage: string | null
}

export async function createMonthlyBillingPeriod(
  input: CreateBillingPeriodInput,
): Promise<string | null> {
  try {
    const { error } = await supabase.rpc('create_monthly_billing_period', {
      p_period_start: input.periodStart,
      p_period_end: input.periodEnd,
      p_due_date: input.dueDate,
      p_provider_cost_minor: Number(input.providerCostAmount),
    })

    return error ? createBillingPeriodErrorMessage : null
  } catch {
    return createBillingPeriodErrorMessage
  }
}

export async function fetchBillingPeriodDetails(
  ownerId: string,
): Promise<BillingPeriodDetailResult> {
  try {
    const { data, error } = await supabase
      .from('billing_periods')
      .select(
        `
          id,
          period_start,
          period_end,
          due_date,
          provider_cost_minor,
          currency,
          member_charges (
            id,
            amount_minor,
            currency,
            due_date,
            voided_at,
            subscription_members (
              members (
                display_name
              )
            ),
            payments (
              amount_minor,
              status
            )
          )
        `,
      )
      .eq('owner_id', ownerId)
      .order('period_start', { ascending: false })

    if (error) {
      return { periods: [], errorMessage: billingPeriodDetailErrorMessage }
    }

    return {
      periods: toBillingPeriodDetails(
        (data ?? []) as BillingPeriodQueryRow[],
        getTaipeiBusinessDate(),
      ),
      errorMessage: null,
    }
  } catch {
    return { periods: [], errorMessage: billingPeriodDetailErrorMessage }
  }
}
