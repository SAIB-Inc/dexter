import { DefinitionField, DefinitionConstr } from '../../../types';
import { DatumParameterKey } from '@app/constants';

/**
 * SaturnSwap Order Datum structure based on SwapDatum from the smart contract.
 * This represents a limit order on SaturnSwap's order book DEX.
 * 
 * SwapDatum {
 *   owner: Address,                    // Order owner
 *   policy_id_sell: PolicyId,          // Token being sold
 *   asset_name_sell: AssetName,        
 *   amount_sell: Int,                  // Amount offered
 *   policy_id_buy: PolicyId,           // Token wanted
 *   asset_name_buy: AssetName,         
 *   amount_buy: Int,                   // Amount wanted
 *   valid_before_time: Option<Int>,    // Order expiry
 *   output_reference: OutputReference  // UTXO reference
 * }
 */
export const orderDefinition: DefinitionConstr = {
    constructor: 0,
    fields: [
        {
            // Owner address (who placed the order)
            constructor: 0,
            fields: [
                {
                    constructor: 0,
                    fields: [
                        {
                            bytes: DatumParameterKey.SenderPubKeyHash
                        }
                    ]
                },
                {
                    constructor: 0,
                    fields: [
                        {
                            constructor: 0,
                            fields: [
                                {
                                    bytes: DatumParameterKey.SenderStakingKeyHash
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            // Token being sold - Policy ID
            bytes: DatumParameterKey.TokenPolicyId
        },
        {
            // Token being sold - Asset Name
            bytes: DatumParameterKey.TokenAssetName
        },
        {
            // Amount being sold
            int: DatumParameterKey.SwapInAmount
        },
        {
            // Token to buy - Policy ID
            bytes: DatumParameterKey.SwapOutTokenPolicyId
        },
        {
            // Token to buy - Asset Name
            bytes: DatumParameterKey.SwapOutTokenAssetName
        },
        {
            // Amount to buy
            int: DatumParameterKey.MinReceive
        },
        {
            // Valid before time (optional - None or Some(timestamp))
            constructor: 0,
            fields: [] // Will be either empty (None) or contain timestamp
        },
        {
            // Output reference (txHash + index)
            constructor: 0,
            fields: [
                {
                    // Transaction hash
                    bytes: DatumParameterKey.PoolIdentifier
                },
                {
                    // Output index
                    int: DatumParameterKey.BatcherFee // Using as a placeholder for index
                }
            ]
        }
    ]
};

export default orderDefinition; 