const { createElement } = require('react')
const compose = require('recompose/compose').default
const withState = require('recompose/withState').default
const lifecycle = require('recompose/lifecycle').default
const { connect: connectRedux } = require('react-redux')
const { bindActionCreators: bindDispatchActionCreators } = require('redux')
const createCid = require('incremental-id')
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
const pick = require('ramda/src/pick')
const complement = require('ramda/src/complement')

module.exports = {
  connect
}

const { isArray } = Array
const isFunction = is(Function)

const pickPending = filter(complement(either(has('result'), has('error'))))
const hasKeys = pipe(keys, length, equals(0), not)

// feathers-action-react
function connect (options) {
  const { selector, actions, query, shouldQueryAgain } = options

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
  const { query, shouldQueryAgain = alwaysFalse } = options

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
          const { cids, requests: allRequests } = nextProps
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
          const queryAgain = shouldQueryAgain(nextProps, status)
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
