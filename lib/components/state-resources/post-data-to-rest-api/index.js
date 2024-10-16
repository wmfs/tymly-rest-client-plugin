const axios = require('axios')
const jp = require('jsonpath')
const {
  isString,
  isObject
} = require('lodash')

class PostDataToRestApi {
  init (resourceConfig, env) {
    this.registry = env.bootedServices.registry
    this.namespace = resourceConfig.namespace
    this.templateUrlRegistryKey = resourceConfig.templateUrlRegistryKey
    this.payloadPath = resourceConfig.payloadPath
    this.restModel = env.bootedServices.storage.models.tymly_restReceipts

    if (resourceConfig.authTokenRegistryKey) this.authToken = this.registry.get(resourceConfig.namespace + '_' + resourceConfig.authTokenRegistryKey)
    if (resourceConfig.resultPath) this.resultPath = resourceConfig.resultPath
    if (resourceConfig.paramPath) this.paramPath = resourceConfig.paramPath
    this.webAPITimeoutInMilliseconds = (process.env.WEB_API_TIMEOUT_IN_MS || 3000)
  }

  async run (event, context) {
    console.log('PostDataToRestApi >>  event - ', JSON.stringify(event, null, 2))
    console.log('PostDataToRestApi >>  this.namespace BEFORE - ', this.namespace)
    if (this.namespace.startsWith('$.')) {
      this.namespace = resolvePaths(event, this.namespace)
    }
    console.log('PostDataToRestApi >>  this.namespace AFTER - ', this.namespace)
    const updatedTemplateUrlRegistryKey = resolvePaths(event, this.templateUrlRegistryKey)
    console.log('PostDataToRestApi >> updatedTemplateUrlRegistryKey - ', updatedTemplateUrlRegistryKey)
    // this.templateUrlRegistryKey = resolvePaths(event, this.templateUrlRegistryKey)
    const regKey = this.namespace + '_' + updatedTemplateUrlRegistryKey
    console.log('PostDataToRestApi >> regKey - ', regKey)
    this.templateUrl = this.registry.has(regKey) ? this.registry.get(regKey) : null
    console.log('PostDataToRestApi >> this.templateUrl - ', this.templateUrl)
    if (!this.templateUrl || this.templateUrl === 'DISABLED') {
      if (this.resultPath) context.sendTaskSuccess({ [this.resultPath]: [] })
      else context.sendTaskSuccess([])
      return
    }

    if (this.paramPath) {
      Object.keys(event[this.paramPath]).forEach(key => {
        this.templateUrl = this.templateUrl.replace(`{{${key}}}`, event[this.paramPath][key])
      })
    }

    const options = {
      headers: {},
      method: 'post',
      timeout: 5000,
      url: this.templateUrl,
      data: event[this.payloadPath]
    }

    if (this.authToken) options.headers.Authorization = this.authToken

    try {
      const result = await axios(options)
      switch (result.status) {
        case 200: // OK
          await recordRequest(this.restModel, options, context, result.status)
          if (this.resultPath) context.sendTaskSuccess({ [this.resultPath]: result.data[this.resultPath] })
          else context.sendTaskSuccess(result.data)
          break
        case 204: // No content
          await recordRequest(this.restModel, options, context, result.status)
          if (this.resultPath) context.sendTaskSuccess({ [this.resultPath]: [] })
          else context.sendTaskSuccess([])
          break
        default:
          await recordRequest(this.restModel, options, context, result.status)
          console.log(`Tried to POST to ${this.templateUrl} with payload ${options}` +
            `but received ${result.status}: ${result.statusMessage}`)
          context.sendTaskFailure(result.statusMessage)
          break
      }
    } catch (err) {
      await recordRequest(this.restModel, options, context, '400')
      console.log(`Tried to POST to ${this.templateUrl} with payload ${JSON.stringify(options, null, 2)}` +
        ` but received ${err.status}: ${err.message}`)
      context.sendTaskFailure(err)
    }
  }
}

function resolvePaths (input, root) {
  const isJSONPath = p => isString(p) && p.length !== 0 && p[0] === '$'

  if (!isObject(root) && isString(root)) {
    if (isJSONPath(root)) {
      return jp.value(input, root)
    } else return root
  }
  if (Array.isArray(root)) {
    root.forEach(element => resolvePaths(input, element))
    return
  }
  for (const [key, value] of Object.entries(root)) {
    if (isJSONPath(value)) {
      root[key] = jp.value(input, value)
    } else {
      resolvePaths(input, value)
    }
  }
}

async function recordRequest (model, options, context, responseCode) {
  await model.create({
    executionName: context.executionName,
    responseCode,
    type: 'POST',
    details: {
      options,
      userId: context.userId,
      templateUrl: this.templateUrl
    }
  })
}

module.exports = PostDataToRestApi
