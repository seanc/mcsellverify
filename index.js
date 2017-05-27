const cheerio = require('cheerio')
const request = require('cloudscraper')
const { Client } = require('discord.js')
const url = require('url')
const shortid = require('shortid')
const config = require('./config.json')
const low = require('lowdb')
const db = low('db.json')

db.defaults({ users: [] }).write()

const bot = new Client()

bot.on('ready', () => console.log('Ready'))
bot.on('message', message => {
  const args = message.cleanContent.trim().split(' ')
  const name = args.shift()
  const rawURL = args.join(' ')

  if (name === '!verify') {
    const pendingUser = db.get('users').find({ id: message.author.id }).value()

    const parsedURL = url.parse(rawURL)
    if (parsedURL.hostname !== 'mcsell.org' && !shortid.isValid(rawURL)) {
      message.reply('Please provide a link to your MCSell profile (ex. <https://mcsell.org/members/sean.22/>)')
    } else if (pendingUser.verified) {
      message.reply('You are already verified.')
    } else if (shortid.isValid(rawURL) && pendingUser) {
      message.reply('Verifying...').then(_message => {
        request.get(pendingUser.url, (err, response, body) => {
          if (err) {
            console.log(err)
            return _message.edit('An error occurred')
          }

          const $ = cheerio.load(body)
          const post = $('#UserStatus').text().split(' ').shift()

          if (pendingUser.code === post.trim()) {
            const banners = $('.userBanners .userBanner')
            banners.each(function () {
              const banner = $(this)
              const role = config.roleMap[banner.find('b').text().trim()]
              if (role) {
                message.member.addRole(role).catch(console.log)
              }
            })
            _message.edit('Verified!').then(() => {
              db.get('users').find({ id: message.author.id })
              .assign({ verified: true })
              .write()
            })
          }
        })
      })
    } else if (pendingUser && !shortid.isValid(rawURL)) {
      message.reply(`You already have a pending verification request, your code is ${pendingUser.code}`)
    } else if (!pendingUser && shortid.isValid(rawURL)) {
      message.reply('Please provide a link to your MCSell profile (ex. <https://mcsell.org/members/sean.22/>)')
    } else {
      const code = shortid.generate()
      message.reply(`Your verification code is ${code}, please update your profile status on MCSell with it, once you have done that please type !verify <code>`)
      .then(() => {
        db.get('users').push({
          id: message.author.id,
          url: parsedURL.href,
          code
        }).write()
      })
    }
  }

  if (name === '!mcsell') {
    const user = message.mentions.members.array().length ?
      message.mentions.members.first() :
      message.member

    const query = db.get('users').find({ id: user.id }).value()
    if (query) {
      message.channel.send(`${message.member.user.username}'s mcsell profile is: ${query.url}`)
    } else {
      message.reply('Sorry, I couldn\'t find that user. Maybe they haven\'t verified themselves yet.')
    }
  }
})

bot.login(config.token)
