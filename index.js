import { Component, createElement } from 'react'
import { connect as connectRedux } from 'react-redux'
import { bindActionCreators as bindDispatchActionCreators } from 'redux'
import createCid from 'incremental-id'
import { is, pipe, compose, merge, map, mapObjIndexed, partialRight, filter, either, has, length, equals, not, keys, pick, complement } from 'ramda'

const { isArray } = Array
const isFunction = is(Function)

const pickPending = filter(complement(either(has('result'), has('error'))))
const hasKeys = pipe(keys, length, equals(0), not)

// feathers-action-react
export function connect (options) {
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
    return class ConnectedFeathers extends Component {
      constructor (props, context) {
        super(props, context)

        this.cancels = []
        this.cids = []

        this.query = query
        this.shouldQueryAgain = shouldQueryAgain || alwaysFalse

        this.component = component
      }

      componentDidMount () {
        this.fetch()
      }

      componentWillReceiveProps (nextProps) {
        // reset state if component should re-fetch
        const cids = this.cids
        const pickCids = pick(cids)
        const requests = pickCids(nextProps.requests)
        const pending = pickPending(requests)
        const isPending = hasKeys(pending)
        const status = {
          cids,
          requests,
          pending,
          isPending
        }
        const queryAgain = this.shouldQueryAgain(nextProps, status)
        // perform re-fetch
        if (queryAgain) this.fetch()
      }

      componentWillUnmount () {
        this.cancel()
      }

      render () {
        const { actions, selected } = this.props
        const props = merge(selected, { actions })
        return createElement(this.component, props)
      }

      fetch () {
        this.cancel()

        var queryDescriptors = this.query
        if (isFunction(queryDescriptors)) {
          queryDescriptors = this.query(this.props)
        }
        if (!isArray(queryDescriptors)) {
          queryDescriptors = [queryDescriptors]
        }

        this.cancels = []
        this.cids = []
        queryDescriptors.forEach(descriptor => {
          const { service, id, params } = descriptor
          const method = id ? 'get' : 'find'
          const action = this.props.actions[service][method]
          const cid = id ? action(id, params) : action(params)
          this.cids.push(cid)
          const cancelAction = this.props.actions[service].complete
          const cancel = () => cancelAction(cid)
          this.cancels.push(cancel)
        })
      }

      cancel () {
        var cancels = this.cancels
        this.cancels = []
        this.cids = []
        cancels.forEach(cancel => cancel())
      }
    }
  }

  return feathersConnector
}

function alwaysFalse () { return false }
