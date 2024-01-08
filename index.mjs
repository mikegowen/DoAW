import 'dotenv/config';
import { providers, Wallet } from "ethers"
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle"

const GWEI = 10n ** 9n // as gwei
const PRIORITY_FEE = 150 // Add tip here
const BASE_FEE = 150

const CHAIN_ID = 1

const SHADOAW_CONTRACT_ADDRESS = '0x15D11DeB1011A375b4e56Bc989319d167DB2Bd3A'

const provider = new providers.JsonRpcProvider({ url: process.env.ALCHEMY_URL })
const botWallet = new Wallet(process.env.BOT_WALLET_KEY, provider)

const doawWallet = Wallet.fromMnemonic(process.env.DOAW_WALLET_MNEMONIC)
const doawWalletTxData = process.env.TRANSFER_CALL_HEX_DATA

const tx = (args) => ({
  chainId: CHAIN_ID,
  type: 2,
  maxFeePerGas: GWEI * BigInt(BASE_FEE),
  maxPriorityFeePerGas: GWEI * BigInt(PRIORITY_FEE),
  data: '0x',
  value: 0n,
  ...args
})

const bundle = [
  // send the DoAW wallet eth from the bot wallet
  {
    transaction: tx({
      to: doawWallet.address,
      value: 18000000000000000n,
    }),
    signer: botWallet
  },

  // send NFT to bot wallet
  {
    transaction: tx({
      to: SHADOAW_CONTRACT_ADDRESS,
      gasLimit: 100000,
      data: doawWalletTxData,
    }),
    signer: doawWallet
  },
]

let i = 0
async function main() {
  console.log('Starting flashbot...')

  let flashbotsProvider
  try {
    console.log('Retreiving Flashbots Provider...')
    flashbotsProvider = await FlashbotsBundleProvider.create(provider, Wallet.createRandom())
  } catch (err) {
    console.error(err)
  }

  provider.on('block', async blockNumber => {
    try {
      const nextBlock = blockNumber + 1
      console.log(`Preparing bundle for block: ${nextBlock}`)

      const signedBundle = await flashbotsProvider.signBundle(bundle)
      console.log('Signed bundle', signedBundle)
      const txBundle = await flashbotsProvider.sendRawBundle(signedBundle, nextBlock)

      if ('error' in txBundle) {
        console.log('bundle error:')
        console.warn(txBundle.error.message)
        return
      }

      console.log('Submitting bundle')
      const response = await txBundle.simulate()
      if ('error' in response) {
        console.log('Simulate error')
        console.error(response.error)
        process.exit(1)
      }

      console.log('response:', response)

      console.log(`Try: ${i} -- block: ${nextBlock}`)
      i++

    } catch (err) {
      console.log('Request error')
      console.error(err)
      process.exit(1)
    }
  })
}

main()
