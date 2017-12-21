import test from 'ava'
import { createElement as h } from 'react'
import configureStore from 'redux-mock-store'
import Enzyme, { mount } from 'enzyme';
import Adapter from 'enzyme-adapter-react-15';

import { connect } from '../'

test.before(t => {
  Enzyme.configure({ adapter: new Adapter() })
})

test.beforeEach(t => {
  const middlewares = []
  const mockStore = configureStore(middlewares)
  const initialState = {}
  const store = mockStore(initialState)

  t.context.store = store
})

test('component is legit', function (t) {
  function TestComponent() {
    return h('div', {})
  }
  const connectedComponent = connect({})(TestComponent)

  const wrapper = mount(
    h(connectedComponent, {
      store: t.context.store
    })
  )

  t.true(wrapper.exists())
})
