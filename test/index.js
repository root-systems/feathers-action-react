import test from 'ava'

import { connect } from '../'

test('feathers-action-react', function (t) {
  t.is(typeof connect, 'function', 'connect is a function')
})

test('options.query can be a single query object', function (t) {
  const result = connect({
    selector: () => null,
    actions: {
      dogs: {
        test: () => null
      }
    },
    query: {
      service: 'dogs'
    }
  })

  // TODO: IK: not really a sufficient test
  t.is(typeof result, 'function', 'result of connect is a function')
})
