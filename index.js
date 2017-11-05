const RtmClient = require('@slack/client').RtmClient
const CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS
const RTM_EVENTS = require('@slack/client').RTM_EVENTS
const qs = require('querystring')
const https = require('https')
const request = require('request')
const config = require('./env.json')

let channel
let bot
let dictionary

let rtm = new RtmClient(config.slackbot_token)

rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (rtmStartData) => {
  for (const c of rtmStartData.channels) {
    if (c.is_member && c.name === 'general') { channel = c.id, channelName = c.name }
  }
  console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name}`)

  bot = '<@' + rtmStartData.self.id + '>'
})

rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function () {
  rtm.sendMessage('Testing from index.js!', channel)
})

rtm.on(RTM_EVENTS.MESSAGE, function (message) {
  console.log(message)
  if (message.channel === channel) {
    if (message.text !== null) {
      console.log(message.text);
      var options = { method: 'GET',
        url: 'http://160.16.100.143:8000/paraphrase/ver1.0/',
        qs: { q: message.text },
        headers:
        { 'postman-token': '34419346-e804-50a0-5c34-b873572d5a28',
          'cache-control': 'no-cache' } }

      request(options, function (error, response, body) {
        if (error) throw new Error(error)

        console.log(body)
      })

      let req = https.request(config.slackbot_option, function (res) {
        var chunks = []
        res.on('data', function (chunk) {
          chunks.push(chunk)
        })
        res.on('end', function () {
          var body = Buffer.concat(chunks)
          console.log(body.toString())
        })
      })

      req.write(qs.stringify({ token: config.slackbot_token,
        channel: message.user,
        text: `You recently said '${message.text}' in the ${channelName} channel. Your message may come off as condescending or rude since it scored a 0.4 on our sentiment detection. We strongly advise you to change your message to one of the following suggestions below:` }))
      req.end()
    }
  }
})

rtm.start()
