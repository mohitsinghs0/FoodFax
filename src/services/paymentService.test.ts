import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLATFORM_UPI_ID,
  PLATFORM_MERCHANT_NAME,
  buildCanonicalUpiUri,
  buildTezGpayUri,
  buildPhonePeUri,
  buildPaytmUri,
  validateUpiUtr,
  normalizePaymentStatus,
  sanitizeCheckoutUpiData,
} from '../utils/orderValidation';

describe('Payment Service & UPI Protocol Suite', () => {
  describe('1. Platform Merchant Invariants', () => {
    it('enforces the exact BharatPe platform merchant UPI ID and Payee Name', () => {
      assert.equal(PLATFORM_UPI_ID, 'bharatpe2e0p0d8x5a59798@unitype');
      assert.equal(PLATFORM_MERCHANT_NAME, 'Mohit Santosh Singh');
    });

    it('generates canonical UPI URI with strict RFC3986 percent-encoding (%20, never +)', () => {
      const uri = buildCanonicalUpiUri({
        pa: PLATFORM_UPI_ID,
        pn: PLATFORM_MERCHANT_NAME,
        am: 1,
        tr: 'ord-1792776849858-260',
        tn: 'FoodFax Order ord-1792776849858-260',
      });

      // Must start with upi://pay?
      assert.ok(uri.startsWith('upi://pay?'), 'Must start with upi://pay?');
      // Must contain correct parameters
      assert.ok(uri.includes(`pa=${encodeURIComponent(PLATFORM_UPI_ID)}`), 'Must contain pa');
      assert.ok(uri.includes('pn=Mohit%20Santosh%20Singh'), 'Payee name must be percent-encoded with %20');
      // Must NOT contain plus signs (which cause Google Pay "Could not load banking name")
      assert.ok(!uri.includes('Order+ord'), 'Must never contain "+" instead of spaces');
      assert.ok(!uri.includes('Mohit+Santosh'), 'Must never use "+" in payee name');
      // Amount must be formatted to 2 decimals
      assert.ok(uri.includes('am=1.00'), 'Amount must be strict 2 decimal digits');
      assert.ok(uri.includes('cu=INR'), 'Currency must be INR');
    });

    it('generates proper app-specific deep links without corrupting query params', () => {
      const params = {
        pa: PLATFORM_UPI_ID,
        pn: PLATFORM_MERCHANT_NAME,
        am: 25.5,
        tr: 'ord-test-123',
        tn: 'FoodFax Order ord-test-123',
      };

      const gpayUri = buildTezGpayUri(params);
      assert.ok(gpayUri.startsWith('tez://upi/pay?'), 'GPay must use tez:// scheme');
      assert.ok(gpayUri.includes('am=25.50'), 'GPay amount must have 2 decimals');

      const phonePeUri = buildPhonePeUri(params);
      assert.ok(phonePeUri.startsWith('phonepe://pay?'), 'PhonePe must use phonepe:// scheme');

      const paytmUri = buildPaytmUri(params);
      assert.ok(paytmUri.startsWith('paytmmp://pay?'), 'Paytm must use paytmmp:// scheme');
    });
  });

  describe('2. Prevention of Third-Party Merchant Overwrite ("FoodAds" Prevention)', () => {
    it('sanitizes gateway response to retain platform merchant QR and block unregistered aliases', () => {
      const originalInstantQr = 'https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=canonical-upi';
      const originalInstantUpi = 'upi://pay?pa=bharatpe2e0p0d8x5a59798%40unitype&pn=Mohit%20Santosh%20Singh';

      // Simulating UPIQRPay returning their unconfigured "FoodAds" payload with '+' encoding
      const thirdPartyGatewayPayload = {
        paymentId: 'pay_gateway_999',
        orderId: 'ord-1792776849858-260',
        amount: 1.04, // third-party arbitrary paise alteration
        qrCode: 'https://upiqrpay.in/qr/foodads_unregistered.png',
        upiLink: 'upi://pay?pa=foodads@upi&pn=FoodAds&tn=Order+123',
        payUrl: 'https://upiqrpay.in/pay/999',
        status: 'pending',
      };

      const sanitized = sanitizeCheckoutUpiData(
        {
          paymentId: 'ord-1792776849858-260',
          orderId: 'ord-1792776849858-260',
          amount: 1.00,
          qrCode: originalInstantQr,
          upiLink: originalInstantUpi,
          payUrl: originalInstantUpi,
          expiresAt: new Date().toISOString(),
          status: 'pending',
        },
        thirdPartyGatewayPayload,
        1.00 // Original expected amount
      );

      // Must adopt the gateway paymentId for background status polling
      assert.equal(sanitized.paymentId, 'pay_gateway_999');
      // Must PRESERVE the canonical platform merchant QR and UPI link (NO "FoodAds" QR)
      assert.equal(sanitized.qrCode, originalInstantQr, 'Must preserve canonical QR to avoid FoodAds error');
      assert.equal(sanitized.upiLink, originalInstantUpi, 'Must preserve canonical UPI link');
      // Must maintain strict pricing integrity (1.00, NOT 1.04)
      assert.equal(sanitized.amount, 1.00, 'Must lock original cart total');
    });
  });

  describe('3. Payment Status Normalization', () => {
    it('normalizes various gateway status strings into standard FoodFax states', () => {
      assert.equal(normalizePaymentStatus('success'), 'PAID');
      assert.equal(normalizePaymentStatus('PAID'), 'PAID');
      assert.equal(normalizePaymentStatus('completed'), 'PAID');
      assert.equal(normalizePaymentStatus('pending'), 'WAITING');
      assert.equal(normalizePaymentStatus('waiting'), 'WAITING');
      assert.equal(normalizePaymentStatus('failed'), 'REJECTED');
      assert.equal(normalizePaymentStatus('expired'), 'EXPIRED');
      assert.equal(normalizePaymentStatus('unknown_random'), 'WAITING');
    });
  });

  describe('4. 12-Digit NPCI UTR Invariants', () => {
    it('accepts authentic 12-digit numeric bank UTRs', () => {
      const res = validateUpiUtr('429618392014');
      assert.equal(res.valid, true);
      assert.equal(res.cleaned, '429618392014');
    });

    it('rejects UTR starting with 0 per NPCI standards', () => {
      const res = validateUpiUtr('012345678901');
      assert.equal(res.valid, false);
      assert.match(res.error || '', /never starts with 0/i);
    });

    it('rejects sequential test patterns', () => {
      const res = validateUpiUtr('412345678912');
      assert.equal(res.valid, false);
      assert.match(res.error || '', /sequential/i);
    });

    it('rejects repetitive dummy sequences', () => {
      const res = validateUpiUtr('999999999999');
      assert.equal(res.valid, false);
      assert.match(res.error || '', /repetitive/i);
    });
  });
});
