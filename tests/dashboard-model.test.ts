import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCurrentSubscriptionDashboard } from '../src/features/dashboard/dashboard-model.ts'

test('從當期帳款與付款資料計算儀表板摘要', () => {
  const dashboard = buildCurrentSubscriptionDashboard(
    {
      activeMemberCount: 4,
      billingPeriod: {
        id: 'period-1',
        periodStart: '2026-07-01',
        periodEnd: '2026-08-01',
        dueDate: '2026-07-20',
        providerCostMinor: 298n,
        currency: 'TWD',
        charges: [
          {
            id: 'partial-charge',
            memberName: '成員甲',
            amountMinor: 100n,
            paidMinor: 40n,
            unpaidMinor: 60n,
            currency: 'TWD',
            paymentStatus: 'partially_paid',
          },
          {
            id: 'paid-charge',
            memberName: '成員乙',
            amountMinor: 100n,
            paidMinor: 100n,
            unpaidMinor: 0n,
            currency: 'TWD',
            paymentStatus: 'paid',
          },
          {
            id: 'overpaid-charge',
            memberName: '成員丙',
            amountMinor: 100n,
            paidMinor: 120n,
            unpaidMinor: 0n,
            currency: 'TWD',
            paymentStatus: 'overpaid',
          },
          {
            id: 'void-charge',
            memberName: '未知成員',
            amountMinor: 100n,
            paidMinor: 100n,
            unpaidMinor: 0n,
            currency: 'TWD',
            paymentStatus: 'void',
          },
        ],
      },
      recentPayments: [],
    },
  )

  assert.equal(dashboard.providerCostMinor, 298n)
  assert.equal(dashboard.activeMemberCount, 4)
  assert.equal(dashboard.receivableMinor, 300n)
  assert.equal(dashboard.collectedMinor, 260n)
  assert.equal(dashboard.outstandingMinor, 60n)
  assert.deepEqual(
    dashboard.incompleteMemberCharges.map((charge) => charge.memberName),
    ['成員甲'],
  )
})

test('逾期未足額成員列入未完成付款名單', () => {
  const dashboard = buildCurrentSubscriptionDashboard(
    {
      activeMemberCount: 1,
      billingPeriod: {
        id: 'period-2',
        periodStart: '2026-06-01',
        periodEnd: '2026-07-01',
        dueDate: '2026-06-15',
        providerCostMinor: 100n,
        currency: 'TWD',
        charges: [
          {
            id: 'overdue-charge',
            memberName: '成員甲',
            amountMinor: 50n,
            paidMinor: 0n,
            unpaidMinor: 50n,
            currency: 'TWD',
            paymentStatus: 'overdue',
          },
        ],
      },
      recentPayments: [],
    },
  )

  assert.equal(
    dashboard.incompleteMemberCharges[0]?.paymentStatus,
    'overdue',
  )
})

test('最近付款最多保留5筆並轉換關聯資料', () => {
  const recentPayments = Array.from({ length: 6 }, (_, index) => ({
    id: `payment-${index + 1}`,
    amount_minor: String(index + 1),
    currency: 'TWD',
    paid_at: `2026-07-0${index + 1}T12:00:00Z`,
    payment_method: '轉帳',
    member_charges: {
      subscription_members: {
        members: { display_name: `成員${index + 1}` },
      },
      billing_periods: {
        period_start: '2026-07-01',
        period_end: '2026-08-01',
      },
    },
  }))
  const dashboard = buildCurrentSubscriptionDashboard(
    {
      activeMemberCount: 0,
      billingPeriod: {
        id: 'period-3',
        periodStart: '2026-07-01',
        periodEnd: '2026-08-01',
        dueDate: '2026-07-20',
        providerCostMinor: 0n,
        currency: 'TWD',
        charges: [],
      },
      recentPayments,
    },
  )

  assert.equal(dashboard.recentPayments.length, 5)
  assert.equal(dashboard.recentPayments[0]?.memberName, '成員1')
  assert.equal(dashboard.recentPayments[0]?.amountMinor, 1n)
  assert.equal(dashboard.recentPayments[0]?.periodStart, '2026-07-01')
})
