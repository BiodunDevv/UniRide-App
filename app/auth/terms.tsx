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
            Terms of Service
          </Text>
          <Text className="text-gray-300 text-[11px]">
            Last updated November 27, 2025
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
            Welcome to UniRide. These Terms of Service govern your access to and
            use of the UniRide platform, including our website, mobile
            applications, and services. By accessing or using the Platform, you
            agree to be bound by these Terms.
          </P>
        </View>

        <Section number={1} title="Acceptance of Terms">
          <P>
            By creating an account, submitting a driver application, or using
            any part of the UniRide Platform, you acknowledge that you have
            read, understood, and agree to be bound by these Terms and our
            Privacy Policy.
          </P>
          <P>
            If you do not agree to these Terms, you must not access or use the
            Platform. We reserve the right to refuse service to anyone for any
            reason at any time.
          </P>
        </Section>

        <Divider />

        <Section number={2} title="Platform Overview">
          <P>
            UniRide is a ridesharing platform designed specifically for
            university students and approved drivers. The Platform connects
            passengers seeking rides with drivers who have available seats.
          </P>
          <P>
            UniRide acts solely as a technology platform and marketplace. We are
            not a transportation carrier, and we do not provide transportation
            services. All rides are provided by independent drivers.
          </P>
        </Section>

        <Divider />

        <Section number={3} title="Driver Requirements & Eligibility">
          <P>
            To become a UniRide driver, you must meet the following
            requirements:
          </P>
          <Bullet>Must be at least 21 years old</Bullet>
          <Bullet>
            Hold a valid driver's license issued in Nigeria for at least 2 years
          </Bullet>
          <Bullet>
            No major traffic violations or DUI convictions in the past 3 years
          </Bullet>
          <Bullet>
            Pass a comprehensive background check including criminal history
          </Bullet>
          <Bullet>
            Must be a current student, staff, or faculty at a recognized
            university
          </Bullet>
          <Bullet>
            Maintain valid auto insurance meeting minimum requirements
          </Bullet>
        </Section>

        <Divider />

        <Section number={4} title="Driver Responsibilities">
          <P>As a UniRide driver, you agree to:</P>
          <Bullet>
            Maintain a professional and courteous demeanor at all times
          </Bullet>
          <Bullet>Arrive at pickup locations on time</Bullet>
          <Bullet>
            Drive safely and obey all traffic laws and regulations
          </Bullet>
          <Bullet>
            Maintain your vehicle in clean and safe operating condition
          </Bullet>
          <Bullet>Verify passenger identity before allowing them in</Bullet>
          <Bullet>
            Not discriminate against passengers based on any protected
            characteristic
          </Bullet>
          <Bullet>Report any incidents or safety concerns immediately</Bullet>
        </Section>

        <Divider />

        <Section number={5} title="Vehicle Requirements">
          <P>All vehicles used on UniRide must meet the following standards:</P>
          <Bullet>Model year 2010 or newer</Bullet>
          <Bullet>4-door sedan, SUV, or hatchback</Bullet>
          <Bullet>Working seat belts, AC, heating, and safety equipment</Bullet>
          <Bullet>Clean interior and exterior</Bullet>
          <Bullet>Valid registration and inspection certification</Bullet>
        </Section>

        <Divider />

        <Section number={6} title="Payment & Earnings">
          <P>
            Drivers earn fares based on distance, time, and demand. UniRide
            deducts a service fee from each completed ride. Tips from passengers
            are retained in full by the driver.
          </P>
          <P>
            Earnings are processed weekly. Drivers are independent contractors
            and are responsible for all applicable taxes.
          </P>
        </Section>

        <Divider />

        <Section number={7} title="Safety & Conduct">
          <P>Prohibited activities include:</P>
          <Bullet>Operating while impaired by drugs or alcohol</Bullet>
          <Bullet>Aggressive, reckless, or distracted driving</Bullet>
          <Bullet>Harassment, threats, or discrimination</Bullet>
          <Bullet>Accepting cash payments outside the Platform</Bullet>
          <Bullet>Recording passengers without consent</Bullet>
          <View className="bg-red-50 rounded-lg p-3 mt-2 mb-1">
            <Text className="text-red-800 text-[11px] font-semibold">
              Zero Tolerance: Violations may result in immediate account
              suspension or permanent deactivation.
            </Text>
          </View>
        </Section>

        <Divider />

        <Section number={8} title="Passenger Obligations">
          <Bullet>Provide accurate pickup and drop-off locations</Bullet>
          <Bullet>Be ready at the designated time and location</Bullet>
          <Bullet>Treat drivers with respect</Bullet>
          <Bullet>Wear seat belts at all times</Bullet>
          <Bullet>Pay all fares and fees through the Platform</Bullet>
          <Bullet>Report safety concerns immediately</Bullet>
        </Section>

        <Divider />

        <Section number={9} title="Privacy & Data Protection">
          <P>
            Your privacy is important to us. Our Privacy Policy explains how we
            collect, use, store, and protect your personal information. We
            collect your name, contact details, location data, payment
            information, and ride history to provide and improve our services.
          </P>
        </Section>

        <Divider />

        <Section number={10} title="Disclaimers & Liability">
          <P>
            The Platform is provided "as is" without warranties of any kind.
            UniRide does not guarantee uninterrupted or error-free service.
          </P>
          <P>
            To the maximum extent permitted by law, UniRide shall not be liable
            for any indirect, incidental, special, or consequential damages
            arising from your use of the Platform.
          </P>
        </Section>

        <Divider />

        <Section number={11} title="Dispute Resolution">
          <P>
            Disputes shall first be addressed through good faith negotiations.
            If unresolved within 30 days, disputes shall be resolved through
            binding arbitration under the Arbitration and Conciliation Act of
            Nigeria.
          </P>
        </Section>

        <Divider />

        <Section number={12} title="Contact Information">
          <View className="bg-gray-50 rounded-xl p-4 gap-2">
            <View className="flex-row items-center gap-2">
              <Ionicons name="mail-outline" size={14} color="#9CA3AF" />
              <Text className="text-gray-500 text-[13px]">
                legal@uniride.ng
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Ionicons name="headset-outline" size={14} color="#9CA3AF" />
              <Text className="text-gray-500 text-[13px]">
                support@uniride.ng
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Ionicons name="call-outline" size={14} color="#9CA3AF" />
              <Text className="text-gray-500 text-[13px]">
                +234 800 UNIRIDE
              </Text>
            </View>
          </View>
        </Section>

        {/* Footer */}
        <View className="mt-4 mb-8">
          <View className="bg-primary/5 rounded-xl p-4">
            <Text className="text-primary text-[12px] font-semibold mb-1">
              Acknowledgment
            </Text>
            <Text className="text-gray-400 text-[11px] leading-[17px]">
              By using UniRide, you acknowledge that you have read, understood,
              and agree to be bound by these Terms of Service.
            </Text>
          </View>
          <Text className="text-gray-300 text-[11px] text-center mt-4">
            © {new Date().getFullYear()} UniRide. All rights reserved.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
