const axios = require('axios')

class PostDataToRestApi {
  init (resourceConfig, env, callback) {
    this.registry = env.bootedServices.registry
    this.namespace = resourceConfig.namespace
    this.templateUrlRegistryKey = resourceConfig.templateUrlRegistryKey

    if (resourceConfig.authTokenRegistryKey) this.authToken = this.registry.get(resourceConfig.namespace + '_' + resourceConfig.authTokenRegistryKey)
    if (resourceConfig.resultPath) this.resultPath = resourceConfig.resultPath
    if (resourceConfig.paramPath) this.paramPath = resourceConfig.paramPath
    this.webAPITimeoutInMilliseconds = (process.env.WEB_API_TIMEOUT_IN_MS || 3000)

    callback(null)
  }

  async run (event, context) {
    this.templateUrl = this.registry.get(this.namespace + '_' + this.templateUrlRegistryKey)

    if (this.templateUrl === 'DISABLED') {
      if (this.resultPath) context.sendTaskSuccess({ [this.resultPath]: [] })
      else context.sendTaskSuccess([])
      return
    }

    if (this.paramPath) {
      Object.keys(event[this.paramPath]).map(key => {
        this.templateUrl = this.templateUrl.replace(`{{${key}}}`, event[this.paramPath][key])
      })
    }

    const options = {}

    if (this.authToken) options.headers.Authorization = this.authToken

    try {
      const result = await axios.post(this.templateUrl, options)
      switch (result.status) {
        case 200: // OK
          if (this.resultPath) context.sendTaskSuccess({ [this.resultPath]: result.data[this.resultPath] })
          else context.sendTaskSuccess(result.data)
          break
        case 204: // No content
          if (this.resultPath) context.sendTaskSuccess({ [this.resultPath]: [] })
          else context.sendTaskSuccess([])
          break
        default:
          console.log(`Tried to POST to ${this.templateUrl} with payload ${options}` +
            `but received ${result.status}: ${result.statusMessage}`)
          context.sendTaskFailure(result.statusMessage)
          break
      }
    } catch (err) {
      console.log(`Tried to POST to ${this.templateUrl} with payload ${JSON.stringify(options, null, 2)}` +
        ` but received ${err.status}: ${err.message}`)
      context.sendTaskFailure(err)
    }
  }
}

module.exports = PostDataToRestApi
