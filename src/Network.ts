import Web3 from 'web3'
import { EventData } from 'web3-eth-contract'

import { IProvider } from './Interfaces/IProvider'
import { DirectProvider } from './Provider/DirectProvider'
import { Account } from './Account'
import {
    ContractBase,
    ContractManager,
    NetworkContract,
    DexTokenContract,
    DispenserContract,
    DirectPurchaseContract,
    ProvenanceContract,
    DIDRegistryContract,
} from './Contract/Contract'
import { isBalanceInsufficient, isDID, didToId } from './Utils'
import { DDO } from './DDO/DDO'
import { RemoteAgent } from './Agent/RemoteAgent'
import { IAgentAuthentication } from './Interfaces/IAgentAuthentication'
import { INetworkOptions } from './Interfaces/INetwork'

/**
 * Network class to connect to a block chain network. To perform starfish operations
 *
 *
 */
export class Network {
    /**
     * Return a instance of a Network object.
     * @param urlProvider URL of the network node or a Provider object to access the node.
     * @param artifactsPath Path to the artifacts files that contain the contract ABI and address.
     * The artifact contract files must be in the format `<contractName>.<networkName>.json`.
     *
     * @return The current Network object
     * @category Static Create
     */
    public static async getInstance(urlProvider: string | IProvider, options?: INetworkOptions): Promise<Network> {
        if (!Network.instance) {
            Network.instance = new Network()
        }
        await Network.instance.init(urlProvider, options)
        return Network.instance
    }

    private static instance
    public provider: IProvider
    public options: INetworkOptions
    public web3: Web3
    public networkId: number
    public networkName: string
    protected networkNames: Map<number, string>
    protected contractManager: ContractManager

    constructor() {
        this.networkNames = new Map([
            [0, 'development'],
            [1, 'main'],
            [2, 'morden'],
            [3, 'ropsten'],
            [4, 'rinkeby'],
            [42, 'kovan'],
            [77, 'POA_Sokol'],
            [99, 'POA_Core'],
            [100, 'xDai'],
            [1337, 'local'], // local private network - for testing
            [8995, 'nile'], // Ocean Protocol Public test net
            [8996, 'spree'], // Ocean Protocol local test net
            [0xcea11, 'pacific'], // Ocean Protocol Public mainnet
        ])
    }

    /**
     * Initialize the starfish object using a url or Provider and arfitfacts path. It is better
     * to call {@link getInstance} to create a new Network object.
     * @param urlProvider URL of the network node or a Provider object to access the node.
     * @param artifactsPath Path to the artifacts files that contain the contract ABI and address.
     */
    public async init(urlProvider: string | IProvider, options?: INetworkOptions): Promise<void> {
        if (typeof urlProvider === 'string') {
            this.provider = new DirectProvider(urlProvider)
        } else {
            this.provider = urlProvider
        }
        this.options = {}
        if (options) {
            this.options = options
        }
        if (this.options.autoLoadLocalArtifacts === undefined) {
            this.options.autoLoadLocalArtifacts = true
        }
        await this.connect()

        this.contractManager = new ContractManager(this.web3, this.networkId, this.networkName)
        if (this.options.autoLoadLocalArtifacts && this.networkName == 'local') {
            await this.contractManager.loadLocalArtifactsPackage()
        }
    }

    /**
     * Connect to the network node.
     * @returns True if the connection is successfull.
     */
    public async connect(): Promise<boolean> {
        this.web3 = new Web3(Web3.givenProvider || this.provider.getProvider())
        this.networkId = await this.web3.eth.net.getId()
        this.networkName = this.networkNames.get(this.networkId)
        return true
    }

    /**
     * Load a contract based on it's name.
     * @param name Name of the contract to load
     * @returns AContract that has been loadad
     */
    public async getContract(name: string): Promise<ContractBase> {
        return this.contractManager.load(name, this.options.artifactsPath)
    }

    /*
     *
     *      Account base operations
     *
     *
     */

    /**
     * Return the ether balance for a given account or account address.
     * @param accountAddress Acount object on account address string.
     * @returns Ether balance as a string.
     */
    public async getEtherBalance(accountAddress: Account | string): Promise<string> {
        const contract = new NetworkContract()
        contract.load(this.web3)
        return await contract.getBalance(accountAddress)
    }

    /**
     * Return the token balance for a given account or account address.
     * @param accountAddress Acount object on account address string.
     * @returns Token balance as a string.
     */
    public async getTokenBalance(accountAddress: Account | string): Promise<string> {
        const contract = <DexTokenContract>await this.getContract('DexToken')
        return await contract.getBalance(accountAddress)
    }

