export type CurrencyCode = 'BRL' | 'USD' | 'EUR';
export type ThemeMode = 'dark' | 'light';
export type BudgetMode = 'categoria' | '50-30-20' | 'base-zero';
export type MemberRole = 'owner' | 'editor' | 'viewer';
export type AccountType = 'carteira' | 'corrente' | 'poupanca' | 'cartao_credito' | 'investimento';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionStatus = 'paid' | 'pending';
export type PaymentMethod = 'dinheiro' | 'debito' | 'credito' | 'pix' | 'transferencia' | 'boleto' | 'outro';
export type RecurrenceFrequency = 'weekly' | 'monthly' | 'yearly';
export type BudgetBucket = 'necessidades' | 'desejos' | 'poupanca';

export interface UserNotificationSettings {
  daysBefore: 1 | 3 | 7;
  browserNotifications: boolean;
  dailyReminder: boolean;
  dailyReminderTime: string; // e.g. "20:00"
}

export interface UserSecuritySettings {
  pinEnabled: boolean;
  pinHash?: string;
  pinSalt?: string;
  autoLockMinutes: 1 | 5 | 15;
  biometricsEnabled?: boolean;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string | null;
  currency: CurrencyCode;
  theme: ThemeMode;
  workspaceIds: string[];
  activeWorkspaceId?: string;
  onboardingDone: boolean;
  consentAcceptedAt: string;
  notificationSettings: UserNotificationSettings;
  security: UserSecuritySettings;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  budgetMode: BudgetMode;
}

export interface WorkspaceMember {
  uid: string;
  role: MemberRole;
  name: string;
  email: string;
  joinedAt: string;
  inviteCode?: string;
}

export interface Invite {
  code: string;
  workspaceId: string;
  workspaceName: string;
  role: 'editor' | 'viewer';
  createdBy: string;
  expiresAt: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  initialBalanceCents: number;
  color: string;
  icon: string;
  archived: boolean;
  // Specific to credit cards
  creditLimitCents?: number;
  closingDay?: number; // 1-31
  dueDay?: number; // 1-31
  deletedAt?: string | null;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
  parentId?: string | null;
  isDefault?: boolean;
  bucket?: BudgetBucket | null;
  deletedAt?: string | null;
}

export interface TransactionAttachment {
  path: string;
  url: string;
  name: string;
  contentType: string;
}

export interface InstallmentInfo {
  groupId: string;
  number: number;
  total: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amountCents: number;
  description: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  accountId: string;
  toAccountId?: string | null; // For transfers
  date: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  dueDate?: string | null;
  paidDate?: string | null;
  paidFromAccountId?: string | null;
  recurrenceId?: string | null;
  installment?: InstallmentInfo | null;
  tags: string[];
  notes?: string;
  attachments: TransactionAttachment[];
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface Recurrence {
  id: string;
  template: Omit<Transaction, 'id' | 'recurrenceId' | 'installment'>;
  frequency: RecurrenceFrequency;
  startDate: string; // YYYY-MM-DD
  endDate?: string | null;
  dayOfMonth?: number;
  lastGeneratedDate?: string;
  active: boolean;
}

export interface Budget {
  id: string;
  categoryId: string;
  limitCents: number;
  alertPercent: number; // default 80
  deletedAt?: string | null;
}

export interface GoalContribution {
  id: string;
  date: string; // YYYY-MM-DD
  amountCents: number;
  note?: string;
}

export interface Goal {
  id: string;
  name: string;
  targetCents: number;
  savedCents: number;
  deadline: string; // YYYY-MM-DD
  accountId?: string | null;
  contributions: GoalContribution[];
  deletedAt?: string | null;
}

export interface ParsedBankTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  amountCents: number;
  type: 'income' | 'expense';
  description: string;
  fitId?: string;
  suggestedCategoryId?: string;
  selected: boolean;
}

export interface FinancialSummary {
  currentBalanceCents: number;
  totalIncomeCents: number;
  totalExpenseCents: number;
  paidExpenseCents: number;
  pendingExpenseCents: number;
  monthBalanceCents: number;
  toPayCents: number;
  toReceiveCents: number;
  largestExpense?: { description: string; amountCents: number; date: string };
  dailyAverageExpenseCents: number;
  forecastEndMonthCents: number;
  savingsRatePercent: number;
  transactionCount: number;
}