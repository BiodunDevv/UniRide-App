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
        <View className="w-7 h-7 bg-accent rounded-lg items-center justify-center">
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

export default function PrivacyScreen() {
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
            <T>Privacy Policy</T>
          </Text>
          <Text className="text-gray-300 text-[11px]">
            <T>Last updated April 18, 2026</T>
          </Text>
        </View>
        <View className="w-8 h-8 rounded-lg bg-accent/10 items-center justify-center">
          <Ionicons name="shield-checkmark-outline" size={16} color="#D4A017" />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 py-6"
        showsVerticalScrollIndicator={false}
      >
        {/* Intro */}
        <View className="bg-accent/5 rounded-xl p-4 mb-6 border-l-[3px] border-accent">
          <P>
            <T>
              This Privacy Policy explains how UniRide collects, uses, stores,
              and shares personal information when you use our mobile app,
              website, and related services. By using UniRide, you acknowledge
              this Policy.
            </T>
          </P>
        </View>

        <Section number={1} title={<T>Data We Collect</T>}>
          <Text className="text-primary text-[13px] font-semibold mb-2">
            <T>Account & Profile Data</T>
          </Text>
          <Bullet>
            <T>Name, email address, phone number, and profile photo</T>
          </Bullet>
          <Bullet>
            <T>University or campus-related profile details you provide</T>
          </Bullet>
          <Bullet>
            <T>Authentication and account security settings</T>
          </Bullet>

          <Text className="text-primary text-[13px] font-semibold mt-3 mb-2">
            <T>Ride & Transaction Data</T>
          </Text>
          <Bullet>
            <T>
              Pickup and destination details, ride history, and booking events
            </T>
          </Bullet>
          <Bullet>
            <T>Payment method metadata and fare records</T>
          </Bullet>
          <Bullet>
            <T>Support requests, in-app reports, and communication records</T>
          </Bullet>

          <Text className="text-primary text-[13px] font-semibold mt-3 mb-2">
            <T>Driver Verification Data</T>
          </Text>
          <Bullet>
            <T>
              Driver license details, vehicle documents, and verification media
            </T>
          </Bullet>
          <Bullet>
            <T>Insurance and compliance information</T>
          </Bullet>
          <Bullet>
            <T>Driver performance and safety-related account events</T>
          </Bullet>

          <Text className="text-primary text-[13px] font-semibold mt-3 mb-2">
            <T>Technical & Device Data</T>
          </Text>
          <Bullet>
            <T>Device type, operating system, app version, and identifiers</T>
          </Bullet>
          <Bullet>
            <T>IP address, log data, and basic diagnostics</T>
          </Bullet>
          <Bullet>
            <T>Location signals required for matching, trip flow, and safety</T>
          </Bullet>
        </Section>

        <Divider />

        <Section number={2} title={<T>How We Use Your Data</T>}>
          <P>
            <T>We process data to operate and improve UniRide, including to:</T>
          </P>
          <Bullet>
            <T>Provide ride matching, booking, trip tracking, and support</T>
          </Bullet>
          <Bullet>
            <T>Verify identity, eligibility, and account trust signals</T>
          </Bullet>
          <Bullet>
            <T>Process payments, earnings, refunds, and platform records</T>
          </Bullet>
          <Bullet>
            <T>Send service, security, and transactional notifications</T>
          </Bullet>
          <Bullet>
            <T>Detect fraud, enforce policy, and protect user safety</T>
          </Bullet>
          <Bullet>
            <T>Comply with legal and regulatory requirements</T>
          </Bullet>
        </Section>

        <Divider />

        <Section number={3} title={<T>Lawful Bases & Consent</T>}>
          <P>
            <T>
              Depending on where you are located, we rely on one or more of
              these legal bases: contract performance, legitimate interest,
              legal obligation, and consent where required.
            </T>
          </P>
          <Bullet>
            <T>
              You may withdraw optional permissions at any time in your device
              or account settings.
            </T>
          </Bullet>
          <Bullet>
            <T>
              Some features may not work correctly if required permissions are
              disabled.
            </T>
          </Bullet>
        </Section>

        <Divider />

        <Section number={4} title={<T>How We Share Data</T>}>
          <P>
            <T>We may share relevant data with:</T>
          </P>
          <Bullet>
            <T>
              Ride participants, so trips can be completed safely and reliably
            </T>
          </Bullet>
          <Bullet>
            <T>
              Service providers such as hosting, payments, analytics,
              communications, and verification vendors
            </T>
          </Bullet>
          <Bullet>
            <T>
              Authorities or regulators when required by law, legal process, or
              safety obligations
            </T>
          </Bullet>
          <Bullet>
            <T>
              Corporate advisers in connection with audits, financing, mergers,
              or asset transfers, where permitted by law
            </T>
          </Bullet>
          <View className="bg-green-50 rounded-lg p-3 mt-2 mb-1">
            <Text className="text-green-800 text-[11px] font-semibold">
              <T>
                We never sell your personal data to third parties for marketing
                purposes.
              </T>
            </Text>
          </View>
        </Section>

        <Divider />

        <Section
          number={5}
          title={<T>Location, Permissions & Notifications</T>}
        >
          <P>
            <T>
              UniRide uses location and device permissions to power matching,
              live trip state, support workflows, and safety tooling.
            </T>
          </P>
          <Bullet>
            <T>
              Location may be processed before and during active trips depending
              on your role and app state.
            </T>
          </Bullet>
          <Bullet>
            <T>
              Push notifications are used for trip updates, alerts, and account
              communications.
            </T>
          </Bullet>
          <Bullet>
            <T>
              If required permissions are denied, certain ride or safety
              features may be unavailable.
            </T>
          </Bullet>
        </Section>

        <Divider />

        <Section number={6} title={<T>Security Safeguards</T>}>
          <P>
            <T>
              We apply technical and organizational safeguards designed to
              protect personal information, including access controls,
              authenticated sessions, monitoring, and encrypted transport where
              appropriate.
            </T>
          </P>
          <P>
            <T>
              No internet or mobile system can be guaranteed fully secure, but
              we continuously improve controls and incident response procedures.
            </T>
          </P>
        </Section>

        <Divider />

        <Section number={7} title={<T>Biometric Data</T>}>
          <P>
            <T>
              If you enable biometric login (fingerprint or Face ID), biometric
              data is processed entirely on your device. UniRide does not store
              or transmit biometric data — we only store a secure flag
              indicating biometric login is enabled for your account.
            </T>
          </P>
        </Section>

        <Divider />

        <Section number={8} title={<T>Data Retention</T>}>
          <P>
            <T>We retain personal data for as long as needed to:</T>
          </P>
          <Bullet>
            <T>Maintain your account and provide core services</T>
          </Bullet>
          <Bullet>
            <T>Complete payments, support requests, and dispute handling</T>
          </Bullet>
          <Bullet>
            <T>Meet legal, tax, audit, and compliance requirements</T>
          </Bullet>
          <P>
            <T>
              After account closure, some data may be deleted, anonymized, or
              retained where required by law or to prevent fraud and abuse.
            </T>
          </P>
        </Section>

        <Divider />

        <Section number={9} title={<T>Your Rights & Choices</T>}>
          <P>
            <T>Subject to applicable law, you may request to:</T>
          </P>
          <Bullet>
            <T>Access, review, or correct your personal data</T>
          </Bullet>
          <Bullet>
            <T>Request deletion or restriction of certain processing</T>
          </Bullet>
          <Bullet>
            <T>Request a copy or export of eligible account data</T>
          </Bullet>
          <Bullet>
            <T>Manage marketing and non-essential communication preferences</T>
          </Bullet>
          <Bullet>
            <T>Withdraw consent where processing depends on consent</T>
          </Bullet>
          <P>
            <T>
              To exercise these rights, contact us at privacy@uniride.ng.
              Identity verification may be required for security.
            </T>
          </P>
        </Section>

        <Divider />

        <Section number={10} title={<T>Children's Privacy</T>}>
          <P>
            <T>
              UniRide is not intended for users under 18 years of age. We do not
              knowingly collect information from minors. If we learn we have
              collected data from a child under 18, we will delete it promptly.
            </T>
          </P>
        </Section>

        <Divider />

        <Section number={11} title={<T>Policy Updates</T>}>
          <P>
            <T>
              We may update this Privacy Policy from time to time. We will
              notify you of material changes via email or in-app notification.
              Continued use of UniRide after changes constitutes acceptance of
              the updated policy.
            </T>
          </P>
        </Section>

        <Divider />

        <Section number={12} title={<T>Contact Us</T>}>
          <View className="bg-gray-50 rounded-xl p-4 gap-2">
            <View className="flex-row items-center gap-2">
              <Ionicons name="mail-outline" size={14} color="#9CA3AF" />
              <Text className="text-gray-500 text-[13px]">
                <T>privacy@uniride.ng</T>
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
            <View className="flex-row items-center gap-2">
              <Ionicons name="location-outline" size={14} color="#9CA3AF" />
              <Text className="text-gray-500 text-[13px]">
                <T>UniRide Nigeria, Lagos, Nigeria</T>
              </Text>
            </View>
          </View>
        </Section>

        {/* Footer */}
        <View className="mt-4 mb-8">
          <Text className="text-gray-300 text-[11px] text-center">
            © {new Date().getFullYear()} UniRide. <T>All rights reserved.</T>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
