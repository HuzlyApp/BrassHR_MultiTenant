/** Demo Pay data matching Figma worker Payslips / Earnings until a payroll API exists. */

export type PayslipLine = {
  description: string;
  hours?: string;
  rate?: string;
  amount: number;
};

export type WorkerPayslip = {
  id: string;
  monthLabel: string;
  periodLabel: string;
  payDateLabel: string;
  status: "paid";
  employeeName: string;
  employeeId: string;
  department: string;
  position: string;
  companyName: string;
  companyAddress: string[];
  companyPhone: string;
  earnings: PayslipLine[];
  deductions: PayslipLine[];
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  ytdEarnings: number;
  ytdDeductions: number;
  ytdNetPay: number;
};

export type EarningsHistoryRow = {
  id: string;
  payslipId: string;
  periodLabel: string;
  hours: number;
  gross: number;
  net: number;
  status: "paid";
  isCurrent?: boolean;
};

export type EarningsMonthPoint = {
  month: string;
  amount: number;
};

export const DEMO_EMPLOYEE_FALLBACK = "Kim Wagner";

export const DEMO_PAYSLIPS: WorkerPayslip[] = [
  {
    id: "ps-2026-11",
    monthLabel: "November 2026",
    periodLabel: "Nov 1 - Nov 30, 2026",
    payDateLabel: "Nov 30, 2026",
    status: "paid",
    employeeName: DEMO_EMPLOYEE_FALLBACK,
    employeeId: "EMP-00123",
    department: "Marketing",
    position: "Marketing Staff",
    companyName: "ABC Solutions Inc.",
    companyAddress: ["123 Business Avenue, Suite 400", "New York, NY 10001"],
    companyPhone: "(212) 555-0148",
    earnings: [
      { description: "Regular Pay", hours: "80 hrs", rate: "$25.00", amount: 2000 },
      { description: "Overtime Pay", hours: "8 hrs", rate: "$37.50", amount: 300 },
      { description: "Bonus", amount: 250 },
    ],
    deductions: [
      { description: "Federal Income Tax", amount: 312.5 },
      { description: "Social Security", amount: 158.1 },
      { description: "Medicare", amount: 36.98 },
      { description: "Health Insurance", amount: 167 },
      { description: "401(k) Contribution", amount: 100 },
    ],
    totalEarnings: 2550,
    totalDeductions: 774.58,
    netPay: 1775.42,
    ytdEarnings: 28500,
    ytdDeductions: 7745.2,
    ytdNetPay: 20754.8,
  },
  {
    id: "ps-2026-10",
    monthLabel: "October 2026",
    periodLabel: "Oct 1 - Oct 31, 2026",
    payDateLabel: "Oct 31, 2026",
    status: "paid",
    employeeName: DEMO_EMPLOYEE_FALLBACK,
    employeeId: "EMP-00123",
    department: "Marketing",
    position: "Marketing Staff",
    companyName: "ABC Solutions Inc.",
    companyAddress: ["123 Business Avenue, Suite 400", "New York, NY 10001"],
    companyPhone: "(212) 555-0148",
    earnings: [
      { description: "Regular Pay", hours: "80 hrs", rate: "$25.00", amount: 2000 },
      { description: "Overtime Pay", hours: "10 hrs", rate: "$37.50", amount: 375 },
      { description: "Bonus", amount: 200 },
    ],
    deductions: [
      { description: "Federal Income Tax", amount: 318.4 },
      { description: "Social Security", amount: 159.55 },
      { description: "Medicare", amount: 37.31 },
      { description: "Health Insurance", amount: 167 },
      { description: "401(k) Contribution", amount: 72.57 },
    ],
    totalEarnings: 2575,
    totalDeductions: 754.83,
    netPay: 1820.17,
    ytdEarnings: 25950,
    ytdDeductions: 6970.62,
    ytdNetPay: 18979.38,
  },
  {
    id: "ps-2026-09",
    monthLabel: "September 2026",
    periodLabel: "Sep 1 - Sep 30, 2026",
    payDateLabel: "Sep 30, 2026",
    status: "paid",
    employeeName: DEMO_EMPLOYEE_FALLBACK,
    employeeId: "EMP-00123",
    department: "Marketing",
    position: "Marketing Staff",
    companyName: "ABC Solutions Inc.",
    companyAddress: ["123 Business Avenue, Suite 400", "New York, NY 10001"],
    companyPhone: "(212) 555-0148",
    earnings: [
      { description: "Regular Pay", hours: "80 hrs", rate: "$25.00", amount: 2000 },
      { description: "Overtime Pay", hours: "6 hrs", rate: "$37.50", amount: 225 },
    ],
    deductions: [
      { description: "Federal Income Tax", amount: 278.1 },
      { description: "Social Security", amount: 137.95 },
      { description: "Medicare", amount: 32.26 },
      { description: "Health Insurance", amount: 167 },
      { description: "401(k) Contribution", amount: 89 },
    ],
    totalEarnings: 2225,
    totalDeductions: 704.31,
    netPay: 1520.69,
    ytdEarnings: 23375,
    ytdDeductions: 6215.79,
    ytdNetPay: 17159.21,
  },
  {
    id: "ps-2026-08",
    monthLabel: "August 2026",
    periodLabel: "Aug 1 - Aug 31, 2026",
    payDateLabel: "Aug 31, 2026",
    status: "paid",
    employeeName: DEMO_EMPLOYEE_FALLBACK,
    employeeId: "EMP-00123",
    department: "Marketing",
    position: "Marketing Staff",
    companyName: "ABC Solutions Inc.",
    companyAddress: ["123 Business Avenue, Suite 400", "New York, NY 10001"],
    companyPhone: "(212) 555-0148",
    earnings: [
      { description: "Regular Pay", hours: "80 hrs", rate: "$25.00", amount: 2000 },
      { description: "Overtime Pay", hours: "4 hrs", rate: "$37.50", amount: 150 },
      { description: "Bonus", amount: 100 },
    ],
    deductions: [
      { description: "Federal Income Tax", amount: 268.75 },
      { description: "Social Security", amount: 139.5 },
      { description: "Medicare", amount: 32.63 },
      { description: "Health Insurance", amount: 167 },
      { description: "401(k) Contribution", amount: 90 },
    ],
    totalEarnings: 2250,
    totalDeductions: 697.88,
    netPay: 1552.12,
    ytdEarnings: 21150,
    ytdDeductions: 5511.48,
    ytdNetPay: 15638.52,
  },
  {
    id: "ps-2026-07",
    monthLabel: "July 2026",
    periodLabel: "Jul 1 - Jul 31, 2026",
    payDateLabel: "Jul 31, 2026",
    status: "paid",
    employeeName: DEMO_EMPLOYEE_FALLBACK,
    employeeId: "EMP-00123",
    department: "Marketing",
    position: "Marketing Staff",
    companyName: "ABC Solutions Inc.",
    companyAddress: ["123 Business Avenue, Suite 400", "New York, NY 10001"],
    companyPhone: "(212) 555-0148",
    earnings: [
      { description: "Regular Pay", hours: "80 hrs", rate: "$25.00", amount: 2000 },
      { description: "Overtime Pay", hours: "12 hrs", rate: "$37.50", amount: 450 },
      { description: "Bonus", amount: 150 },
    ],
    deductions: [
      { description: "Federal Income Tax", amount: 325 },
      { description: "Social Security", amount: 161.2 },
      { description: "Medicare", amount: 37.7 },
      { description: "Health Insurance", amount: 167 },
      { description: "401(k) Contribution", amount: 104 },
    ],
    totalEarnings: 2600,
    totalDeductions: 794.9,
    netPay: 1805.1,
    ytdEarnings: 18900,
    ytdDeductions: 4813.6,
    ytdNetPay: 14086.4,
  },
  {
    id: "ps-2026-06",
    monthLabel: "June 2026",
    periodLabel: "Jun 1 - Jun 30, 2026",
    payDateLabel: "Jun 30, 2026",
    status: "paid",
    employeeName: DEMO_EMPLOYEE_FALLBACK,
    employeeId: "EMP-00123",
    department: "Marketing",
    position: "Marketing Staff",
    companyName: "ABC Solutions Inc.",
    companyAddress: ["123 Business Avenue, Suite 400", "New York, NY 10001"],
    companyPhone: "(212) 555-0148",
    earnings: [
      { description: "Regular Pay", hours: "80 hrs", rate: "$25.00", amount: 2000 },
      { description: "Overtime Pay", hours: "2 hrs", rate: "$37.50", amount: 75 },
    ],
    deductions: [
      { description: "Federal Income Tax", amount: 248.5 },
      { description: "Social Security", amount: 128.65 },
      { description: "Medicare", amount: 30.09 },
      { description: "Health Insurance", amount: 167 },
      { description: "401(k) Contribution", amount: 83 },
    ],
    totalEarnings: 2075,
    totalDeductions: 657.24,
    netPay: 1417.76,
    ytdEarnings: 16300,
    ytdDeductions: 4018.7,
    ytdNetPay: 12281.3,
  },
];

