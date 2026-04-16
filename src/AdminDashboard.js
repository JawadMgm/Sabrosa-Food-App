import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';

function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 🌟 NEW: State to control which tab we are looking at
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'completed'

  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const ordersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching live orders:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const advanceOrderStatus = async (orderId, currentStatus) => {
    const statuses = ['pending', 'preparing', 'delivering', 'completed'];
    const currentIndex = statuses.indexOf(currentStatus || 'pending');
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];

    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, { status: nextStatus });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (window.confirm("Are you sure you want to delete this order forever?")) {
      try {
        await deleteDoc(doc(db, "orders", orderId));
      } catch (error) {
        console.error("Error deleting order:", error);
      }
    }
  };

  // 🌟 NEW: Export Financials to CSV
  const exportToCSV = () => {
    const headers = "Order ID,Customer Name,Phone,Payment,Status,Total,Date\n";
    const rows = orders.map(o => {
      // Clean up strings to prevent CSV breaking
      const name = o.customer.name.replace(/,/g, ''); 
      const method = o.customer.paymentMethod === 'bkash' ? `bKash (${o.customer.trxId})` : 'COD';
      return `${o.id},${name},${o.customer.phone},${method},${o.status || 'pending'},৳${o.total},"${o.timestamp}"`;
    }).join("\n");

    const csvContent = headers + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `sabrosa_orders_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const calculateStats = () => {
    let stats = { totalOrders: 0, todayRev: 0, weekRev: 0, monthRev: 0, totalRev: 0 };
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); 
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    orders.forEach(order => {
      stats.totalOrders += 1;
      const orderTotal = order.total || 0;
      stats.totalRev += orderTotal;

      let orderDate;
      if (order.createdAt && typeof order.createdAt.toDate === 'function') {
        orderDate = order.createdAt.toDate(); 
      } else {
        orderDate = new Date(order.timestamp); 
      }

      if (orderDate >= today) stats.todayRev += orderTotal;
      if (orderDate >= startOfWeek) stats.weekRev += orderTotal;
      if (orderDate >= startOfMonth) stats.monthRev += orderTotal;
    });

    return stats;
  };

  const stats = calculateStats();

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending': return 'bg-red-500 text-white animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]';
      case 'preparing': return 'bg-yellow-500 text-black font-black';
      case 'delivering': return 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]';
      case 'completed': return 'bg-green-500 text-white';
      default: return 'bg-red-500 text-white';
    }
  };

  // 🌟 NEW: Filter orders based on the active tab
  const filteredOrders = orders.filter(order => {
    if (activeTab === 'active') return order.status !== 'completed';
    if (activeTab === 'completed') return order.status === 'completed';
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 pt-20">
      <div className="max-w-7xl mx-auto">
        
        {/* Header & Export Button */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-6">
          <div>
            <h1 className="text-5xl font-black font-display text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500 mb-2">
              Restaurant Dashboard
            </h1>
            <p className="text-gray-400 text-lg">Live Order Management System</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <button 
              onClick={exportToCSV}
              className="glass px-6 py-3 rounded-xl border border-white/20 hover:bg-white/10 transition-all font-bold text-gray-200 flex items-center space-x-2"
            >
              <span>📊</span>
              <span>Export CSV</span>
            </button>
            <div className="glass px-6 py-3 rounded-xl border border-white/10 flex items-center space-x-3 bg-black/50">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-bold text-green-400">Live Sync Online</span>
            </div>
          </div>
        </div>

        {/* Financial Metrics */}
        {!loading && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10 animate-fadeIn">
            <div className="glass p-5 rounded-2xl border border-white/10 hover:border-orange-500/30 transition-all text-center">
              <p className="text-gray-400 text-xs uppercase tracking-wider font-bold mb-1">Total Orders</p>
              <p className="text-4xl font-black text-white">{stats.totalOrders}</p>
            </div>
            <div className="glass p-5 rounded-2xl border border-white/10 hover:border-green-500/30 transition-all text-center">
              <p className="text-gray-400 text-xs uppercase tracking-wider font-bold mb-1">Today's Revenue</p>
              <p className="text-3xl font-black text-green-400">৳{stats.todayRev.toFixed(2)}</p>
            </div>
            <div className="glass p-5 rounded-2xl border border-white/10 hover:border-emerald-500/30 transition-all text-center">
              <p className="text-gray-400 text-xs uppercase tracking-wider font-bold mb-1">This Week</p>
              <p className="text-3xl font-black text-emerald-400">৳{stats.weekRev.toFixed(2)}</p>
            </div>
            <div className="glass p-5 rounded-2xl border border-white/10 hover:border-teal-500/30 transition-all text-center">
              <p className="text-gray-400 text-xs uppercase tracking-wider font-bold mb-1">This Month</p>
              <p className="text-3xl font-black text-teal-400">৳{stats.monthRev.toFixed(2)}</p>
            </div>
            <div className="glass p-5 rounded-2xl border border-white/10 hover:border-cyan-500/30 transition-all text-center">
              <p className="text-gray-400 text-xs uppercase tracking-wider font-bold mb-1">All Time Revenue</p>
              <p className="text-3xl font-black text-cyan-400">৳{stats.totalRev.toFixed(2)}</p>
            </div>
          </div>
        )}

        {/* 🌟 NEW: Smart Filtering Tabs */}
        <div className="flex space-x-4 mb-8 border-b border-white/10 pb-4">
          <button 
            onClick={() => setActiveTab('active')}
            className={`px-6 py-2 rounded-xl font-bold transition-all ${
              activeTab === 'active' 
                ? 'bg-orange-600 text-white shadow-[0_0_15px_rgba(251,146,60,0.4)]' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            🔥 Active Kitchen ({orders.filter(o => o.status !== 'completed').length})
          </button>
          <button 
            onClick={() => setActiveTab('completed')}
            className={`px-6 py-2 rounded-xl font-bold transition-all ${
              activeTab === 'completed' 
                ? 'bg-green-600 text-white shadow-[0_0_15px_rgba(22,163,74,0.4)]' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            ✅ Completed ({orders.filter(o => o.status === 'completed').length})
          </button>
        </div>

        {/* Orders Grid */}
        {loading ? (
          <div className="text-center py-20">
            <div className="text-6xl animate-spin mb-4">🍽️</div>
            <p className="text-xl text-gray-400 font-bold">Connecting to kitchen...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="glass rounded-3xl p-16 text-center border border-white/10">
            <div className="text-7xl mb-6 opacity-50">
              {activeTab === 'active' ? '🍳' : '📋'}
            </div>
            <h2 className="text-3xl font-bold mb-2">
              {activeTab === 'active' ? 'Kitchen is Clear' : 'No Completed Orders'}
            </h2>
            <p className="text-gray-400">
              {activeTab === 'active' ? 'Waiting for new hungry customers.' : 'Completed orders will appear here.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
            {filteredOrders.map((order) => (
              <div 
                key={order.id} 
                className={`glass rounded-2xl p-6 border transition-all duration-300 relative overflow-hidden group ${
                  order.status === 'completed' ? 'border-green-500/30 bg-green-900/10' : 'border-white/10 hover:border-orange-500/50 hover:-translate-y-1 hover:shadow-xl'
                }`}
              >
                
                <div className="absolute top-0 right-0 flex z-10">
                  <button 
                    onClick={() => advanceOrderStatus(order.id, order.status)}
                    className={`text-xs font-bold px-4 py-2 rounded-bl-lg transition-all cursor-pointer border-l border-b border-black/20 hover:brightness-110 ${getStatusColor(order.status)}`}
                  >
                    {(order.status || 'pending').toUpperCase()} ↻
                  </button>
                  <button 
                    onClick={() => handleDeleteOrder(order.id)}
                    className="bg-black/60 hover:bg-red-600 text-white text-xs px-4 py-2 font-bold transition-colors backdrop-blur-md"
                    title="Delete Order"
                  >
                    ✕
                  </button>
                </div>

                <div className="mb-4 pb-4 border-b border-white/10 mt-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-2xl text-white">{order.customer.name}</h3>
                    <span className="text-sm text-gray-400 bg-black/40 px-2 py-1 rounded-md">{order.timestamp.split(',')[1]}</span>
                  </div>
                  <p className="text-gray-300 text-sm mb-1 flex items-center gap-2"><span>📞</span> {order.customer.phone}</p>
                  <p className="text-gray-300 text-sm flex items-start gap-2"><span>📍</span> <span>{order.customer.address}</span></p>
                </div>

                <div className="mb-4 min-h-[100px]">
                  <h4 className="text-sm font-bold text-orange-400 mb-3 uppercase tracking-wider">Order Items</h4>
                  <ul className="space-y-3">
                    {order.items.map((item, index) => (
                      <li key={index} className="flex justify-between text-sm text-gray-200 items-center bg-black/20 p-2 rounded-lg">
                        <span className="font-medium"><span className="text-orange-400 mr-2">{item.quantity}x</span> {item.name}</span>
                        <span className="font-bold text-white">৳{(item.price * item.quantity).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {order.customer.instructions && (
                  <div className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                    <p className="text-xs text-yellow-400 font-bold mb-1">NOTE FROM CUSTOMER:</p>
                    <p className="text-sm text-gray-200 italic">"{order.customer.instructions}"</p>
                  </div>
                )}

                <div className="pt-4 border-t border-white/10 flex justify-between items-end bg-black/20 -mx-6 -mb-6 p-6 mt-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Payment Status</p>
                    <p className={`text-sm font-bold ${order.customer.paymentMethod === 'bkash' ? 'text-pink-400' : 'text-green-400'} flex items-center gap-2`}>
                      {order.customer.paymentMethod === 'bkash' ? '🦅' : '💵'}
                      {order.customer.paymentMethod === 'bkash' ? `bKash (${order.customer.trxId})` : 'Cash on Delivery'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Total</p>
                    <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500 drop-shadow-md">
                      ৳{order.total.toFixed(2)}
                    </p>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;