import { Component, createElement } from 'react'
import { connect as connectRedux } from 'react-redux'
import { bindActionCreators as bindDispatchActionCreators } from 'redux'
import createCid from 'incremental-id'
import { is, pipe, compose, merge, map, partialRight } from 'ramda'

const { isArray } = Array
const isFunction = is(Function)

// feathers-action-react
export function connect (options) {
  const { selector, actions, query, shouldQueryAgain } = options

  const reduxConnector = createReduxConnector({ selector, actions })
  const feathersConnector = createFeathersConnector({ query, shouldQueryAgain })

  return compose(reduxConnector, feathersConnector)
}

const bindCidToActionCreators = map(action => {
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

        this.cancels = null

        this.query = query
        this.shouldQueryAgain = shouldQueryAgain || alwaysFalse

        this.component = component
      }

      componentDidMount () {
        this.fetch()
      }

      componentWillReceiveProps (nextProps) {
        // reset state if component should re-fetch
        const prevProps = this.props
        const queryAgain = this.shouldQueryAgain(prevProps, nextProps)
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
        if (this.cancels != null) {
          this.cancel()
        }
        var queryDescriptors = this.query
        if (isFunction(queryDescriptors)) {
          queryDescriptors = this.query(this.props)
        }
        if (!isArray(queryDescriptors)) {
          queryDescriptors = [queryDescriptors]
        }
        this.cancels = queryDescriptors.map(descriptor => {
          const { service, id, params } = descriptor
          const method = id ? 'get' : 'find'
          const action = this.props.actions[service][method]
          const cid = id ? action(id, params) : action(params)
          const cancelAction = this.props.actions[service].complete
          const cancel = () => cancelAction(cid)
          return cancel
        })
      }

      cancel () {
        this.cancels.forEach(cancel => cancel())
        this.cancels = null
      }
    }
  }

  return feathersConnector
}

function alwaysFalse () { return false }
