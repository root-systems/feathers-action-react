const { createElement } = require('react')
const compose = require('recompose/compose').default
const withStateHandlers = require('recompose/withStateHandlers').default
const withProps = require('recompose/withProps').default
const lifecycle = require('recompose/lifecycle').default
const { connect: connectRedux } = require('react-redux')
const { bindActionCreators: bindDispatchActionCreators } = require('redux')
const createCid = require('incremental-id')
const assert = require('assert')
const is = require('ramda/src/is')
const isNil = require('ramda/src/isNil')
const isEmpty = require('ramda/src/isEmpty')
const pipe = require('ramda/src/pipe')
const mergeAll = require('ramda/src/mergeAll')
const map = require('ramda/src/map')
const mapObjIndexed = require('ramda/src/mapObjIndexed')
const partialRight = require('ramda/src/partialRight')
const either = require('ramda/src/either')
const not = require('ramda/src/not')
const prop = require('ramda/src/prop')
const path = require('ramda/src/path')
const forEach = require('ramda/src/forEach')
const values = require('ramda/src/values')
const indexBy = require('ramda/src/indexBy')
const nthArg = require('ramda/src/nthArg')
const assoc = require('ramda/src/assoc')
const omit = require('ramda/src/omit')
const all = require('ramda/src/all')
const __ = require('ramda/src/__')
const merge = require('ramda/src/merge')
const ifElse = require('ramda/src/ifElse')
const find = require('ramda/src/find')
const complement = require('ramda/src/complement')
const { createSelector, createStructuredSelector } = require('reselect')
const deepEqual = require('fast-deep-equal')

module.exports = {
  connect
}

const indexByName = indexBy(prop('name'))

const isFunction = is(Function)
const isArray = is(Array)
const isObject = is(Object)
const isNotNil = complement(isNil)

//const shouldBindCid = prop('shouldBindCid')
const shouldBindCid = () => true

const isSelector = isFunction
const isActions = isObject
const isQuery = either(isArray, isObject)

const getFeathersRequests = prop('feathers')
const getStateAndOwnProps = (state, props) => [state, props.ownProps]
const getQueryServices = ifElse(
  isObject,
  prop('service'),
  map(prop('service'))
)
// TODO: IK: ramdaify
const findMissingServices = (actions) => {
  return find((service) => {
    return isNil(actions[service])
  })
}
// TODO: IK: ramdaify
const hasAllActions = (actions, ogQuery) => {
  if (isEmpty(ogQuery)) return true

  const queryServices = getQueryServices(ogQuery)
  if (isArray(queryServices)) {
    return not(findMissingServices(actions)(queryServices))
  }
  return isNotNil(actions[queryServices])
}

// feathers-action-react
function connect (options) {
  const {
    selector = (state, props) => {},
    actions = {},
    query: ogQuery = [] // IK: consider whether this should just be named "queries" to avoid confusion later in this code, possibly at the expense of user confusion (maybe don't allow a single query object, always enforce an array, even of a single object)
  } = options

  assert(isSelector(selector), 'options.selector is not a selector, expected function')
  assert(isActions(actions), 'options.actions is not actions, expected object')
  assert(isQuery(ogQuery), 'options.query is not a query, expected array or object')

  assert(hasAllActions(actions, ogQuery), 'options.actions is missing service actions for services in options.query, expected relevant actions to be provided')

  // TODO assert(allQuerysHaveNames)
  const query = nameQuery(ogQuery)

  const propsConnector = withProps(
    (ownProps) => ({ ownProps })
  )
  const stateConnector = withStateHandlers(
    {
      query,
      cidByQuery: {}
    },
    {
      setCidByQuery: ({ cidByQuery }) => (queryName, cid) => ({
        cidByQuery: assoc(queryName, cid, cidByQuery)
      })
    }
  )
  const reduxConnector = createReduxConnector({ selector, actions })
  const feathersConnector = createFeathersConnector()

  return compose(
    propsConnector,
    stateConnector,
    reduxConnector,
    feathersConnector
  )
}

function nameQuery (query) {
  if (isArray(query)) {
    return query.map(nameQuery)
  }
  return merge(query, {
    name: createCid()
  })
}

const bindCidToActionCreators = mapObjIndexed((action, name) => {
  // don't bind cid to complete action
  if (name === 'complete') return action
  if (not(shouldBindCid(action))) return action

  return (...args) => {
    const cid = createCid()
    action(cid, ...args)
    return cid
  }
})

