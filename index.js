const assert = require('assert')
const __ = require('ramda/src/__')
const all = require('ramda/src/all')
const assoc = require('ramda/src/assoc')
const both = require('ramda/src/both')
const clone = require('ramda/src/clone')
const createCid = require('incremental-id')
const curry = require('ramda/src/curry')
const defaultTo = require('ramda/src/defaultTo')
const either = require('ramda/src/either')
const forEach = require('ramda/src/forEach')
const has = require('ramda/src/has')
const ifElse = require('ramda/src/ifElse')
const indexBy = require('ramda/src/indexBy')
const is = require('ramda/src/is')
const isNil = require('ramda/src/isNil')
const isEmpty = require('ramda/src/isEmpty')
const keys = require('ramda/src/keys')
const map = require('ramda/src/map')
const mapObjIndexed = require('ramda/src/mapObjIndexed')
const merge = require('ramda/src/merge')
const mergeAll = require('ramda/src/mergeAll')
const not = require('ramda/src/not')
const nthArg = require('ramda/src/nthArg')
const omit = require('ramda/src/omit')
const partialRight = require('ramda/src/partialRight')
const path = require('ramda/src/path')
const pipe = require('ramda/src/pipe')
const prop = require('ramda/src/prop')
const reduce = require('ramda/src/reduce')
const values = require('ramda/src/values')
const deepEqual = require('fast-deep-equal')
const { createElement } = require('react')
const compose = require('recompose/compose').default
const lifecycle = require('recompose/lifecycle').default
const withProps = require('recompose/withProps').default
const withStateHandlers = require('recompose/withStateHandlers').default
const { bindActionCreators: bindDispatchActionCreators } = require('redux')
const { connect: connectRedux } = require('react-redux')
const { createSelector, createStructuredSelector } = require('reselect')

module.exports = {
  connect
}

const indexByName = indexBy(prop('name'))

const isAny = () => true
const isArray = is(Array)
const isFunction = is(Function)
const isObject = is(Object)
const isString = is(String)

const hasProperties = curry((propertyTypes, object) => {
  return all(
    (propertyName) => {
      const propertyType = propertyTypes[propertyName]
      const {
        type,
        required = false
      } = propertyType
      const objectValue = object[propertyName]
      const isType = type(objectValue)
      return isType
    },
    keys(propertyTypes)
  )
})

const hasValues = curry((type, object) => {
  return pipe(
    values,
    all(type)
  )
})

// TODO make configurable somehow (either in connect options or attached to action creator?)
const shouldBindCid = () => true

const isSelector = isFunction
const assertSelector = (selector) => {
  assert(isSelector(selector), 'feathers-action-react: options.selector is not a selector, expected function')
}

const isActions = both(isObject, hasValues(both(isObject, hasValues(isFunction))))
const assertActions = (actions) => {
  assert(isActions(actions), 'feathers-action-react: options.actions is not actions, expected object of objects of functions')
}

const isQueryItem = both(
  isObject,
  hasProperties({
    name: {
      type: isString
    },
    service: {
      type: isString,
      required: true
    },
    params: {
      type: either(isObject, isFunction)
    },
    id: {
      type: either(isAny, isFunction)
    },
    dependencies: {
      type: both(isArray, hasValues(isString))
    }
  })
)
const isQuery = either(isQueryItem, both(isArray, hasValues(isQueryItem)))
const assertQuery = (query) => {
  assert(isQuery(query), 'feathers-action-react: options.query is not a query, expected object or array of objects with properties: optional `name` string, required `service` string, optional `params` object or function, optional `id` any or function, optional `dependencies` array of strings.')
}

const assertQueryActions = curry((actions, query) => {
  return forEach(
    nextQuery => {
      const { service } = nextQuery
      assert(!isNil(actions[service]), `feathers-action-react: options.actions is missing actions for service ${service}`)
      return nextQuery
    },
    query
  )
})

const getFeathersRequests = prop('feathers')
const getStateAndOwnProps = (state, props) => [state, props.ownProps]

