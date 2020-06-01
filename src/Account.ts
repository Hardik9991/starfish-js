/*


    Account

*/

import fs from 'fs-extra'
import Web3 from 'web3'

import { toChecksumAddress } from 'web3-utils'
import { EncryptedKeystoreV3Json, SignedTransaction } from 'web3-core'

import Starfish from './Starfish'
/**
 * Account class to hold a privatly owned account
 */
export default class Account {
    readonly address: string
    readonly checksumAddress: string
    readonly password: string
    readonly keyFilename: string
    readonly isLocal: boolean
    public keyData: EncryptedKeystoreV3Json

    /**
     * Create a new account object, using the provided password.
     * @param password Password to use for this new account.
     * @param entropy Entropy for the account generation.
     * @returns A new Account object.
     */
    public static createNew(password: string, entropy?: string): Account {
        const web3 = new Web3()
        const result = web3.eth.accounts.create(entropy)
        const address = result.address
        const keyData = web3.eth.accounts.encrypt(result.privateKey, password)
        return new Account(address, password, null, keyData)
    }

    /**
     * Loads a new account object that has been already loaded on the network node.
     * @param network Network node that has the account.
     * @param address Address of the account on the node.
     * @param password Password to access this account information in the account file.
     * @returns A new account object with the nessecary information.
     */
    public static async loadFromNetwork(network: Starfish, address: string, password: string): Promise<Account> {
        const accounts = await network.web3.eth.personal.getAccounts()
        if (accounts.indexOf(address) >= 0) {
            return new Account(address, password)
        }
        return null
    }

    /**
     * Loads a new account object from an account file.
     * @param password Password to access this account information in the account file.
     * @param filename Filename of the account data.
     * @returns A new account object with the nessecary information , or null if the password is incorect or file is not found.
     */
    public static async loadFromFile(password: string, filename: string): Promise<Account> {
        const web3 = new Web3()
        const data = await Account.loadKeyFileFromFile(filename)
        if (data) {
            const keyData = await web3.eth.accounts.decrypt(data, password)
            return new Account(keyData.address, password, filename, data)
        }
        return null
    }

    /**
     * Load an account json file that contains the information needed to sign and hash messages.
     * @param filename Filename of the account file.
     * @returns Data that contains the account information. The user needs to pass the password
     * to use this data.
     */
    public static async loadKeyFileFromFile(filename: string): Promise<EncryptedKeystoreV3Json> {
        let data = null
        if (fs.pathExists(filename)) {
            const rawData = await fs.readFile(filename)
            data = JSON.parse(rawData)
        }
        return data
    }

    /**
     * Construct a new account object. Please use the following static methods:
     *
     *   +   {@link createNew}
     *   +   {@link createFromFile}
     *
     * @param address Address of the account.
     * @param password Password of the account.
     * @param keyfilename Filename where the account key data is stored.
     * @param keyData Account key data ( encrypted )
     */
    constructor(address?: string, password?: string, keyFilename?: string, keyData?: EncryptedKeystoreV3Json) {
        this.address = address
        this.checksumAddress = toChecksumAddress(this.address)
        this.password = password
        this.keyFilename = keyFilename
        this.keyData = keyData
        this.isLocal = typeof this.keyData != 'undefined'
    }

    /**
     * Save the key data to a file.
     * @param filename Filename to write the account key data too.
     */
    public async saveToFile(filename: string): Promise<any> {
        const data = JSON.stringify(this.keyData)
        return await fs.writeFile(filename, data)
    }

    /**
     * Sign a transaction using the accounts password and keyData.
     * @param web3 Web3 object that is being used to connect and send the transaction.
     * @param transaction Transaction that needs to be signed.
     * @returns Return the signed transaction.
     */
    public async signTransaction(web3: Web3, transaction: unknown): Promise<SignedTransaction> {
        // decode the keyData to find out the private key
        const data = await web3.eth.accounts.decrypt(this.keyData, this.password)
        return web3.eth.accounts.signTransaction(transaction, data.privateKey)
    }

    public async unlock(web3: Web3): Promise<boolean> {
        if (typeof this.keyData === 'undefined') {
            return web3.eth.personal.unlockAccount(this.checksumAddress, this.password, null)
        }
        return false
    }

    /**
     * Export the account encrypted keyData as a string.
     */
    public exportKey(): string {
        return JSON.stringify(this.keyData)
    }

    /**
     * Import the an account's private key and internally save the keyData.
     * @param privateKey Private key of the account.
     * @param password Password used to encrypt the private key and create the keyData.
     */
    public importKey(privateKey: string, password: string): void {
        const web3 = new Web3()
        this.keyData = web3.eth.accounts.encrypt(privateKey, password)
    }

    /**
     * Test to see if this address string is equal, to the one saved in this account object.
     * @param address Addresse to compare against
     */
    public isAddressEqual(address: string): boolean {
        return toChecksumAddress(address) === this.checksumAddress
    }

    /**
     * Return true if the password is set in this account object.
     */
    public isPassword(): boolean {
        return this.password != null
    }
}
