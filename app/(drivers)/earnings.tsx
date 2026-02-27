import ComingSoon from "@/components/ui/ComingSoon";
import { useTranslation } from "@/hooks/use-translation";

export default function DriverEarningsScreen() {
  const title = useTranslation("Earnings");
  const subtitle = useTranslation(
    "Track your earnings, payouts and financial stats",
  );

  return <ComingSoon title={title} subtitle={subtitle} icon="wallet-outline" />;
}
