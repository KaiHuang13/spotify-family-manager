import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addOneCalendarMonth,
  validateCreateBillingPeriodInput,
} from '../src/features/billing/billing-period-model.ts'

test('計算一個日曆月並處理月底', () => {
  assert.equal(addOneCalendarMonth('2026-07-01'), '2026-08-01')
  assert.equal(addOneCalendarMonth('2026-01-31'), '2026-02-28')
  assert.equal(addOneCalendarMonth('2024-01-31'), '2024-02-29')
})

test('有效月份費用可通過驗證', () => {
  assert.deepEqual(
    validateCreateBillingPeriodInput({
      periodStart: '2026-07-01',
      periodEnd: '2026-08-01',
      dueDate: '2026-07-10',
      providerCostAmount: '298',
    }),
    {},
  )
})

test('拒絕不是一個月的計費期間與過早付款期限', () => {
  const errors = validateCreateBillingPeriodInput({
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    dueDate: '2026-06-30',
    providerCostAmount: '298',
  })

  assert.equal(errors.periodEnd, '計費結束日必須是開始日的一個月後。')
  assert.equal(errors.dueDate, '付款期限不得早於計費開始日。')
})

test('拒絕無效日期及非整數或超出安全範圍的費用', () => {
  const invalidDateErrors = validateCreateBillingPeriodInput({
    periodStart: '2026-02-30',
    periodEnd: 'invalid',
    dueDate: '2026-13-01',
    providerCostAmount: '1.5',
  })

  assert.equal(invalidDateErrors.periodStart, '請輸入有效的計費開始日。')
  assert.equal(invalidDateErrors.periodEnd, '請輸入有效的計費結束日。')
  assert.equal(invalidDateErrors.dueDate, '請輸入有效的到期日。')
  assert.equal(
    invalidDateErrors.providerCostAmount,
    'Spotify 當期總費用必須是非負整數。',
  )

  assert.equal(
    validateCreateBillingPeriodInput({
      periodStart: '2026-07-01',
      periodEnd: '2026-08-01',
      dueDate: '2026-07-10',
      providerCostAmount: '9007199254740992',
    }).providerCostAmount,
    'Spotify 當期總費用超出可安全處理範圍。',
  )
})
