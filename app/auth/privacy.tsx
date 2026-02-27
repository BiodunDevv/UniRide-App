import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { T } from "@/hooks/use-translation";

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
            <T>Last updated November 27, 2025</T>
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
              At UniRide, we take your privacy seriously. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your
              information when you use our platform. Please read this carefully.
            </T>
          </P>
        </View>

        <Section number={1} title={<T>Information We Collect</T>}>
          <Text className="text-primary text-[13px] font-semibold mb-2">
            <T>Personal Information</T>
          </Text>
          <Bullet>
            <T>Full name and date of birth</T>
          </Bullet>
          <Bullet>
            <T>Email address and phone number</T>
          </Bullet>
          <Bullet>
            <T>University affiliation and student ID</T>
          </Bullet>
          <Bullet>
            <T>Profile photo</T>
          </Bullet>
          <Bullet>
            <T>Payment and banking information</T>
          </Bullet>

          <Text className="text-primary text-[13px] font-semibold mt-3 mb-2">
            <T>Driver-Specific Information</T>
          </Text>
          <Bullet>
            <T>Driver's license details and photos</T>
          </Bullet>
          <Bullet>
            <T>Vehicle registration and insurance documents</T>
          </Bullet>
          <Bullet>
            <T>Background check authorization</T>
          </Bullet>

          <Text className="text-primary text-[13px] font-semibold mt-3 mb-2">
            <T>Automatically Collected</T>
          </Text>
          <Bullet>
            <T>Device information (model, OS, unique identifiers)</T>
          </Bullet>
          <Bullet>
            <T>Location data during active rides</T>
          </Bullet>
          <Bullet>
            <T>App usage patterns and ride history</T>
          </Bullet>
          <Bullet>
            <T>IP address and browser information</T>
          </Bullet>
        </Section>

        <Divider />

        <Section number={2} title={<T>How We Use Your Information</T>}>
          <P>
            <T>We use collected information to:</T>
          </P>
          <Bullet>
            <T>Provide and maintain our ridesharing services</T>
          </Bullet>
          <Bullet>
            <T>Match riders with available drivers</T>
          </Bullet>
          <Bullet>
            <T>Process payments and driver earnings</T>
          </Bullet>
          <Bullet>
            <T>Verify identity and driver eligibility</T>
          </Bullet>
          <Bullet>
            <T>Ensure safety through real-time ride tracking</T>
          </Bullet>
          <Bullet>
            <T>Send service notifications and updates</T>
          </Bullet>
          <Bullet>
            <T>Improve our platform and user experience</T>
          </Bullet>
          <Bullet>
            <T>Comply with legal obligations</T>
          </Bullet>
          <Bullet>
            <T>Prevent fraud and enforce our Terms</T>
          </Bullet>
        </Section>

        <Divider />

        <Section number={3} title={<T>Information Sharing</T>}>
          <P>
            <T>We may share your information with:</T>
          </P>
          <Bullet>
            <T>
              Ride partners — limited profile info is shared between riders and
              drivers during active rides
            </T>
          </Bullet>
          <Bullet>
            <T>
              Service providers — payment processors, background check
              providers, cloud hosting services
            </T>
          </Bullet>
          <Bullet>
            <T>
              Legal authorities — when required by law, court order, or to
              protect rights and safety
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

        <Section number={4} title={<T>Data Security</T>}>
          <P>
            <T>
              We implement industry-standard security measures to protect your
              data:
            </T>
          </P>
          <Bullet>
            <T>End-to-end encryption for sensitive data</T>
          </Bullet>
          <Bullet>
            <T>Secure token-based authentication (JWT)</T>
          </Bullet>
          <Bullet>
            <T>Regular security audits and monitoring</T>
          </Bullet>
          <Bullet>
            <T>Encrypted data storage and transmission</T>
          </Bullet>
          <Bullet>
            <T>Device management with maximum 3 active devices</T>
          </Bullet>
          <P>
            <T>
              While we strive to protect your information, no method of
              transmission over the internet is 100% secure. We cannot guarantee
              absolute security.
            </T>
          </P>
        </Section>

        <Divider />

        <Section number={5} title={<T>Location Data</T>}>
          <P>
            <T>
              We collect location data to provide core ride services. Location
              is collected:
            </T>
          </P>
          <Bullet>
            <T>When you request or offer a ride</T>
          </Bullet>
          <Bullet>
            <T>During an active ride for real-time tracking</T>
          </Bullet>
          <Bullet>
            <T>To calculate fares and optimize routes</T>
          </Bullet>
          <P>
            <T>
              You can disable location services in your device settings, but
              this will prevent the app from functioning properly.
            </T>
          </P>
        </Section>

        <Divider />

        <Section number={6} title={<T>Biometric Data</T>}>
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

        <Section number={7} title={<T>Data Retention</T>}>
          <P>
            <T>We retain your data for as long as:</T>
          </P>
          <Bullet>
            <T>Your account is active</T>
          </Bullet>
          <Bullet>
            <T>Necessary to provide services and process transactions</T>
          </Bullet>
          <Bullet>
            <T>Required by applicable laws and regulations</T>
          </Bullet>
          <P>
            <T>
              After account deletion, we may retain anonymized data for
              analytics. Certain data may be retained as required by law for up
              to 7 years.
            </T>
          </P>
        </Section>

        <Divider />

        <Section number={8} title={<T>Your Rights</T>}>
          <P>
            <T>You have the right to:</T>
          </P>
          <Bullet>
            <T>Access your personal data we hold</T>
          </Bullet>
          <Bullet>
            <T>Correct inaccurate information</T>
          </Bullet>
          <Bullet>
            <T>Request deletion of your account and data</T>
          </Bullet>
          <Bullet>
            <T>Opt out of non-essential communications</T>
          </Bullet>
          <Bullet>
            <T>Export your data in a portable format</T>
          </Bullet>
          <Bullet>
            <T>Withdraw consent for data processing (where applicable)</T>
          </Bullet>
          <P>
            <T>To exercise these rights, contact us at privacy@uniride.ng.</T>
          </P>
        </Section>

        <Divider />

        <Section number={9} title={<T>Children's Privacy</T>}>
          <P>
            <T>
              UniRide is not intended for users under 18 years of age. We do not
              knowingly collect information from minors. If we learn we have
              collected data from a child under 18, we will delete it promptly.
            </T>
          </P>
        </Section>

        <Divider />

        <Section number={10} title={<T>Policy Updates</T>}>
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

        <Section number={11} title={<T>Contact Us</T>}>
          <View className="bg-gray-50 rounded-xl p-4 gap-2">
            <View className="flex-row items-center gap-2">
              <Ionicons name="mail-outline" size={14} color="#9CA3AF" />
              <Text className="text-gray-500 text-[13px]">
                <T>privacy@uniride.ng</T>
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Ionicons name="headset-outline" size={14} color="#9CA3AF" />
              <Text className="text-gray-500 text-[13px]">
                <T>support@uniride.ng</T>
              </Text>
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
