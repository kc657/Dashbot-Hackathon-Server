const RtmClient = require('@slack/client').RtmClient
const CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS
const RTM_EVENTS = require('@slack/client').RTM_EVENTS
const qs = require('querystring')
const http = require('https')
const config = require('./env.json')

let channel
let bot
let user

var rtm = new RtmClient(config.slackbot_token)

rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (rtmStartData) => {
  for (const c of rtmStartData.channels) {
    if (c.is_member && c.name === 'general') { channel = c.id }
  }
  console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name}`)

  bot = '<@' + rtmStartData.self.id + '>'
})

rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function () {
  rtm.sendMessage('Testing from index.js!', channel)
})

rtm.on(RTM_EVENTS.MESSAGE, function (message) {
  if (message.channel === channel) {
    if (message.text !== null) {
      var req = http.request(config.slackbot_option, function (res) {
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
        text: message.text }))
      req.end()
    }
  }

})

rtm.start()
