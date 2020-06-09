/*
 *
 *
 *    Remote Agent Adapter class
 *
 *
 *
 */

import fetch, { Headers } from 'node-fetch'
import { Base64 } from 'js-base64'
import urljoin from 'url-join'

export class RemoteAgentAdapter {
    public static getInstance(): RemoteAgentAdapter {
        if (!RemoteAgentAdapter.instance) {
            RemoteAgentAdapter.instance = new RemoteAgentAdapter()
        }
        return RemoteAgentAdapter.instance
    }

    protected static createHeaders(contentType?: string, token?: string): Headers {
        const headers = new Headers()
        if (contentType) {
            headers.set('content-type', contentType)
        }
        if (token) {
            headers.set('Authorization', `token ${token}`)
        }
        return headers
    }

    private static instance

    public async getAuthorizationToken(username: string, password: string, url: string): Promise<string> {
        const auth = Base64.encode(`${username}:${password}`)
        const headers = new Headers({
            Authorization: `Basic ${auth}`,
        })
        let response = await fetch(url, {
            method: 'GET',
            headers: headers,
        })
        if (!response.ok) {
            throw new Error(`Unable to get access token from ${url} error: ${response.status}`)
        }
        const tokenList = await response.json()
        if (tokenList && tokenList.length > 0) {
            return tokenList[tokenList.length - 1]
        }
        response = await fetch(url, {
            method: 'POST',
            headers: headers,
        })
        if (response.ok) {
            return response.json()
        }
        throw new Error(`Unable to create new token from ${url} error: ${response.status}`)
    }

    public async getDDO(url: string, token?: string): Promise<string> {
        const ddoURL = urljoin(url, '/api/ddo')
        const headers = RemoteAgentAdapter.createHeaders('application/json', token)
        const response = await fetch(ddoURL, {
            method: 'GET',
            headers: headers,
        })
        if (response.ok) {
            return response.text()
        }
        throw new Error(`Unable to get DDO information from url ${ddoURL} error: ${response.status}`)
    }
}