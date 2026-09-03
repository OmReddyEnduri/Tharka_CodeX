import { Layout } from "@/components/layout/Layout";
import { Helmet } from "react-helmet-async";

export default function TermsAndConditions() {
  return (
    <Layout>
      <Helmet>
        <title>Terms & Conditions - Tharka High School</title>
        <meta name="description" content="Terms & Conditions for Tharka High School." />
      </Helmet>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-4">Terms & Conditions</h1>

        <div className="space-y-6">
          <p>
            By accessing or using{" "}
            <a href="https://www.tharkaschool.com/" className="text-blue-500 hover:underline">
              https://www.tharkaschool.com/
            </a>
            , you agree to comply with the following Terms & Conditions.
          </p>

          <div>
            <h2 className="text-2xl font-semibold mb-2">1. Services Offered</h2>
            <p>
              Tharka High School provides online educational services, including live classes and pre-recorded courses, delivered through website login and live Zoom sessions.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-2">2. User Accounts</h2>
            <p>
              Users are responsible for maintaining the confidentiality of their login credentials. Sharing or transferring account access is strictly prohibited.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-2">3. Payments & Subscriptions</h2>
            <ul className="list-disc list-inside ml-4 mt-2">
              <li>All payments are processed securely through third-party payment gateways.</li>
              <li>Subscription plans, pricing, and duration are clearly displayed at the time of purchase.</li>
              <li>Users are responsible for ensuring accurate payment details.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-2">4. Intellectual Property</h2>
            <p>
              All content, including videos, materials, graphics, and branding, is the intellectual property of Tharka High School. Unauthorized copying, sharing, resale, or distribution is strictly prohibited.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-2">5. No Guarantees</h2>
            <p>
              Tharka High School does not guarantee academic results, job placement, income, or specific outcomes from course participation.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-2">6. Access & Termination</h2>
            <p>
              We reserve the right to suspend or terminate user access in case of violation of these Terms or misuse of the platform.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-2">7. Limitation of Liability</h2>
            <p>
              We shall not be liable for any indirect, incidental, or consequential damages arising from the use of our services.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-2">8. Governing Law</h2>
            <p>
              These Terms & Conditions shall be governed by and interpreted in accordance with the laws of India.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
