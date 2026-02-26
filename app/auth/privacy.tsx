import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
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
            Privacy Policy
          </Text>
          <Text className="text-gray-300 text-[11px]">
            Last updated November 27, 2025
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
            At UniRide, we take your privacy seriously. This Privacy Policy
            explains how we collect, use, disclose, and safeguard your
            information when you use our platform. Please read this carefully.
          </P>
        </View>

        <Section number={1} title="Information We Collect">
          <Text className="text-primary text-[13px] font-semibold mb-2">
            Personal Information
          </Text>
          <Bullet>Full name and date of birth</Bullet>
          <Bullet>Email address and phone number</Bullet>
          <Bullet>University affiliation and student ID</Bullet>
          <Bullet>Profile photo</Bullet>
          <Bullet>Payment and banking information</Bullet>

          <Text className="text-primary text-[13px] font-semibold mt-3 mb-2">
            Driver-Specific Information
          </Text>
          <Bullet>Driver's license details and photos</Bullet>
          <Bullet>Vehicle registration and insurance documents</Bullet>
          <Bullet>Background check authorization</Bullet>

          <Text className="text-primary text-[13px] font-semibold mt-3 mb-2">
            Automatically Collected
          </Text>
          <Bullet>Device information (model, OS, unique identifiers)</Bullet>
          <Bullet>Location data during active rides</Bullet>
          <Bullet>App usage patterns and ride history</Bullet>
          <Bullet>IP address and browser information</Bullet>
        </Section>

        <Divider />

        <Section number={2} title="How We Use Your Information">
          <P>We use collected information to:</P>
          <Bullet>Provide and maintain our ridesharing services</Bullet>
          <Bullet>Match riders with available drivers</Bullet>
          <Bullet>Process payments and driver earnings</Bullet>
          <Bullet>Verify identity and driver eligibility</Bullet>
          <Bullet>Ensure safety through real-time ride tracking</Bullet>
          <Bullet>Send service notifications and updates</Bullet>
          <Bullet>Improve our platform and user experience</Bullet>
          <Bullet>Comply with legal obligations</Bullet>
          <Bullet>Prevent fraud and enforce our Terms</Bullet>
        </Section>

        <Divider />

        <Section number={3} title="Information Sharing">
          <P>We may share your information with:</P>
          <Bullet>
            Ride partners — limited profile info is shared between riders and
            drivers during active rides
          </Bullet>
          <Bullet>
            Service providers — payment processors, background check providers,
            cloud hosting services
          </Bullet>
          <Bullet>
            Legal authorities — when required by law, court order, or to protect
            rights and safety
          </Bullet>
          <View className="bg-green-50 rounded-lg p-3 mt-2 mb-1">
            <Text className="text-green-800 text-[11px] font-semibold">
              We never sell your personal data to third parties for marketing
              purposes.
            </Text>
          </View>
        </Section>

        <Divider />

        <Section number={4} title="Data Security">
          <P>
            We implement industry-standard security measures to protect your
            data:
          </P>
          <Bullet>End-to-end encryption for sensitive data</Bullet>
          <Bullet>Secure token-based authentication (JWT)</Bullet>
          <Bullet>Regular security audits and monitoring</Bullet>
          <Bullet>Encrypted data storage and transmission</Bullet>
          <Bullet>Device management with maximum 3 active devices</Bullet>
          <P>
            While we strive to protect your information, no method of
            transmission over the internet is 100% secure. We cannot guarantee
            absolute security.
          </P>
        </Section>

        <Divider />

        <Section number={5} title="Location Data">
          <P>
            We collect location data to provide core ride services. Location is
            collected:
          </P>
          <Bullet>When you request or offer a ride</Bullet>
          <Bullet>During an active ride for real-time tracking</Bullet>
          <Bullet>To calculate fares and optimize routes</Bullet>
          <P>
            You can disable location services in your device settings, but this
            will prevent the app from functioning properly.
          </P>
        </Section>

        <Divider />

        <Section number={6} title="Biometric Data">
          <P>
            If you enable biometric login (fingerprint or Face ID), biometric
            data is processed entirely on your device. UniRide does not store or
            transmit biometric data — we only store a secure flag indicating
            biometric login is enabled for your account.
          </P>
        </Section>

        <Divider />

        <Section number={7} title="Data Retention">
          <P>We retain your data for as long as:</P>
          <Bullet>Your account is active</Bullet>
          <Bullet>
            Necessary to provide services and process transactions
          </Bullet>
          <Bullet>Required by applicable laws and regulations</Bullet>
          <P>
            After account deletion, we may retain anonymized data for analytics.
            Certain data may be retained as required by law for up to 7 years.
          </P>
        </Section>

        <Divider />

        <Section number={8} title="Your Rights">
          <P>You have the right to:</P>
          <Bullet>Access your personal data we hold</Bullet>
          <Bullet>Correct inaccurate information</Bullet>
          <Bullet>Request deletion of your account and data</Bullet>
          <Bullet>Opt out of non-essential communications</Bullet>
          <Bullet>Export your data in a portable format</Bullet>
          <Bullet>
            Withdraw consent for data processing (where applicable)
          </Bullet>
          <P>To exercise these rights, contact us at privacy@uniride.ng.</P>
        </Section>

        <Divider />

        <Section number={9} title="Children's Privacy">
          <P>
            UniRide is not intended for users under 18 years of age. We do not
            knowingly collect information from minors. If we learn we have
            collected data from a child under 18, we will delete it promptly.
          </P>
        </Section>

        <Divider />

        <Section number={10} title="Policy Updates">
          <P>
            We may update this Privacy Policy from time to time. We will notify
            you of material changes via email or in-app notification. Continued
            use of UniRide after changes constitutes acceptance of the updated
            policy.
          </P>
        </Section>

        <Divider />

        <Section number={11} title="Contact Us">
          <View className="bg-gray-50 rounded-xl p-4 gap-2">
            <View className="flex-row items-center gap-2">
              <Ionicons name="mail-outline" size={14} color="#9CA3AF" />
              <Text className="text-gray-500 text-[13px]">
                privacy@uniride.ng
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Ionicons name="headset-outline" size={14} color="#9CA3AF" />
              <Text className="text-gray-500 text-[13px]">
                support@uniride.ng
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Ionicons name="location-outline" size={14} color="#9CA3AF" />
              <Text className="text-gray-500 text-[13px]">
                UniRide Nigeria, Lagos, Nigeria
              </Text>
            </View>
          </View>
        </Section>

        {/* Footer */}
        <View className="mt-4 mb-8">
          <Text className="text-gray-300 text-[11px] text-center">
            © {new Date().getFullYear()} UniRide. All rights reserved.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
