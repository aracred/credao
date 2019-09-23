const fetch = require('isomorphic-unfetch')
const { ethers } = require("ethers")
const githubJWT = require('./githubJWT')
const parseLinkHeader = require('parse-link-header')
const { GH_INSTALLATION_REPOS_URL, GH_ACCESS_TOKEN_URL, GH_USER_URL } = require('./constants')

export async function getInstallationGithubToken(githubInstallationId){
  let data = await fetch(`https://api.github.com/app/installations/${githubInstallationId}/access_tokens`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${await githubJWT()}`, "Accept": "application/vnd.github.machine-man-preview+json" }
  })
  return (await data.json()).token
}

export async function getInstallationRepos(ghToken){
  let repos = []
  let url = GH_INSTALLATION_REPOS_URL
  while(!!url){
    let res = await fetch(`${GH_INSTALLATION_REPOS_URL}`, {
      headers: { "Authorization": `token ${ghToken}`, "Accept": "application/vnd.github.machine-man-preview+json" }
    })
    let data = await res.json()
    console.log(`${data.total_count} repos`)
    repos = repos.concat( data.repositories )
    let link = parseLinkHeader(res.headers.get("link"))
    url = link && link.next ? link.next.url : null
  }
  return repos
}

export async function createInstallation({userId, githubInstallationId, githubToken, name, target, creatorId}){
  let resData = await gqlSubmit(`
    mutation { createInstallation( input: {
          installation: { githubId: ${githubInstallationId}, githubToken: "${githubToken}",
            name: "${name}", target: "${target}", creatorId: ${creatorId} } }
    ) { installation { id name target creatorId } } }`)
  return resData && resData.data.createInstallation.installation
}

export async function updateInstallationDAO({id, dao}){
  let resData = await gqlSubmit(`
    mutation { updateInstallationById(input: {installationPatch: {dao: "${dao}"}, id: ${id}}) {
        clientMutationId } }`)
  return resData && resData.data.updateInstallationById.installation
}

export async function getInstallationByGithubId({githubInstallationId}){
  const resData = await gqlSubmit(`query {
    installationByGithubId(githubId: ${githubInstallationId}) {
      id name target dao creatorId } }`)
  return resData && resData.data.installationByGithubId
}

export async function getUserInstallationsByUserId(userId){
  const resData = await gqlSubmit(`query { userById(id: ${userId}) { id
      installationsByInstallationUserUserIdAndInstallationId {
        nodes { id name target dao } } } }`)
  return resData && resData.data.userById.installationsByInstallationUserUserIdAndInstallationId.nodes
}

export async function createInstallationUser({userId, installationId}){
  const wallet = ethers.Wallet.createRandom()

  const resData = await gqlSubmit(`mutation {
    createInstallationUser( input: { installationUser: { userId: ${userId}, installationId: ${installationId}, autoKey: "${wallet.privateKey}" } } ) {
      installationUser { userId installationId address autoKey } } }`)

  return resData && resData.data.createInstallationUser.installationUser
}

export async function getInstallationById({installationId}){
  const resData = await gqlSubmit(`query { installationById(id: ${installationId}) { id name target dao } }`)
  return resData && resData.data.installationById
}

export async function getInstallationUser({userId, installationId}){
  const resData = await gqlSubmit(`query {
    installationUserByInstallationIdAndUserId(userId: ${userId}, installationId: ${installationId}) {
      userId installationId address autoKey
      installationByInstallationId { name dao }
    } }`)
  return resData && resData.data.installationUserByInstallationIdAndUserId
}

export async function createUser({githubId, username}){
  let inputs = [`username: "${username}"`]
  if(githubId) inputs.push(`githubId: ${githubId}`)
  let resData = await gqlSubmit(`mutation { createUser( input: { user: { ${inputs.join(", ")} } } ) { user { id username } } }`)
  return resData.data.createUser.user
}

export async function getUserByGithubId({githubId}){
  let resData = await gqlSubmit(`query { userByGithubId(githubId: ${githubId}) { id username } }`)
  console.log(resData)
  return resData && resData.data.userByGithubId
}

export async function getUserByUsername({username}){
  let resData = await gqlSubmit(`query { userByUsername(username: "${username}") { id } }`)
  console.log(resData)
  return resData && resData.data.userByUsername
}

export async function gqlSubmit(query){
  let baseURL = ''
  if(typeof window === "undefined")
    baseURL = process.env.BASE_URL

  let res = await fetch(`${baseURL}/graphql`, {
    method: "POST",
    headers: {"Content-Type": "application/json", "Accept": "application/json"},
    body: JSON.stringify({query})
  })
  return (await res.json())
}
