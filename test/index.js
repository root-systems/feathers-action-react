import test from 'ava'

import { connect } from '../'

test('feathers-action-react', function (t) {
  t.is(typeof connect, 'function', 'connect is a function')
})
