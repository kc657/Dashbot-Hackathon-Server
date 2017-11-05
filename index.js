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

let rtm = new RtmClient(config.slackbot_token)

rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (rtmStartData) => {
  console.log(rtmStartData.channels)
  for (const c of rtmStartData.channels) {
    if (c.is_member && c.name === 'general') {
      channel = c.id, channelName = c.name
    }
  }
  bot = '<@' + rtmStartData.self.id + '>'
})

rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function () {
  console.log('connection opened')
})

rtm.on(RTM_EVENTS.MESSAGE, function (message) {
  if (message.channel === 'D7W5R9KJB') {
    let pieces = []
    if (message.text !== null) {
      pieces = message.text.split(' ')
      console.log(pieces)

      if (pieces.length > 1) {
        if (pieces[0] === bot) {
          var helpResponse = '<@' + message.user + '>'

          switch (pieces[1].toLowerCase()) {
            case 'help':
              helpResponse += `, I am here for you if you are currently stressed or frustrated at work. Type one of the following commands for more information: ${bot} depression, ${bot} suicide, or ${bot} anxiety`
              break
            case 'depression':
              helpResponse += `, sorry to hear that you are depressed. May I suggest this article...`
              break
            case 'anxiety':
              helpResponse += `, anxiety really sucks. We have some anxiety exercises that may help! Type one of the following commands to try these out: ${bot} exerciseOne or ${bot} exerciseTwo `
              break
            case 'suicide':
              helpResponse += `, please don't! Please care for you, especially your family and friends. Hope this photo from your last trip cheers you up!`
              break
            case 'exerciseone':
              helpResponse += `,One Minute Breathing
              Start by breathing in and out slowly to become aware of your natural breathing rhythm. Let the breath flow in and out effortlessly, as you prepare your lungs for deeper breaths.
              Step one: Inhale for a count of four.
              Step two: Hold for a count of seven. (If you feel dizzy, hold for four until you can build up to seven.)
              Step three: Exhale for a count of eight.
              Repeat four times.`
              break
            case 'exercisetwo':
              helpResponse += `Sit with your eyes closed and turn your attention to your breathing. Breathe naturally, preferably through the nostrils, without attempting to control your breath. Be aware of the sensation of the breath as it enters and leaves the nostrils.

              Step one: Place one hand on your belly, and the other on your chest. Take a deep breath for a count of four. Hold your breath for a count of three. Exhale for a count of four. The hand on your chest should remain relatively still, while the hand on your belly rises gently upward. Contract your abdominal muscles to exhale, breathing out through your mouth.

              Step two: Concentrate on your breath and forget everything else. Your mind may be busy, and you may feel that this exercise is making your mind busier, but the reality is you're becoming more aware of your mind's busy state.

              Step three: Resist the temptation to follow the different thoughts as they arise, and focus on the sensation of the breath. If you discover that your mind has wandered and is following your thoughts, immediately return it to the breath.`
              break
            default:
              helpResponse += ', sorry I do not understand the command "' + pieces[1] + '". For a list of supported commands, type: ' + bot + ' help'
              break
          }

          rtm.sendMessage(helpResponse, message.channel)
        }
      }
    }
  } else if (message.channel === channel) {
    console.log(message.channel, channel)
    if (message.text !== null) {
      let suggestion
      let suggestionQuery = message.text
      let dictionary = [['can you', 'would you kindly'], ['hate', 'dislike'], ['screw you', 'can you not...'], ["coup d'etat", 'If you stage a coup, you will all be fired! Big brother is watching you all...']]
      dictionary.forEach(function (keyPair) {
        if (suggestionQuery.includes(keyPair[0])) {
          suggestion = suggestionQuery.replace(keyPair[0], keyPair[1])
        }
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
              let reply = {
                type: 'message',
                text: `You should consider phrasing your message like: '${suggestion}'. If you need more help with any emotional issues, type '@talk-kindly help' for more information!`,
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
              suggestion = ''
            }
          })
        })
        client.connect(parsedData.url)
      })

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
        apiKey: config.microsoft_token,
        endpoint: 'westus.api.cognitive.microsoft.com'
      })
      let score
      textAnalyticsClient.sentiment({
        headers,
        body
      }).then((response) => {
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
