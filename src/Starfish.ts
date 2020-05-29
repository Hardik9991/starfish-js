import Web3 from 'web3'
import IProvider from './Providers/IProvider'
import DirectProvider from './Providers/DirectProvider'
import Account from './Account'
import AContract from './Contracts/AContract'
import ContractManager from './Contracts/ContractManager'
import NetworkContract from './Contracts/NetworkContract'
import OceanTokenContract from './Contracts/OceanTokenContract'
import DispenserContract from './Contracts/DispenserContract'

/**
 * Starfish class to connect to a block chain network. To perform starfish operations
 *
 *
 */
export default class Starfish {
    /**
     * Return a instance of a Starfish object.
     * @param urlProvider URL of the network node or a Provider object to access the node.
     * @param artifactsPath Path to the artifacts files that contain the contract ABI and address.
     * The artifact contract files must be in the format `<contractName>.<networkName>.json`.
     *
     * @return The current Starfish object
     */
    public static async getInstance(urlProvider: string | IProvider, artifactsPath?: string): Promise<Starfish> {
        if (!Starfish.instance) {
            Starfish.instance = new Starfish()
            await Starfish.instance.init(urlProvider, artifactsPath)
        }
        return Starfish.instance
    }

    private static instance
    private provider: IProvider
    private artifactsPath: string
    private web3: Web3
    private networkId: number
    private networkName: string
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
            [8995, 'nile'], // Ocean Protocol Public test net
            [8996, 'spree'], // Ocean Protocol local test net
            [0xcea11, 'pacific'], // Ocean Protocol Public mainnet
        ])
    }

    /**
     * Initialize the starfish object using a url or Provider and arfitfacts path. It is better
     * to call {@link getInstance} to create a new Starfish object.
     * @param urlProvider URL of the network node or a Provider object to access the node.
     * @param artifactsPath Path to the artifacts files that contain the contract ABI and address.
     */
    public async init(urlProvider: string | IProvider, artifactsPath?: string): Promise<void> {
        if (typeof urlProvider === 'string') {
            this.provider = new DirectProvider(urlProvider)
        } else {
            this.provider = urlProvider
        }
        if (artifactsPath === undefined) {
            artifactsPath = 'artifacts'
        }
        this.artifactsPath = artifactsPath
        await this.connect()
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
    public async getContract(name: string): Promise<AContract> {
        if (!this.contractManager) {
            this.contractManager = new ContractManager(this.web3, this.networkName, this.artifactsPath)
        }
        return await this.contractManager.load(name)
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
        const contract = <OceanTokenContract>await this.getContract('OceanToken')
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
        const txHash = await contract.requestTokens(account, amount)
        const receipt = await contract.waitForReceipt(txHash)
        return receipt.status === 1
    }

    /**
     * Return the current provider.
     */
    public getProvider(): IProvider {
        return this.provider
    }

    /**
     * Return the current artifacts path being used to load the contracts.
     */
    public getArtifactsPath(): string {
        return this.artifactsPath
    }

    /**
     * Return the web3 object used to acess the network node.
     */
    public getWeb3(): Web3 {
        return this.web3
    }

    /**
     * Return the connected network Id of the node
     */
    public getNetworkId(): number {
        return this.networkId
    }

    /**
     * Return the network name based on the network Id value.
     */
    public getNetworkName(): string {
        return this.networkName
    }
}