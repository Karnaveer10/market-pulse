import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ShoppingBag, CheckCircle2, ArrowRight, Sparkles, Tag, Users,
  MousePointerClick, CreditCard, ChevronRight, Activity, Eye, ShieldCheck,
  Star, Truck, ShieldAlert, Award, Headphones, ArrowLeft, Heart, Search,
  Menu, X, ExternalLink, Lock, UserCheck, UserPlus, LogOut, Phone, Mail, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProducts, type Product } from '@/hooks/use-products';
import { useCampaigns } from '@/hooks/use-campaigns';
import { useChannels } from '@/hooks/use-channels';
import { useCustomers, type Customer } from '@/hooks/use-customers';
import { dispatchTelemetryEvent } from '@/lib/telemetry-service';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import XRayTraceModal from '@/components/XRayTraceModal';

interface CurrentUser {
  id?: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  isGuest?: boolean;
}

export default function StorefrontPage() {
  const queryClient = useQueryClient();
  const { data: dbProducts = [] } = useProducts();
  const { data: campaigns = [] } = useCampaigns();
  const { data: channels = [] } = useChannels();
  const { data: customers = [] } = useCustomers();

  // ONLY Online Channels Allowed for the E-Commerce Website
  const onlineChannels = channels.filter(c => c.type === 'online');

  // Active Login/Session State
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [regForm, setRegForm] = useState({
    name: '',
    email: '',
    phone: '',
    location: 'Bengaluru, Karnataka',
  });

  // Check localStorage for existing logged-in user on mount
  useEffect(() => {
    const saved = localStorage.getItem('voltstore_user');
    if (saved) {
      try {
        setCurrentUser(JSON.parse(saved));
      } catch (_) {}
    } else {
      // Default to opening login/welcome modal on first arrival
      setLoginModalOpen(true);
    }
  }, []);

  // Products catalog
  const defaultProducts: Product[] = [
    {
      id: 'prod-watch-1',
      name: 'Nexus Smart Watch Pro (AMOLED Bluetooth Calling)',
      category: 'Electronics',
      price: 4999,
      status: 'active',
      created_at: new Date().toISOString(),
    },
    {
      id: 'prod-buds-2',
      name: 'AeroNoise ANC Earbuds (50dB Hybrid Noise Canceling)',
      category: 'Audio',
      price: 2499,
      status: 'active',
      created_at: new Date().toISOString(),
    },
    {
      id: 'prod-power-3',
      name: 'Kavach Ultra 20,000mAh PowerBank (65W Fast Charge)',
      category: 'Accessories',
      price: 1499,
      status: 'active',
      created_at: new Date().toISOString(),
    },
    {
      id: 'prod-charger-4',
      name: 'VoltFast GaN 65W Multi-Port Travel Adapter',
      category: 'Accessories',
      price: 1899,
      status: 'active',
      created_at: new Date().toISOString(),
    },
    {
      id: 'prod-key-5',
      name: 'GamerX MechStrike RGB Hot-Swappable Keyboard',
      category: 'Gaming',
      price: 3499,
      status: 'active',
      created_at: new Date().toISOString(),
    },
    {
      id: 'prod-cam-6',
      name: 'EyeSafe 2K Ultra HD Smart Home WiFi Camera',
      category: 'Smart Home',
      price: 2199,
      status: 'active',
      created_at: new Date().toISOString(),
    },
  ];

  const products = dbProducts.length > 0 ? dbProducts : defaultProducts;

  // Selected Marketing Campaign Attribution Context
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');

  // Cart & Modals
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [xrayModalOpen, setXrayModalOpen] = useState(false);
  const [lastActionToast, setLastActionToast] = useState<string>('');

  const activeCampaign = campaigns.find(c => c.id === selectedCampaignId) || {
    id: 'camp-diwali',
    name: 'Diwali Mega Dhamaka Sale',
  };

  // Only select from Online Channels
  const activeChannel = onlineChannels.find(c => c.id === selectedChannelId) || onlineChannels[0] || {
    id: 'chan-insta',
    name: 'Instagram Sponsored Ads',
    platform: 'Instagram',
  };

  const showNotification = (msg: string) => {
    setLastActionToast(msg);
    setTimeout(() => setLastActionToast(''), 4500);
  };

  // Simple Password Verification ("123") & Customer Resolution
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername) return;

    // Check simple password rule: "123" or any 123 variant
    if (loginPassword !== '123' && loginPassword !== '') {
      showNotification('💡 Hint: Enter password "123" to login as customer');
      return;
    }

    // Check if customer already exists in database
    const matchedCustomer = customers.find(c =>
      c.name.toLowerCase().includes(loginUsername.toLowerCase()) ||
      c.email.toLowerCase().includes(loginUsername.toLowerCase())
    );

    if (matchedCustomer) {
      const userObj: CurrentUser = {
        id: matchedCustomer.id,
        name: matchedCustomer.name,
        email: matchedCustomer.email,
        phone: matchedCustomer.phones?.[0] || '+91 98765 43210',
        location: matchedCustomer.location || 'Bengaluru, Karnataka',
      };
      setCurrentUser(userObj);
      localStorage.setItem('voltstore_user', JSON.stringify(userObj));
      setLoginModalOpen(false);
      showNotification(`Welcome back, ${matchedCustomer.name}! Existing Customer session loaded.`);
    } else {
      // Not existing customer -> prompt for their info
      setIsRegistering(true);
      setRegForm({
        name: loginUsername,
        email: `${loginUsername.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
        phone: '+91 98765 43210',
        location: 'Bengaluru, Karnataka',
      });
    }
  };

  // Register New Customer info in Supabase
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.name || !regForm.email) return;

    let createdId: string | undefined;
    try {
      const { data: newCust } = await supabase.from('customers').insert({
        name: regForm.name,
        email: regForm.email,
        phones: [regForm.phone],
        location: regForm.location,
      }).select().single();

      createdId = newCust?.id;
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (_) {}

    const userObj: CurrentUser = {
      id: createdId,
      name: regForm.name,
      email: regForm.email,
      phone: regForm.phone,
      location: regForm.location,
    };
    setCurrentUser(userObj);
    localStorage.setItem('voltstore_user', JSON.stringify(userObj));
    setIsRegistering(false);
    setLoginModalOpen(false);
    showNotification(`Welcome, ${regForm.name}! New customer registered in database.`);
  };

  const handleLogout = () => {
    localStorage.removeItem('voltstore_user');
    setCurrentUser(null);
    setLoginModalOpen(true);
    showNotification('Logged out from VoltStore India');
  };

  // 1. Interaction: Product Visit (Stores Customer ID in interactions table)
  const handleProductView = async (product: Product) => {
    setQuickViewProduct(product);

    await dispatchTelemetryEvent({
      type: 'visit',
      product_id: product.id,
      product_name: product.name,
      customer_name: currentUser?.name || 'Aarav Sharma',
      campaign_id: activeCampaign.id,
      campaign_name: activeCampaign.name,
      channel_id: activeChannel.id,
      channel_name: activeChannel.name,
    });

    try {
      await supabase.from('interactions').insert({
        type: 'visit',
        revenue: 0,
        product_id: product.id,
        customer_id: currentUser?.id || null,
        campaign_id: activeCampaign.id.startsWith('camp-') ? null : activeCampaign.id,
        channel_id: activeChannel.id.startsWith('chan-') ? null : activeChannel.id,
        date: new Date().toISOString().split('T')[0],
      });
      queryClient.invalidateQueries({ queryKey: ['interactions'] });
    } catch (_) {}

    showNotification(`⚡ Telemetry: "Visit" on ${product.name.slice(0, 25)} by ${currentUser?.name || 'Customer'}`);
  };

  // 2. Interaction: Ad Click (Stores Customer ID & CPC cost)
  const handleAdBannerClick = async () => {
    await dispatchTelemetryEvent({
      type: 'click',
      customer_name: currentUser?.name || 'Aarav Sharma',
      campaign_id: activeCampaign.id,
      campaign_name: activeCampaign.name,
      channel_id: activeChannel.id,
      channel_name: activeChannel.name,
      cost: 15, // ₹15 CPC
    });

    try {
      await supabase.from('interactions').insert({
        type: 'click',
        revenue: 0,
        customer_id: currentUser?.id || null,
        campaign_id: activeCampaign.id.startsWith('camp-') ? null : activeCampaign.id,
        channel_id: activeChannel.id.startsWith('chan-') ? null : activeChannel.id,
        date: new Date().toISOString().split('T')[0],
      });
      queryClient.invalidateQueries({ queryKey: ['interactions'] });
    } catch (_) {}

    showNotification(`⚡ Telemetry: "Click" registered via ${activeChannel.name} (Budget -₹15)`);
  };

  // 3. Interaction: Add to Cart
  const handleAddToCart = async (product: Product, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
    setCartDrawerOpen(true);

    await dispatchTelemetryEvent({
      type: 'cart_add',
      product_id: product.id,
      product_name: product.name,
      customer_name: currentUser?.name || 'Customer',
      campaign_id: activeCampaign.id,
      channel_id: activeChannel.id,
      revenue: product.price,
    });

    showNotification(`🛒 Cart: Added "${product.name.slice(0, 22)}..." (₹${product.price})`);
  };

  // 4. Interaction: Checkout & Purchase (Stores Customer ID, Revenue, Channel, Campaign)
  const handleCompleteCheckout = async () => {
    if (cart.length === 0) return;
    const totalOrderRevenue = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const primaryProduct = cart[0].product;

    try {
      await supabase.from('interactions').insert({
        type: 'purchase',
        revenue: totalOrderRevenue,
        product_id: primaryProduct.id,
        customer_id: currentUser?.id || null,
        campaign_id: activeCampaign.id.startsWith('camp-') ? null : activeCampaign.id,
        channel_id: activeChannel.id.startsWith('chan-') ? null : activeChannel.id,
        date: new Date().toISOString().split('T')[0],
      });
      queryClient.invalidateQueries({ queryKey: ['interactions'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    } catch (_) {}

    await dispatchTelemetryEvent({
      type: 'purchase',
      product_id: primaryProduct.id,
      product_name: primaryProduct.name,
      customer_name: currentUser?.name || 'Aarav Sharma',
      campaign_id: activeCampaign.id,
      campaign_name: activeCampaign.name,
      channel_id: activeChannel.id,
      channel_name: activeChannel.name,
      revenue: totalOrderRevenue,
    });

    setCart([]);
    setCheckoutModalOpen(false);
    setCartDrawerOpen(false);
    showNotification(`🎉 Order Successful for ${currentUser?.name || 'Customer'}! +₹${totalOrderRevenue.toLocaleString('en-IN')} Saved in Interactions Table.`);
  };

  const totalCartValue = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* 1. TOP AWS TELEMETRY EVALUATOR CONTROLS BAR */}
      <div className="bg-slate-900 border-b border-emerald-500/30 px-4 py-2.5 sticky top-0 z-50 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-medium border border-slate-700"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to MarketPulse Admin
          </Link>

          {/* Current Customer Badge */}
          {currentUser ? (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-emerald-400">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Customer: <strong className="text-white">{currentUser.name}</strong></span>
              <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 ml-1">
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => setLoginModalOpen(true)}
              className="h-6 text-[11px] gap-1 bg-emerald-500 text-black hover:bg-emerald-400 font-bold"
            >
              <Lock className="w-3 h-3" /> Sign In (PW: 123)
            </Button>
          )}
        </div>

        {/* Campaign & ONLINE-ONLY Channel Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
            <Tag className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Campaign:</span>
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="bg-transparent text-slate-200 outline-none font-semibold cursor-pointer max-w-[160px] truncate"
            >
              <option value="" className="bg-slate-900">Diwali Mega Dhamaka Sale</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
              ))}
            </select>
          </div>

          {/* ONLINE CHANNELS ONLY */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400">Online Channel:</span>
            <select
              value={selectedChannelId || activeChannel.id}
              onChange={(e) => setSelectedChannelId(e.target.value)}
              className="bg-transparent text-slate-200 outline-none font-semibold cursor-pointer max-w-[170px] truncate"
            >
              {onlineChannels.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
              ))}
            </select>
          </div>

          <Button
            size="sm"
            onClick={() => setXrayModalOpen(true)}
            className="h-7 text-xs gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20"
          >
            <Activity className="w-3.5 h-3.5 animate-pulse" /> AWS X-Ray Traces
          </Button>
        </div>
      </div>

      {/* Floating Action Notification */}
      <AnimatePresence>
        {lastActionToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 right-4 z-50 bg-emerald-950 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-xl shadow-2xl text-xs flex items-center gap-3 backdrop-blur-md"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{lastActionToast}</span>
            <button
              onClick={() => setXrayModalOpen(true)}
              className="underline text-emerald-400 hover:text-emerald-200 font-semibold text-[11px] ml-2"
            >
              X-Ray Trace &rarr;
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. REALISTIC INDIAN E-COMMERCE NAVBAR (VoltStore India) */}
      <header className="bg-slate-900/90 border-b border-slate-800 sticky top-10 z-40 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sparkles className="w-5 h-5 text-black font-bold" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-emerald-400 bg-clip-text text-transparent">
                VoltStore India
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Official Store
              </span>
            </div>
          </div>

          {/* Search bar simulation */}
          <div className="hidden md:flex flex-1 max-w-md items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-full px-4 py-2 text-xs">
            <Search className="w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search Smartwatches, ANC Earbuds, PowerBanks..."
              className="bg-transparent border-none outline-none w-full text-slate-200 placeholder:text-slate-500"
            />
          </div>

          {/* User & Bag Actions */}
          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300">
                <span>Namaste, <strong>{currentUser.name.split(' ')[0]}</strong></span>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLoginModalOpen(true)}
                className="text-xs text-slate-300 hover:text-white"
              >
                Sign In
              </Button>
            )}

            <Button
              size="sm"
              onClick={() => setCartDrawerOpen(true)}
              className="relative gap-2 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold rounded-xl"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Bag</span>
              {totalCartCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-black text-emerald-400 text-[10px] font-bold flex items-center justify-center">
                  {totalCartCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* 3. HERO FESTIVE BANNER */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 py-12 px-4 sm:px-6 lg:px-8 border-b border-slate-800/80">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.15),rgba(255,255,255,0))]" />
        <div className="max-w-7xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Sparkles className="w-3.5 h-3.5" /> {activeCampaign.name} • Live Online Offer
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
              India's Premier Direct-to-Consumer Audio & Smart Gear.
            </h1>
            <p className="text-sm sm:text-base text-slate-400 max-w-xl">
              Attributed via <strong className="text-emerald-400">{activeChannel.name}</strong>. Purchases and clicks automatically sync to the unified PostgreSQL database and trigger AWS SNS alerts.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                onClick={handleAdBannerClick}
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold px-6 py-2.5 rounded-xl gap-2 shadow-lg shadow-emerald-500/25"
              >
                <MousePointerClick className="w-4 h-4" /> Claim Festive Discount (Simulate Online Ad Click)
              </Button>
              {!currentUser && (
                <Button
                  variant="outline"
                  onClick={() => setLoginModalOpen(true)}
                  className="border-slate-700 hover:bg-slate-800 text-slate-200 rounded-xl"
                >
                  Customer Sign In
                </Button>
              )}
            </div>

            {/* Trust Badges */}
            <div className="pt-6 grid grid-cols-3 gap-4 border-t border-slate-800 text-slate-400 text-xs">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-400" />
                <span>Pan-India Free Express</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>1-Year Domestic Warranty</span>
              </div>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-400" />
                <span>Top Rated 4.9/5</span>
              </div>
            </div>
          </div>

          {/* Hero Featured Card */}
          <div className="lg:col-span-5">
            <motion.div
              whileHover={{ y: -4 }}
              className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/80 rounded-3xl p-6 shadow-2xl relative"
            >
              <div className="absolute top-4 right-4 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                BESTSELLER
              </div>
              <div className="w-full h-48 bg-slate-950/60 rounded-2xl flex items-center justify-center mb-6 border border-slate-800">
                <Headphones className="w-20 h-20 text-emerald-400 animate-pulse" />
              </div>
              <h3 className="text-xl font-bold text-white mb-1">AeroNoise ANC Earbuds Pro</h3>
              <p className="text-xs text-slate-400 mb-4">50dB Hybrid Noise Cancellation • 40Hr Battery • Made in India</p>
              <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                <div>
                  <span className="text-2xl font-black text-emerald-400 font-mono">₹2,499</span>
                  <span className="text-xs text-slate-500 line-through ml-2">₹5,999</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAddToCart(products[1] || products[0])}
                  className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold rounded-xl"
                >
                  Add to Cart
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 4. PRODUCTS CATALOG SECTION */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 w-full space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Trending Indian Tech Catalog</h2>
            <p className="text-xs text-slate-400">Click any product to fire real-time telemetry attributed to {currentUser?.name || 'Customer'}</p>
          </div>
          <div className="text-xs font-mono text-emerald-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Channel: {activeChannel.name}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <motion.div
              key={product.id}
              whileHover={{ y: -4 }}
              onClick={() => handleProductView(product)}
              className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-5 flex flex-col justify-between transition cursor-pointer shadow-lg group relative overflow-hidden"
            >
              <div className="space-y-3">
                <div className="w-full h-40 bg-slate-950 rounded-xl flex items-center justify-center border border-slate-800/80 group-hover:scale-105 transition-transform duration-300">
                  <Sparkles className="w-10 h-10 text-emerald-400/60" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {product.category}
                  </span>
                  <div className="flex items-center text-amber-400 text-xs">
                    <Star className="w-3 h-3 fill-current mr-1" /> 4.9 (1.2k)
                  </div>
                </div>
                <h3 className="font-bold text-base text-white group-hover:text-emerald-400 transition">
                  {product.name}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-2">
                  Engineered with premium aerospace-grade components and backed by 1-year pan-India replacement support.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800/80 mt-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-black text-emerald-400 font-mono">
                    ₹{product.price.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-slate-500">Inclusive of all Indian GST</div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleProductView(product); }}
                    className="h-8 text-xs border-slate-700 hover:bg-slate-800"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" /> View
                  </Button>
                  <Button
                    size="sm"
                    onClick={(e) => handleAddToCart(product, e)}
                    className="h-8 text-xs bg-emerald-500 hover:bg-emerald-600 text-black font-semibold rounded-lg"
                  >
                    Add
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      {/* 5. SHOPPING CART DRAWER */}
      <AnimatePresence>
        {cartDrawerOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full p-6 flex flex-col justify-between shadow-2xl"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-lg font-bold text-white">Your Shopping Bag ({totalCartCount})</h3>
                  </div>
                  <button onClick={() => setCartDrawerOpen(false)} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {cart.length === 0 ? (
                  <div className="py-20 text-center text-sm text-slate-400">
                    Your bag is empty.<br />Add a smartwatch or earbuds to test checkout!
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto divide-y divide-slate-800 pr-1">
                    {cart.map((item, idx) => (
                      <div key={idx} className="pt-3 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-semibold text-white">{item.product.name}</div>
                          <div className="text-slate-400">Qty: {item.quantity} × ₹{item.product.price}</div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-emerald-400">
                            ₹{(item.product.price * item.quantity).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-slate-800">
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Subtotal</span>
                      <span className="font-mono text-white">₹{totalCartValue.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Customer</span>
                      <span className="font-semibold text-emerald-400">{currentUser?.name || 'Aarav Sharma'}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Delivery Across India</span>
                      <span className="text-emerald-400 font-semibold uppercase text-[10px]">FREE</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-slate-800">
                      <span>Total Amount:</span>
                      <span className="text-emerald-400 font-mono">₹{totalCartValue.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => { setCartDrawerOpen(false); setCheckoutModalOpen(true); }}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-2.5 rounded-xl gap-2 shadow-lg shadow-emerald-500/25"
                  >
                    Proceed to 1-Click Checkout <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. INDIAN PERSONA CHECKOUT MODAL */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Complete Order (UPI / NetBanking / COD)</h3>
              </div>
              <button onClick={() => setCheckoutModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {/* Indian Customer Address from Session */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 text-xs">
              <div className="font-semibold text-white flex items-center justify-between">
                <span>Shipping to: {currentUser?.name || 'Aarav Sharma'}</span>
                <span className="text-emerald-400 text-[10px] font-mono">Verified Customer</span>
              </div>
              <div className="text-slate-400">{currentUser?.location || 'Indiranagar, Bengaluru, Karnataka'}</div>
              <div className="text-slate-400">Contact: {currentUser?.phone || '+91 98765 43210'} • {currentUser?.email || 'aarav@gmail.com'}</div>
            </div>

            {/* Attribution Breakdown for Evaluators */}
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-[11px] space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Attributed Customer ID:</span>
                <span className="font-mono text-emerald-400">{currentUser?.id ? `${currentUser.id.slice(0, 18)}...` : 'Linked on commit'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Attributed Campaign:</span>
                <span className="font-semibold text-amber-400">{activeCampaign.name}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Attributed Online Channel:</span>
                <span className="font-semibold text-blue-400">{activeChannel.name}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div>
                <span className="text-xs text-slate-400">Grand Total:</span>
                <div className="text-xl font-black text-emerald-400 font-mono">
                  ₹{totalCartValue.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCheckoutModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCompleteCheckout}
                  className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold gap-2"
                >
                  <ShieldCheck className="w-4 h-4" /> Place Order & Fire Telemetry
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* 7. CUSTOMER LOGIN & REGISTRATION MODAL (Password: "123") */}
      {loginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  {isRegistering ? 'Register as New Customer' : 'Customer Sign In'}
                </h3>
              </div>
              <button onClick={() => setLoginModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {!isRegistering ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <p className="text-xs text-slate-400">
                  Enter an existing Indian customer name (e.g. <strong>Aarav Sharma</strong> or <strong>Ananya Deshmukh</strong>) with password <strong>123</strong>. If not found, you can enter new details.
                </p>

                <div>
                  <label className="text-xs font-medium text-slate-300">Customer Name / Email</label>
                  <Input
                    required
                    placeholder="e.g. Aarav Sharma"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white mt-1"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-slate-300">Password</label>
                    <span className="text-[10px] text-emerald-400 font-mono">Use "123"</span>
                  </div>
                  <Input
                    type="password"
                    placeholder="123"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white mt-1"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => { setIsRegistering(true); setRegForm({ ...regForm, name: loginUsername }); }}
                    className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> New customer? Register here
                  </button>

                  <Button type="submit" size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold">
                    Sign In
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <p className="text-xs text-slate-400">
                  Provide customer details to save in the central database and track all interactions.
                </p>

                <div>
                  <label className="text-xs font-medium text-slate-300">Full Name</label>
                  <Input
                    required
                    placeholder="e.g. Vikram Malhotra"
                    value={regForm.name}
                    onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-white mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300">Email Address</label>
                  <Input
                    required
                    type="email"
                    placeholder="vikram@example.com"
                    value={regForm.email}
                    onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-white mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300">Phone Number</label>
                  <Input
                    required
                    placeholder="+91 98765 43210"
                    value={regForm.phone}
                    onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-white mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300">City / Location</label>
                  <Input
                    placeholder="Bengaluru, Karnataka"
                    value={regForm.location}
                    onChange={(e) => setRegForm({ ...regForm, location: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-white mt-1"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setIsRegistering(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    &larr; Back to Sign In
                  </button>

                  <Button type="submit" size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold">
                    Save Profile & Continue
                  </Button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}

      {/* 8. PRODUCT QUICK VIEW MODAL */}
      {quickViewProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                {quickViewProduct.category}
              </span>
              <button onClick={() => setQuickViewProduct(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="w-full h-44 bg-slate-950 rounded-2xl flex items-center justify-center border border-slate-800">
              <Sparkles className="w-12 h-12 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white">{quickViewProduct.name}</h3>
            <p className="text-xs text-slate-400">
              Equipped with high-precision sensors, IP68 water resistance, and fast-charge technology.
            </p>
            <div className="p-3 bg-slate-950 rounded-xl text-[11px] text-slate-400 flex items-center justify-between">
              <span>Customer: {currentUser?.name || 'Aarav Sharma'}</span>
              <span className="font-mono text-emerald-400">Event "visit" recorded</span>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-2xl font-black text-emerald-400 font-mono">
                ₹{quickViewProduct.price.toLocaleString('en-IN')}
              </span>
              <Button
                onClick={() => { handleAddToCart(quickViewProduct); setQuickViewProduct(null); }}
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold"
              >
                Add to Cart
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 9. REALISTIC INDIAN FOOTER */}
      <footer className="bg-slate-950 border-t border-slate-800 py-10 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            © 2026 VoltStore India Private Limited. All rights reserved. Registered Office: Bengaluru, Karnataka.
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>BIS Certified</span>
            <Link to="/" className="text-emerald-400 hover:underline">
              Return to MarketPulse Admin
            </Link>
          </div>
        </div>
      </footer>

      {/* X-Ray Distributed Trace Modal */}
      <XRayTraceModal isOpen={xrayModalOpen} onClose={() => setXrayModalOpen(false)} />
    </div>
  );
}
