// Mock data for MarketPulse dashboard

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  budget: number;
  spent: number;
  status: 'active' | 'paused' | 'completed';
  productId: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  location: string;
  phones: string[];
  joinedAt: string;
}

export interface Channel {
  id: string;
  name: string;
  type: 'online' | 'offline';
  platform: string;
}

export interface Interaction {
  id: string;
  type: 'click' | 'purchase' | 'visit';
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  campaignId: string;
  campaignName: string;
  channelId: string;
  channelName: string;
  revenue: number;
  date: string;
}

export const products: Product[] = [
  { id: 'p1', name: 'Nexus Smart Watch Pro', category: 'Electronics', price: 4999, status: 'active', createdAt: '2024-01-15' },
  { id: 'p2', name: 'AeroNoise ANC Earbuds', category: 'Audio', price: 2499, status: 'active', createdAt: '2024-02-01' },
  { id: 'p3', name: 'Kavach Ultra PowerBank 20k', category: 'Accessories', price: 1299, status: 'active', createdAt: '2024-02-20' },
  { id: 'p4', name: 'GamerX RGB Mechanical Keyboard', category: 'Gaming', price: 3499, status: 'inactive', createdAt: '2024-03-10' },
  { id: 'p5', name: 'VoltFast 65W GaN Charger', category: 'Accessories', price: 1799, status: 'active', createdAt: '2024-03-25' },
];

export const campaigns: Campaign[] = [
  { id: 'c1', name: 'Diwali Mega Dhamaka Sale', startDate: '2024-10-01', endDate: '2024-11-15', budget: 150000, spent: 124000, status: 'active', productId: 'p1' },
  { id: 'c2', name: 'Great Indian Festive Blitz', startDate: '2024-09-15', endDate: '2024-10-15', budget: 80000, spent: 78000, status: 'completed', productId: 'p2' },
  { id: 'c3', name: 'Monsoon Tech Bonanza', startDate: '2024-07-01', endDate: '2024-08-31', budget: 50000, spent: 22000, status: 'active', productId: 'p3' },
  { id: 'c4', name: 'Independence Day Super Savings', startDate: '2024-08-10', endDate: '2024-08-20', budget: 40000, spent: 39000, status: 'completed', productId: 'p5' },
  { id: 'c5', name: 'IPL Season Retargeting', startDate: '2024-04-01', endDate: '2024-05-31', budget: 100000, spent: 0, status: 'paused', productId: 'p1' },
];

export const customers: Customer[] = [
  { id: 'cu1', name: 'Aarav Sharma', email: 'aarav.sharma@gmail.com', location: 'Bengaluru, Karnataka', phones: ['+91-98765-43210'], joinedAt: '2024-01-20' },
  { id: 'cu2', name: 'Ananya Deshmukh', email: 'ananya.deshmukh@yahoo.in', location: 'Mumbai, Maharashtra', phones: ['+91-98230-11223'], joinedAt: '2024-02-14' },
  { id: 'cu3', name: 'Rohan Verma', email: 'rohan.verma@outlook.com', location: 'Delhi NCR', phones: ['+91-99112-44556'], joinedAt: '2024-03-01' },
  { id: 'cu4', name: 'Priya Iyer', email: 'priya.iyer@gmail.com', location: 'Chennai, Tamil Nadu', phones: ['+91-94441-77889'], joinedAt: '2024-03-18' },
  { id: 'cu5', name: 'Kabir Patel', email: 'kabir.patel@gmail.com', location: 'Ahmedabad, Gujarat', phones: ['+91-97250-99887'], joinedAt: '2024-04-05' },
  { id: 'cu6', name: 'Neha Sundaram', email: 'neha.sundaram@gmail.com', location: 'Hyderabad, Telangana', phones: ['+91-98490-66554'], joinedAt: '2024-04-22' },
];

export const channels: Channel[] = [
  { id: 'ch1', name: 'Instagram Sponsored Ads', type: 'online', platform: 'Instagram' },
  { id: 'ch2', name: 'YouTube Tech Review Ads', type: 'online', platform: 'YouTube' },
  { id: 'ch3', name: 'Google Search CPC', type: 'online', platform: 'Google' },
  { id: 'ch4', name: 'WhatsApp & Email Blast', type: 'online', platform: 'WhatsApp' },
  { id: 'ch5', name: 'Bengaluru Metro Billboards', type: 'offline', platform: 'Namma Metro' },
  { id: 'ch6', name: 'Croma & Reliance Digital In-Store', type: 'offline', platform: 'Retail POS' },
];

