import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { T } from "@/hooks/use-translation";
import { usePlatformSettingsStore } from "@/store/usePlatformSettingsStore";

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-7">
      <View className="flex-row items-center gap-3 mb-3">
        <View className="w-7 h-7 bg-primary rounded-lg items-center justify-center">
          <Text className="text-white text-[11px] font-bold">{number}</Text>
        </View>
        <Text className="text-primary text-[15px] font-bold flex-1">
          {title}
        </Text>
      </View>
      <View className="pl-10">{children}</View>
    </View>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-gray-500 text-[13px] leading-[20px] mb-2">
      {children}
    </Text>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-row mb-1.5">
      <Text className="text-gray-300 text-[13px] mr-2">•</Text>
      <Text className="text-gray-500 text-[13px] leading-[20px] flex-1">
        {children}
      </Text>
    </View>
  );
}

function Divider() {
  return <View className="h-px bg-gray-100 my-5" />;
}

export default function TermsScreen() {
  const router = useRouter();
  const supportEmail = usePlatformSettingsStore((state) => {
    const email = String(state.settings.support_email || "").trim();
    return email || "support@uniride.ng";
  });
  const supportPhone = usePlatformSettingsStore((state) => {
    const phone = String(state.settings.support_phone || "").trim();
    return phone || "+234 (0) 800-UNIRIDE";
  });

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-5 py-4 border-b border-gray-100">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-gray-50 items-center justify-center mr-3"
        >
          <Ionicons name="close" size={18} color="#042F40" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-primary text-[16px] font-bold">
            <T>Terms of Service</T>
          </Text>
          <Text className="text-gray-300 text-[11px]">
            <T>Effective date: April 18, 2026</T>
          </Text>
        </View>
        <View className="w-8 h-8 rounded-lg bg-primary/5 items-center justify-center">
          <Ionicons name="document-text-outline" size={16} color="#042F40" />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 py-6"
        showsVerticalScrollIndicator={false}
      >
        {/* Intro */}
        <View className="bg-primary/5 rounded-xl p-4 mb-6 border-l-[3px] border-primary">
          <P>
            <T>
              These Terms of Service govern your access to and use of the
              UniRide mobile app, website, and related services. By creating an
              account, applying as a driver, or using UniRide, you agree to
              these Terms and our Privacy Policy.
            </T>
          </P>
        </View>

        <Section number={1} title={<T>Eligibility & Account Security</T>}>
          <P>
            <T>
              You must provide accurate information and keep your account
              details up to date. You are responsible for activity on your
              account and for safeguarding your password, PIN, and device
              access.
            </T>
          </P>
          <Bullet>
            <T>Riders must be legally eligible to use ride services.</T>
          </Bullet>
          <Bullet>
            <T>
              Drivers must meet onboarding requirements, including valid
              identity, license, and vehicle documentation.
            </T>
          </Bullet>
          <P>
            <T>
              If your account details are false, outdated, or compromised,
              UniRide may restrict access to protect users and platform safety.
            </T>
          </P>
        </Section>

        <Divider />

        <Section number={2} title={<T>Platform Role</T>}>
          <P>
            <T>
              UniRide is a technology platform that connects riders and
              independent drivers. UniRide is not a transportation carrier and
              does not directly provide transportation services.
            </T>
          </P>
          <P>
            <T>
              Drivers are responsible for operating their vehicles in compliance
              with applicable laws, licenses, insurance, and safety standards.
            </T>
          </P>
        </Section>

        <Divider />

        <Section number={3} title={<T>Ride Bookings & Live Sessions</T>}>
          <P>
            <T>
              Ride sessions may move through available, accepted, in-progress,
              completed, or cancelled states. Timers and session states are
              based on secure server timestamps.
            </T>
          </P>
          <Bullet>
            <T>
              Riders and drivers must provide accurate pickup, destination, and
              trip details.
            </T>
          </Bullet>
          <Bullet>
            <T>
              Drivers should keep location updates active while online so riders
              can track trip progress and safety context.
            </T>
          </Bullet>
          <Bullet>
            <T>
              UniRide may adjust live session visibility or access in cases of
              safety risk, connectivity issues, or policy enforcement.
            </T>
          </Bullet>
        </Section>

        <Divider />

        <Section
          number={4}
          title={<T>Cancellations, No-Shows & Risk Controls</T>}
        >
          <P>
            <T>
              Both riders and drivers may cancel trips for valid reasons.
              Frequent cancellations, no-shows, or abuse of booking flow may
              result in warning, temporary restrictions, flagging, or
              suspension.
            </T>
          </P>
          <Bullet>
            <T>
              Platform risk scoring may consider cancellation patterns and other
              trust and safety signals.
            </T>
          </Bullet>
          <Bullet>
            <T>
              Accounts under review may have access restricted while checks are
              completed.
            </T>
          </Bullet>
          <Bullet>
            <T>
              UniRide may reverse or withhold platform privileges where fraud,
              manipulation, or repeated bad-faith behavior is detected.
            </T>
          </Bullet>
        </Section>

        <Divider />

        <Section number={5} title={<T>Fees, Payments & Refunds</T>}>
          <P>
            <T>
              Fares, fees, and payable amounts are shown in-app based on
              platform settings, route details, and service rules in effect at
              booking time.
            </T>
          </P>
          <Bullet>
            <T>
              Payments are expected to be completed through approved in-app
              channels unless UniRide explicitly provides another method.
            </T>
          </Bullet>
          <Bullet>
            <T>
              Refunds or adjustments may be issued where required by policy,
              platform error, or verified service issues.
            </T>
          </Bullet>
          <Bullet>
            <T>
              Drivers are independent providers and are responsible for their
              own tax and regulatory obligations.
            </T>
          </Bullet>
        </Section>

        <Divider />

        <Section number={6} title={<T>Driver & Vehicle Standards</T>}>
          <P>
            <T>
              Drivers must maintain professional conduct and ensure their
              vehicles are roadworthy, clean, and compliant with applicable
              regulations.
            </T>
          </P>
          <Bullet>
            <T>Maintain valid driver and vehicle documentation.</T>
          </Bullet>
          <Bullet>
            <T>Operate safely and comply with traffic and safety laws.</T>
          </Bullet>
          <Bullet>
            <T>
              Keep profile details, license images, and vehicle information
              accurate and up to date.
            </T>
          </Bullet>
          <Bullet>
            <T>Respond promptly to support and safety checks when requested.</T>
          </Bullet>
        </Section>

        <Divider />

        <Section number={7} title={<T>Safety & Acceptable Use</T>}>
          <P>
            <T>
              UniRide has zero tolerance for behavior that threatens rider,
              driver, or public safety.
            </T>
          </P>
          <Bullet>
            <T>Operating while impaired by drugs or alcohol</T>
          </Bullet>
          <Bullet>
            <T>Aggressive, reckless, or distracted driving</T>
          </Bullet>
          <Bullet>
            <T>Harassment, threats, or discrimination</T>
          </Bullet>
          <Bullet>
            <T>Fraud, impersonation, or account sharing</T>
          </Bullet>
          <Bullet>
            <T>Unauthorized recordings or privacy violations</T>
          </Bullet>
          <View className="bg-red-50 rounded-lg p-3 mt-2 mb-1">
            <Text className="text-red-800 text-[11px] font-semibold">
              <T>
                Serious or repeated violations may result in immediate
                suspension, permanent deactivation, and legal escalation.
              </T>
            </Text>
          </View>
        </Section>

        <Divider />

        <Section number={8} title={<T>Suspension & Termination</T>}>
          <P>
            <T>
              UniRide may suspend, flag, or terminate accounts to protect
              platform integrity, investigate abuse, enforce policy, or comply
              with legal obligations.
            </T>
          </P>
          <Bullet>
            <T>
              Access may be limited during review of safety, identity, payment,
              or conduct issues.
            </T>
          </Bullet>
          <Bullet>
            <T>
              You may request account closure at any time, subject to retention
              requirements described in our Privacy Policy.
            </T>
          </Bullet>
        </Section>

        <Divider />

        <Section number={9} title={<T>Intellectual Property</T>}>
          <P>
            <T>
              UniRide and its licensors own the app, trademarks, logos,
              software, and service content. You are granted a limited,
              revocable, non-transferable license to use the app for personal,
              lawful purposes.
            </T>
          </P>
          <Bullet>
            <T>
              You may not copy, modify, reverse engineer, distribute, or
              commercially exploit UniRide content without written permission.
            </T>
          </Bullet>
        </Section>

        <Divider />

        <Section number={10} title={<T>Disclaimers & Liability Limits</T>}>
          <P>
            <T>
              Services are provided on an "as available" basis. While UniRide
              works to provide reliable access and safety tools, we do not
              guarantee uninterrupted, error-free, or risk-free service.
            </T>
          </P>
          <P>
            <T>
              To the extent permitted by law, UniRide is not liable for
              indirect, incidental, special, or consequential losses arising
              from use of the platform.
            </T>
          </P>
        </Section>

        <Divider />

        <Section number={11} title={<T>Governing Law & Disputes</T>}>
          <P>
            <T>
              These Terms are governed by applicable laws of the Federal
              Republic of Nigeria. Disputes should first be raised with UniRide
              support in good faith.
            </T>
          </P>
          <P>
            <T>
              If unresolved, disputes may be referred to arbitration or
              competent courts in Nigeria, in line with applicable law.
            </T>
          </P>
        </Section>

        <Divider />

        <Section number={12} title={<T>Changes to These Terms</T>}>
          <P>
            <T>
              We may update these Terms from time to time. Material updates may
              be communicated in-app, by email, or on official UniRide channels.
              Continued use of UniRide after updates means you accept the
              revised Terms.
            </T>
          </P>
        </Section>

        <Divider />

        <Section number={13} title={<T>Contact Information</T>}>
          <View className="bg-gray-50 rounded-xl p-4 gap-2">
            <View className="flex-row items-center gap-2">
              <Ionicons name="mail-outline" size={14} color="#9CA3AF" />
              <Text className="text-gray-500 text-[13px]">
                legal@uniride.ng
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Ionicons name="headset-outline" size={14} color="#9CA3AF" />
              <Text className="text-gray-500 text-[13px]">{supportEmail}</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Ionicons name="call-outline" size={14} color="#9CA3AF" />
              <Text className="text-gray-500 text-[13px]">{supportPhone}</Text>
            </View>
          </View>
        </Section>

        {/* Footer */}
        <View className="mt-4 mb-8">
          <View className="bg-primary/5 rounded-xl p-4">
            <Text className="text-primary text-[12px] font-semibold mb-1">
              <T>Acknowledgment</T>
            </Text>
            <Text className="text-gray-400 text-[11px] leading-[17px]">
              <T>
                By using UniRide, you confirm that you have read and accepted
                these Terms of Service.
              </T>
            </Text>
          </View>
          <Text className="text-gray-300 text-[11px] text-center mt-4">
            © {new Date().getFullYear()} UniRide. <T>All rights reserved.</T>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
