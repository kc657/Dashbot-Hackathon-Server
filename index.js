const RtmClient = require('@slack/client').RtmClient
const CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS
const RTM_EVENTS = require('@slack/client').RTM_EVENTS
const cognitiveServices = require('cognitive-services')
const qs = require('querystring')
const https = require('https')
const request = require('request')
const config = require('./env.json')
const dashbot = require('dashbot')(config.dashbot_token).slack
const rp = require('request-promise')
const fs = require('fs')
const _ = require('lodash')
let WebSocketClient = require('websocket').client
let client = new WebSocketClient()

var urlRoot = 'https://tracker.dashbot.io/track'
var apiKey = config.dashbot_token
var slackKey = config.slackbot_token
var debug = true

let channel
let bot
let dictionary

let accessKey = 'fc7253e3cc8344c6ae12049c0b80773b'
let uri = 'westus.api.cognitive.microsoft.com'
let path = '/text/analytics/v2.0/sentiment'

let rtm = new RtmClient(config.slackbot_token)

rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (rtmStartData) => {
  for (const c of rtmStartData.channels) {
    if (c.is_member && c.name === 'general') { channel = c.id, channelName = c.name }
  }
  bot = '<@' + rtmStartData.self.id + '>'
})

rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function () {
  rtm.sendMessage('Testing from index.js!', channel)
})

rp('https://slack.com/api/rtm.start?token=' + slackKey, function (error, response) {
  const parsedData = JSON.parse(response.body)

  // Tell dashbot when you connect.
  var url = urlRoot + '?apiKey=' + apiKey + '&type=connect&platform=slack'
  rp({
    uri: url,
    method: 'POST',
    json: parsedData
  })

  const bot = parsedData.self
  const team = parsedData.team
  const baseMessage = {
    token: slackKey,
    team: {
      id: team.id,
      name: team.name
    },
    bot: {
      id: bot.id
    }
  }
  client.on('connect', function (connection) {
    console.log('Slack bot ready')
    connection.on('message', function (message) {
      const parsedMessage = JSON.parse(message.utf8Data)

      // Tell dashbot when a message arrives
      var url = urlRoot + '?apiKey=' + apiKey + '&type=incoming&platform=slack'
      var toSend = _.clone(baseMessage)
      toSend.message = parsedMessage
      if (debug) {
        console.log('Dashbot incoming: ' + url)
        console.log(JSON.stringify(toSend, null, 2))
      }
      rp({
        uri: url,
        method: 'POST',
        json: toSend
      })

      if (parsedMessage.type === 'message' && parsedMessage.channel &&
        parsedMessage.channel[0] === 'D' && parsedMessage.user !== bot.id) {
        // reply on the web socket.
        const reply = {
          type: 'message',
          text: 'You are right when you say: ' + parsedMessage.text,
          channel: parsedMessage.channel
        }

        // Tell dashbot about your response
        var url = urlRoot + '?apiKey=' + apiKey + '&type=outgoing&platform=slack'
        var toSend = _.clone(baseMessage)
        toSend.message = reply
        if (debug) {
          console.log('Dashbot outgoing: ' + url)
          console.log(JSON.stringify(toSend, null, 2))
        }
        rp({
          uri: url,
          method: 'POST',
          json: toSend
        })

        connection.sendUTF(JSON.stringify(reply))
      }
    })
  })
  client.connect(parsedData.url)
})

rtm.on(RTM_EVENTS.MESSAGE, function (message) {
  if (message.channel === channel) {
    if (message.text !== null) {
      // MICROSOFT TEXT ANALYSIS
      const headers = {
        'Content-type': 'application/json'
      }
      const body = {'documents': [{
            'language': 'en',
            'id': '1',
            'text': `${message.text}`
          }]}
      const textAnalyticsClient = new cognitiveServices.textAnalytics({
        apiKey: 'fc7253e3cc8344c6ae12049c0b80773b',
        endpoint: 'westus.api.cognitive.microsoft.com'
      })
      let score
      textAnalyticsClient.sentiment({
        headers,
        body
      }).then((response) => {
        console.log(response.documents[0].score)
        score = response.documents[0].score
        let req = https.request(config.slackbot_option, function (res) {
          var chunks = []
          res.on('data', function (chunk) {
            chunks.push(chunk)
          })
          res.on('end', function () {
            var body = Buffer.concat(chunks)
          })
        })
        req.write(qs.stringify({ token: config.slackbot_token,
          channel: 'D7W5R9KJB',
          text: `You recently said '${message.text}' in the ${channelName} channel. Your message may come off as condescending or rude since it scored a ${score} on our sentiment detection. We strongly advise you to change your message to one of the following suggestions below:` }))
        req.end()
      }).catch((err) => {
        console.log(err)
      })

    }
  }
})

rtm.start()
