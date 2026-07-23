import assert from 'node:assert/strict'
import test from 'node:test'
import {
  validateAddMemberInput,
  validateDeactivateMemberInput,
  validateMemberBasicInput,
  validatePaymentCycleInput,
} from '../src/features/members/member-form-model.ts'

test('有效的新增成員資料不產生驗證錯誤', () => {
  assert.deepEqual(
    validateAddMemberInput({
      displayName: '家庭成員',
      joinedOn: '2026-07-01',
      notes: '',
    }),
    {},
  )
})

test('名稱只有空白時拒絕送出', () => {
  const errors = validateAddMemberInput({
    displayName: '   ',
    joinedOn: '2026-07-01',
    notes: '',
  })

  assert.equal(errors.displayName, '請輸入名稱。')
})

test('拒絕不存在的日曆日期', () => {
  const errors = validateAddMemberInput({
    displayName: '家庭成員',
    joinedOn: '2026-02-30',
    notes: '',
  })

  assert.equal(errors.joinedOn, '請輸入有效的加入日期。')
})

test('有效的基本資料修改不產生驗證錯誤', () => {
  assert.deepEqual(
    validateMemberBasicInput(
      {
        displayName: '更新後名稱',
        joinedOn: '2026-06-01',
        notes: '更新後備註',
      },
      '2026-07-01',
    ),
    {},
  )
})

test('修改基本資料時仍拒絕空白名稱與無效日期', () => {
  const errors = validateMemberBasicInput({
    displayName: '  ',
    joinedOn: '2026-13-01',
    notes: '',
  })

  assert.equal(errors.displayName, '請輸入名稱。')
  assert.equal(errors.joinedOn, '請輸入有效的加入日期。')
})

test('修改後的加入日期不得晚於既有計費起算日', () => {
  const errors = validateMemberBasicInput(
    {
      displayName: '家庭成員',
      joinedOn: '2026-07-02',
      notes: '',
    },
    '2026-07-01',
  )

  assert.equal(errors.joinedOn, '加入日期不得晚於計費起算日。')
})

test('有效退出日期可通過驗證', () => {
  assert.deepEqual(
    validateDeactivateMemberInput('2026-08-01', '2026-07-01'),
    {},
  )
})

test('拒絕無效退出日期', () => {
  const errors = validateDeactivateMemberInput('2026-02-30', '2026-01-01')

  assert.equal(errors.exitedOn, '請輸入有效的退出日期。')
})

test('退出日期必須晚於計費起算日', () => {
  const errors = validateDeactivateMemberInput('2026-07-01', '2026-07-01')

  assert.equal(errors.exitedOn, '退出日期必須晚於計費起算日。')
})

test('monthly與yearly可搭配非負整數月分攤金額', () => {
  assert.deepEqual(
    validatePaymentCycleInput({
      paymentCycle: 'monthly',
      monthlyShareAmount: '50',
    }),
    {},
  )
  assert.deepEqual(
    validatePaymentCycleInput({
      paymentCycle: 'yearly',
      monthlyShareAmount: '50',
    }),
    {},
  )
})

test('拒絕未選週期、負數、小數與超出安全範圍的金額', () => {
  assert.equal(
    validatePaymentCycleInput({
      paymentCycle: '',
      monthlyShareAmount: '-1',
    }).paymentCycle,
    '請選擇月繳或年繳。',
  )
  assert.equal(
    validatePaymentCycleInput({
      paymentCycle: 'monthly',
      monthlyShareAmount: '1.5',
    }).monthlyShareAmount,
    '每月分攤金額必須是非負整數。',
  )
  assert.equal(
    validatePaymentCycleInput({
      paymentCycle: 'yearly',
      monthlyShareAmount: '9007199254740992',
    }).monthlyShareAmount,
    '每月分攤金額超出可安全處理範圍。',
  )
})
