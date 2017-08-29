const { createElement } = require('react')
const compose = require('recompose/compose').default
const withState = require('recompose/withState').default
const lifecycle = require('recompose/lifecycle').default
const { connect: connectRedux } = require('react-redux')
const { bindActionCreators: bindDispatchActionCreators } = require('redux')
const createCid = require('incremental-id')
const assert = require('assert')
const is = require('ramda/src/is')
const pipe = require('ramda/src/pipe')
const mergeAll = require('ramda/src/mergeAll')
const map = require('ramda/src/map')
const mapObjIndexed = require('ramda/src/mapObjIndexed')
const partialRight = require('ramda/src/partialRight')
const filter = require('ramda/src/filter')
const either = require('ramda/src/either')
const has = require('ramda/src/has')
const length = require('ramda/src/length')
const equals = require('ramda/src/equals')
const not = require('ramda/src/not')
const keys = require('ramda/src/keys')
const prop = require('ramda/src/prop')
const pick = require('ramda/src/pick')
const complement = require('ramda/src/complement')

module.exports = {
  connect
}

const isFunction = is(Function)
const isArray = is(Array)
const isObject = is(Object)

const isReady = prop('isReady')
const isPending = complement(isReady)
const pickPending = filter(isPending)
const hasKeys = pipe(keys, length, equals(0), not)

const isSelector = isFunction
const isActions = isObject
const isQuery = either(either(isFunction, isArray), isObject)
const isShouldQueryAgain = isFunction

// feathers-action-react
function connect (options) {
  const {
    selector = (state) => state,
    actions = {},
    query = [],
    shouldQueryAgain = alwaysFalse
  } = options

  assert(isSelector(selector), 'options.selector is not a selector, expected function')
  assert(isActions(actions), 'options.actions is not actions, expected object')
  assert(isQuery(query), 'options.query is not a query, expected function, array or object')
  assert(isShouldQueryAgain(shouldQueryAgain), 'options.shouldQueryAgain is not shouldQueryAgain, expected function')

  const reduxConnector = createReduxConnector({ selector, actions })
  const feathersConnector = createFeathersConnector({ query, shouldQueryAgain })

  return compose(reduxConnector, feathersConnector)
}

const bindCidToActionCreators = mapObjIndexed((action, name) => {
  // don't bind cid to complete action
  if (name === 'complete') return action

  return (...args) => {
    const cid = createCid()
    action(cid, ...args)
    return cid
  }
})

function createReduxConnector (options) {
  const { selector, actions } = options

  const reduxConnector = connectRedux(
    function mapStateToProps (state, ownProps) {
      return {
        ownProps,
        requests: state.feathers,
        selected: selector(state, ownProps)
      }
    },
    function mapDispatchToProps (dispatch) {
      const bindActionCreators = map(pipe(
        partialRight(bindDispatchActionCreators, [dispatch]),
        bindCidToActionCreators
      ))
      return {
        actions: bindActionCreators(actions)
      }
    }
  )

  return reduxConnector
}

function createFeathersConnector (options) {
  const { query, shouldQueryAgain } = options

  const feathersConnector = (component) => {
    return compose(
      withState('cids', 'setCids', []),
      withState('cancels', 'setCancels', []),
      lifecycle({
        componentDidMount () {
          fetch(this.props)
        },

        componentWillReceiveProps (nextProps) {
          // reset state if component should re-fetch
          const queryAgain = shouldQueryAgain(
            nextProps,
            getStatus(nextProps),
            this.props,
            getStatus(this.props)
          )
          // perform re-fetch
          if (queryAgain) fetch(nextProps)
        },

        componentWillUnmount () {
          cancel(this.props)
        }
      })
    )(props => {
      const { selected, ownProps, actions } = props
      const componentProps = mergeAll([
        selected,
        ownProps,
        { actions }
      ])
      return createElement(component, componentProps)
    })

    function fetch (props) {
      cancel(props)

      var queryDescriptors = query
      if (isFunction(queryDescriptors)) {
        queryDescriptors = query(props)
      }
      if (!isArray(queryDescriptors)) {
        queryDescriptors = [queryDescriptors]
      }

      var cancels = []
      var cids = []

      queryDescriptors.forEach(descriptor => {
        const { service, id, params } = descriptor

        if (!props.actions[service]) {
          throw new Error(`feathers-action-react/index: Expected to be provided respective actions for service ${service} in the actions object`)
        }
        
        const method = id ? 'get' : 'find'
        const action = props.actions[service][method]
        const cid = id ? action(id, params) : action(params)
        cids.push(cid)
        const cancelAction = props.actions[service].complete
        const cancel = () => cancelAction(cid)
        cancels.push(cancel)
      })

      const { setCancels, setCids } = props

      setCancels(cancels)
      setCids(cids)
    }

    function cancel (props) {
      const { cancels, setCancels, setCids } = props
      setCancels([])
      setCids([])
      cancels.forEach(cancel => cancel())
    }
  }

  return feathersConnector
}

function alwaysFalse () { return false }

function getStatus (props) {
  const { cids, requests: allRequests } = props
  const pickCids = pick(cids)
  const requests = pickCids(allRequests)
  const pending = pickPending(requests)
  const isPending = hasKeys(pending)
  const status = {
    cids,
    requests,
    pending,
    isPending
  }
  return status
}
