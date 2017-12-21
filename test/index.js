import test from 'ava'
import { createElement as h } from 'react'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'
// import createModule from 'feathers-action'
import Enzyme, { mount } from 'enzyme';
import Adapter from 'enzyme-adapter-react-15';

import { connect } from '../'

const is = require('ramda/src/is')
const isFunction = is(Function)

function TestComponent (props) {
  return h('div', {}, 'hello')
}

test.before(t => {
  Enzyme.configure({ adapter: new Adapter() })
})

test.beforeEach(t => {
  // mock-store or a real store?
  const middlewares = []
  const mockStore = configureStore(middlewares)
  const initialState = { dogs: ['louis', 'rogue'] }
  const store = mockStore(initialState)

  t.context.generateWrapper = (connectedComponent, props) => {
    return mount(
      h(Provider, { store },
        h(connectedComponent, props)
      )
    )
  }
})

test('component is legit', function (t) {
  const { generateWrapper } = t.context
  const connectedComponent = connect({})(TestComponent)

  const wrapper = generateWrapper(connectedComponent)

  t.true(wrapper.exists())
})


test('component has expected props.selected', function (t) {
  const { generateWrapper } = t.context
  const connectedComponent = connect({
    selector: (state) => { return { dog: state.dogs[0] } }
  })(TestComponent)

  const wrapper = generateWrapper(connectedComponent)

  const dog = wrapper.find(TestComponent).prop('dog')
  // IK: would it be better to have selected props under { selected: {} } on the final component?
  t.deepEqual(dog, 'louis', 'props.selected did not deepEqual expected')
})

test('component has expected props.actions', function (t) {
  const { generateWrapper } = t.context
  const connectedComponent = connect({
    actions: { dogs: { get: () => ({ }) } }
  })(TestComponent)

  const wrapper = generateWrapper(connectedComponent)

  const propActions = wrapper.find(TestComponent).prop('actions')
  t.true(isFunction(propActions.dogs.get), 'props.actions.dogs.get was not a function')
})


test('component has expected ownProps', function (t) {
  const { generateWrapper } = t.context
  const connectedComponent = connect({

  })(TestComponent)

  const wrapper = generateWrapper(connectedComponent, { testing: 123 })

  const testing = wrapper.find(TestComponent).prop('testing')
  // IK: would it be better to have own props under { ownProps: {} } on the final component?
  t.deepEqual(testing, 123, 'ownProps did not deepEqual expected')
})

test('component executes a query on mount', function (t) {
  const { generateWrapper } = t.context
  const connectedComponent = connect({
    query: {
      name: 'findAllDogs',
      service: 'dogs',
      params: {}
    }
  })(TestComponent)

  const wrapper = generateWrapper(connectedComponent)

  // const ownProps = wrapper.find(TestComponent).prop('ownProps')
  console.log(wrapper.debug())
})


test.todo('a query with a dependency is called once dependant query is finished')
