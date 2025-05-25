import { DatumParameterKey } from '@app/constants';

/**
 * SaturnSwap pool datum definition
 * This defines the structure of the pool datum on-chain
 * TODO: Update this structure based on actual SaturnSwap pool datum
 */
export default {
    constructor: 0,
    fields: [
        {
            // Pool NFT identifier
            bytes: DatumParameterKey.PoolIdentifier
        },
        {
            // Asset A
            constructor: 0,
            fields: [
                {
                    bytes: DatumParameterKey.PoolAssetAPolicyId
                },
                {
                    bytes: DatumParameterKey.PoolAssetAAssetName
                }
            ]
        },
        {
            // Asset B
            constructor: 0,
            fields: [
                {
                    bytes: DatumParameterKey.PoolAssetBPolicyId
                },
                {
                    bytes: DatumParameterKey.PoolAssetBAssetName
                }
            ]
        },
        {
            // Reserve A
            int: DatumParameterKey.ReserveA
        },
        {
            // Reserve B
            int: DatumParameterKey.ReserveB
        },
        {
            // Total LP tokens
            int: DatumParameterKey.TotalLpTokens
        },
        {
            // Pool fee numerator
            int: DatumParameterKey.LpFeeNumerator
        },
        {
            // Pool fee denominator
            int: DatumParameterKey.LpFeeDenominator
        }
    ]
}; 