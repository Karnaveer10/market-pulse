
-- Create update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Software',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products are viewable by everyone" ON public.products FOR SELECT USING (true);
CREATE POLICY "Products can be inserted by anyone" ON public.products FOR INSERT WITH CHECK (true);
CREATE POLICY "Products can be updated by anyone" ON public.products FOR UPDATE USING (true);
CREATE POLICY "Products can be deleted by anyone" ON public.products FOR DELETE USING (true);

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Campaigns table
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  spent NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Campaigns are viewable by everyone" ON public.campaigns FOR SELECT USING (true);
CREATE POLICY "Campaigns can be inserted by anyone" ON public.campaigns FOR INSERT WITH CHECK (true);
CREATE POLICY "Campaigns can be updated by anyone" ON public.campaigns FOR UPDATE USING (true);
CREATE POLICY "Campaigns can be deleted by anyone" ON public.campaigns FOR DELETE USING (true);

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  phones TEXT[] NOT NULL DEFAULT '{}',
  joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers are viewable by everyone" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Customers can be inserted by anyone" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Customers can be updated by anyone" ON public.customers FOR UPDATE USING (true);
CREATE POLICY "Customers can be deleted by anyone" ON public.customers FOR DELETE USING (true);

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Channels table
CREATE TABLE public.channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'online' CHECK (type IN ('online', 'offline')),
  platform TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Channels are viewable by everyone" ON public.channels FOR SELECT USING (true);
CREATE POLICY "Channels can be inserted by anyone" ON public.channels FOR INSERT WITH CHECK (true);
CREATE POLICY "Channels can be updated by anyone" ON public.channels FOR UPDATE USING (true);
CREATE POLICY "Channels can be deleted by anyone" ON public.channels FOR DELETE USING (true);

CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON public.channels
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Interactions table
CREATE TABLE public.interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'click' CHECK (type IN ('click', 'purchase', 'visit')),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
  revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Interactions are viewable by everyone" ON public.interactions FOR SELECT USING (true);
CREATE POLICY "Interactions can be inserted by anyone" ON public.interactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Interactions can be updated by anyone" ON public.interactions FOR UPDATE USING (true);
CREATE POLICY "Interactions can be deleted by anyone" ON public.interactions FOR DELETE USING (true);

CREATE TRIGGER update_interactions_updated_at BEFORE UPDATE ON public.interactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
