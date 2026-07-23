import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateChargePaymentSummary,
  getTaipeiBusinessDate,
  toBillingPeriodDetails,
} from '../src/features/billing/billing-period-detail-model.ts'

test('依有效付款合計判斷未付、部分付款、已付與溢付', () => {
  const payments = [
    { amount_minor: '20', status: 'posted' },
    { amount_minor: 10, status: 'posted' },
    { amount_minor: '999', status: 'void' },
  ]

  assert.deepEqual(
    calculateChargePaymentSummary('50', [], '2026-07-31', '2026-07-15'),
    { paidMinor: 0n, unpaidMinor: 50n, paymentStatus: 'unpaid' },
  )
  assert.deepEqual(
    calculateChargePaymentSummary(
      '50',
      payments,
      '2026-07-31',
      '2026-07-15',
    ),
    {
      paidMinor: 30n,
      unpaidMinor: 20n,
      paymentStatus: 'partially_paid',
    },
  )
  assert.deepEqual(
    calculateChargePaymentSummary(
      '30',
      payments,
      '2026-07-31',
      '2026-07-15',
    ),
    { paidMinor: 30n, unpaidMinor: 0n, paymentStatus: 'paid' },
  )
  assert.deepEqual(
    calculateChargePaymentSummary(
      '25',
      payments,
      '2026-07-31',
      '2026-07-15',
    ),
    { paidMinor: 30n, unpaidMinor: 0n, paymentStatus: 'overpaid' },
  )
})

test('到期日之後仍不足時判斷為逾期', () => {
  assert.deepEqual(
    calculateChargePaymentSummary(
      '50',
      [{ amount_minor: '20', status: 'posted' }],
      '2026-07-15',
      '2026-07-16',
    ),
    { paidMinor: 20n, unpaidMinor: 30n, paymentStatus: 'overdue' },
  )
  assert.equal(
    calculateChargePaymentSummary('50', [], '2026-07-15', '2026-07-15')
      .paymentStatus,
    'unpaid',
  )
})

test('只加總有效付款並以bigint計算部分付款餘額', () => {
  const [period] = toBillingPeriodDetails(
    [
      {
        id: 'period-1',
        period_start: '2026-07-01',
        period_end: '2026-08-01',
        due_date: '2026-07-31',
        provider_cost_minor: '298',
        currency: 'TWD',
        member_charges: [
          {
            id: 'charge-1',
            amount_minor: '50',
            currency: 'TWD',
            due_date: '2026-07-31',
            voided_at: null,
            subscription_members: {
              members: { display_name: '成員甲' },
            },
            payments: [
              { amount_minor: '20', status: 'posted' },
              { amount_minor: '10', status: 'void' },
            ],
          },
        ],
      },
    ],
    '2026-07-15',
  )

  assert.equal(period?.providerCostMinor, 298n)
  assert.equal(period?.charges[0]?.paidMinor, 20n)
  assert.equal(period?.charges[0]?.unpaidMinor, 30n)
  assert.equal(period?.charges[0]?.paymentStatus, 'partially_paid')
})

test('推導已付、逾期與作廢狀態且未付金額不為負數', () => {
  const [period] = toBillingPeriodDetails(
    [
      {
        id: 'period-2',
        period_start: '2026-06-01',
        period_end: '2026-07-01',
        due_date: '2026-06-10',
        provider_cost_minor: 298,
        currency: 'TWD',
        member_charges: [
          {
            id: 'paid-charge',
            amount_minor: 50,
            currency: 'TWD',
            due_date: '2026-06-10',
            voided_at: null,
            subscription_members: null,
            payments: [{ amount_minor: 60, status: 'posted' }],
          },
          {
            id: 'overdue-charge',
            amount_minor: 50,
            currency: 'TWD',
            due_date: '2026-06-10',
            voided_at: null,
            subscription_members: null,
            payments: [],
          },
          {
            id: 'void-charge',
            amount_minor: 50,
            currency: 'TWD',
            due_date: '2026-06-10',
            voided_at: '2026-06-05T00:00:00Z',
            subscription_members: null,
            payments: [],
          },
        ],
      },
    ],
    '2026-06-20',
  )

  assert.equal(period?.charges[0]?.paymentStatus, 'overpaid')
  assert.equal(period?.charges[0]?.unpaidMinor, 0n)
  assert.equal(period?.charges[1]?.paymentStatus, 'overdue')
  assert.equal(period?.charges[2]?.paymentStatus, 'void')
})

test('業務日期固定使用Asia/Taipei', () => {
  assert.equal(
    getTaipeiBusinessDate(new Date('2026-07-01T16:30:00Z')),
    '2026-07-02',
  )
})
