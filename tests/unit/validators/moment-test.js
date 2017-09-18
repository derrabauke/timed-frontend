import { expect } from 'chai'
import { describe, it } from 'mocha'
import validateMoment from 'timed/validators/moment'
import moment from 'moment'

describe('Unit | Validator | moment', function() {
  it('works without value', function() {
    expect(validateMoment()('key', null, null, {}, {})).to.be.false
    expect(validateMoment()('key', moment(), null, {}, {})).to.be.true
  })

  it('works with gt', function() {
    expect(
      validateMoment({ gt: 'otherKey' })(
        'key',
        moment(),
        null,
        {},
        { otherKey: moment().add(-1, 'second') }
      )
    ).to.be.true

    expect(
      validateMoment({ gt: 'otherKey' })(
        'key',
        moment(),
        null,
        {},
        { otherKey: moment().add(1, 'second') }
      )
    ).to.be.false
  })

  it('works with lt', function() {
    expect(
      validateMoment({ lt: 'otherKey' })(
        'key',
        moment(),
        null,
        {},
        { otherKey: moment().add(1, 'second') }
      )
    ).to.be.true

    expect(
      validateMoment({ lt: 'otherKey' })(
        'key',
        moment(),
        null,
        {},
        { otherKey: moment().add(-1, 'second') }
      )
    ).to.be.false
  })

  it('works with gt and lt', function() {
    expect(
      validateMoment({ lt: 'ltKey', gt: 'gtKey' })(
        'key',
        moment(),
        null,
        {},
        {
          gtKey: moment().add(-1, 'second'),
          ltKey: moment().add(1, 'second')
        }
      )
    ).to.be.true
  })

  it('works with changes', function() {
    expect(
      validateMoment({ lt: 'ltKey', gt: 'gtKey' })(
        'key',
        moment(),
        null,
        {
          gtKey: moment().add(-1, 'second'),
          ltKey: moment().add(1, 'second')
        },
        {}
      )
    ).to.be.true
  })

  it('prefers changes before the original object', function() {
    expect(
      validateMoment({ gt: 'gtKey' })(
        'key',
        moment(),
        null,
        {
          gtKey: moment().add(-1, 'second')
        },
        {
          gtKey: moment().add(1, 'second')
        }
      )
    ).to.be.true
  })
})
