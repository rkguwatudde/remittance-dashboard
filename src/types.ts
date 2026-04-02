export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  recipient: string;
  date: string;
  status: 'completed' | 'pending' | 'failed' | 'processing';
  type: 'send' | 'receive' | 'request';
}

export interface Recipient {
  id: string;
  name: string;
  email: string;
  phone: string;
  bankName?: string;
  accountNumber?: string;
  avatar?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
}
