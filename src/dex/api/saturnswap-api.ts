import { BaseApi } from './base-api';
import { Asset, Token } from '../models/asset';
import { LiquidityPool } from '../models/liquidity-pool';
import axios, { AxiosInstance } from 'axios';
import { SaturnSwap } from '../saturnswap';
import { RequestConfig } from '@app/types';
import { appendSlash } from '@app/utils';

/**
 * SaturnSwap API implementation
 * Provides methods to fetch liquidity pools and other data from SaturnSwap's GraphQL API
 */
export class SaturnSwapApi extends BaseApi {

    protected readonly api: AxiosInstance;
    protected readonly dex: SaturnSwap;

    constructor(dex: SaturnSwap, requestConfig: RequestConfig) {
        super();

        this.dex = dex;

        this.api = axios.create({
            timeout: requestConfig.timeout,
            // TODO: Update with actual SaturnSwap API endpoint
            baseURL: `${appendSlash(requestConfig.proxyUrl)}https://api.saturnswap.com/graphql`,
            withCredentials: false,
        });
    }

    /**
     * Fetch liquidity pools from SaturnSwap API
     * @param assetA The first asset to filter by
     * @param assetB Optional second asset to filter by
     */
    liquidityPools(assetA?: Token, assetB?: Token): Promise<LiquidityPool[]> {
        // If both tokens provided, fetch specific pair
        if (assetA && assetB) {
            return this.poolByPair(assetA, assetB)
                .then((pool: LiquidityPool | null) => pool ? [pool] : []);
        }

        // TODO: Implement GraphQL query based on actual SaturnSwap API schema
        // This is a placeholder implementation
        return this.api.post('', {
            operationName: 'GetPools',
            query: `
                query GetPools($asset: String) {
                    pools(asset: $asset) {
                        id
                        assetA {
                            policyId
                            assetName
                            decimals
                        }
                        assetB {
                            policyId
                            assetName
                            decimals
                        }
                        reserveA
                        reserveB
                        lpToken {
                            policyId
                            assetName
                        }
                        totalLpSupply
                        poolFee
                    }
                }
            `,
            variables: {
                asset: assetA ? (assetA === 'lovelace' ? 'lovelace' : assetA.identifier()) : undefined,
            },
        }).then((response: any) => {
            const pools = response.data?.data?.pools || [];
            return pools.map((pool: any) => this.liquidityPoolFromResponse(pool));
        }).catch((error: any) => {
            console.error('Error fetching SaturnSwap pools:', error);
            return [];
        });
    }

    /**
     * Fetch a specific pool by asset pair
     */
    private poolByPair(assetA: Token, assetB: Token): Promise<LiquidityPool | null> {
        // TODO: Implement based on actual SaturnSwap API
        return this.api.post('', {
            operationName: 'GetPoolByPair',
            query: `
                query GetPoolByPair($assetA: String!, $assetB: String!) {
                    poolByPair(assetA: $assetA, assetB: $assetB) {
                        id
                        assetA {
                            policyId
                            assetName
                            decimals
                        }
                        assetB {
                            policyId
                            assetName
                            decimals
                        }
                        reserveA
                        reserveB
                        lpToken {
                            policyId
                            assetName
                        }
                        totalLpSupply
                        poolFee
                    }
                }
            `,
            variables: {
                assetA: assetA === 'lovelace' ? 'lovelace' : assetA.identifier(),
                assetB: assetB === 'lovelace' ? 'lovelace' : assetB.identifier(),
            },
        }).then((response: any) => {
            const pool = response.data?.data?.poolByPair;
            return pool ? this.liquidityPoolFromResponse(pool) : null;
        }).catch((error: any) => {
            console.error('Error fetching SaturnSwap pool by pair:', error);
            return null;
        });
    }

    /**
     * Convert API response to LiquidityPool model
     */
    private liquidityPoolFromResponse(poolData: any): LiquidityPool {
        const liquidityPool: LiquidityPool = new LiquidityPool(
            SaturnSwap.identifier,
            poolData.assetA.policyId !== ''
                ? new Asset(poolData.assetA.policyId, poolData.assetA.assetName, poolData.assetA.decimals ?? 0)
                : 'lovelace',
            poolData.assetB.policyId !== ''
                ? new Asset(poolData.assetB.policyId, poolData.assetB.assetName, poolData.assetB.decimals ?? 0)
                : 'lovelace',
            BigInt(poolData.reserveA),
            BigInt(poolData.reserveB),
            this.dex.poolAddress, // Saturn uses direct pool address
            this.dex.orderAddress,
            this.dex.orderAddress, // Same address for market/limit orders
        );

        liquidityPool.lpToken = new Asset(poolData.lpToken.policyId, poolData.lpToken.assetName);
        liquidityPool.totalLpTokens = BigInt(poolData.totalLpSupply);
        liquidityPool.poolFeePercent = poolData.poolFee || 0.3;
        liquidityPool.identifier = poolData.id || liquidityPool.lpToken.identifier();

        return liquidityPool;
    }
} 