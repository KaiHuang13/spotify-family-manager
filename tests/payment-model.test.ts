import assert from 'node:assert/strict'
import test from 'node:test'
import {
  toPaymentChargeOptions,
  validateRecordPaymentInput,
} from '../src/features/payments/payment-model.ts'

const options = [
  {
    chargeId: 'charge-1',
    memberId: 'member-1',
    memberName: '成員甲',
    billingPeriodId: 'period-1',
    periodStart: '2026-07-01',
    periodEnd: '2026-08-01',
    amountMinor: 50n,
    currency: 'TWD',
  },
]

test('將管理者可讀取的成員應收轉為付款選項', () => {
  const result = toPaymentChargeOptions([
    {
      id: 'charge-1',
      amount_minor: '50',
      currency: 'TWD',
      subscription_members: [
        {
          member_id: 'member-1',
          members: [{ display_name: '成員甲' }],
        },
      ],
      billing_periods: [
        {
          id: 'period-1',
          period_start: '2026-07-01',
          period_end: '2026-08-01',
          status: 'draft',
        },
      ],
    },
  ])

  assert.deepEqual(result, options)
})

test('有效付款資料可通過驗證', () => {
  assert.deepEqual(
    validateRecordPaymentInput(
      {
        memberId: 'member-1',
        memberChargeId: 'charge-1',
        amount: '20',
        paidOn: '2026-07-10',
        paymentMethod: '銀行轉帳',
        notes: '',
      },
      options,
    ),
    {},
  )
})

test('拒絕零、負數、小數及超出安全範圍的付款金額', () => {
  for (const amount of ['0', '-1', '1.5']) {
    assert.equal(
      validateRecordPaymentInput(
        {
          memberId: 'member-1',
          memberChargeId: 'charge-1',
          amount,
          paidOn: '2026-07-10',
          paymentMethod: '現金',
          notes: '',
        },
        options,
      ).amount,
      '付款金額必須是大於 0 的整數。',
    )
  }

  assert.equal(
    validateRecordPaymentInput(
      {
        memberId: 'member-1',
        memberChargeId: 'charge-1',
        amount: '9007199254740992',
        paidOn: '2026-07-10',
        paymentMethod: '現金',
        notes: '',
      },
      options,
    ).amount,
    '付款金額超出可安全處理範圍。',
  )
})

test('拒絕成員與應收不相符及缺少付款資料', () => {
  const errors = validateRecordPaymentInput(
    {
      memberId: 'other-member',
      memberChargeId: 'charge-1',
      amount: '20',
      paidOn: 'invalid-date',
      paymentMethod: '   ',
      notes: '',
    },
    options,
  )

  assert.equal(errors.memberChargeId, '請選擇該成員的對應月份。')
  assert.equal(errors.paidOn, '請輸入有效的付款日期。')
  assert.equal(errors.paymentMethod, '請輸入付款方式。')
})
