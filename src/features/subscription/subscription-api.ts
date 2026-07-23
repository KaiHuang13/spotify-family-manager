import { supabase } from '../../lib/supabase'
import type { SpotifyPlan } from '../../types/subscription'

interface SpotifyPlanResult {
  plan: SpotifyPlan | null
  errorMessage: string | null
}

const loadErrorMessage = '無法載入 Spotify 方案設定，請稍後再試一次。'
const updateErrorMessage =
  '無法更新方案開始日；請確認日期不晚於既有成員或月份費用的日期。'

export async function fetchSpotifyPlan(
  ownerId: string,
): Promise<SpotifyPlanResult> {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('id, plan_name, started_on, current_cost_minor, currency')
      .eq('owner_id', ownerId)
      .eq('service_code', 'spotify')
      .eq('status', 'active')
      .maybeSingle()

    if (error || !data) {
      return { plan: null, errorMessage: loadErrorMessage }
    }

    return {
      plan: {
        id: data.id,
        planName: data.plan_name,
        startedOn: data.started_on,
        currentCostMinor: BigInt(data.current_cost_minor),
        currency: data.currency,
      },
      errorMessage: null,
    }
  } catch {
    return { plan: null, errorMessage: loadErrorMessage }
  }
}

export async function updateSpotifyPlanStartDate(
  ownerId: string,
  planId: string,
  startedOn: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .update({ started_on: startedOn })
      .eq('id', planId)
      .eq('owner_id', ownerId)
      .select('id')
      .maybeSingle()

    return error || !data ? updateErrorMessage : null
  } catch {
    return updateErrorMessage
  }
}

