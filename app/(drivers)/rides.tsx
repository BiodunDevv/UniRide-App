import ComingSoon from "@/components/ui/ComingSoon";
import { useTranslation } from "@/hooks/use-translation";

export default function DriverRidesScreen() {
  const title = useTranslation("Your Rides");
  const subtitle = useTranslation(
    "View and manage your active and completed rides",
  );

  return <ComingSoon title={title} subtitle={subtitle} icon="car-outline" />;
}
