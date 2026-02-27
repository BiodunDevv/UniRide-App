import ComingSoon from "@/components/ui/ComingSoon";
import { useTranslations } from "@/hooks/use-translation";

export default function DriverEarningsScreen() {
  const [tTitle, tSubtitle] = useTranslations([
    "Earnings",
    "Track your earnings, payouts and financial stats",
  ]);

  return (
    <ComingSoon title={tTitle} subtitle={tSubtitle} icon="wallet-outline" />
  );
}
