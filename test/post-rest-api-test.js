/* eslint-env mocha */

const expect = require('chai').expect
const bodyParser = require('body-parser')
const express = require('express')
const RestApiClient = require('./../lib/components/state-resources/post-data-to-rest-api')

const mockRegistry = {
  keys: {
    test_url: 'http://localhost:3003/test-endpoint',
    test_nocontent: 'http://localhost:3003/no-content',
    test_notfound: 'http://localhost:3003/not-found',
    test_servererror: 'http://localhost:3003/server-error'
  },

  get: function (key) {
    return this.keys[key]
  },

  has: function (key) {
    return this.keys[key]
  }
}

const mockStorage = {
  'tymly_failedRestRequests': { create: () => console.log('failed') }
}

xdescribe('Post REST endpoint', () => {
  const app = express()
  let server

  before(() => {
    app.post('/test-endpoint', (req, res) => res.status(200).send('HOORAY'))
    app.post('/no-content', (req, res) => res.status(204).send())
    app.post('/server-error', (req, res) => res.status(500).send('ERROR'))
    app.use(bodyParser.urlencoded({ extended: false }))
    app.use(bodyParser.json())
    server = app.listen(
      3003,
      () => console.log('Listening ... ')
    )
  })

  const tests = [
    {
      title: 'Content',
      config: {
        namespace: 'test',
        templateUrlRegistryKey: 'url'
      },
      success: body => expect(body).to.eql('HOORAY')
    },
    {
      title: 'No-content',
      config: {
        namespace: 'test',
        templateUrlRegistryKey: 'nocontent'
      },
      success: body => expect(body).to.eql([])
    },
    {
      title: 'Not found',
      config: {
        namespace: 'test',
        templateUrlRegistryKey: 'notfound'
      },
      failure: err => {
        expect(err.message).to.eql('Request failed with status code 404')
      }
    },
    {
      title: 'Server error',
      config: {
        namespace: 'test',
        templateUrlRegistryKey: 'servererror'
      },
      failure: err => {
        expect(err.message).to.eql('Request failed with status code 500')
      }
    }
  ]

  for (const test of tests) {
    describe(`fetch ${test.title}`, () => {
      const testEnv = {
        bootedServices: { registry: mockRegistry, storage: mockStorage }
      }

      const apiClient = new RestApiClient()

      it('boot apiClient', (done) => {
        apiClient.init(
          test.config,
          testEnv,
          done
        )
      })

      it('call api', (done) => {
        apiClient.run(
          {},
          {
            sendTaskSuccess: body => {
              if (!test.success) {
                return done('Expected API call to fail')
              }
              test.success(body)
              done()
            },
            sendTaskFailure: err => {
              if (!test.failure) {
                return done(err)
              }
              try {
                test.failure(err)
                done()
              } catch (ex) {
                done(ex)
              }
            }
          }
        )
      }) // it('call api' ...
    }) // describe ...
  } // for ...

  after(() => {
    server.close()
  })
})