export const interactions: Interaction[] = [
  { id: 'i1', type: 'purchase', customerId: 'cu1', customerName: 'Aarav Sharma', productId: 'p1', productName: 'Nexus Smart Watch Pro', campaignId: 'c1', campaignName: 'Diwali Mega Dhamaka Sale', channelId: 'ch3', channelName: 'Google Search CPC', revenue: 4999, date: '2024-03-15' },
  { id: 'i2', type: 'click', customerId: 'cu2', customerName: 'Ananya Deshmukh', productId: 'p2', productName: 'AeroNoise ANC Earbuds', campaignId: 'c2', campaignName: 'Great Indian Festive Blitz', channelId: 'ch1', channelName: 'Instagram Sponsored Ads', revenue: 0, date: '2024-03-14' },
  { id: 'i3', type: 'purchase', customerId: 'cu3', customerName: 'Rohan Verma', productId: 'p5', productName: 'VoltFast 65W GaN Charger', campaignId: 'c4', campaignName: 'Independence Day Super Savings', channelId: 'ch4', channelName: 'WhatsApp & Email Blast', revenue: 1799, date: '2024-03-13' },
  { id: 'i4', type: 'visit', customerId: 'cu4', customerName: 'Priya Iyer', productId: 'p3', productName: 'Kavach Ultra PowerBank 20k', campaignId: 'c3', campaignName: 'Monsoon Tech Bonanza', channelId: 'ch4', channelName: 'WhatsApp & Email Blast', revenue: 0, date: '2024-03-12' },
  { id: 'i5', type: 'purchase', customerId: 'cu5', customerName: 'Kabir Patel', productId: 'p1', productName: 'Nexus Smart Watch Pro', campaignId: 'c1', campaignName: 'Diwali Mega Dhamaka Sale', channelId: 'ch2', channelName: 'YouTube Tech Review Ads', revenue: 4999, date: '2024-03-11' },
  { id: 'i6', type: 'click', customerId: 'cu6', customerName: 'Neha Sundaram', productId: 'p2', productName: 'AeroNoise ANC Earbuds', campaignId: 'c2', campaignName: 'Great Indian Festive Blitz', channelId: 'ch1', channelName: 'Instagram Sponsored Ads', revenue: 0, date: '2024-03-10' },
  { id: 'i7', type: 'purchase', customerId: 'cu2', customerName: 'Ananya Deshmukh', productId: 'p3', productName: 'Kavach Ultra PowerBank 20k', campaignId: 'c3', campaignName: 'Monsoon Tech Bonanza', channelId: 'ch3', channelName: 'Google Search CPC', revenue: 1299, date: '2024-03-09' },
  { id: 'i8', type: 'visit', customerId: 'cu1', customerName: 'Aarav Sharma', productId: 'p5', productName: 'VoltFast 65W GaN Charger', campaignId: 'c1', campaignName: 'Diwali Mega Dhamaka Sale', channelId: 'ch5', channelName: 'Bengaluru Metro Billboards', revenue: 0, date: '2024-03-08' },
];

export const campaignPerformanceData = [
  { month: 'Jan', 'Spring Launch': 2400, 'Social Blitz': 1800, 'Email Nurture': 0 },
  { month: 'Feb', 'Spring Launch': 3200, 'Social Blitz': 4200, 'Email Nurture': 800 },
  { month: 'Mar', 'Spring Launch': 5800, 'Social Blitz': 7800, 'Email Nurture': 1200 },
  { month: 'Apr', 'Spring Launch': 8200, 'Social Blitz': 7800, 'Email Nurture': 2400 },
  { month: 'May', 'Spring Launch': 11000, 'Social Blitz': 7800, 'Email Nurture': 3600 },
  { month: 'Jun', 'Spring Launch': 12400, 'Social Blitz': 7800, 'Email Nurture': 5000 },
];

export const channelComparisonData = [
  { channel: 'Google', revenue: 4200, interactions: 340 },
  { channel: 'Instagram', revenue: 3100, interactions: 520 },
  { channel: 'YouTube', revenue: 2800, interactions: 280 },
  { channel: 'Email', revenue: 3600, interactions: 190 },
  { channel: 'Billboard', revenue: 800, interactions: 45 },
  { channel: 'Trade Show', revenue: 1200, interactions: 60 },
];

export const revenueOverTimeData = [
  { month: 'Jan', revenue: 12400, customers: 45 },
  { month: 'Feb', revenue: 18200, customers: 62 },
  { month: 'Mar', revenue: 24600, customers: 78 },
  { month: 'Apr', revenue: 21800, customers: 71 },
  { month: 'May', revenue: 28400, customers: 89 },
  { month: 'Jun', revenue: 32100, customers: 102 },
];

export const conversionData = [
  { channel: 'Google', visits: 1200, clicks: 340, purchases: 48, rate: 4.0 },
  { channel: 'Instagram', visits: 2800, clicks: 520, purchases: 31, rate: 1.1 },
  { channel: 'YouTube', visits: 1600, clicks: 280, purchases: 22, rate: 1.4 },
  { channel: 'Email', visits: 800, clicks: 190, purchases: 38, rate: 4.75 },
];
