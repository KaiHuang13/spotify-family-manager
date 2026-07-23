import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getCurrentOrLatestParticipation,
  toMemberListItems,
} from '../src/features/members/member-list-model.ts'

test('沒有訂閱期間時加入與退出日期皆為空', () => {
  assert.equal(getCurrentOrLatestParticipation([]), null)
})

test('合併相鄰期間以保留真正的加入日期', () => {
  const participation = getCurrentOrLatestParticipation([
    { start_date: '2026-01-01', end_date: '2026-04-01' },
    { start_date: '2026-04-01', end_date: '2026-07-01' },
    { start_date: '2026-07-01', end_date: null },
  ])

  assert.deepEqual(participation, {
    joinedOn: '2026-01-01',
    exitedOn: null,
  })
})

test('重新加入時只顯示最近一次連續參與期間', () => {
  const participation = getCurrentOrLatestParticipation([
    { start_date: '2025-01-01', end_date: '2025-05-01' },
    { start_date: '2026-02-15', end_date: '2026-06-01' },
  ])

  assert.deepEqual(participation, {
    joinedOn: '2026-02-15',
    exitedOn: '2026-06-01',
  })
})

test('將資料庫欄位轉換為清單顯示資料', () => {
  const items = toMemberListItems([
    {
      id: 'member-1',
      display_name: '管理者',
      joined_on: '2025-12-20',
      deactivated_on: null,
      status: 'active',
      notes: '  家庭管理者  ',
      subscription_members: [
        {
          id: 'subscription-member-1',
          start_date: '2026-01-01',
          end_date: null,
          payment_frequency: 'yearly',
          monthly_share_minor: 50,
          currency: 'TWD',
        },
      ],
    },
  ])

  assert.deepEqual(items, [
    {
      id: 'member-1',
      displayName: '管理者',
      status: 'active',
      joinedOn: '2025-12-20',
      billingStartedOn: '2026-01-01',
      subscriptionMemberId: 'subscription-member-1',
      paymentCycle: 'yearly',
      monthlyShareMinor: 50,
      currency: 'TWD',
      exitedOn: null,
      notes: '家庭管理者',
    },
  ])
})

test('停用成員保留在清單並顯示主檔退出日期', () => {
  const items = toMemberListItems([
    {
      id: 'member-2',
      display_name: '歷史成員',
      joined_on: '2025-01-01',
      deactivated_on: '2025-12-31',
      status: 'inactive',
      notes: null,
      subscription_members: [],
    },
  ])

  assert.equal(items[0]?.status, 'inactive')
  assert.equal(items[0]?.exitedOn, '2025-12-31')
})
