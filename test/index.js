import test from 'ava'
import { createElement as h } from 'react'
import Enzyme, { mount } from 'enzyme';
import Adapter from 'enzyme-adapter-react-15';
import { connect } from '../'

test.before(t => {
  Enzyme.configure({ adapter: new Adapter() })
})

test('component is legit', function (t) {
  function TestComponent() {
    return h('div', {})
  }
  const wrapper = mount((h(TestComponent)))

  t.true(wrapper.exists())
})