export const DEMO_EARNINGS_METRICS = {
  netPay: 2550,
  netPaySubtitle: "After Deductions",
  grossPay: 2980,
  grossPaySubtitle: "+32% vs last",
  totalHours: 42.5,
  totalHoursSubtitle: "40h Regular",
  nextPayDate: "Nov 15, 2026",
  nextPaySubtitle: "Friday • Direct Deposit",
};

export const DEMO_EARNINGS_MONTHLY: EarningsMonthPoint[] = [
  { month: "Jan", amount: 2100 },
  { month: "Feb", amount: 2280 },
  { month: "Mar", amount: 2450 },
  { month: "Apr", amount: 2380 },
  { month: "May", amount: 2600 },
  { month: "Jun", amount: 2075 },
  { month: "Jul", amount: 2980 },
  { month: "Aug", amount: 2250 },
  { month: "Sep", amount: 2225 },
  { month: "Oct", amount: 2575 },
  { month: "Nov", amount: 2550 },
  { month: "Dec", amount: 1800 },
];

export const DEMO_EARNINGS_HISTORY: EarningsHistoryRow[] = [
  {
    id: "eh-1",
    payslipId: "ps-2026-07-b",
    periodLabel: "July 16 - July 31, 2026",
    hours: 41,
    gross: 2980,
    net: 2550,
    status: "paid",
    isCurrent: true,
  },
  {
    id: "eh-2",
    payslipId: "ps-2026-07-a",
    periodLabel: "July 1 - July 15, 2026",
    hours: 40,
    gross: 2400,
    net: 1980.45,
    status: "paid",
  },
  {
    id: "eh-3",
    payslipId: "ps-2026-06-b",
    periodLabel: "June 16 - June 30, 2026",
    hours: 38.5,
    gross: 2310,
    net: 1895.2,
    status: "paid",
  },
  {
    id: "eh-4",
    payslipId: "ps-2026-06-a",
    periodLabel: "June 1 - June 15, 2026",
    hours: 40,
    gross: 2400,
    net: 1962.8,
    status: "paid",
  },
  {
    id: "eh-5",
    payslipId: "ps-2026-05-b",
    periodLabel: "May 16 - May 31, 2026",
    hours: 42,
    gross: 2680,
    net: 2210.15,
    status: "paid",
  },
  {
    id: "eh-6",
    payslipId: "ps-2026-05-a",
    periodLabel: "May 1 - May 15, 2026",
    hours: 39,
    gross: 2340,
    net: 1925.6,
    status: "paid",
  },
];

export function formatPayCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatPayHours(hours: number): string {
  return `${hours.toFixed(2)} hrs`;
}
