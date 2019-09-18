const express = require('express')
const session = require('express-session')
const next = require('next')
const { postgraphile } = require('postgraphile')
const PgManyToManyPlugin = require("@graphile-contrib/pg-many-to-many");
const { COLLECT_CRED_QUEUE, GH_OAUTH_URL } = require('../utils/constants')
const PgBoss = require('pg-boss')
const boss = new PgBoss(process.env.DATABASE_URL)
const collectCred = require('../tasks/collectCred')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

main()

async function main(){
  // await startBoss()

  await boss.start()
  await boss.subscribe(COLLECT_CRED_QUEUE, collectCred)

  await app.prepare()
  const server = express()

  server.use('/api', (req,res,next)=>{
    req.boss = boss
    next()
  })

  server.use(session({
    store: new (require('connect-pg-simple')(session))(),
    secret: process.env.COOKIE_SECRET,
    resave: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }, // 30 days
    saveUninitialized: false
  }))

  server.use(postgraphile(process.env.DATABASE_URL,'public', {
    watchPg: true,
    graphiql: true,
    enhanceGraphiql: true,
    dynamicJson: true,
    appendPlugins: [PgManyToManyPlugin]
  }))

  server.get('/sign-in', (req, res)=>{
    res.redirect(`${GH_OAUTH_URL}?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=http://localhost:4000/setup`)
  })

  server.get('/sign-out', (req, res)=>{
    req.session.destroy()
    res.redirect('/')
  })

  server.get('*', handle)

  server.listen(process.env.PORT, err => {
    if (err) throw err
    let baseURL = `http://localhost:${process.env.PORT}`
    console.log(`> Ready on ${baseURL}`)
    process.env.BASE_URL = baseURL
  })

}