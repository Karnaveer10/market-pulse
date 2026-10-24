import { supabase } from '@/integrations/supabase/client';

export async function seedIndianDataIfEmpty() {
  try {
    // Check if we need to clean out old foreign names or seed fresh Indian entities
    const { data: existingCustomers } = await supabase.from('customers').select('id, name');
    const hasOldData = existingCustomers?.some(c => 
      c.name.includes('Johnson') || c.name.includes('Chen') || c.name.includes('Williams') || c.name.includes('Rivera')
    );

    if (hasOldData) {
      console.log('Detected legacy foreign seed data. Resetting with authentic Indian entities...');
      // Clean up in reverse foreign key order
      await supabase.from('interactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('campaigns').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('channels').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }

    const { data: currentProducts } = await supabase.from('products').select('id');
    if (!currentProducts || currentProducts.length === 0) {
      console.log('Seeding authentic Indian products, campaigns, customers, and channels...');

      // 1. Insert Products (matching VoltStore India)
      const { data: insertedProducts } = await supabase.from('products').insert([
        { name: 'Nexus Smart Watch Pro', category: 'Electronics', price: 4999, status: 'active' },
        { name: 'AeroNoise ANC Earbuds', category: 'Audio', price: 2499, status: 'active' },
        { name: 'Kavach Ultra PowerBank 20k', category: 'Accessories', price: 1499, status: 'active' },
        { name: 'VoltFast GaN 65W Charger', category: 'Accessories', price: 1899, status: 'active' },
        { name: 'GamerX MechStrike Keyboard', category: 'Gaming', price: 3499, status: 'active' },
        { name: 'EyeSafe 2K Smart Home Camera', category: 'Smart Home', price: 2199, status: 'active' },
      ]).select();

      // 2. Insert Indian Channels (Online & Offline)
      const { data: insertedChannels } = await supabase.from('channels').insert([
        { name: 'Instagram Sponsored Ads', type: 'online', platform: 'Instagram Feed & Reels' },
        { name: 'YouTube Tech Reviews', type: 'online', platform: 'YouTube Influencers' },
        { name: 'Google Search CPC', type: 'online', platform: 'Google Ads' },
        { name: 'WhatsApp & Email Blast', type: 'online', platform: 'WhatsApp Business API' },
        { name: 'Bengaluru Metro Billboards', type: 'offline', platform: 'Namma Metro Phase 2' },
        { name: 'Croma & Reliance Digital In-Store', type: 'offline', platform: 'Retail Store POS' },
        { name: 'Delhi NCR Mall Kiosks', type: 'offline', platform: 'Select Citywalk Kiosk' },
      ]).select();

      // 3. Insert Indian Customers
      const { data: insertedCustomers } = await supabase.from('customers').insert([
        { name: 'Aarav Sharma', email: 'aarav.sharma@gmail.com', location: 'Bengaluru, Karnataka', phones: ['+91 98765 43210'], joined_at: '2024-01-15' },
        { name: 'Ananya Deshmukh', email: 'ananya.deshmukh@yahoo.in', location: 'Mumbai, Maharashtra', phones: ['+91 98230 11223'], joined_at: '2024-02-01' },
        { name: 'Rohan Verma', email: 'rohan.verma@outlook.com', location: 'Delhi NCR', phones: ['+91 99112 44556'], joined_at: '2024-02-20' },
        { name: 'Priya Iyer', email: 'priya.iyer@gmail.com', location: 'Chennai, Tamil Nadu', phones: ['+91 94441 77889'], joined_at: '2024-03-05' },
        { name: 'Kabir Patel', email: 'kabir.patel@gmail.com', location: 'Ahmedabad, Gujarat', phones: ['+91 97250 99887'], joined_at: '2024-03-18' },
        { name: 'Neha Sundaram', email: 'neha.sundaram@gmail.com', location: 'Hyderabad, Telangana', phones: ['+91 98490 66554'], joined_at: '2024-04-02' },
        { name: 'Aditya Chatterjee', email: 'aditya.c@gmail.com', location: 'Kolkata, West Bengal', phones: ['+91 98301 23456'], joined_at: '2024-04-12' },
      ]).select();

      // 4. Insert Indian Marketing Campaigns
      const p1 = insertedProducts?.[0]?.id || null;
      const p2 = insertedProducts?.[1]?.id || null;
      const p3 = insertedProducts?.[2]?.id || null;
      const p4 = insertedProducts?.[3]?.id || null;

      const { data: insertedCampaigns } = await supabase.from('campaigns').insert([
        {
          name: 'Diwali Mega Dhamaka Sale',
          status: 'active',
          budget: 150000,
          spent: 124000,
          start_date: '2024-10-01',
          end_date: '2024-11-15',
          product_id: p1,
        },
        {
          name: 'Great Indian Festive Blitz',
          status: 'completed',
          budget: 80000,
          spent: 78000,
          start_date: '2024-09-15',
          end_date: '2024-10-15',
          product_id: p2,
        },
        {
          name: 'Monsoon Tech Bonanza',
          status: 'active',
          budget: 50000,
          spent: 22000,
          start_date: '2024-07-01',
          end_date: '2024-08-31',
          product_id: p3,
        },
        {
          name: 'Independence Day Super Savings',
          status: 'completed',
          budget: 40000,
          spent: 39000,
          start_date: '2024-08-10',
          end_date: '2024-08-20',
          product_id: p4,
        },
        {
          name: 'IPL Season Retargeting',
          status: 'paused',
          budget: 100000,
          spent: 0,
          start_date: '2024-04-01',
          end_date: '2024-05-31',
          product_id: p1,
        },
      ]).select();

      // 5. Insert Attributed Relational Interactions (Online + Offline)
      if (insertedCustomers && insertedChannels && insertedCampaigns && insertedProducts) {
        await supabase.from('interactions').insert([
          {
            type: 'purchase',
            revenue: 4999,
            customer_id: insertedCustomers[0]?.id,
            channel_id: insertedChannels[2]?.id, // Google Search CPC
            campaign_id: insertedCampaigns[0]?.id, // Diwali Sale
            product_id: insertedProducts[0]?.id, // Nexus Watch
            date: '2024-10-15',
          },
          {
            type: 'purchase',
            revenue: 2499,
            customer_id: insertedCustomers[1]?.id,
            channel_id: insertedChannels[0]?.id, // Instagram
            campaign_id: insertedCampaigns[1]?.id, // Festive Blitz
            product_id: insertedProducts[1]?.id, // Earbuds
            date: '2024-10-14',
          },
          {
            type: 'purchase',
            revenue: 1499,
            customer_id: insertedCustomers[2]?.id,
            channel_id: insertedChannels[3]?.id, // WhatsApp
            campaign_id: insertedCampaigns[2]?.id, // Monsoon Bonanza
            product_id: insertedProducts[2]?.id, // PowerBank
            date: '2024-10-13',
          },
          {
            type: 'purchase',
            revenue: 4999,
            customer_id: insertedCustomers[3]?.id,
            channel_id: insertedChannels[5]?.id, // Croma Retail Offline POS
            campaign_id: insertedCampaigns[0]?.id, // Diwali Sale
            product_id: insertedProducts[0]?.id,
            date: '2024-10-12',
          },
          {
            type: 'click',
            revenue: 0,
            customer_id: insertedCustomers[4]?.id,
            channel_id: insertedChannels[0]?.id,
            campaign_id: insertedCampaigns[1]?.id,
            product_id: insertedProducts[1]?.id,
            date: '2024-10-11',
          },
          {
            type: 'visit',
            revenue: 0,
            customer_id: insertedCustomers[5]?.id,
            channel_id: insertedChannels[4]?.id, // Bengaluru Metro
            campaign_id: insertedCampaigns[0]?.id,
            product_id: insertedProducts[3]?.id,
            date: '2024-10-10',
          },
        ]);
      }
      console.log('Seeding completed successfully!');
    }
  } catch (err) {
    console.warn('Auto-seed check complete:', err);
  }
}
