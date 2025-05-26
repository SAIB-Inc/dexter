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
 * 
 * Note: SaturnSwap is a limit-order DEX, so "pools" here represent order book
 * liquidity and trading pairs, not traditional AMM pools with x*y=k curves.
 */
export class SaturnSwapApi extends BaseApi {

    protected readonly api: AxiosInstance;
    protected readonly dex: SaturnSwap;

    constructor(dex: SaturnSwap, requestConfig: RequestConfig) {
        super();

        this.dex = dex;

        this.api = axios.create({
            timeout: requestConfig.timeout,
            // SaturnSwap GraphQL API endpoint
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

        // Based on SaturnSwap API documentation, use getPools query
        return this.api.post('', {
            query: `
                query GetPools($first: Int, $where: PoolFilterInput) {
                    getPools(first: $first, where: $where) {
                        nodes {
                            id
                            name
                            ticker
                            lp_fee_percent
                            token_project_one {
                                ticker
                                policy_id
                                asset_name
                                decimals
                            }
                            token_project_two {
                                ticker
                                policy_id
                                asset_name
                                decimals
                            }
                            pool_stats {
                                liquidity_ada
                                volume_24h_ada
                                price_one
                                price_two
                            }
                        }
                    }
                }
            `,
            variables: {
                first: 100,
                where: assetA ? {
                    or: [
                        { token_project_one: { policy_id: { eq: assetA === 'lovelace' ? '' : (assetA as Asset).policyId } } },
                        { token_project_two: { policy_id: { eq: assetA === 'lovelace' ? '' : (assetA as Asset).policyId } } }
                    ]
                } : undefined,
            },
        }).then((response: any) => {
            const pools = response.data?.data?.getPools?.nodes || [];
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
        // Use getPoolByTokens as shown in API docs
        return this.api.post('', {
            query: `
                query GetPoolByTokens($policyIdOne: String, $assetNameOne: String, $policyIdTwo: String, $assetNameTwo: String) {
                    getPoolByTokens(
                        policyIdOne: $policyIdOne,
                        assetNameOne: $assetNameOne,
                        policyIdTwo: $policyIdTwo,
                        assetNameTwo: $assetNameTwo
                    ) {
                        id
                        name
                        ticker
                        lp_fee_percent
                        token_project_one {
                            ticker
                            policy_id
                            asset_name
                            decimals
                        }
                        token_project_two {
                            ticker
                            policy_id
                            asset_name
                            decimals
                        }
                        pool_stats {
                            liquidity_ada
                            volume_24h_ada
                            price_one
                            price_two
                        }
                    }
                }
            `,
            variables: {
                policyIdOne: assetA === 'lovelace' ? '' : (assetA as Asset).policyId,
                assetNameOne: assetA === 'lovelace' ? '' : (assetA as Asset).assetName,
                policyIdTwo: assetB === 'lovelace' ? '' : (assetB as Asset).policyId,
                assetNameTwo: assetB === 'lovelace' ? '' : (assetB as Asset).assetName,
            },
        }).then((response: any) => {
            const pool = response.data?.data?.getPoolByTokens;
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
        // Extract token information
        const tokenA = poolData.token_project_one.policy_id !== ''
            ? new Asset(poolData.token_project_one.policy_id, poolData.token_project_one.asset_name, poolData.token_project_one.decimals ?? 0)
            : 'lovelace';
        const tokenB = poolData.token_project_two.policy_id !== ''
            ? new Asset(poolData.token_project_two.policy_id, poolData.token_project_two.asset_name, poolData.token_project_two.decimals ?? 0)
            : 'lovelace';

        // Calculate reserves based on liquidity and prices
        // This is a simplified calculation - actual implementation may need refinement
        const liquidityAda = BigInt(poolData.pool_stats?.liquidity_ada || 0);
        const priceOne = poolData.pool_stats?.price_one || 1;
        const priceTwo = poolData.pool_stats?.price_two || 1;
        
        const reserveA = tokenA === 'lovelace' ? liquidityAda / 2n : BigInt(Math.floor(Number(liquidityAda) / 2 / priceOne));
        const reserveB = tokenB === 'lovelace' ? liquidityAda / 2n : BigInt(Math.floor(Number(liquidityAda) / 2 / priceTwo));

        const liquidityPool: LiquidityPool = new LiquidityPool(
            SaturnSwap.identifier,
            tokenA,
            tokenB,
            reserveA,
            reserveB,
            this.dex.poolAddress,
            this.dex.orderAddress,
            this.dex.orderAddress,
        );

        // Set additional properties
        liquidityPool.poolFeePercent = poolData.lp_fee_percent || 0.3;
        liquidityPool.identifier = poolData.id;
        
        // SaturnSwap uses dynamic LP token policies, so we can't set a generic lpToken here
        // Each liquidity provider has their own policy

        return liquidityPool;
    }
} 