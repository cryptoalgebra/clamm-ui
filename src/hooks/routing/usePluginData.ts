import { useEffect, useState } from "react";
import { Address, encodeAbiParameters } from "viem";
import { useAccount } from "wagmi";

export function usePluginData() {

    const [accountPluginData, setAccountPluginData] = useState<{ pluginData: Address; fee: number | undefined }>({
        pluginData: '0x',
        fee: undefined
    })
    
    const { address: account } = useAccount()

    useEffect(() => {

        async function fetchPluginData() {
            
            if (!account) return

            const res = await fetch("https://fee.clamm.io/api/sign", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    address: account
                })
            })

            if (res.ok) {

                const body = await res.json()

                console.log('body', body)

                if ("error" in body) {
                    console.error("Error during signing managed fee plugin")
                } else {
                    console.log([body.data.nonce, body.data.fee, account, body.data.expirationTime, body.signature])
                    const encodedData = encodeAbiParameters(
                        [{
                            type: "tuple",
                            components: [
                                { type: "bytes32" },
                                { type: "uint24" },
                                { type: "address" },
                                { type: "uint32" },
                                { type: "bytes" }
                            ]
                        }],
                        [[body.data.nonce, body.data.fee, account, body.data.expirationTime, body.signature]]
                    )

                    setAccountPluginData({
                        pluginData: encodedData,
                        fee: body.data.fee
                    })
                }

            }

        }

        if (!account) return

        fetchPluginData()

    }, [account])

    console.log('accountPluginData', accountPluginData)

    return accountPluginData

}