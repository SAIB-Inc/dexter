import { LiquidityPool } from './models/liquidity-pool';
import { BaseDataProvider } from '@providers/data/base-data-provider';
import { Asset, Token } from './models/asset';
import { BaseDex } from './base-dex';
import {
    AssetAddress,
    AssetBalance,
    DatumParameters,
    DefinitionConstr,
    DefinitionField,
    PayToAddress,
    RequestConfig,
    SpendUTxO,
    SwapFee,
    UTxO
} from '@app/types';
import { DefinitionBuilder } from '@app/definition-builder';
import { correspondingReserves } from '@app/utils';
import { AddressType, DatumParameterKey } from '@app/constants';
import order from '@dex/definitions/saturnswap/order';
import pool from '@dex/definitions/saturnswap/pool';
import { BaseApi } from '@dex/api/base-api';
import { SaturnSwapApi } from '@dex/api/saturnswap-api';
import { Script } from 'lucid-cardano';
import { BaseWalletProvider } from '@providers/wallet/base-wallet-provider';

export class SaturnSwap extends BaseDex {

    public static readonly identifier: string = 'SaturnSwap';
    public readonly api: BaseApi;

    /**
     * On-Chain constants for SaturnSwap.
     * NOTE: These addresses and policy IDs need to be updated with actual SaturnSwap values
     */
    public readonly poolAddress: string = 'addr1_SATURN_POOL_ADDRESS'; // TODO: Update with actual address
    public readonly orderAddress: string = 'addr1_SATURN_ORDER_ADDRESS'; // TODO: Update with actual address
    public readonly lpTokenPolicyId: string = 'SATURN_LP_TOKEN_POLICY_ID'; // TODO: Update with actual policy
    public readonly poolNftPolicyId: string = 'SATURN_POOL_NFT_POLICY_ID'; // TODO: Update with actual policy
    public readonly poolValidityAsset: string = 'SATURN_POOL_VALIDITY_ASSET'; // TODO: Update with actual asset
    public readonly cancelDatum: string = 'd87a80'; // TODO: Verify Saturn's cancel datum
    public readonly orderScript: Script = {
        type: 'PlutusV2', // Saturn likely uses V2
        script: 'SATURN_ORDER_SCRIPT_CBOR', // TODO: Update with actual script
    };

    constructor(requestConfig: RequestConfig = {}) {
        super();
        this.api = new SaturnSwapApi(this, requestConfig);
    }

    public async liquidityPoolAddresses(provider: BaseDataProvider): Promise<string[]> {
        // For batcherless DEX, we return the pool validator address
        return Promise.resolve([this.poolAddress]);
    }

    public async liquidityPools(provider: BaseDataProvider): Promise<LiquidityPool[]> {
        const poolAddresses: string[] = await this.liquidityPoolAddresses(provider);
        const pools: LiquidityPool[] = [];

        for (const address of poolAddresses) {
            const utxos: UTxO[] = await provider.utxos(address);
            
            for (const utxo of utxos) {
                const pool = await this.liquidityPoolFromUtxo(provider, utxo);
                if (pool) {
                    pools.push(pool);
                }
            }
        }

        return pools;
    }

    public async liquidityPoolFromUtxo(provider: BaseDataProvider, utxo: UTxO): Promise<LiquidityPool | undefined> {
        if (!utxo.datumHash) {
            return undefined;
        }

        // Find pool NFT
        const poolNft: Asset | undefined = utxo.assetBalances.find((assetBalance: AssetBalance) => {
            return assetBalance.asset !== 'lovelace' && 
                   assetBalance.asset.policyId === this.poolNftPolicyId;
        })?.asset as Asset;

        if (!poolNft) return undefined;

        // Get relevant assets (excluding LP tokens and pool NFT)
        const relevantAssets: AssetBalance[] = utxo.assetBalances.filter((assetBalance: AssetBalance) => {
            if (assetBalance.asset === 'lovelace') return true;
            const asset = assetBalance.asset as Asset;
            return asset.policyId !== this.lpTokenPolicyId && 
                   asset.policyId !== this.poolNftPolicyId;
        });

        if (relevantAssets.length < 2) {
            return undefined;
        }

        // Parse datum to get pool details
        try {
            const builder: DefinitionBuilder = await (new DefinitionBuilder()).loadDefinition(pool);
            const datum: DefinitionField = await provider.datumValue(utxo.datumHash);
            const parameters: DatumParameters = builder.pullParameters(datum as DefinitionConstr);

            const liquidityPool: LiquidityPool = new LiquidityPool(
                SaturnSwap.identifier,
                relevantAssets[0].asset,
                relevantAssets[1].asset,
                relevantAssets[0].quantity,
                relevantAssets[1].quantity,
                utxo.address,
                this.orderAddress,
                this.orderAddress, // Saturn uses same address for market/limit orders
            );

            liquidityPool.lpToken = new Asset(this.lpTokenPolicyId, poolNft.nameHex);
            liquidityPool.identifier = poolNft.identifier();
            liquidityPool.poolFeePercent = 0.3; // TODO: Get actual fee from datum or constants
            liquidityPool.totalLpTokens = BigInt(parameters.TotalLpTokens || 0);

            return liquidityPool;
        } catch (e) {
            return undefined;
        }
    }

