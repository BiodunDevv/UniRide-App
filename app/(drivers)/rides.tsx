import ComingSoon from "@/components/ui/ComingSoon";
import { useTranslations } from "@/hooks/use-translation";

export default function DriverRidesScreen() {
  const [tTitle, tSubtitle] = useTranslations([
    "Your Rides",
    "View and manage your active and completed rides",
  ]);

  return <ComingSoon title={tTitle} subtitle={tSubtitle} icon="car-outline" />;
}
