# feathers-action-react

connect [feathers-action@2](https://github.com/ahdinosaur/feathers-action) to react data containers

made as part of [dogstack](https://dogstack.js.org) :dog: :dog: :dog:

```shell
npm install --save feathers-action-react
```

## example

```js
import { connect } from 'feathers-action-react'
import {
  createSelector,
  createStructuredSelector
} from 'reselect'

import Dogs from '../components/dogs'

import { actions as dogActions } from '../'

import { getDogs, getCollars } from '../getters'

export default connect({
  selector: createStructuredSelector({
    dogs: getDogs,
    collars: getCollars
  }),
  actions: {
    dogs: dogActions
  },
  query: [
    {
      name: 'findAllDogs',
      service: 'dogs',
      params: {}
    },
    {
      name: 'findCollarsForEachDog',
      service: 'collars',
      dependencies: [
        'findAllDogs'
      ],
      params: createSelector(
        getDogs,
        (dogs) => ({
          params: {
            dogId: {
              $in: dogs.map(dog => dog.id)
            }
          }
        })
      }
    }
  ]
})(Dogs)
```

## usage

### `{ connect } = require('feathers-action-react')`

### `hoc = connect(options)`

`options`:

- `selector`: a function of shape `(state, props) => selected`
- `actions`: an object where keys are feathers service names and values are objects of action creators
- `query`: an object or array of objects to describe feathers `find` or `get` service method calls
  - `name`: (optional) name of query
  - `service`: (required) name of feathers service to call
  - `dependencies`: (optional) array of query names that this query depends on being run before is ready
  - `params`: (optional) object or selector for object to use as `params` argument in feathers call
  - `id`: (required if `get` call) value or selector for value to use as `id` argument in feathers call

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