    public estimatedGive(liquidityPool: LiquidityPool, swapOutToken: Token, swapOutAmount: bigint): bigint {
        const poolFeeMultiplier: bigint = 10000n;
        const poolFeeModifier: bigint = poolFeeMultiplier - BigInt(Math.round((liquidityPool.poolFeePercent / 100) * Number(poolFeeMultiplier)));

        const [reserveOut, reserveIn]: bigint[] = correspondingReserves(liquidityPool, swapOutToken);

        const swapInNumerator: bigint = swapOutAmount * reserveIn * poolFeeMultiplier;
        const swapInDenominator: bigint = (reserveOut - swapOutAmount) * poolFeeModifier;

        return swapInNumerator / swapInDenominator + 1n;
    }

    public estimatedReceive(liquidityPool: LiquidityPool, swapInToken: Token, swapInAmount: bigint): bigint {
        const poolFeeMultiplier: bigint = 10000n;
        const poolFeeModifier: bigint = poolFeeMultiplier - BigInt(Math.round((liquidityPool.poolFeePercent / 100) * Number(poolFeeMultiplier)));

        const [reserveIn, reserveOut]: bigint[] = correspondingReserves(liquidityPool, swapInToken);

        const swapOutNumerator: bigint = swapInAmount * reserveOut * poolFeeModifier;
        const swapOutDenominator: bigint = swapInAmount * poolFeeModifier + reserveIn * poolFeeMultiplier;

        return swapOutNumerator / swapOutDenominator;
    }

    public priceImpactPercent(liquidityPool: LiquidityPool, swapInToken: Token, swapInAmount: bigint): number {
        const poolFeeMultiplier: bigint = 10000n;
        const poolFeeModifier: bigint = poolFeeMultiplier - BigInt(Math.round((liquidityPool.poolFeePercent / 100) * Number(poolFeeMultiplier)));

        const [reserveIn, reserveOut]: bigint[] = correspondingReserves(liquidityPool, swapInToken);

        const swapOutNumerator: bigint = swapInAmount * poolFeeModifier * reserveOut;
        const swapOutDenominator: bigint = swapInAmount * poolFeeModifier + reserveIn * poolFeeMultiplier;

        const priceImpactNumerator: bigint = (reserveOut * swapInAmount * swapOutDenominator * poolFeeModifier)
            - (swapOutNumerator * reserveIn * poolFeeMultiplier);
        const priceImpactDenominator: bigint = reserveOut * swapInAmount * swapOutDenominator * poolFeeMultiplier;

        return Number(priceImpactNumerator * 100n) / Number(priceImpactDenominator);
    }

    public async buildSwapOrder(liquidityPool: LiquidityPool, swapParameters: DatumParameters, spendUtxos: SpendUTxO[] = []): Promise<PayToAddress[]> {
        // Saturn is batcherless, so no batcher fee
        const deposit: SwapFee | undefined = this.swapOrderFees().find((fee: SwapFee) => fee.id === 'deposit');

        if (!deposit) {
            return Promise.reject('Deposit fee not configured.');
        }

        swapParameters = {
            ...swapParameters,
            [DatumParameterKey.DepositFee]: deposit.value,
        };

        const datumBuilder: DefinitionBuilder = new DefinitionBuilder();
        await datumBuilder.loadDefinition(order)
            .then((builder: DefinitionBuilder) => {
                builder.pushParameters(swapParameters);
            });

        return [
            this.buildSwapOrderPayment(
                swapParameters,
                {
                    address: this.orderAddress,
                    addressType: AddressType.Contract,
                    assetBalances: [
                        {
                            asset: 'lovelace',
                            quantity: deposit.value,
                        },
                    ],
                    datum: datumBuilder.getCbor(),
                    isInlineDatum: true, // Saturn likely uses inline datums
                    spendUtxos: spendUtxos,
                }
            )
        ];
    }

    public async buildCancelSwapOrder(txOutputs: UTxO[], returnAddress: string): Promise<PayToAddress[]> {
        const relevantUtxo: UTxO | undefined = txOutputs.find((utxo: UTxO) => {
            return utxo.address === this.orderAddress;
        });

        if (!relevantUtxo) {
            return Promise.reject('Unable to find Saturn order UTxO for cancellation.');
        }

        return [
            {
                address: returnAddress,
                addressType: AddressType.Base,
                assetBalances: relevantUtxo.assetBalances,
                isInlineDatum: false,
                spendUtxos: [{
                    utxo: relevantUtxo,
                    redeemer: this.cancelDatum,
                    validator: this.orderScript,
                    signer: returnAddress,
                }],
            }
        ];
    }

    public swapOrderFees(liquidityPool?: LiquidityPool, swapInToken?: Token, swapInAmount?: bigint): SwapFee[] {
        return [
            {
                id: 'deposit',
                title: 'Deposit',
                description: 'Minimum ADA required for the order UTxO. Returned when order is executed or cancelled.',
                value: 2_000000n, // TODO: Verify actual minimum ADA for Saturn
                isReturned: true,
            },
        ];
    }
} 