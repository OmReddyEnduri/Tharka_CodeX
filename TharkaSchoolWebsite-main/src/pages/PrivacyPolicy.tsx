import { Layout } from "@/components/layout/Layout";
import { Helmet } from "react-helmet-async";

export default function PrivacyPolicy() {
  return (
    <Layout>
      <Helmet>
        <title>Privacy Policy - Tharka High School</title>
        <meta name="description" content="Privacy Policy for Tharka High School." />
      </Helmet>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-4">Effective Date: 26 January 2026</p>

        <div className="space-y-6">
          <p>
            Tharka High School (“we”, “our”, “us”) operates the website{" "}
            <a href="https://www.tharkaschool.com/" className="text-blue-500 hover:underline">
              https://www.tharkaschool.com/
            </a>
            . We are committed to protecting the privacy of our users and ensuring transparency in how personal information is collected and used.
          </p>

          <div>
            <h2 className="text-2xl font-semibold mb-2">1. Information We Collect</h2>
            <p>
              We may collect the following personal information when you register, subscribe, or use our services:
            </p>
            <ul className="list-disc list-inside ml-4 mt-2">
              <li>Name</li>
              <li>Email address</li>
            </ul>
            <p className="mt-2">
              Payment-related information is processed securely by third-party payment gateways and is not stored on our servers.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-2">2. Use of Information</h2>
            <p>The information collected is used to:</p>
            <ul className="list-disc list-inside ml-4 mt-2">
              <li>Provide access to courses and educational services</li>
              <li>Manage subscriptions and user accounts</li>
              <li>Communicate updates, announcements, and support responses</li>
              <li>Improve platform functionality and user experience</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-2">3. Cookies & Analytics</h2>
            <p>
              We use cookies and third-party tools such as Google Analytics to analyze user behavior and enhance our services. Users may disable cookies through their browser settings if they choose.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-2">4. Data Security</h2>
            <p>
              We take reasonable and appropriate measures to protect personal information. However, no electronic transmission or storage system is completely secure, and we cannot guarantee absolute security.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-2">5. Third-Party Services</h2>
            <p>
              We may use third-party services such as payment gateways, analytics providers, and video conferencing tools (e.g., Zoom) for live classes. These services operate under their own privacy policies, and we are not responsible for their practices.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-2">6. Contact Information</h2>
            <p>For any questions regarding this Privacy Policy, please contact:</p>
            <ul className="list-none mt-2">
              <li>📧 tharkaschool@gmail.com</li>
              <li>📞 9686054029</li>
              <li>📍 Vinukonda, Andhra Pradesh, India</li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
}