// feathers-action-react
function connect (options) {
  const {
    selector = (state, props) => {},
    actions = {},
    query: ogQuery = []
  } = options

  assertSelector(selector)
  assertActions(actions)

  assertQuery(ogQuery)
  assertQueryActions(actions, ogQuery)

  const query = nameQuery(ogQuery)

  const propsConnector = withProps(
    (ownProps) => ({ ownProps })
  )
  const stateConnector = withStateHandlers(
    {
      query,
      cidByQuery: {},
      argsByQuery: {}
    },
    {
      setCidByQuery: ({ cidByQuery }) => (queryName, cid) => ({
        cidByQuery: assoc(queryName, cid, cidByQuery)
      }),
      setArgsByQuery: ({ argsByQuery }) => (queryName, args) => ({
        argsByQuery: assoc(queryName, args, argsByQuery)
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
  if (!isNil(query.name)) return query
  return merge(query, { name: createCid() })
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

const resolveQueryArg = (argName) => (dft) => (query) => (state, props) => {
  const arg = query[argName]
  if (isNil(arg)) return dft
  if (!isFunction(arg)) return arg
  const result = arg(state, props)
  return isNil(result) ? dft : result
}

const getRawQuerys = (state, props) => {
  const { query } = props
  return isArray(query) ? query : [query]
}
const getCidByQuery = (state, props) => {
  return props.cidByQuery
}
const getArgsByQuery = (state, props) => {
  return props.argsByQuery
}
const getRequestByQuery = createSelector(
  getCidByQuery,
  getFeathersRequests,
  (cidByQuery, requests) => {
    const mapRequests = map(pipe(
      cid => {
        return requests[cid]
      },
      defaultTo(null)
    ))
    return mapRequests(cidByQuery)
  }
)
const getIsReadyByQuery = createSelector(
  getRequestByQuery,
  ifElse(
    isNil,
    () => ({}),
    map(
      ifElse(
        isNil,
        () => false,
        prop('isReady')
      )
    )
  )
)
const getQueryByName = createSelector(
  getRawQuerys,
  indexByName
)
const getHasReadyDependenciesByQuery = createSelector(
  getQueryByName,
  getIsReadyByQuery,
  (queryByName, isReadyByQuery) => map(pipe(
    prop('dependencies'),
    ifElse(
      either(isNil, isEmpty),
      () => true,
      all(prop(__, isReadyByQuery))
    )
  ))(queryByName)
)
const getQuerys = createSelector(
  getQueryByName,
  getCidByQuery,
  getArgsByQuery,
  getRequestByQuery,
  getIsReadyByQuery,
  getHasReadyDependenciesByQuery,
  getStateAndOwnProps,
  (queryByName, cidByQuery, argsByQuery, requestByQuery, isReadyByQuery, hasReadyDependenciesByQuery, [state, ownProps]) => {
    const enhanceQuerys = map(query => {
      const cid = cidByQuery[query.name]
      const args = argsByQuery[query.name]
      const request = requestByQuery[query.name]
      const isReady = isReadyByQuery[query.name]
      const hasReadyDependencies = hasReadyDependenciesByQuery[query.name]

      const isStarted = not(isNil(cid))
      // TODO clean up
      const id = resolveQueryArg('id')(null)(query)(state, ownProps)
      // need to clone params because feathers mutates the params during a request.
      const params = clone(resolveQueryArg('params')({})(query)(state, ownProps))
      var prevArgs
      if (isStarted) {
        prevArgs = {
          // TODO clean up
          id: isNil(args.id) ? null: args.id,
          params: isNil(args.params) ? {}: args.params
        }
      } else {
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
      // console.log('mapStateToProps', selected, querys)
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
        // console.log('mountProps', this.props)
        handleQuerys(this.props)
      },

      componentDidUpdate (nextProps) {
        // console.log('componentDidUpdate', nextProps)
        handleQuerys(nextProps)
      },

      componentWillUnmount () {
        // console.log('unmountProps', this.props)
        cancelQuerys(this.props)
      }
    })(function ConnectedFeathers (props) {
      const { selected, ownProps, actions } = props
      const componentProps = mergeAll([
        selected,
        ownProps,
        { actions }
      ])
      // console.log('render', componentProps)
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

  function requestQuery (query, { actions, setCidByQuery, setArgsByQuery } ) {
    const { name, service, id, params } = query
    const args = clone({ id, params })
    const method = id ? 'get' : 'find'
    const action = actions[service][method]
    const cid = id ? action(id, params) : action(params)
    // need to clone args to check prevArgs == nextArgs,
    // because feathers mutates the arguments during a request.
    setArgsByQuery(name, args)
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

