import { DefinitionField, DefinitionConstr } from '../../../types';
import { DatumParameterKey } from '@app/constants';

/**
 * SaturnSwap Liquidity Datum structure based on the smart contract.
 * SaturnSwap is a limit-order DEX, not a traditional AMM.
 * 
 * This represents the ControlDatum variant which manages liquidity parameters:
 * ControlDatum {
 *   policy_id_one: PolicyId,
 *   asset_name_one: AssetName,
 *   min_one_price: Int,
 *   max_one_price: Int,
 *   precision_one: Int,
 *   policy_id_two: PolicyId,
 *   asset_name_two: AssetName,
 *   min_two_price: Int,
 *   max_two_price: Int,
 *   precision_two: Int,
 *   is_active: Bool,
 * }
 * 
 * Note: SaturnSwap also has AddLiquidityDatum and SignatureDatum variants
 */
export const poolDefinition: DefinitionConstr = {
    constructor: 2, // ControlDatum is typically the third variant (index 2)
    fields: [
        {
            // First token policy ID
            bytes: DatumParameterKey.PoolAssetAPolicyId
        },
        {
            // First token asset name
            bytes: DatumParameterKey.PoolAssetAAssetName
        },
        {
            // Minimum price for token one
            int: DatumParameterKey.LpFee
        },
        {
            // Maximum price for token one
            int: DatumParameterKey.LpFeeNumerator
        },
        {
            // Precision for token one
            int: DatumParameterKey.ReserveA
        },
        {
            // Second token policy ID
            bytes: DatumParameterKey.PoolAssetBPolicyId
        },
        {
            // Second token asset name
            bytes: DatumParameterKey.PoolAssetBAssetName
        },
        {
            // Minimum price for token two
            int: DatumParameterKey.TotalLpTokens
        },
        {
            // Maximum price for token two
            int: DatumParameterKey.LpFeeDenominator
        },
        {
            // Precision for token two
            int: DatumParameterKey.ReserveB
        },
        {
            // Is pool active (0 = false, 1 = true)
            int: DatumParameterKey.LpFee
        }
    ]
};

export default poolDefinition; 