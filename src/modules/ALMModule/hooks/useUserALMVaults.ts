import { Address, formatUnits } from "viem";
import { ExtendedVault, useALMVaultsByPool } from "./useALMVaults";
import useSWR from "swr";
import { calculateUserDepositTokenPNL, getUserFeesCollected, getUserAmounts, getUserAmountsStaked } from "@cryptoalgebra/alm-sdk";
import { useEthersProvider } from "@/hooks/common/useEthersProvider";
import { useUSDCPrice } from "@/hooks/common/useUSDCValue";

export interface UserALMVault {
    amount0: string;
    amount1: string;
    fees0: string;
    fees1: string;
    feesUsd: number;
    amountsUsd: number;
    shares: string;
    pnl: string;
    roi: number;
    onFarming: boolean;
    vault: ExtendedVault;
}

export function useUserALMVaultsByPool(poolAddress: Address | undefined, account: Address | undefined) {
    const provider = useEthersProvider();
    const { vaults, isLoading: isVaultsLoading } = useALMVaultsByPool(poolAddress);

    const { formatted: currencyAPriceUSD } = useUSDCPrice(vaults?.[0]?.token0);
    const { formatted: currencyBPriceUSD } = useUSDCPrice(vaults?.[0]?.token1);

    const { data: userVaults, isLoading: isUserVaultsLoading, mutate: mutateUserVaults } = useSWR(
        ["userVaults", account, vaults, poolAddress, currencyAPriceUSD, currencyBPriceUSD, provider],
        fetchUserVaults(account, vaults, provider, getUserAmounts, false, currencyAPriceUSD, currencyBPriceUSD),
        { revalidateOnMount: true, revalidateOnFocus: true, refreshInterval: 15_000 }
    );

    const { data: stakedVaults, isLoading: isStakedVaultsLoading, mutate: mutateStakedVaults } = useSWR(
        ["stakedUserVaults", account, vaults, poolAddress, currencyAPriceUSD, currencyBPriceUSD, provider],
        fetchUserVaults(account, vaults, provider, getUserAmountsStaked, true, currencyAPriceUSD, currencyBPriceUSD),
        { revalidateOnMount: true, revalidateOnFocus: true, refreshInterval: 15_000 }
    );

    return {
        userVaults: userVaults?.concat(stakedVaults || []),
        isLoading: isUserVaultsLoading || isVaultsLoading || isStakedVaultsLoading,
        refetch: () => {
            mutateUserVaults();
            mutateStakedVaults();
        },
    };
}

function fetchUserVaults(
    account: Address | undefined,
    vaults: ExtendedVault[] | undefined,
    provider: ReturnType<typeof useEthersProvider>,
    getAmountsFn: typeof getUserAmounts,
    onFarming: boolean,
    currencyAPriceUSD: number,
    currencyBPriceUSD: number
) {
    return async (): Promise<UserALMVault[]> => {
        if (!provider || !account || !vaults) throw new Error("not ready");

        const results: UserALMVault[] = [];

        for (const vault of vaults) {
            const [amount0, amount1, shares] = await getAmountsFn(
                account,
                vault.id,
                provider,
                vault.token0.decimals,
                vault.token1.decimals,
                true
            );

            if (shares.toString() === "0") continue;

            const formattedAmounts = [
                formatUnits(amount0.toBigInt(), vault.token0.decimals),
                formatUnits(amount1.toBigInt(), vault.token1.decimals),
            ];
            const formattedShares = formatUnits(shares.toBigInt(), 18);

            const { totalUserFees0, totalUserFees1 } = await getUserFeesCollected(account, vault.id, provider);
            const formattedFees = [
                formatUnits(totalUserFees0.toBigInt(), vault.token0.decimals),
                formatUnits(totalUserFees1.toBigInt(), vault.token1.decimals),
            ];

            const { pnl, roi } = await calculateUserDepositTokenPNL(
                account,
                vault.id,
                amount0.toString(),
                amount1.toString(),
                vault.token0.decimals,
                vault.token1.decimals,
                provider
            );

            results.push({
                amount0: formattedAmounts[0],
                amount1: formattedAmounts[1],
                fees0: formattedFees[0],
                fees1: formattedFees[1],
                feesUsd: Number(formattedFees[0]) * currencyAPriceUSD + Number(formattedFees[1]) * currencyBPriceUSD,
                shares: formattedShares,
                amountsUsd: Number(formattedAmounts[0]) * currencyAPriceUSD + Number(formattedAmounts[1]) * currencyBPriceUSD,
                vault,
                pnl,
                roi,
                onFarming,
            });
        }

        return results;
    };
}
