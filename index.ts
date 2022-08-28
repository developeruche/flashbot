// This script would be handling everything related to scripting 
import {ethers} from "ethers";
import { FlashbotsBundleProvider, FlashbotsBundleResolution} from "@flashbots/ethers-provider-bundle";



// declaration ans init of constants and variables
const GWEI = ethers.utils.parseUnits("1", 9);
const WEI = ethers.utils.parseEther("1");

const GAS_FEE = ethers.utils.parseUnits("2", 9);
const P_FEE = ethers.utils.parseUnits("3", 9);
const ERC20_CONTRACT = "0x525728DDb14195C02631BF4cACC57eF84658a415";

const CHAIN_ID = 5; // this is the chain id for goerli
const FLASHBOT_URL = "https://relay-goerli.flashbots.net";

const provider = new ethers.providers.JsonRpcProvider("");




async function main() {
    // const [admin, victim] = await ethers.getSigners();
    const admin = new ethers.Wallet("");
    const victim = new ethers.Wallet("");
    const r_signer = ethers.Wallet.createRandom(); // this pourpose of this wallet id to establish an identity when submitting a transaction to flashbot

    const flashbot = await FlashbotsBundleProvider.create(
        provider,
        r_signer,
        FLASHBOT_URL
    );

    const abi = ["function transfer(address,uint256) external"];
    const iface = new ethers.utils.Interface(abi);

    provider.on("block", async (block) => {
        console.log("BLOCK: ", block);

        const signedTx = await flashbot.signBundle([
            {
                signer: admin,
                transaction: {
                    chainId: CHAIN_ID,
                    type: 2, //EIP 1559
                    maxFeePerGas: P_FEE,
                    maxPriorityFeePerGas: GAS_FEE,
                    gasLimit: 1000000,
                    value: ethers.utils.parseEther("0.01"),
                    data: "0x",
                    to: victim.address
                }
            },
            {
                signer: victim,
                transaction: {
                    chainId: 5,
                    type: 2,
                    to: ERC20_CONTRACT,
                    gasLimit: 1000000,
                    data: iface.encodeFunctionData("transfer", [
                        admin.address,
                        ethers.utils.parseEther("100000"),
                    ]),
                    maxFeePerGas: P_FEE,
                    maxPriorityFeePerGas: GAS_FEE,
                },
            },
        ])

        const targetBlock = block + 1;

        // running a quick simulation 
        const sim = await flashbot.simulate(signedTx, targetBlock);

        if("error" in sim) {
            console.log(`Simulation error: ${sim.error.message}`);
        } else {
            console.log("TX simulation was successful");
        }

        // sending the raw transaction 
        const res = await flashbot.sendRawBundle(signedTx, targetBlock);
        if("error" in res) {
            throw new Error(res.error.message);
        }


        const bundleResolution = await res.wait();
        if(bundleResolution === FlashbotsBundleResolution.BundleIncluded) {
            console.log(`Congrats, included in ${targetBlock}`);
            console.log(JSON.stringify(sim, null, 2));
            process.exit(0);
        } else if (bundleResolution === FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
            console.log(`Not included in ${targetBlock}`);
        } else if(bundleResolution === FlashbotsBundleResolution.AccountNonceTooHigh) {
            console.log("Nonce is too high, bailing");
            process.exit(1);
        }
    })
}


main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});