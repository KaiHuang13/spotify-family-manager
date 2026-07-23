import { supabase } from '../../lib/supabase'
import type { BillingPeriodQueryRow } from '../../types/billing'
import type {
  CurrentSubscriptionDashboard,
  DashboardRecentPaymentQueryRow,
} from '../../types/dashboard'
import {
  getTaipeiBusinessDate,
  toBillingPeriodDetails,
} from '../billing/billing-period-detail-model'
import { buildCurrentSubscriptionDashboard } from './dashboard-model'

const dashboardErrorMessage = '無法載入當期訂閱狀態，請稍後再試一次。'

interface DashboardResult {
  dashboard: CurrentSubscriptionDashboard | null
  errorMessage: string | null
}

export async function fetchCurrentSubscriptionDashboard(
  ownerId: string,
): Promise<DashboardResult> {
  const businessDate = getTaipeiBusinessDate()

  try {
    const [periodResult, activeMemberResult, recentPaymentsResult] =
      await Promise.all([
        supabase
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
          .is('voided_at', null)
          .lte('period_start', businessDate)
          .gt('period_end', businessDate)
          .order('period_start', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('subscription_members')
          .select('id, members!inner(status)', { count: 'exact', head: true })
          .eq('owner_id', ownerId)
          .lte('start_date', businessDate)
          .or(`end_date.is.null,end_date.gt.${businessDate}`)
          .eq('members.status', 'active'),
        supabase
          .from('payments')
          .select(
            `
              id,
              amount_minor,
              currency,
              paid_at,
              payment_method,
              member_charges (
                subscription_members (
                  members (
                    display_name
                  )
                ),
                billing_periods (
                  period_start,
                  period_end
                )
              )
            `,
          )
          .eq('owner_id', ownerId)
          .eq('status', 'posted')
          .order('paid_at', { ascending: false })
          .limit(5),
      ])

    if (
      periodResult.error ||
      activeMemberResult.error ||
      recentPaymentsResult.error
    ) {
      return { dashboard: null, errorMessage: dashboardErrorMessage }
    }

    if (!periodResult.data) {
      return { dashboard: null, errorMessage: null }
    }

    const [billingPeriod] = toBillingPeriodDetails(
      [periodResult.data as BillingPeriodQueryRow],
      businessDate,
    )

    if (!billingPeriod) {
      return { dashboard: null, errorMessage: dashboardErrorMessage }
    }

    return {
      dashboard: buildCurrentSubscriptionDashboard(
        {
          billingPeriod,
          activeMemberCount: activeMemberResult.count ?? 0,
          recentPayments: (recentPaymentsResult.data ??
            []) as unknown as DashboardRecentPaymentQueryRow[],
        },
      ),
      errorMessage: null,
    }
  } catch {
    return { dashboard: null, errorMessage: dashboardErrorMessage }
  }
}
