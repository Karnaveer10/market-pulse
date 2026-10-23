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
  { id: 'p1', name: 'Pro Analytics Suite', category: 'Software', price: 299, status: 'active', createdAt: '2024-01-15' },
  { id: 'p2', name: 'Marketing Toolkit', category: 'Software', price: 149, status: 'active', createdAt: '2024-02-01' },
  { id: 'p3', name: 'Cloud Storage Plan', category: 'Service', price: 49, status: 'active', createdAt: '2024-02-20' },
  { id: 'p4', name: 'Data Connector', category: 'Integration', price: 99, status: 'inactive', createdAt: '2024-03-10' },
  { id: 'p5', name: 'Enterprise Dashboard', category: 'Software', price: 599, status: 'active', createdAt: '2024-03-25' },
];

export const campaigns: Campaign[] = [
  { id: 'c1', name: 'Spring Launch 2024', startDate: '2024-03-01', endDate: '2024-04-30', budget: 15000, spent: 12400, status: 'active', productId: 'p1' },
  { id: 'c2', name: 'Social Media Blitz', startDate: '2024-02-15', endDate: '2024-03-15', budget: 8000, spent: 7800, status: 'completed', productId: 'p2' },
  { id: 'c3', name: 'Email Nurture Series', startDate: '2024-04-01', endDate: '2024-06-30', budget: 5000, spent: 1200, status: 'active', productId: 'p3' },
  { id: 'c4', name: 'Product Hunt Launch', startDate: '2024-01-10', endDate: '2024-01-20', budget: 3000, spent: 2900, status: 'completed', productId: 'p5' },
  { id: 'c5', name: 'Retargeting Campaign', startDate: '2024-05-01', endDate: '2024-07-31', budget: 10000, spent: 0, status: 'paused', productId: 'p1' },
];

export const customers: Customer[] = [
  { id: 'cu1', name: 'Sarah Johnson', email: 'sarah@example.com', location: 'New York, US', phones: ['+1-555-0101'], joinedAt: '2024-01-20' },
  { id: 'cu2', name: 'Marcus Chen', email: 'marcus@example.com', location: 'San Francisco, US', phones: ['+1-555-0102', '+1-555-0103'], joinedAt: '2024-02-14' },
  { id: 'cu3', name: 'Emma Williams', email: 'emma@example.com', location: 'London, UK', phones: ['+44-555-0201'], joinedAt: '2024-03-01' },
  { id: 'cu4', name: 'Alex Rivera', email: 'alex@example.com', location: 'Toronto, CA', phones: ['+1-555-0301'], joinedAt: '2024-03-18' },
  { id: 'cu5', name: 'Yuki Tanaka', email: 'yuki@example.com', location: 'Tokyo, JP', phones: ['+81-555-0401', '+81-555-0402'], joinedAt: '2024-04-05' },
  { id: 'cu6', name: 'Priya Patel', email: 'priya@example.com', location: 'Mumbai, IN', phones: ['+91-555-0501'], joinedAt: '2024-04-22' },
];

export const channels: Channel[] = [
  { id: 'ch1', name: 'Instagram Ads', type: 'online', platform: 'Instagram' },
  { id: 'ch2', name: 'YouTube Ads', type: 'online', platform: 'YouTube' },
  { id: 'ch3', name: 'Google Search', type: 'online', platform: 'Google' },
  { id: 'ch4', name: 'Email Newsletter', type: 'online', platform: 'Email' },
  { id: 'ch5', name: 'NYC Billboard', type: 'offline', platform: 'Times Square' },
  { id: 'ch6', name: 'Trade Show Booth', type: 'offline', platform: 'CES 2024' },
];

export const interactions: Interaction[] = [
  { id: 'i1', type: 'purchase', customerId: 'cu1', customerName: 'Sarah Johnson', productId: 'p1', productName: 'Pro Analytics Suite', campaignId: 'c1', campaignName: 'Spring Launch 2024', channelId: 'ch3', channelName: 'Google Search', revenue: 299, date: '2024-03-15' },
  { id: 'i2', type: 'click', customerId: 'cu2', customerName: 'Marcus Chen', productId: 'p2', productName: 'Marketing Toolkit', campaignId: 'c2', campaignName: 'Social Media Blitz', channelId: 'ch1', channelName: 'Instagram Ads', revenue: 0, date: '2024-03-14' },
  { id: 'i3', type: 'purchase', customerId: 'cu3', customerName: 'Emma Williams', productId: 'p5', productName: 'Enterprise Dashboard', campaignId: 'c4', campaignName: 'Product Hunt Launch', channelId: 'ch4', channelName: 'Email Newsletter', revenue: 599, date: '2024-03-13' },
  { id: 'i4', type: 'visit', customerId: 'cu4', customerName: 'Alex Rivera', productId: 'p3', productName: 'Cloud Storage Plan', campaignId: 'c3', campaignName: 'Email Nurture Series', channelId: 'ch4', channelName: 'Email Newsletter', revenue: 0, date: '2024-03-12' },
  { id: 'i5', type: 'purchase', customerId: 'cu5', customerName: 'Yuki Tanaka', productId: 'p1', productName: 'Pro Analytics Suite', campaignId: 'c1', campaignName: 'Spring Launch 2024', channelId: 'ch2', channelName: 'YouTube Ads', revenue: 299, date: '2024-03-11' },
  { id: 'i6', type: 'click', customerId: 'cu6', customerName: 'Priya Patel', productId: 'p2', productName: 'Marketing Toolkit', campaignId: 'c2', campaignName: 'Social Media Blitz', channelId: 'ch1', channelName: 'Instagram Ads', revenue: 0, date: '2024-03-10' },
  { id: 'i7', type: 'purchase', customerId: 'cu2', customerName: 'Marcus Chen', productId: 'p3', productName: 'Cloud Storage Plan', campaignId: 'c3', campaignName: 'Email Nurture Series', channelId: 'ch3', channelName: 'Google Search', revenue: 49, date: '2024-03-09' },
  { id: 'i8', type: 'visit', customerId: 'cu1', customerName: 'Sarah Johnson', productId: 'p5', productName: 'Enterprise Dashboard', campaignId: 'c1', campaignName: 'Spring Launch 2024', channelId: 'ch5', channelName: 'NYC Billboard', revenue: 0, date: '2024-03-08' },
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
