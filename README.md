# feathers-action-react

connect [feathers-action@2](https://github.com/ahdinosaur/feathers-action) to react data containers

made as part of [dogstack](https://dogstack.js.org) :dog: :dog: :dog:

```shell
npm install --save feathers-action-react
```

## example

```js
import { connect } from 'feathers-action-react'

import Dogs from '../components/dogs'

import { actions as dogActions } from '../'

import { getIndexProps } from '../getters'

export default connect({
  selector: getIndexProps,
  actions: { dogs: dogActions },
  query: {
    service: 'dogs',
    params: {}
  }
})(Dogs)
```

## usage

### `{ connect } = require('feathers-action-react')`

### `hoc = connect(options)`

`options`:

- `selector`: a function of shape `(state) => props`
- `actions`: an object where keys are feathers service names and values are objects of action creators
- `query`: an object to describe a feathers `find` or `get` service method call, or an array of these, or a function of shape `(props) => query`.
  - for find: `{ service, params }`
  - for get: `{ service, id, params }`
- `shouldQueryAgain`: a function of shape `(prevProps, nextProps) => Boolean` for whether we should re-fetch on updated props

`hoc` is a "higher-order component": a function of shape `(component) => nextComponent`

## license

The Apache License

Copyright &copy; 2017 Michael Williams

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
