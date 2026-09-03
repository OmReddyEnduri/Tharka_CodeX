import { Layout } from "@/components/layout/Layout";
import { Helmet } from "react-helmet-async";

export default function RefundPolicy() {
  return (
    <Layout>
      <Helmet>
        <title>Refund & Cancellation Policy - Tharka High School</title>
        <meta name="description" content="Refund & Cancellation Policy for Tharka High School." />
      </Helmet>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-4">Refund & Cancellation Policy</h1>

        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-2">1. Nature of Services</h2>
            <p>
              The services provided by Tharka High School are digital educational services. Access to course content or live sessions is considered successful delivery of the service.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-2">2. Refund Eligibility</h2>
            <p>Refunds are applicable only under the following conditions:</p>
            <ul className="list-disc list-inside ml-4 mt-2">
              <li>✅ Refund requests made before accessing course content</li>
              <li>✅ For live courses, refund requests made before the first scheduled live class</li>
              <li>❌ No refunds will be provided once any course content has been accessed or consumed</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-2">3. Refund Processing</h2>
            <ul className="list-disc list-inside ml-4 mt-2">
                <li>Approved refunds will be processed to the original payment method used at the time of purchase.</li>
                <li>Refunds will be processed through our payment gateway partner.</li>
                <li>Processing timelines may vary depending on the bank or payment provider.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-2">4. Non-Refundable Amounts</h2>
            <p>The following are non-refundable:</p>
            <ul className="list-disc list-inside ml-4 mt-2">
              <li>Payment gateway or platform processing fees</li>
              <li>Applicable taxes (GST or other statutory taxes)</li>
              <li>Any administrative or registration fees, if applicable</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-2">5. Subscription Cancellation</h2>
            <p>
              Users may cancel their subscription at any time. However, no refunds will be issued for the current billing cycle once access to services has been granted.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-2">6. Refund Requests & Contact</h2>
            <p>For refund-related queries, please contact:</p>
            <ul className="list-none mt-2">
              <li>📧 tharkaschool@gmail.com</li>
              <li>📞 9686054029</li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
}
