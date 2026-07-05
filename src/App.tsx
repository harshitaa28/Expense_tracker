import React, { useState, useEffect } from "react";
import { GoogleGenAI, Type } from "@google/genai";
import {
  Sparkles,
  Plus,
  Trash2,
  Calendar,
  RefreshCw,
  TrendingUp,
  Wallet,
  PieChart as ChartIcon,
  Search,
  Filter,
  Info
} from "lucide-react";

// Read API Key from environment or fallback placeholder
const GEMINI_API_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY || "PASTE_YOUR_API_KEY_HERE";

// Initialize the Google GenAI SDK
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string; // ISO String
}

const CATEGORIES = ["Food", "Transport", "Shopping", "Bills", "Entertainment", "Miscellaneous"];

const EXAMPLE_PROMPTS = [
  "spent 450 rupees on dinner with friends",
  "paid 2500 for the electricity bill yesterday",
  "bought grocery items for 1200 rupees",
  "auto rickshaw ride cost 120 rupees"
];

export default function App() {
  // Local storage synchronization
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try {
      const saved = localStorage.getItem("expenses");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Local storage retrieval failed:", e);
      return [];
    }
  });

  // Smart & manual input state
  const [smartInput, setSmartInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const [manualDesc, setManualDesc] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualCategory, setManualCategory] = useState("Food");
  const [manualDate, setManualDate] = useState(() => {
    return new Date().toISOString().substring(0, 10);
  });

  // UI interaction state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "amount-high" | "amount-low">("newest");
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // Sync state with browser local storage on updates
  useEffect(() => {
    localStorage.setItem("expenses", JSON.stringify(expenses));
  }, [expenses]);

  // Financial calculations
  const totalExpenditure = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const averageSpend = expenses.length > 0 ? totalExpenditure / expenses.length : 0;

  const categoryTotals = expenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>);

  // Retrieve 7-day rolling statistics
  const getWeeklyData = () => {
    const now = new Date();
    const startOfWeek = new Date();
    startOfWeek.setDate(now.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const weeklyList = expenses.filter((exp) => {
      const expDate = new Date(exp.date);
      return expDate >= startOfWeek && expDate <= now;
    });

    const weeklyTotal = weeklyList.reduce((sum, exp) => sum + exp.amount, 0);
    const weeklyCatTotals = weeklyList.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
      return acc;
    }, {} as Record<string, number>);

    return { weeklyList, weeklyTotal, weeklyCatTotals };
  };

  const { weeklyList, weeklyTotal, weeklyCatTotals } = getWeeklyData();

  // Natural language transaction parsing
  const handleSmartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smartInput.trim()) return;

    if (GEMINI_API_KEY === "PASTE_YOUR_API_KEY_HERE") {
      alert(
        "Active API Key Required.\n\nPlease define VITE_GEMINI_API_KEY in your hosting environment variables or paste your API key at the top of App.tsx."
      );
      return;
    }

    setIsProcessing(true);
    try {
      const promptText = `
        Parse this natural language input string representing a purchase or transaction:
        "${smartInput}"

        Extract:
        1. "description": A short, clean capitalized item name.
        2. "amount": A positive floating-point number representing the exact value.
        3. "category": Pick the single best match from: 'Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Miscellaneous'.

        Return ONLY a raw JSON object:
        {
          "description": string,
          "amount": number,
          "category": "Food" | "Transport" | "Shopping" | "Bills" | "Entertainment" | "Miscellaneous"
        }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: promptText,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              category: {
                type: Type.STRING,
                enum: CATEGORIES,
              },
            },
            required: ["description", "amount", "category"],
          },
        },
      });

      const responseText = response.text;
      if (!responseText) throw new Error("Empty response returned from the model.");

      const parsedData = JSON.parse(responseText.trim());
      const verifiedCategory = CATEGORIES.includes(parsedData.category)
        ? parsedData.category
        : "Miscellaneous";

      const newExpense: Expense = {
        id: Date.now().toString(),
        description: parsedData.description,
        amount: Math.abs(parsedData.amount),
        category: verifiedCategory,
        date: new Date().toISOString(),
      };

      setExpenses((prev) => [newExpense, ...prev]);
      setSmartInput("");
    } catch (err: any) {
      console.error("NLP extraction failed:", err);
      alert("Unable to interpret text. Please enter the details manually below.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Direct manual log entry
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!manualDesc.trim()) {
      alert("Please specify a description.");
      return;
    }

    const parsedNum = parseFloat(manualAmount);
    if (isNaN(parsedNum) || parsedNum <= 0) {
      alert("Please specify a positive numeric value.");
      return;
    }

    const newExpense: Expense = {
      id: Date.now().toString(),
      description: manualDesc.trim(),
      amount: parsedNum,
      category: manualCategory,
      date: manualDate ? new Date(manualDate).toISOString() : new Date().toISOString(),
    };

    setExpenses((prev) => [newExpense, ...prev]);

    setManualDesc("");
    setManualAmount("");
    setManualCategory("Food");
    setManualDate(new Date().toISOString().substring(0, 10));
  };

  const deleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((exp) => exp.id !== id));
  };

  const handleResetAll = () => {
    const isConfirmed = window.confirm(
      "Are you sure you want to clear your local database? This action is permanent."
    );
    if (isConfirmed) {
      setExpenses([]);
      localStorage.removeItem("expenses");
    }
  };

  const handlePresetSelect = (preset: string) => {
    setSmartInput(preset);
  };

  // Filters & Sorting logic
  const filteredAndSortedExpenses = expenses
    .filter((exp) => {
      const matchesSearch = exp.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategoryFilter === "All" || exp.category === selectedCategoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      if (sortBy === "amount-high") {
        return b.amount - a.amount;
      }
      if (sortBy === "amount-low") {
        return a.amount - b.amount;
      }
      return 0;
    });

  // UI styling helpers
  const getCategoryStyles = (category: string) => {
    switch (category) {
      case "Food":
        return {
          bg: "bg-emerald-50 border-emerald-100 text-emerald-800",
          indicator: "bg-emerald-500",
          accentText: "text-emerald-700",
          hex: "#10b981"
        };
      case "Transport":
        return {
          bg: "bg-sky-50 border-sky-100 text-sky-800",
          indicator: "bg-sky-500",
          accentText: "text-sky-700",
          hex: "#0ea5e9"
        };
      case "Shopping":
        return {
          bg: "bg-purple-50 border-purple-100 text-purple-800",
          indicator: "bg-purple-500",
          accentText: "text-purple-700",
          hex: "#a855f7"
        };
      case "Bills":
        return {
          bg: "bg-rose-50 border-rose-100 text-rose-800",
          indicator: "bg-rose-500",
          accentText: "text-rose-700",
          hex: "#f43f5e"
        };
      case "Entertainment":
        return {
          bg: "bg-amber-50 border-amber-100 text-amber-800",
          indicator: "bg-amber-500",
          accentText: "text-amber-700",
          hex: "#f59e0b"
        };
      default:
        return {
          bg: "bg-slate-50 border-slate-200 text-slate-800",
          indicator: "bg-slate-500",
          accentText: "text-slate-600",
          hex: "#64748b"
        };
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(val);
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return isoString;
    }
  };

  // SVG Weekly Donut chart generator
  const renderWeeklyDonut = () => {
    const radius = 35;
    const circumference = 2 * Math.PI * radius;
    let accumulatedPercentage = 0;

    const activeWeeklyShares = CATEGORIES.map((cat) => {
      const totalAmount = weeklyCatTotals[cat] || 0;
      return {
        category: cat,
        amount: totalAmount,
        percentage: weeklyTotal > 0 ? (totalAmount / weeklyTotal) * 100 : 0
      };
    }).filter((item) => item.amount > 0);

    if (activeWeeklyShares.length === 0) {
      return (
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="transparent"
          stroke="#f1f5f9"
          strokeWidth="10"
        />
      );
    }

    return activeWeeklyShares.map((item) => {
      const styles = getCategoryStyles(item.category);
      const strokeDashoffset = circumference - (circumference * item.percentage) / 100;
      const strokeDasharray = `${circumference} ${circumference}`;
      const rotation = (accumulatedPercentage * 360) / 100;
      accumulatedPercentage += item.percentage;

      const isHovered = hoveredCategory === item.category;

      return (
        <circle
          key={item.category}
          cx="50"
          cy="50"
          r={radius}
          fill="transparent"
          stroke={styles.hex}
          strokeWidth={isHovered ? "12" : "10"}
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(${rotation - 90} 50 50)`}
          className="transition-all duration-300 cursor-pointer origin-center"
          onMouseEnter={() => setHoveredCategory(item.category)}
          onMouseLeave={() => setHoveredCategory(null)}
        />
      );
    });
  };

  return (
    <div id="app-root" className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-16">
      
      {/* HEADER SECTION */}
      <header className="bg-white border-b border-slate-200 py-5 px-4 md:px-8 sticky top-0 z-10 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-sm">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h1 id="app-title" className="text-lg font-bold tracking-tight text-slate-900">SmartSpend</h1>
              <p className="text-xs text-slate-500">Natural language personal ledger & analytics</p>
            </div>
          </div>

          <button
            onClick={handleResetAll}
            disabled={expenses.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-100 rounded-lg transition-all duration-150 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-600 disabled:hover:border-slate-200 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Data
          </button>

        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 mt-8">
        
        {/* SUMMARY DASHBOARD BANNER */}
        <section id="hero-summary-card" className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-xs mb-8 relative overflow-hidden">
          <div className="absolute right-0 top-0 -mt-10 -mr-10 w-44 h-44 bg-indigo-50 rounded-full blur-2xl opacity-60"></div>
          
          <div className="relative z-1 grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
            
            <div className="md:col-span-2 border-b md:border-b-0 md:border-r border-slate-100 pb-5 md:pb-0 pr-6">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Total Expenses Logged</span>
              <div className="flex items-baseline gap-2">
                <span id="running-balance" className="text-4xl font-extrabold text-indigo-600 tracking-tight">
                  {formatCurrency(totalExpenditure)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                <span>Aggregated from {expenses.length} transaction entries</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 md:col-span-2">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Average Spent</span>
                <span className="text-base font-bold text-slate-800 block">
                  {formatCurrency(averageSpend)}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">per transaction item</span>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">This Week's Total</span>
                <span className="text-base font-bold text-slate-800 block">
                  {formatCurrency(weeklyTotal)}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">over past 7 days</span>
              </div>
            </div>

          </div>
        </section>

        {/* INPUTS AND LOGS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* INPUT FORM PANEL */}
          <div className="space-y-6">
            
            {/* Natural Language Entry */}
            <div id="ai-smart-log-panel" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
              <div className="flex items-center gap-2.5 mb-3">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h2 className="font-bold text-slate-900 text-sm">Natural Language Entry</h2>
              </div>

              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Log items natively. Our processing layer automatically separates description, value, and category.
              </p>

              <form onSubmit={handleSmartSubmit} className="space-y-4">
                <textarea
                  value={smartInput}
                  onChange={(e) => setSmartInput(e.target.value)}
                  placeholder="e.g., spent 450 rupees on dinner with friends last night..."
                  disabled={isProcessing}
                  className="w-full h-24 p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white outline-hidden resize-none transition-all placeholder:text-slate-450"
                />

                <div className="space-y-2">
                  <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">
                    Quick Presets (Click to load):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {EXAMPLE_PROMPTS.map((prompt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handlePresetSelect(prompt)}
                        disabled={isProcessing}
                        className="text-[11px] px-2.5 py-1 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 rounded-lg transition-all cursor-pointer text-left truncate max-w-full"
                      >
                        "{prompt}"
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isProcessing || !smartInput.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 px-4 text-xs font-bold rounded-xl shadow-xs hover:bg-indigo-700 active:bg-indigo-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Parse & Log Item</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Manual Entry */}
            <div id="manual-form-panel" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <Plus className="w-5 h-5 text-indigo-600" />
                <h2 className="font-bold text-slate-900 text-sm">Manual Expense Entry</h2>
              </div>

              <form onSubmit={handleManualSubmit} className="space-y-4">
                
                <div>
                  <label htmlFor="manual-desc" className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
                    Description
                  </label>
                  <input
                    id="manual-desc"
                    type="text"
                    value={manualDesc}
                    onChange={(e) => setManualDesc(e.target.value)}
                    placeholder="e.g., Grocery Shopping"
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white outline-hidden transition-all placeholder:text-slate-400 text-slate-800"
                  />
                </div>

                <div>
                  <label htmlFor="manual-amount" className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
                    Amount (₹)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <span className="text-xs font-semibold text-slate-400">₹</span>
                    </div>
                    <input
                      id="manual-amount"
                      type="number"
                      step="1"
                      min="1"
                      value={manualAmount}
                      onChange={(e) => setManualAmount(e.target.value)}
                      placeholder="0"
                      className="w-full pl-8 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white outline-hidden transition-all placeholder:text-slate-400 text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="manual-category" className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
                      Category
                    </label>
                    <select
                      id="manual-category"
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value)}
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white outline-hidden transition-all text-slate-800 cursor-pointer"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="manual-date" className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">
                      Date
                    </label>
                    <input
                      id="manual-date"
                      type="date"
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white outline-hidden transition-all text-slate-800 cursor-pointer"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-1.5 bg-slate-900 text-white py-2.5 px-4 text-xs font-bold rounded-xl shadow-xs hover:bg-slate-800 active:bg-slate-950 focus:outline-hidden focus:ring-2 focus:ring-slate-500/30 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Expense Manually</span>
                </button>
              </form>
            </div>

          </div>

          {/* LEDGER & GRAPH COLUMN */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* WEEKLY REPORT PIE CHART MODULE */}
            <section id="weekly-report-card" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                <ChartIcon className="w-5 h-5 text-indigo-600" />
                <div>
                  <h2 className="font-bold text-slate-950 text-sm">Weekly Spending Share</h2>
                  <p className="text-[11px] text-slate-400">Analysis of rolling category expenditure over the last 7 days</p>
                </div>
              </div>

              {weeklyList.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center py-2">
                  
                  {/* Interactive SVG Donut / Pie */}
                  <div className="md:col-span-5 flex flex-col items-center justify-center relative">
                    <div className="relative w-44 h-44">
                      <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                        {renderWeeklyDonut()}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-4">
                        <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block">7-Day Sum</span>
                        <span className="text-sm font-black text-slate-800 leading-tight">
                          {formatCurrency(weeklyTotal)}
                        </span>
                      </div>
                    </div>
                    
                    {hoveredCategory && (
                      <div className="mt-2 text-center">
                        <span className="text-[10px] text-slate-500 font-medium">Focused:</span>
                        <span className="text-[11px] font-bold text-slate-800 ml-1.5 uppercase tracking-wide">
                          {hoveredCategory} ({formatCurrency(weeklyCatTotals[hoveredCategory] || 0)})
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Interactive legend */}
                  <div className="md:col-span-7 space-y-2.5">
                    <h3 className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 mb-2">Category Breakdown</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {CATEGORIES.map((cat) => {
                        const amount = weeklyCatTotals[cat] || 0;
                        const percentage = weeklyTotal > 0 ? (amount / weeklyTotal) * 100 : 0;
                        const styles = getCategoryStyles(cat);
                        const isHovered = hoveredCategory === cat;

                        return (
                          <div
                            key={cat}
                            onMouseEnter={() => setHoveredCategory(cat)}
                            onMouseLeave={() => setHoveredCategory(null)}
                            className={`p-2.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                              isHovered ? "bg-slate-50 border-slate-300 scale-102" : "bg-white border-slate-100"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${styles.indicator}`} />
                                {cat}
                              </span>
                              <span className="text-[10px] font-bold text-indigo-600">
                                {percentage.toFixed(0)}%
                              </span>
                            </div>
                            <span className="text-xs font-black text-slate-900 block pl-3.5">
                              {formatCurrency(amount)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <span className="text-xs font-bold text-slate-500 block">No expenses logged in the last 7 days</span>
                  <p className="text-[10px] text-slate-400 mt-1">Add transaction logs to build your weekly analysis report.</p>
                </div>
              )}
            </section>

            {/* TRANSACTIONS LIST LEDGER */}
            <div id="expense-ledger-panel" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col">
              
              <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-100 pb-4 mb-4 gap-4">
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">Transaction Ledger Log</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Filter, search, or review your logs</p>
                </div>
                
                <div className="inline-flex items-center px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-semibold">
                  {filteredAndSortedExpenses.length} of {expenses.length} records shown
                </div>
              </div>

              {/* Filters Controls Row */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-6">
                
                <div className="md:col-span-5 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search descriptions..."
                    className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white outline-hidden transition-all placeholder:text-slate-400"
                  />
                </div>

                <div className="md:col-span-4 relative flex items-center">
                  <div className="absolute left-3 flex items-center pointer-events-none">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white outline-hidden transition-all text-slate-700 cursor-pointer"
                  >
                    <option value="All">All Categories</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white outline-hidden transition-all text-slate-700 cursor-pointer"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="amount-high">Highest Amount</option>
                    <option value="amount-low">Lowest Amount</option>
                  </select>
                </div>

              </div>

              {/* Transactions list */}
              <div id="ledger-history-list" className="max-h-[480px] overflow-y-auto pr-1 space-y-3 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                {filteredAndSortedExpenses.length > 0 ? (
                  filteredAndSortedExpenses.map((expense) => {
                    const styles = getCategoryStyles(expense.category);
                    return (
                      <div
                        key={expense.id}
                        className="p-4 bg-white hover:bg-slate-50/80 border border-slate-200 rounded-xl flex items-center justify-between gap-4 transition-all duration-150 group"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={`w-2 h-2 rounded-full ${styles.indicator} shrink-0`} />
                          
                          <div className="min-w-0">
                            <span className="font-bold text-slate-950 text-xs block truncate" title={expense.description}>
                              {expense.description}
                            </span>
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-[10px] text-slate-400">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-300" />
                                {formatDate(expense.date)}
                              </span>
                              <span className="text-slate-200">•</span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${styles.bg}`}>
                                {expense.category}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-extrabold text-slate-900 tracking-tight">
                            {formatCurrency(expense.amount)}
                          </span>
                          <button
                            onClick={() => deleteExpense(expense.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg transition-all duration-150 cursor-pointer"
                            title="Delete transaction log"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center">
                    <div className="p-3 bg-slate-100 text-slate-400 rounded-full mb-3">
                      <Wallet className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-slate-950 text-xs block">No transaction logs listed</span>
                    <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                      {expenses.length === 0
                        ? "Enter your transaction details above using standard natural language or fill out the manual form."
                        : "Try adjusting your query or filter keywords to display your recorded logs."}
                    </p>
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-4 md:px-8 mt-16 text-center border-t border-slate-200/60 pt-8">
        <p className="text-[11px] text-slate-400">
          SmartSpend — Personal financial ledger built with React & Tailwind CSS.
        </p>
      </footer>
    </div>
  );
}
