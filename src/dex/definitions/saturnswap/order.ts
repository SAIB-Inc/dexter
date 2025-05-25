import { DatumParameterKey } from '@app/constants';

/**
 * SaturnSwap order datum definition
 * This defines the structure of swap order datums on-chain
 * TODO: Update this structure based on actual SaturnSwap order datum
 */
export default {
    constructor: 0,
    fields: [
        {
            // Sender address
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
                }
            ]
        },
        {
            // Swap direction and minimum receive
            constructor: 0,
            fields: [
                {
                    constructor: DatumParameterKey.Action,
                    fields: []
                },
                {
                    int: DatumParameterKey.MinReceive
                }
            ]
        },
        {
            // Swap in token
            constructor: 0,
            fields: [
                {
                    bytes: DatumParameterKey.SwapInTokenPolicyId
                },
                {
                    bytes: DatumParameterKey.SwapInTokenAssetName
                }
            ]
        },
        {
            // Swap in amount
            int: DatumParameterKey.SwapInAmount
        },
        {
            // Swap out token
            constructor: 0,
            fields: [
                {
                    bytes: DatumParameterKey.SwapOutTokenPolicyId
                },
                {
                    bytes: DatumParameterKey.SwapOutTokenAssetName
                }
            ]
        },
        {
            // Deposit fee (no batcher fee for Saturn)
            int: DatumParameterKey.DepositFee
        }
    ]
}; 