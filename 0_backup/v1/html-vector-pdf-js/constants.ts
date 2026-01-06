import { PdfConfig } from './types';

export const DEFAULT_CONFIG: PdfConfig = {
  filename: 'Invoice-INV-2024-001.pdf',
  pageSize: 'a4',
  orientation: 'portrait',
  margins: {
    top: 10,
    right: 10,
    bottom: 10,
    left: 10,
  },
  fontFamily: 'helvetica',
  debug: false,
};

export const SAMPLE_HTML = `
<div class="exp_to_excel_button_content">
  <!-- Header Table -->
  <table class="globe3-table" style="border: none;">
    <tr style="border: none;">
      <td style="border: none; width: 20%;">
        <img src="https://picsum.photos/100/50" alt="Logo" style="width: 100px; height: 50px;" />
      </td>
      <td style="border: none; width: 50%;">
        <div style="font-size: 16px; font-weight: bold; color: #1e3a8a;">GLOBE3 SOLUTIONS PTE LTD</div>
        <div>123 Tech Park Crescent</div>
        <div>Singapore, 600123</div>
        <div>Tel: +65 6123 4567</div>
      </td>
      <td style="border: none; width: 30%; text-align: right;">
        <div style="font-size: 20px; font-weight: bold;">TAX INVOICE</div>
        <br/>
        <div><strong>Invoice No:</strong> INV-2024-001</div>
        <div><strong>Date:</strong> 25 Oct 2023</div>
      </td>
    </tr>
  </table>

  <!-- Bill To Section -->
  <div style="margin-top: 20px; margin-bottom: 10px; font-weight: bold;">Bill To:</div>
  <table class="globe3-table">
    <tr>
      <td style="background-color: #f8fafc;">
        <strong>Mega Corp Industries</strong><br/>
        789 Business Blvd, Tower A<br/>
        Singapore, 018989<br/>
        Attn: Accounts Payable
      </td>
    </tr>
  </table>

  <!-- Items Table -->
  <table class="globe3-table" style="margin-top: 20px;">
    <thead>
      <tr>
        <th style="width: 5%;">#</th>
        <th style="width: 45%;">Description</th>
        <th style="width: 15%; text-align: right;">Qty</th>
        <th style="width: 15%; text-align: right;">Unit Price</th>
        <th style="width: 20%; text-align: right;">Amount (SGD)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>Professional Services - System Implementation</td>
        <td class="text-right">40</td>
        <td class="text-right">150.00</td>
        <td class="text-right">6,000.00</td>
      </tr>
      <tr>
        <td>2</td>
        <td>Software License - Annual Subscription</td>
        <td class="text-right">1</td>
        <td class="text-right">2,500.00</td>
        <td class="text-right">2,500.00</td>
      </tr>
       <tr>
        <td>3</td>
        <td>Customization Module - Reporting</td>
        <td class="text-right">10</td>
        <td class="text-right">150.00</td>
        <td class="text-right">1,500.00</td>
      </tr>
    </tbody>
  </table>

  <!-- Totals -->
  <table class="globe3-table" style="width: 40%; margin-left: auto;">
    <tr>
      <td style="font-weight: bold;">Subtotal:</td>
      <td class="text-right">10,000.00</td>
    </tr>
    <tr>
      <td>GST (9%):</td>
      <td class="text-right">900.00</td>
    </tr>
    <tr style="background-color: #1e3a8a; color: white;">
      <td style="font-weight: bold; border-color: #1e3a8a;">Grand Total:</td>
      <td class="text-right" style="font-weight: bold; border-color: #1e3a8a;">10,900.00</td>
    </tr>
  </table>

  <!-- Footer -->
  <div style="margin-top: 40px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 10px; color: #666;">
    <p>Terms & Conditions: Payment due within 30 days. Cheques should be crossed and made payable to "Globe3 Solutions Pte Ltd".</p>
    <p style="text-align: center;">Thank you for your business!</p>
  </div>
</div>
`;
