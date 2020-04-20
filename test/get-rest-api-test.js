/* eslint-env mocha */

const expect = require('chai').expect
const express = require('express')
const RestApiClient = require('./../lib/components/state-resources/get-data-from-rest-api')

const mockRegistry = {
  keys: {
    test_url: 'http://localhost:3003/test-endpoint',
    test_nocontent: 'http://localhost:3003/no-content',
    test_notfound: 'http://localhost:3003/not-found',
    test_servererror: 'http://localhost:3003/server-error'
  },

  get: function (key) {
    return this.keys[key]
  }
}

describe('Fetch REST endpoint', () => {
  const app = express()
  let server

  before(() => {
    app.get('/test-endpoint', (req, res) => res.send('HOORAY'))
    app.get('/no-content', (req, res) => res.status(204).send())
    app.get('/server-error', (req, res) => res.status(500).send('Borked'))
    server = app.listen(
      3003,
      () => { console.log('Listening ... ') }
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
        bootedServices: { registry: mockRegistry }
      }

      const apiClient = new RestApiClient()

      it('boot apiClient', () => {
        apiClient.init(test.config, testEnv)
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