    /**
     * Request more tokens, this only works on a test network ONLY.
     * @param account Account object to request tokens for.
     * @param amount Amount to request.
     * @returns True if successfull.
     */
    public async requestTestTokens(account: Account, amount: number): Promise<boolean> {
        const contract = <DispenserContract>await this.getContract('Dispenser')
        const receipt = await contract.requestTokens(account, amount)
        return receipt.status
    }

    /*
     *
     *      Send ether and tokens to another account
     *
     *
     */
    /**
     * Send some ether to another account.
     * @param account Account to send the ether from. You must have access to the private password, or have this account unlocked.
     * @param toAccountAddress Account or address string of the account that will receive the payment.
     * @param amount Amount to of ether to send.
     * @returns True if the sending of the payment was made.
     */
    public async sendEther(account: Account, toAccountAddress: Account | string, amount: number | string): Promise<boolean> {
        const contract = new NetworkContract()
        contract.load(this.web3)
        const fromAccountBalance = await contract.getBalance(account)

        if (isBalanceInsufficient(fromAccountBalance, amount)) {
            throw new Error(
                `The account ${account.address} has insufficient funds of ${fromAccountBalance} ether to send ${amount} ether`
            )
        }
        const receipt = await contract.sendEther(account, toAccountAddress, amount)
        return receipt.status
    }

    /**
     * Send some token to another account.
     * @param account Account to send the token from. You must have access to the private password, or have this account unlocked.
     * @param toAccountAddress Account or address string of the account that will receive the payment.
     * @param amount Amount to of token to send.
     * @returns True if the sending of the payment was made.
     */
    public async sendToken(account: Account, toAccountAddress: Account | string, amount: number | string): Promise<boolean> {
        const contract = <DexTokenContract>await this.getContract('DexToken')
        const fromAccountBalance = await contract.getBalance(account)

        if (isBalanceInsufficient(fromAccountBalance, amount)) {
            throw new Error(
                `The account ${account.address} has insufficient funds of ${fromAccountBalance} tokens to send ${amount} tokens`
            )
        }
        const receipt = await contract.transfer(account, toAccountAddress, amount)
        return receipt.status
    }

    /*
     *
     *
     *      Send Tokens (make payment) with logging on the block chain.
     *
     */

    /**
     * Send some token to another account and record the transaction with two optional references. These references are saved
     * on the block chain with the payment transaction. They can be reterived later using the call {@link getTokenEventLogs}
     * @param account Account to send the token from. You must have access to the private password, or have this account unlocked.
     * @param toAccountAddress Account or address string of the account that will receive the payment.
     * @param amount Amount to of token to send.
     * @param reference1 Reference #1 to save with the payment transaction.
     * @param reference2 Reference #2 to save with the payment transaction.
     * @returns True if the sending of the payment was made.
     */
    public async sendTokenWithLog(
        account: Account,
        toAccountAddress: Account | string,
        amount: number | string,
        reference1?: string,
        reference2?: string
    ): Promise<boolean> {
        let status = false
        const dexContract = <DexTokenContract>await this.getContract('DexToken')
        const directContract = <DirectPurchaseContract>await this.getContract('DirectPurchase')

        const fromAccountBalance = await dexContract.getBalance(account)
        if (isBalanceInsufficient(fromAccountBalance, amount)) {
            throw new Error(
                `The account ${account.address} has insufficient funds of ${fromAccountBalance} tokens to send ${amount} tokens`
            )
        }

        // first approve the transfer fo tokens for the direct-contract
        const approved = await dexContract.approveTransfer(account, directContract.address, amount)
        status = approved.status
        if (status) {
            const receipt = await directContract.sendTokenWithLog(account, toAccountAddress, amount, reference1, reference2)
            status = receipt.status
        }
        return status
    }

    /**
     * Returns true if any token has been sent to the recipient 'toAccountAddress' with the amount, and optional references.
     * This method will only show any tokens sent by the method {@link sendTokenWithLog}.
     * @param account Account to send the token from. You must have access to the private password, or have this account unlocked.
     * @param toAccountAddress Account or address string of the account that will receive the payment.
     * @param amount Amount to of token to send.
     * @param reference1 Reference #1 to save with the payment transaction.
     * @param reference2 Reference #2 to save with the payment transaction.
     * @returns True if a valid payment was found.
     */
    public async isTokenSent(
        fromAccountAddress: Account | string,
        toAccountAddress: Account | string,
        amount: number | string,
        reference1?: string,
        reference2?: string
    ): Promise<boolean> {
        const contract = <DirectPurchaseContract>await this.getContract('DirectPurchase')
        const eventLogs = await contract.getEventLogs(fromAccountAddress, toAccountAddress, amount, reference1, reference2)
        return eventLogs && eventLogs.length > 0
    }

