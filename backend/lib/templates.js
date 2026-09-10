const templates = [
  {
    id: 'blank',
    title: 'Blank Document',
    category: 'General',
    description: 'Start with a clean page.',
    content: '<p></p>',
  },
  {
    id: 'business',
    title: 'Business Report',
    category: 'Business',
    description: 'Executive summary, findings, and recommendations.',
    content: `
<h1>Strategic Business Report</h1>
<p><strong>Prepared by:</strong> Your Name</p>
<p><strong>Prepared for:</strong> Client or Department</p>
<h2>Executive Summary</h2>
<p>Summarize the purpose, key findings, and recommended next steps.</p>
<h2>Objectives</h2>
<ul>
  <li>Primary objective</li>
  <li>Success metric</li>
  <li>Timeline</li>
</ul>
<h2>Findings</h2>
<p>Present evidence, risks, and opportunities.</p>
<h2>Recommendations</h2>
<ol>
  <li><strong>Recommendation one</strong> - rationale and impact.</li>
  <li><strong>Recommendation two</strong> - rationale and impact.</li>
</ol>`,
  },
  {
    id: 'letter',
    title: 'Professional Letter',
    category: 'Business',
    description: 'A polished formal letter layout.',
    content: `
<p><strong>Your Full Name</strong></p>
<p>Your Address, City, State ZIP</p>
<p>your@email.com - (555) 000-0000</p>
<p><strong>Recipient Name</strong><br>Title or Organization<br>Recipient Address</p>
<p>Dear Recipient,</p>
<p>State the purpose of your letter clearly and professionally.</p>
<p>Provide supporting details, dates, and any requested action.</p>
<p>Sincerely,</p>
<p><strong>Your Full Name</strong></p>`,
  },
  {
    id: 'resume',
    title: 'Resume',
    category: 'Career',
    description: 'A clean resume structure with summary, experience, and skills.',
    content: `
<h1>Your Full Name</h1>
<p><strong>Role or Professional Title</strong></p>
<p>email@example.com - (555) 000-0000 - City, State</p>
<h2>Professional Summary</h2>
<p>Summarize your experience, strengths, and target role.</p>
<h2>Experience</h2>
<p><strong>Job Title</strong> - Company Name</p>
<ul>
  <li>Achievement with measurable outcome.</li>
  <li>Project, leadership, or collaboration highlight.</li>
</ul>
<h2>Education</h2>
<p>Degree - School Name</p>
<h2>Skills</h2>
<p>Skill 1 - Skill 2 - Skill 3</p>`,
  },
  {
    id: 'proposal',
    title: 'Project Proposal',
    category: 'Business',
    description: 'Scope, timeline, budget, and expected outcomes.',
    content: `
<h1>Project Proposal</h1>
<p><strong>Prepared by:</strong> Your Name</p>
<p><strong>Submitted to:</strong> Client or Team</p>
<h2>Overview</h2>
<p>Describe the project and why it matters.</p>
<h2>Problem Statement</h2>
<p>Define the problem, gap, or opportunity.</p>
<h2>Proposed Solution</h2>
<p>Explain the approach and expected value.</p>
<h2>Scope of Work</h2>
<ul>
  <li>Deliverable one</li>
  <li>Deliverable two</li>
  <li>Out of scope items</li>
</ul>
<h2>Timeline and Budget</h2>
<p>List milestones, dates, and estimated costs.</p>`,
  },
  {
    id: 'invoice',
    title: 'Invoice',
    category: 'Finance',
    description: 'Professional invoice with bill-to details, line items, and payment instructions.',
    content: `
<table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
  <tbody>
    <tr>
      <td style="border: none; padding: 0; vertical-align: top;">
        <h1 style="margin: 0; font-size: 32px; font-weight: bold;">INVOICE</h1>
        <p style="margin: 5px 0; font-size: 14px; color: #d4af37;"><strong>#INV-2026-001</strong></p>
      </td>
      <td style="border: none; padding: 0; text-align: right; vertical-align: top;">
        <h2 style="margin: 0; font-size: 16px; font-weight: bold; text-align: right;">Your Business Name</h2>
        <p style="margin: 5px 0; font-size: 13px; text-align: right;">123 Your Street, City, State ZIP</p>
        <p style="margin: 5px 0; font-size: 13px; text-align: right;">billing@business.com • (555) 000-0000</p>
      </td>
    </tr>
  </tbody>
</table>

<table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
  <tbody>
    <tr>
      <td style="border: none; padding: 0; vertical-align: top; width: 60%;">
        <p style="margin: 0; font-size: 12px; font-weight: bold; color: #666;">BILL TO</p>
        <p style="margin: 5px 0 0 0; font-size: 13px;"><strong>Client Full Name</strong></p>
        <p style="margin: 5px 0; font-size: 13px;">Client Company Inc.</p>
        <p style="margin: 5px 0; font-size: 13px;">456 Client Street, City, State ZIP</p>
        <p style="margin: 5px 0; font-size: 13px;">client@company.com</p>
      </td>
      <td style="border: none; padding: 0; vertical-align: top; width: 40%; text-align: right;">
        <p style="margin: 5px 0; font-size: 13px; text-align: right;"><strong>Invoice No.:</strong> <span style="color: #d4af37;">INV-2026-001</span></p>
        <p style="margin: 5px 0; font-size: 13px; text-align: right;"><strong>Invoice Date:</strong> <span style="color: #d4af37;">April 22, 2026</span></p>
        <p style="margin: 5px 0; font-size: 13px; text-align: right;"><strong>Due Date:</strong> <span style="color: #d4af37;">May 22, 2026</span></p>
        <p style="margin: 5px 0; font-size: 13px; text-align: right;"><strong>Status:</strong> <span style="color: #d4af37; font-weight: bold;">UNPAID</span></p>
      </td>
    </tr>
  </tbody>
</table>

<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <thead>
    <tr style="border-bottom: 2px solid #333;">
      <th style="text-align: left; padding: 8px; font-size: 12px; color: #666; font-weight: bold;">DESCRIPTION</th>
      <th style="text-align: center; padding: 8px; font-size: 12px; color: #666; font-weight: bold;">QTY</th>
      <th style="text-align: right; padding: 8px; font-size: 12px; color: #666; font-weight: bold;">UNIT PRICE</th>
      <th style="text-align: right; padding: 8px; font-size: 12px; color: #666; font-weight: bold;">AMOUNT</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom: 1px solid #ddd;">
      <td style="padding: 10px; font-size: 13px; text-align: left;">Service or Product Name</td>
      <td style="text-align: center; padding: 10px; font-size: 13px;">1</td>
      <td style="text-align: right; padding: 10px; font-size: 13px;">$1,200.00</td>
      <td style="text-align: right; padding: 10px; font-size: 13px;">$1,200.00</td>
    </tr>
    <tr style="border-bottom: 1px solid #ddd;">
      <td style="padding: 10px; font-size: 13px; text-align: left;">Consulting Hours (Design)</td>
      <td style="text-align: center; padding: 10px; font-size: 13px;">4</td>
      <td style="text-align: right; padding: 10px; font-size: 13px;">$150.00</td>
      <td style="text-align: right; padding: 10px; font-size: 13px;">$600.00</td>
    </tr>
    <tr style="border-bottom: 1px solid #ddd;">
      <td style="padding: 10px; font-size: 13px; text-align: left;">Additional Service Item</td>
      <td style="text-align: center; padding: 10px; font-size: 13px;">1</td>
      <td style="text-align: right; padding: 10px; font-size: 13px;">$350.00</td>
      <td style="text-align: right; padding: 10px; font-size: 13px;">$350.00</td>
    </tr>
  </tbody>
</table>

<table style="width: 100%; border-collapse: collapse; margin: 20px 0 30px 0;">
  <tbody>
    <tr>
      <td style="border: none; width: 60%;"></td>
      <td style="border: none; width: 40%; text-align: right;">
        <table style="width: 100%; border-collapse: collapse;">
          <tbody>
            <tr style="border-bottom: 1px solid #ddd;">
              <td style="padding: 8px 0; font-size: 13px; text-align: left;"><strong>Subtotal</strong></td>
              <td style="padding: 8px 0; font-size: 13px; text-align: right;">$2,150.00</td>
            </tr>
            <tr style="border-bottom: 1px solid #ddd;">
              <td style="padding: 8px 0; font-size: 13px; text-align: left;"><strong>Tax (GST 18%)</strong></td>
              <td style="padding: 8px 0; font-size: 13px; text-align: right;">$387.00</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-size: 14px; text-align: left; color: #d4af37;"><strong>Total Due</strong></td>
              <td style="padding: 8px 0; font-size: 14px; text-align: right; font-weight: bold; color: #d4af37;">$2,537.00</td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </tbody>
</table>

<table style="width: 100%; border-collapse: collapse; margin-top: 30px; border-top: 1px solid #ccc;">
  <tbody>
    <tr>
      <td style="border: none; padding: 20px 20px 0 0; vertical-align: top; width: 50%;">
        <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: bold; color: #666; text-align: left;">PAYMENT INSTRUCTIONS</p>
        <p style="margin: 3px 0; font-size: 12px; text-align: left;">Bank Transfer: Your Bank Name</p>
        <p style="margin: 3px 0; font-size: 12px; text-align: left;">Account Name: Your Business Name</p>
        <p style="margin: 3px 0; font-size: 12px; text-align: left;">Account No.: XXXX-XXXX-XXXX</p>
        <p style="margin: 3px 0; font-size: 12px; text-align: left;">IFSC / Routing: XXXXXXXX</p>
        <p style="margin: 3px 0; font-size: 12px; text-align: left;">Or pay via: razorpay.com/your-link</p>
      </td>
      <td style="border: none; padding: 20px 0 0 20px; vertical-align: top; width: 50%;">
        <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: bold; color: #666; text-align: left;">TERMS & NOTES</p>
        <p style="margin: 3px 0; font-size: 12px; text-align: left; line-height: 1.5;">Payment due within 30 days of invoice date. Late payments are subject to a 1.5% monthly interest charge. Thank you for your business — we appreciate the partnership!</p>
      </td>
    </tr>
  </tbody>
</table>
    `,
  },
];

function listTemplates() {
  return templates.map(({ content, ...template }) => template);
}

function getTemplate(id) {
  return templates.find((template) => template.id === id) || null;
}

module.exports = {
  getTemplate,
  listTemplates,
};