const resolveQueryArg = (argName) => (query) => (state, props) => {
  const arg = query[argName]
  return (
    isNil(arg)
    ? null
    : isFunction(arg)
      ? arg(state, props)
      : arg
  )
}

const getRawQuerys = (state, props) => {
  const { query } = props
  return isArray(query) ? query : [query]
}
const getCidByQuery = (state, props) => {
  return props.cidByQuery
}
const getQueryByName = createSelector(
  getRawQuerys,
  indexByName
)
const isReady = path(['request', 'isReady'])
const getHasReadyDependenciesByQuery = createSelector(
  getQueryByName,
  (queryByName) => map(pipe(
    prop('dependencies'),
    ifElse(
      either(isNil, isEmpty),
      () => true,
      all(pipe(
        prop(__, queryByName),
        isReady
      ))
    )
  ))(queryByName)
)
const getQuerys = createSelector(
  getQueryByName,
  getCidByQuery,
  getHasReadyDependenciesByQuery,
  getFeathersRequests,
  getStateAndOwnProps,
  (queryByName, cidByQuery, hasReadyDependenciesByQuery, requests, [state, ownProps]) => {
    const enhanceQuerys = map(query => {
      const cid = cidByQuery[query.name]
      const isStarted = not(isNil(cid))
      const hasReadyDependencies = hasReadyDependenciesByQuery[query.name]
      // TODO clean up
      const id = resolveQueryArg('id')(query)(state, ownProps)
      const params = resolveQueryArg('params')(query)(state, ownProps)
      var request, isReady, prevArgs
      if (isStarted) {
        request = requests[cid]
        isReady = request.isReady
        prevArgs = {
          // TODO clean up
          id: isNil(request.args.id) ? null: request.args.id,
          params: isNil(request.args.params) ? null: request.args.params
        }
      } else {
        isReady = false
        prevArgs = null
      }
      const nextArgs = { id, params }
      const isSameArgs = deepEqual(prevArgs, nextArgs)
      const shouldRequest = hasReadyDependencies && (
        not(isStarted) || not(isSameArgs)
      )
      return merge(query, {
        cid,
        request,
        id,
        params,
        isStarted,
        hasReadyDependencies,
        shouldRequest
      })
    })
    return enhanceQuerys(queryByName)
  }
)

function createReduxConnector (options) {
  const { selector, actions } = options

  const reduxConnector = connectRedux(
    function mapStateToProps (state, props) {
      // use the original props passed into the top-level 
      const selected = selector(state, props.ownProps)
      // use react state handlers
      const querys = getQuerys(state, props)
      console.log('mapStateToProps', selected, querys)
      return { selected, querys }
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
  const feathersConnector = (component) => {
    return lifecycle({
      componentDidMount () {
        console.log('mountProps', this.props)
        handleQuerys(this.props)
      },

      componentDidUpdate (nextProps) {
        console.log('componentDidUpdate', nextProps)
        handleQuerys(nextProps)
      },

      componentWillUnmount () {
        console.log('unmountProps', this.props)
        cancelQuerys(this.props)
      }
    })(function ConnectedFeathers (props) {
      const { selected, ownProps, actions } = props
      const componentProps = mergeAll([
        selected,
        ownProps,
        { actions }
      ])
      console.log('render', componentProps)
      return null
      return createElement(component, componentProps)
    })
  }

  function handleQuerys (props) {
    const handleEachQuery = pipe(
      values,
      forEach(query => {
        if (query.shouldRequest) {
          if (query.cid) {
            cancelQuery(query, props)
          }
          requestQuery(query, props)
        }
      })
    )
    handleEachQuery(props.querys)
  }

  function requestQuery (query, { actions, setCidByQuery } ) {
    const { name, service, id, params } = query
    const method = id ? 'get' : 'find'
    const action = actions[service][method]
    const cid = id ? action(id, params) : action(params)
    setCidByQuery(name, cid)
  }

  function cancelQuerys (props) {
    const cancelEachQuery = forEach(query => {
      cancelQuery(query, props)
    })
    return cancelEachQuery(props.querys)
  }

  function cancelQuery (query, { actions, setCidByQuery }) {
    const { name, service, cid } = query
    const serviceActions = actions[service]
    const cancelAction = serviceActions.complete
    cancelAction(cid)
    setCidByQuery(name, null)
  }

  return feathersConnector
}
