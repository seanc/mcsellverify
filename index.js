const cheerio = require('cheerio')
const request = require('cloudscraper')
const { Client } = require('discord.js')
const url = require('url')
const shortid = require('shortid')
const config = require('./config.json')

const bot = new Client()
const cache = []

bot.on('ready', () => console.log('Ready'))
bot.on('message', message => {
  const args = message.cleanContent.trim().split(' ')
  const name = args.shift()
  const rawURL = args.join(' ')

  if (name === '!verify') {
    const pendingUser = cache.find(u => u.id === message.author.id)

    const parsedURL = url.parse(rawURL)
    if (parsedURL.hostname !== 'mcsell.org' && !shortid.isValid(rawURL)) {
      message.reply('Please provide a link to your MCSell profile (ex. <https://mcsell.org/members/sean.22/>)')
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
              cache.forEach((user, index) => user.id === message.author.id ? cache.splice(index, 1) : null)
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
      message.reply(`Your verification code is ${code}, please update your profile status on MCSell with it`)
      .then(() => {
        cache.push({
          id: message.author.id,
          url: parsedURL.href,
          code
        })
      })
    }
  }
})

bot.login(config.token)
