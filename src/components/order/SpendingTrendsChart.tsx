import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  TooltipProps,
} from 'recharts';
import { Order } from '../../types';
import { 
  TrendingUp, 
  Calendar, 
  IndianRupee, 
  ShoppingBag, 
  ChevronDown, 
  ChevronUp,
  Store,
  Sparkles,
  BarChart3,
  CalendarDays
} from 'lucide-react';

interface SpendingTrendsChartProps {
  orders: Order[];
}

interface SpendingPoint {
  key: string;
  label: string;
  fullTitle: string;
  subtitle: string;
  spending: number;
  orderCount: number;
  shops: string[];
}

// Custom Tooltip for the Recharts Bar Chart
const CustomSpendingTooltip: React.FC<TooltipProps<number, string>> = ({
  active,
  payload,
}) => {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload as SpendingPoint;
    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-xl border border-slate-700/60 text-xs min-w-[180px] animate-in fade-in duration-150">
        <div className="font-bold text-slate-200 pb-1.5 border-b border-slate-800 flex items-center justify-between">
          <span>{data.fullTitle}</span>
          <span className="text-[10px] text-orange-400 font-mono font-medium">{data.subtitle}</span>
        </div>

        <div className="mt-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-medium">Total Spent:</span>
            <span className="font-black text-orange-400 text-sm">
              ₹{data.spending.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Orders placed:</span>
            <span className="font-bold text-slate-100">
              {data.orderCount} {data.orderCount === 1 ? 'order' : 'orders'}
            </span>
          </div>

          {data.shops.length > 0 && (
            <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-300 flex items-center gap-1.5 truncate">
              <Store className="w-3 h-3 text-orange-400 flex-shrink-0" />
              <span className="truncate">{data.shops.join(', ')}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export const SpendingTrendsChart: React.FC<SpendingTrendsChartProps> = ({ orders }) => {
  const [viewMode, setViewMode] = useState<'monthly' | 'daily'>('monthly');
  const [dailyRange, setDailyRange] = useState<'30' | '14' | '7'>('30');
  const [isExpanded, setIsExpanded] = useState(true);

  // 1. Monthly Aggregation Logic (Last 6 Months up to current month)
  const monthlyData = useMemo(() => {
    const result: SpendingPoint[] = [];
    const now = new Date();
    const monthsToShow = 6;

    for (let i = monthsToShow - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthNum = d.getMonth() + 1;
      const monthKey = `${year}-${String(monthNum).padStart(2, '0')}`;
      
      const shortMonth = d.toLocaleDateString('en-IN', { month: 'short' });
      const fullMonth = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

      // Filter valid non-cancelled orders for this calendar month
      const matchingOrders = orders.filter((order) => {
        if (order.orderStatus === 'CANCELLED') return false;
        try {
          const od = new Date(order.createdAt);
          return od.getFullYear() === year && od.getMonth() + 1 === monthNum;
        } catch {
          return false;
        }
      });

      const spending = matchingOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      const uniqueShops: string[] = Array.from(
        new Set(matchingOrders.map((o) => o.shopName).filter((name): name is string => Boolean(name)))
      );

      result.push({
        key: monthKey,
        label: shortMonth,
        fullTitle: fullMonth,
        subtitle: `${year}`,
        spending,
        orderCount: matchingOrders.length,
        shops: uniqueShops,
      });
    }

    const totalSpend = result.reduce((sum, p) => sum + p.spending, 0);
    const totalOrders = result.reduce((sum, p) => sum + p.orderCount, 0);
    const activeMonthsCount = result.filter((p) => p.spending > 0).length || 1;
    const avgPerMonth = Math.round(totalSpend / activeMonthsCount);

    let peakMonth: SpendingPoint | null = null;
    result.forEach((p) => {
      if (p.spending > 0 && (!peakMonth || p.spending > peakMonth.spending)) {
        peakMonth = p;
      }
    });

    return { data: result, totalSpend, totalOrders, avgPerMonth, peakMonth };
  }, [orders]);

  // 2. Daily Aggregation Logic (Last 30, 14, or 7 Days)
  const dailyData = useMemo(() => {
    const daysCount = parseInt(dailyRange, 10);
    const result: SpendingPoint[] = [];
    const now = new Date();

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      const shortDate = d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: daysCount <= 14 ? 'short' : undefined,
      });

      const fullDate = d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      const dayName = d.toLocaleDateString('en-IN', { weekday: 'short' });

      const daysOrders = orders.filter((order) => {
        if (order.orderStatus === 'CANCELLED') return false;
        try {
          const orderDate = new Date(order.createdAt);
          const oYear = orderDate.getFullYear();
          const oMonth = String(orderDate.getMonth() + 1).padStart(2, '0');
          const oDay = String(orderDate.getDate()).padStart(2, '0');
          return `${oYear}-${oMonth}-${oDay}` === dateKey;
        } catch {
          return false;
        }
      });

      const spending = daysOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      const uniqueShops: string[] = Array.from(
        new Set(daysOrders.map((o) => o.shopName).filter((name): name is string => Boolean(name)))
      );

      result.push({
        key: dateKey,
        label: shortDate,
        fullTitle: fullDate,
        subtitle: dayName,
        spending,
        orderCount: daysOrders.length,
        shops: uniqueShops,
      });
    }

    const totalSpend = result.reduce((sum, p) => sum + p.spending, 0);
    const totalOrders = result.reduce((sum, p) => sum + p.orderCount, 0);
    const avgPerOrder = totalOrders > 0 ? Math.round(totalSpend / totalOrders) : 0;

    let peakDay: SpendingPoint | null = null;
    result.forEach((p) => {
      if (p.spending > 0 && (!peakDay || p.spending > peakDay.spending)) {
        peakDay = p;
      }
    });

    return { data: result, totalSpend, totalOrders, avgPerOrder, peakDay };
  }, [orders, dailyRange]);

  const activePoints = viewMode === 'monthly' ? monthlyData.data : dailyData.data;
  const maxSpending = Math.max(...activePoints.map((d) => d.spending), 100);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-100 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20 flex-shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                Spending Trends
              </h2>
              <span className="text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-800 px-2 py-0.5 rounded-md">
                {viewMode === 'monthly' ? 'Monthly Trends' : `Last ${dailyRange} Days`}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {viewMode === 'monthly'
                ? 'Month-by-month food expenditure and orders'
                : 'Daily counter order spending breakdown'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle: Monthly vs Daily */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                viewMode === 'monthly'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>Monthly</span>
            </button>
            <button
              onClick={() => setViewMode('daily')}
              className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                viewMode === 'daily'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3 h-3" />
              <span>Daily (30D)</span>
            </button>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
            aria-label={isExpanded ? 'Collapse chart' : 'Expand chart'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Chart & Stats */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Sub-selector for Daily Mode */}
          {viewMode === 'daily' && (
            <div className="flex items-center justify-between p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
              <span className="text-[11px] text-slate-500 px-2 font-medium">Timeline Window:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDailyRange('7')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    dailyRange === '7' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
                  }`}
                >
                  7 Days
                </button>
                <button
                  onClick={() => setDailyRange('14')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    dailyRange === '14' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
                  }`}
                >
                  14 Days
                </button>
                <button
                  onClick={() => setDailyRange('30')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    dailyRange === '30' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
                  }`}
                >
                  30 Days
                </button>
              </div>
            </div>
          )}

          {/* Quick Metrics Cards */}
          {viewMode === 'monthly' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Total (6 Mo)
                </span>
                <div className="flex items-baseline gap-0.5 mt-0.5">
                  <span className="text-base sm:text-lg font-black text-slate-900">
                    ₹{monthlyData.totalSpend.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Avg. / Month
                </span>
                <div className="flex items-baseline gap-0.5 mt-0.5">
                  <span className="text-base sm:text-lg font-black text-slate-900">
                    ₹{monthlyData.avgPerMonth.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Total Orders
                </span>
                <div className="flex items-baseline gap-0.5 mt-0.5">
                  <span className="text-base sm:text-lg font-black text-slate-900">
                    {monthlyData.totalOrders}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">orders</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Peak Month
                </span>
                <div className="flex items-baseline gap-1 mt-0.5 truncate">
                  <span className="text-base sm:text-lg font-black text-slate-900 truncate">
                    {monthlyData.peakMonth ? `₹${monthlyData.peakMonth.spending}` : '₹0'}
                  </span>
                  {monthlyData.peakMonth && (
                    <span className="text-[10px] text-orange-600 font-bold truncate">
                      {monthlyData.peakMonth.label}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Total Spend
                </span>
                <div className="flex items-baseline gap-0.5 mt-0.5">
                  <span className="text-base sm:text-lg font-black text-slate-900">
                    ₹{dailyData.totalSpend.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Total Orders
                </span>
                <div className="flex items-baseline gap-0.5 mt-0.5">
                  <span className="text-base sm:text-lg font-black text-slate-900">
                    {dailyData.totalOrders}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">orders</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Avg. Ticket
                </span>
                <div className="flex items-baseline gap-0.5 mt-0.5">
                  <span className="text-base sm:text-lg font-black text-slate-900">
                    ₹{dailyData.avgPerOrder}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">/ order</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Highest Day
                </span>
                <div className="flex items-baseline gap-1 mt-0.5 truncate">
                  <span className="text-base sm:text-lg font-black text-slate-900 truncate">
                    {dailyData.peakDay ? `₹${dailyData.peakDay.spending}` : '₹0'}
                  </span>
                  {dailyData.peakDay && (
                    <span className="text-[10px] text-orange-600 font-bold truncate">
                      {dailyData.peakDay.label}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Recharts Bar Chart Container */}
          <div className="pt-2">
            <div className="w-full h-52 sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={activePoints}
                  margin={{ top: 10, right: 8, left: -22, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="spendingBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EA580C" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#F97316" stopOpacity={0.8} />
                    </linearGradient>
                    <linearGradient id="emptyBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E2E8F0" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#CBD5E1" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#F1F5F9"
                  />

                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tick={{ fill: '#64748B', fontSize: 10, fontWeight: 600 }}
                    interval={viewMode === 'monthly' ? 0 : dailyRange === '30' ? 4 : dailyRange === '14' ? 1 : 0}
                  />

                  <YAxis
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tick={{ fill: '#64748B', fontSize: 10, fontWeight: 600 }}
                    tickFormatter={(val) => `₹${val}`}
                    domain={[0, Math.max(maxSpending * 1.15, 100)]}
                  />

                  <Tooltip
                    content={<CustomSpendingTooltip />}
                    cursor={{ fill: 'rgba(234, 88, 12, 0.06)' }}
                  />

                  <Bar
                    dataKey="spending"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={viewMode === 'monthly' ? 38 : dailyRange === '7' ? 32 : dailyRange === '14' ? 22 : 12}
                  >
                    {activePoints.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.spending > 0 ? 'url(#spendingBarGrad)' : 'url(#emptyBarGrad)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium px-2 pt-2 border-t border-slate-100">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-orange-600 inline-block" />
                <span>
                  {viewMode === 'monthly' ? 'Monthly spending records' : 'Days with food orders'}
                </span>
              </span>
              <span>Click or hover on bars to inspect details</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