    /**
     * Returns a list of events that have been sent to the recipient 'toAccountAddress' with the amount, and optiona references.
     * This call will only work with tokens send by the method {@link sendTokenWithLog}.
     * @param account Account to send the token from. You must have access to the private password, or have this account unlocked.
     * @param toAccountAddress Account or address string of the account that will receive the payment.
     * @param amount Amount to of token to send.
     * @param reference1 Reference #1 to save with the payment transaction.
     * @param reference2 Reference #2 to save with the payment transaction.
     * @returns The list of events that have been found.
     */
    public async getTokenEventLogs(
        fromAccountAddress: Account | string,
        toAccountAddress: Account | string,
        amount: number | string,
        reference1?: string,
        reference2?: string
    ): Promise<EventData[]> {
        const contract = <DirectPurchaseContract>await this.getContract('DirectPurchase')
        return contract.getEventLogs(fromAccountAddress, toAccountAddress, amount, reference1, reference2)
    }

    /*
     *
     *
     *      Register and list Provenance
     *
     *
     *
     */
    /**
     * Register provenance on the network.
     * @param account Account to register the provenance from.
     * @param assetId Asset id to register. This is a 32 byte hex string ( '0x' + 64 hex chars )
     * @returns True if the registration was successfull.
     */
    public async registerProvenance(account: Account, assetId: string): Promise<boolean> {
        const contract = <ProvenanceContract>await this.getContract('Provenance')
        const receipt = await contract.register(account, assetId)
        return receipt.status
    }

    /**
     * Return a list of provenance event logs for a given assetId.
     * @param assetId Asset id to search for a provenance record.
     * @returns List of event items found for this assetId.
     */
    public async getProvenanceEventLogs(assetId: string): Promise<EventData[]> {
        const contract = <ProvenanceContract>await this.getContract('Provenance')
        return contract.getEventLogs(assetId)
    }
    /*
     *
     *
     *      Register DID with a DDO string and reslove DID to a DDO string
     *
     *
     */
    /*
     * Registers a DID on the block chain network, with an associated DDO.
     * @param account Account to use to sign and pay for the registration.
     * @param did DID string to register.
     * @param ddoText DDO in JSON text.
     * @returns True if the registration was successful.
     */
    public async registerDID(account: Account, did: string, ddoText: string): Promise<boolean> {
        const contract = <DIDRegistryContract>await this.getContract('DIDRegistry')
        const didId = didToId(did)
        const receipt = await contract.register(account, didId, ddoText)
        return receipt.status
    }

    /*
     * Resolves a DID to a DDO text string if found on the block chain network.
     * @param did DID to search find.
     * @returns DDO as a JSON text if found, else return null.
     */
    public async resolveDID(did: string): Promise<string> {
        const contract = <DIDRegistryContract>await this.getContract('DIDRegistry')
        const didId = didToId(did)
        return contract.getValue(didId)
    }

    /*
     *
     *
     *          Helper for resolving agents
     *
     *
     */

    /*
     * Resolves an agent address to a DDO object. An agent address can be a URL, DID or Asset DID.
     * @param agentAddress DID, URL or Asset DID of the agent to resolve.
     * @param username Optional username of the agent to access. Access is only used if the URL is provided.
     * @param password Optional password of the agent to access.
     * @param authentication Optionas authentication object, this can be used instead of the username/password
     * @returns a DDO object if the agent is found, else returns null.
     */
    public async resolveAgent(
        agentAddress: string,
        username?: string,
        password?: string,
        authentication?: IAgentAuthentication
    ): Promise<DDO> {
        if (isDID(agentAddress)) {
            const ddoText = await this.resolveDID(agentAddress)
            if (ddoText) {
                return DDO.createFromString(ddoText)
            }
        }
        let agentAuthentication = authentication
        if (!authentication) {
            agentAuthentication = {
                username: username,
                password: password,
            }
        }
        const ddoText = await RemoteAgent.resolveURL(agentAddress, agentAuthentication)
        if (ddoText) {
            return DDO.createFromString(ddoText)
        }
        return null
    }
}
