const Abstract = require('./abstract')
const _ = require('lodash')
const util = require('util')

const Constants = {
  ScfTriggerTypeTimer: 'timer',
  ScfTriggerTypeCos: 'cos',
  ScfTriggerTypeCmq: 'cmq',
  ScfTriggerTypeCkafka: 'ckafka'
}

class DeployTrigger extends Abstract {
  async create(ns, oldEvents, funcObject, successFunc, failedFunc) {
    const triggers = funcObject.Properties.Events
    const triggerResults = []
    const len = _.size(triggers)

    for (let i = 0; i < len; i++) {
      if (_.isEmpty(triggers[i])) {
        continue
      }

      const keys = Object.keys(triggers[i])
      const trigger = triggers[i][keys[0]]
      const triggerName = keys[0]
      trigger.Type = trigger.Type.toString().toLocaleLowerCase()
      const oldEvent = _.find(oldEvents, (event) => {
        if (event.Type == Constants.ScfTriggerTypeCkafka) {
          const fullname = triggerName + '-' + trigger.Properties.Topic
          if (event.TriggerName == fullname) {
            return event
          }
        }

        if (event.TriggerName == triggerName && event.Type == trigger.Type) {
          return event
        }
      })

      // trigger not changed
      if (!_.isEmpty(oldEvent) && !this._isChanged(trigger, oldEvent)) {
        continue
      }

      // delete exists trigger
      if (!_.isEmpty(oldEvent) /* && trigger.Type != Constants.ScfTriggerTypeApigw*/) {
        const delArgs = {
          Type: oldEvent.Type,
          TriggerName: oldEvent.TriggerName,
          FunctionName: funcObject.FuncName,
          Region: this.options.region,
          Namespace: ns,
          TriggerDesc: oldEvent.TriggerDesc
        }

        const handler = util.promisify(this.scfClient.DeleteTrigger.bind(this.scfClient))
        try {
          await handler(delArgs)
        } catch (e) {
          this.context.debug('ErrorCode: ' + e.code + ' RequestId: ' + e.requestId)
          throw e
        }
      }

      const args = {
        Type: trigger.Type,
        TriggerName: triggerName,
        FunctionName: funcObject.FuncName,
        Region: this.options.region,
        Namespace: ns
      }

      if (trigger.Properties.Enable) {
        args.Enable = 'OPEN'
      } else {
        args.Enable = 'CLOSE'
      }

      let desc
      switch (args.Type) {
        case Constants.ScfTriggerTypeTimer:
          args.TriggerDesc = trigger.Properties.CronExpression
          break
        case Constants.ScfTriggerTypeCkafka:
          if (triggerName != trigger.Properties.Name) {
            if (failedFunc && _.isFunction(failedFunc)) {
              failedFunc(
                `create trigger ${triggerName} failed, 触发器名称不符合规范 (triggerName 应为消息队列 CKafka ID)`,
                trigger
              )
            }
            continue
          }
          if (!(trigger.Properties.MaxMsgNum > 1 && trigger.Properties.MaxMsgNum < 1000)) {
            if (failedFunc && _.isFunction(failedFunc)) {
              failedFunc(
                `create trigger ${triggerName} failed, 最大批量消息数，范围1 - 1000`,
                trigger
              )
            }
            continue
          }
          desc = {
            maxMsgNum: trigger.Properties.MaxMsgNum.toString(),
            offset: trigger.Properties.Offset || 'latest'
          }
          args.TriggerName = util.format('%s-%s', trigger.Properties.Name, trigger.Properties.Topic)
          args.TriggerDesc = JSON.stringify(desc)
          break
        case Constants.ScfTriggerTypeCmq:
          if (triggerName != trigger.Properties.Name) {
            if (failedFunc && _.isFunction(failedFunc)) {
              failedFunc(
                `create trigger ${triggerName} failed, 触发器名称不符合规范 (triggerName 应为CMQ名称)`,
                trigger
              )
            }
            continue
          }
          break
        case Constants.ScfTriggerTypeCos:
          desc = {
            event: trigger.Properties.Events,
            filter: {
              Prefix: trigger.Properties.Filter.Prefix || '',
              Suffix: trigger.Properties.Filter.Suffix || ''
            }
          }
          if (triggerName != trigger.Properties.Bucket) {
            if (failedFunc && _.isFunction(failedFunc)) {
              failedFunc(
                `create trigger ${triggerName} failed, 触发器名称不符合规范 (triggerName 格式应为: <BucketName-APPID>.cos.<Region>.myqcloud.com)`,
                trigger
              )
            }
            continue
          }

          args.TriggerDesc = JSON.stringify(desc)
          break
      }

      let handler
      handler = util.promisify(this.scfClient.CreateTrigger.bind(this.scfClient))
      try {
        const respAddTrigger = await handler(args)
        triggerResults.push(respAddTrigger)
        if (successFunc && _.isFunction(successFunc)) {
          successFunc(respAddTrigger.TriggerInfo, trigger)
        }
      } catch (e) {
        if (oldEvent && oldEvent.TriggerDesc) {
          this.context.debug(e)
          args.TriggerDesc =
            oldEvent.Type == 'timer' ? JSON.parse(oldEvent.TriggerDesc).cron : oldEvent.TriggerDesc
          handler = util.promisify(this.scfClient.CreateTrigger.bind(this.scfClient))
          try {
            await handler(args)
          } catch (e) {
            this.context.debug('ErrorCode: ' + e.code + ' RequestId: ' + e.requestId)
            throw e
          }
        } else {
          throw e
        }
      }
    }

    return triggerResults
  }

  _isChanged(trigger, oldEvent) {
    const triggerDesc = JSON.parse(oldEvent.TriggerDesc)
    const triggerEnable = oldEvent.Enable == 1 ? true : false

    let changed = false
    switch (trigger.Type.toLocaleLowerCase()) {
      case Constants.ScfTriggerTypeTimer:
        const newCron = util.format('0 %s *', trigger.Properties.CronExpression)
        if (triggerDesc.cron == newCron && trigger.Properties.Enable == triggerEnable) {
          this.context.debug(`Trigger ${oldEvent.TriggerName}: ${oldEvent.Type} not changed`)
          break
        }
        changed = true
        break
      case Constants.ScfTriggerTypeCmq:
        if (trigger.Properties.Enable == triggerEnable) {
          this.context.debug(`Trigger ${oldEvent.TriggerName}: ${oldEvent.Type} not changed`)
          break
        }

        changed = true
        break

      case Constants.ScfTriggerTypeCos:
        if (
          trigger.Properties.Events == triggerDesc.event &&
          trigger.Properties.Filter.Prefix == triggerDesc.filter.Prefix &&
          trigger.Properties.Filter.Suffix == triggerDesc.filter.Suffix &&
          trigger.Properties.Enable == triggerEnable
        ) {
          this.context.debug(`Trigger ${oldEvent.TriggerName}: ${oldEvent.Type} not changed`)
          break
        }
        changed = true
        break
      case Constants.ScfTriggerTypeCkafka:
        // ckafka not support enable/disable
        if (
          trigger.Properties.Topic == triggerDesc.topicName &&
          trigger.Properties.MaxMsgNum == triggerDesc.maxMsgNum &&
          (trigger.Properties.Offset ? trigger.Properties.Offset == triggerDesc.offset : true)
        ) {
          this.context.debug(`Trigger ${oldEvent.TriggerName}: ${oldEvent.Type} not changed`)
          break
        }
        changed = true
        break
    }
    return changed
  }
}

module.exports = DeployTrigger
