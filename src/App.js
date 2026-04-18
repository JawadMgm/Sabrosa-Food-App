import { useState, useEffect } from 'react';
import { menuData } from './menuData';
import AdminDashboard from './AdminDashboard'; 
import { db } from './firebase';
import { collection, addDoc, doc, onSnapshot } from 'firebase/firestore'; 

function App() {
  const [currentPage, setCurrentPage] = useState('home'); 

  const [expandedCategory, setExpandedCategory] = useState(null);
  const [breakfastSubCategory, setBreakfastSubCategory] = useState(null);
  const [isDessertAvailable, setDessertAvailable] = useState(false);
  const [isBreakfastAvailable, setBreakfastAvailable] = useState(false);
  const [isLunchAvailable, setLunchAvailable] = useState(false);
  const [isDinnerAvailable, setDinnerAvailable] = useState(false);
  const [isRestaurantClosed, setRestaurantClosed] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  
  const [orderDetails, setOrderDetails] = useState({
    name: '',
    phone: '',
    address: '',
    instructions: '',
    paymentMethod: 'cod', 
    trxId: ''
  });
  
  const [currentOrder, setCurrentOrder] = useState(null);
  const [liveOrderStatus, setLiveOrderStatus] = useState('pending'); 

  // 🌟 NEW: Secret click tracker for the Admin Backdoor
  const [secretClickCount, setSecretClickCount] = useState(0);

  const RESTAURANT_HOURS = {
    BREAKFAST_START: 9,   
    BREAKFAST_END: 12,    
    LUNCH_START: 12,      
    LUNCH_END: 18,        
    DINNER_START: 19,     
    DINNER_END: 26,       
    CLOSED_START: 2,      
    CLOSED_END: 9         
  };

  useEffect(() => {
    const checkAvailability = () => {
      const now = new Date();
      let hour = now.getHours();
      
      if (hour >= 0 && hour < RESTAURANT_HOURS.CLOSED_START) {
        hour = 24 + hour; 
      }
      
      const isClosed = hour >= RESTAURANT_HOURS.CLOSED_START && hour < RESTAURANT_HOURS.BREAKFAST_START;
      const isBreakfastTime = hour >= RESTAURANT_HOURS.BREAKFAST_START && hour < RESTAURANT_HOURS.BREAKFAST_END;
      const isLunchTime = hour >= RESTAURANT_HOURS.LUNCH_START && hour < RESTAURANT_HOURS.LUNCH_END;
      const isDinnerTime = hour >= RESTAURANT_HOURS.DINNER_START && hour <= RESTAURANT_HOURS.DINNER_END;
      const isDessertTime = isLunchTime || isDinnerTime; 
      
      setBreakfastAvailable(isBreakfastTime);
      setLunchAvailable(isLunchTime);
      setDinnerAvailable(isDinnerTime);
      setDessertAvailable(isDessertTime);
      setRestaurantClosed(isClosed);
      setCurrentTime(now);
    };

    checkAvailability();
    const interval = setInterval(checkAvailability, 60000);
    return () => clearInterval(interval);
  }, [RESTAURANT_HOURS.BREAKFAST_START, RESTAURANT_HOURS.CLOSED_START, RESTAURANT_HOURS.BREAKFAST_END, RESTAURANT_HOURS.LUNCH_START, RESTAURANT_HOURS.LUNCH_END, RESTAURANT_HOURS.DINNER_START, RESTAURANT_HOURS.DINNER_END]);

  useEffect(() => {
    if (orderSubmitted && currentOrder && currentOrder.id) {
      const unsub = onSnapshot(doc(db, "orders", currentOrder.id), (docSnapshot) => {
        if (docSnapshot.exists()) {
          setLiveOrderStatus(docSnapshot.data().status || 'pending');
        }
      });
      return () => unsub(); 
    }
  }, [orderSubmitted, currentOrder]);

  // 🌟 NEW: The Secret Backdoor Logic
  const handleLogoClick = () => {
    const newCount = secretClickCount + 1;
    setSecretClickCount(newCount);

    if (newCount >= 5) {
      // Trigger the secret prompt on the 5th click
      const passcode = window.prompt("Sabrosa System: Enter Admin PIN");
      
      // CHANGE "7777" TO WHATEVER PIN YOU WANT!
      if (passcode === "7777") {
        setCurrentPage('admin');
      } else if (passcode !== null) {
        alert("Access Denied: Incorrect PIN.");
      }
      setSecretClickCount(0); // Reset clicks
    } else {
      // Normal behavior for regular customers
      setCurrentPage('home');
      
      // Reset the counter if they stop clicking after a few seconds
      setTimeout(() => setSecretClickCount(0), 3000);
    }
  };

  const toggleCategory = (category) => {
    if (expandedCategory === category) {
      setExpandedCategory(null);
      setBreakfastSubCategory(null);
    } else {
      setExpandedCategory(category);
      setBreakfastSubCategory(null);
    }
  };

  const toggleBreakfastSub = (subCategory) => {
    if (breakfastSubCategory === subCategory) {
      setBreakfastSubCategory(null);
    } else {
      setBreakfastSubCategory(subCategory);
    }
  };

  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 2000);
  };

  const addToCart = (item) => {
    const existingItem = cart.find(cartItem => cartItem.id === item.id);
    if (existingItem) {
      setCart(cart.map(cartItem => 
        cartItem.id === item.id 
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem
      ));
      showNotification(`Added another ${item.name} to cart!`);
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
      showNotification(`${item.name} added to cart!`);
    }
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId, change) => {
    setCart(cart.map(item => {
      if (item.id === itemId) {
        const newQuantity = item.quantity + change;
        if (newQuantity <= 0) return null;
        return { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(Boolean));
  };

  const getCartTotal = () => cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  const getCartCount = () => cart.reduce((count, item) => count + item.quantity, 0);

  const handleInputChange = (e) => {
    let { name, value } = e.target;
    if (name === 'trxId') value = value.toUpperCase();
    if (name === 'phone') value = value.replace(/[^0-9+\-\s]/g, '');
    setOrderDetails({ ...orderDetails, [name]: value });
    setCheckoutError('');
  };

  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    setCheckoutError('');
    
    if (orderDetails.paymentMethod === 'bkash' && !orderDetails.trxId) {
      setCheckoutError('Please enter your bKash Transaction ID!');
      return;
    }

    if (!orderDetails.name || !orderDetails.phone || !orderDetails.address) {
      setCheckoutError('Please fill in your Name, Phone, and Address before submitting!');
      return;
    }

    setIsSubmitting(true); 

    const orderData = {
      customer: orderDetails,
      items: cart,
      total: getCartTotal(),
      timestamp: new Date().toLocaleString(),
      status: 'pending',
      createdAt: new Date()
    };

    try {
      const docRef = await addDoc(collection(db, "orders"), orderData);
      setCurrentOrder({ id: docRef.id, ...orderData });
      setLiveOrderStatus('pending'); 
      setCart([]);
      setShowCart(false);
      setShowCheckout(false);
      setOrderSubmitted(true);
      
    } catch (error) {
      console.error("Error adding document: ", error);
      setCheckoutError(`Database Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const FoodItem = ({ item }) => (
    <div className="card-3d glass rounded-3xl p-5 md:p-6 hover:neon-glow transition-all duration-500 border border-white/10 group">
      <div className="flex flex-col md:flex-row items-start space-y-4 md:space-y-0 md:space-x-6">
        
        <div className="w-full md:w-48 h-48 md:h-40 lg:h-48 flex-shrink-0 overflow-hidden rounded-2xl border border-white/10 relative">
          <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all duration-500 z-10"></div>
          {item.image && item.image.startsWith('http') ? (
            <img src={item.image} alt={item.name} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center text-6xl">{item.image}</div>
          )}
        </div>

        <div className="flex-grow w-full">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-2 md:mb-3 gap-2">
            <h3 className="text-xl md:text-2xl font-bold text-white leading-tight font-display">{item.name}</h3>
            <span className="text-lg md:text-xl font-bold gradient-text bg-gradient-to-br from-orange-400/10 to-red-400/10 px-3 py-1 md:px-4 md:py-2 rounded-xl border border-orange-500/20 backdrop-blur-sm self-start whitespace-nowrap">
              ৳{item.price.toFixed(2)}
            </span>
          </div>
          <p className="text-gray-400 text-sm md:text-base leading-relaxed mb-4 md:mb-6 font-light">{item.description}</p>
          <button 
            onClick={() => addToCart(item)}
            className="w-full md:w-auto bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white px-6 md:px-8 py-3 rounded-xl font-bold transition-all duration-300 transform hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(251,146,60,0.3)] border border-orange-500/50 flex items-center justify-center space-x-2"
          >
            <span>Add to Cart</span>
            <span className="text-xl">🛒</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 pb-32 relative overflow-hidden">
      
      {/* Background Images */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none bg-black z-0">
        
        {/* Default Background */}
        <div className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${currentPage !== 'menu' || expandedCategory === null ? 'opacity-[0.4]' : 'opacity-0'}`}>
          <img src={`${process.env.PUBLIC_URL}/images/default-bg.jpg`} alt="" className="w-full h-full object-cover" style={{ maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)' }} />
        </div>
        
        {/* Breakfast Background */}
        <div className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${currentPage === 'menu' && expandedCategory === 'breakfast' ? 'opacity-[0.4]' : 'opacity-0'}`}>
          <img src={`${process.env.PUBLIC_URL}/images/breakfast-bg.jpg`} alt="" className="w-full h-full object-cover" style={{ maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)' }} />
        </div>
        
        {/* Lunch Background */}
        <div className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${currentPage === 'menu' && expandedCategory === 'lunch' ? 'opacity-[0.4]' : 'opacity-0'}`}>
          <img src={`${process.env.PUBLIC_URL}/images/lunch-bg.jpg`} alt="" className="w-full h-full object-cover" style={{ maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)' }} />
        </div>
        
        {/* Dinner Background */}
        <div className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${currentPage === 'menu' && expandedCategory === 'dinner' ? 'opacity-[0.4]' : 'opacity-0'}`}>
          <img src={`${process.env.PUBLIC_URL}/images/dinner-bg.jpg`} alt="" className="w-full h-full object-cover" style={{ maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)' }} />
        </div>
        
        {/* Dessert Background */}
        <div className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${currentPage === 'menu' && expandedCategory === 'dessert' ? 'opacity-[0.4]' : 'opacity-0'}`}>
          <img src={`${process.env.PUBLIC_URL}/images/dessert-bg.jpg`} alt="" className="w-full h-full object-cover" style={{ maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)' }} />
        </div>

        {/* Ambient Glows */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-orange-600/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-red-600/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-purple-600/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full z-40 glass border-b border-white/10 backdrop-blur-md bg-black/40">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 md:py-5 flex flex-col md:flex-row justify-between items-center gap-3 md:gap-0">
          
          {/* 🌟 UPGRADED: The Secret Logo Trigger */}
          <div 
            className="text-2xl md:text-3xl font-black font-display gradient-text tracking-wider cursor-pointer select-none" 
            onClick={handleLogoClick}
          >
            SABROSA
          </div>

          <div className="flex items-center space-x-4 md:space-x-8 overflow-x-auto w-full md:w-auto justify-center md:justify-end pb-1 md:pb-0 hide-scrollbar scroll-smooth">
            {['home', 'about', 'menu', 'contact'].map((page) => (
              <button
                key={page}
                onClick={() => {
                  setCurrentPage(page);
                  window.scrollTo(0, 0); 
                }}
                className={`text-sm md:text-lg font-bold capitalize transition-all duration-300 tracking-wide whitespace-nowrap ${
                  currentPage === page 
                    ? 'text-orange-400 drop-shadow-[0_0_10px_rgba(251,146,60,0.8)] border-b-2 border-orange-400 pb-1' 
                    : 'text-gray-400 hover:text-white pb-1'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {notification && (
        <div className="fixed top-24 right-4 md:right-8 glass neon-glow-strong text-white px-6 md:px-8 py-4 md:py-5 rounded-2xl z-[120] animate-fadeIn border border-orange-500/50 text-sm md:text-lg">
          <p className="font-bold">✓ {notification}</p>
        </div>
      )}

      <div className="pt-28 md:pt-32 px-4 relative z-10">
        
        {/* ---- HOME PAGE ---- */}
        {currentPage === 'home' && (
          <div className="max-w-5xl mx-auto text-center mt-10 md:mt-20 animate-fadeIn px-2 md:px-0">
            <div className="glass neon-glow rounded-3xl p-8 md:p-16 border border-white/10">
              <div className="text-6xl md:text-8xl mb-6 md:mb-8 animate-float">🍽️</div>
              <h1 className="text-4xl sm:text-6xl md:text-8xl font-black mb-4 md:mb-6 font-display gradient-text leading-tight">
                Experience Premium <br className="hidden md:block"/> Dining at Home
              </h1>
              <p className="text-gray-300 text-lg md:text-2xl font-light mb-8 md:mb-12 max-w-2xl mx-auto">
                Carefully curated, exquisitely prepared, and delivered straight to your door. 
                Your next unforgettable meal is just a click away.
              </p>
              <button 
                onClick={() => setCurrentPage('menu')}
                className="w-full sm:w-auto bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white px-8 md:px-12 py-4 md:py-5 rounded-2xl font-bold text-xl md:text-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-[0_0_40px_rgba(251,146,60,0.6)] border border-orange-500/50"
              >
                Explore The Menu 🍽️
              </button>
            </div>
          </div>
        )}

        {/* ---- ABOUT PAGE ---- */}
        {currentPage === 'about' && (
          <div className="max-w-4xl mx-auto mt-6 md:mt-10 animate-fadeIn px-2 md:px-0">
            <div className="glass rounded-3xl p-8 md:p-12 border border-white/10 neon-glow">
              <h1 className="text-4xl md:text-6xl font-black mb-6 md:mb-8 font-display gradient-text text-center">Our Story</h1>
              <div className="space-y-6 md:space-y-8 text-gray-300 text-base md:text-xl font-light leading-relaxed">
                <p>Welcome to SABROSA, where culinary excellence meets the comfort of your home. Founded with a passion for exceptional food and uncompromising quality, we set out to redefine the digital dining experience.</p>
                <div className="flex flex-col md:flex-row items-center md:space-x-6 glass p-6 rounded-2xl border border-white/5 my-6 md:my-8 gap-4 md:gap-0 text-center md:text-left">
                  <div className="text-5xl md:text-6xl p-4 bg-orange-500/10 rounded-2xl border border-orange-500/20">👨‍🍳</div>
                  <p className="font-medium">Our master chefs source only the finest, freshest ingredients daily. From early morning breakfast bowls to late-night decadent desserts, every dish is crafted with precision and care.</p>
                </div>
                <p>We believe that ordering food shouldn't just be convenient—it should be an experience. That's why we've designed our platform to be as beautiful and seamless as the meals we deliver. Thank you for inviting us to your table.</p>
              </div>
            </div>
          </div>
        )}

        {/* ---- CONTACT PAGE ---- */}
        {currentPage === 'contact' && (
          <div className="max-w-4xl mx-auto mt-6 md:mt-10 animate-fadeIn px-2 md:px-0">
            <h1 className="text-4xl md:text-6xl font-black mb-8 md:mb-10 font-display gradient-text text-center">Get In Touch</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <div className="glass rounded-3xl p-6 md:p-10 border border-white/10 neon-glow space-y-6 md:space-y-8">
                <h2 className="text-2xl md:text-3xl font-bold text-white font-display mb-4 md:mb-6">Contact Info</h2>
                <div className="flex items-start space-x-4">
                  <span className="text-3xl md:text-4xl bg-orange-500/20 p-3 rounded-xl border border-orange-500/30">📍</span>
                  <div>
                    <h3 className="text-white font-bold text-lg md:text-xl">Our Kitchen</h3>
                    <p className="text-gray-400 text-sm md:text-base mt-1">123 Culinary Boulevard<br/>Food District, FL 33101</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <span className="text-3xl md:text-4xl bg-orange-500/20 p-3 rounded-xl border border-orange-500/30">📞</span>
                  <div>
                    <h3 className="text-white font-bold text-lg md:text-xl">Call Us</h3>
                    <p className="text-gray-400 text-sm md:text-base mt-1">+1 (555) 123-4567<br/>Available during business hours</p>
                  </div>
                </div>
              </div>
              <div className="glass rounded-3xl p-6 md:p-10 border border-white/10 neon-glow">
                <h2 className="text-2xl md:text-3xl font-bold text-white font-display mb-6">Send a Message</h2>
                <form className="space-y-4 md:space-y-5" onSubmit={(e) => { e.preventDefault(); showNotification("Message sent successfully!"); }}>
                  <div><input type="text" placeholder="Your Name" className="w-full glass border border-white/20 rounded-xl px-4 md:px-5 py-3 md:py-4 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 text-sm md:text-base" /></div>
                  <div><input type="email" placeholder="Your Email" className="w-full glass border border-white/20 rounded-xl px-4 md:px-5 py-3 md:py-4 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 text-sm md:text-base" /></div>
                  <div><textarea rows="4" placeholder="How can we help you?" className="w-full glass border border-white/20 rounded-xl px-4 md:px-5 py-3 md:py-4 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 resize-none text-sm md:text-base" /></div>
                  <button type="submit" className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white py-3 md:py-4 rounded-xl font-bold text-base md:text-lg transition-all border border-orange-500/50 shadow-lg">Send Message 🚀</button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ---- MENU PAGE ---- */}
        {currentPage === 'menu' && (
          <div className="animate-fadeIn px-2 md:px-0">
            <div className="max-w-6xl mx-auto mb-10 md:mb-16 text-center">
              <div className="glass neon-glow rounded-3xl p-6 md:p-10 mb-8 border border-white/10">
                <h1 className="text-4xl sm:text-5xl md:text-7xl font-black mb-2 md:mb-4 font-display gradient-text animate-float">SABROSA Menu</h1>
                <p className="text-gray-300 text-sm md:text-xl font-medium mb-4 md:mb-6 mt-4">Fresh, exquisite meals delivered to your door</p>
                <div className="inline-block glass px-6 py-2 md:px-8 md:py-4 rounded-full border border-orange-500/30">
                  <p className="text-orange-400 font-bold text-sm md:text-lg">⏰ {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            </div>

            <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
              
              {isRestaurantClosed && (
                <div className="glass rounded-3xl overflow-hidden border border-red-500/30 neon-glow-strong mb-8">
                  <div className="p-6 md:p-12 text-center">
                    <div className="text-7xl md:text-9xl mb-4 md:mb-6 animate-float">🔒</div>
                    <h2 className="text-4xl md:text-6xl font-black text-red-400 mb-3 md:mb-4 font-display">We're Currently Closed</h2>
                    <p className="text-gray-300 text-lg md:text-2xl mb-4 md:mb-6">Our restaurant is closed from 2 AM to 9 AM</p>
                    <div className="glass border border-orange-500/30 rounded-2xl p-4 md:p-6 inline-block">
                      <p className="text-gray-300 text-base md:text-lg mb-2 md:mb-3 font-semibold">Opening Hours:</p>
                      <div className="text-left space-y-2 text-gray-400 text-sm md:text-base">
                        <p>🍳 <span className="text-yellow-400 font-bold">Breakfast:</span> 9 AM - 12 PM</p>
                        <p>🍔 <span className="text-green-400 font-bold">Lunch:</span> 12 PM - 6 PM</p>
                        <p>🍝 <span className="text-purple-400 font-bold">Dinner:</span> 7 PM - 2 AM</p>
                        <p>🍰 <span className="text-pink-400 font-bold">Dessert:</span> 12 PM - 6 PM & 7 PM - 2 AM</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* DESSERT BOX */}
              {isDessertAvailable ? (
                <div className="card-3d glass rounded-3xl overflow-hidden border border-pink-500/20 neon-glow">
                  <div onClick={() => toggleCategory('dessert')} className="p-6 md:p-10 cursor-pointer hover:bg-white/5 transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 md:space-x-6">
                        <div className="text-4xl md:text-7xl bg-gradient-to-br from-pink-500/20 to-red-500/20 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-pink-500/30 backdrop-blur-sm">🍰</div>
                        <div>
                          <h2 className="text-3xl md:text-5xl font-black text-pink-400 mb-1 md:mb-2 font-display">Dessert</h2>
                          <p className="text-gray-400 text-sm md:text-lg font-light">Sweet treats & delightful desserts</p>
                        </div>
                      </div>
                      <div className="text-3xl md:text-5xl text-gray-500 transition-transform duration-300" style={{ transform: expandedCategory === 'dessert' ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</div>
                    </div>
                  </div>
                  {expandedCategory === 'dessert' && (
                    <div className="px-4 md:px-10 pb-6 md:pb-10 pt-4 bg-gradient-to-b from-pink-950/20 to-transparent border-t border-pink-500/20 space-y-4 md:space-y-6 animate-fadeIn">
                      {menuData.dessert.map(item => <FoodItem key={item.id} item={item} />)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="glass rounded-3xl overflow-hidden border border-gray-700/50 opacity-60">
                  <div className="p-6 md:p-10 flex items-center justify-between">
                    <div className="flex items-center space-x-4 md:space-x-6">
                      <div className="text-4xl md:text-7xl grayscale opacity-50 bg-gray-800/30 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-gray-700/30">🍰</div>
                      <div>
                        <h2 className="text-3xl md:text-5xl font-black text-gray-600 mb-1 md:mb-2 font-display">Dessert</h2>
                        <p className="text-gray-500 text-sm md:text-lg font-light">Available 12 PM - 6 PM & 7 PM - 2 AM</p>
                      </div>
                    </div>
                    <div className="hidden sm:block bg-red-900/30 text-red-400 px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold text-sm md:text-lg border border-red-800/50">⏰ Unavailable</div>
                  </div>
                </div>
              )}

              {/* BREAKFAST BOX */}
              {isBreakfastAvailable ? (
                <div className="card-3d glass rounded-3xl overflow-hidden border border-yellow-500/20 neon-glow">
                  <div onClick={() => toggleCategory('breakfast')} className="p-6 md:p-10 cursor-pointer hover:bg-white/5 transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 md:space-x-6">
                        <div className="text-4xl md:text-7xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-yellow-500/30 backdrop-blur-sm">🍳</div>
                        <div>
                          <h2 className="text-3xl md:text-5xl font-black text-yellow-400 mb-1 md:mb-2 font-display">Breakfast</h2>
                          <p className="text-gray-400 text-sm md:text-lg font-light">Start your day right</p>
                        </div>
                      </div>
                      <div className="text-3xl md:text-5xl text-gray-500 transition-transform duration-300" style={{ transform: expandedCategory === 'breakfast' ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</div>
                    </div>
                  </div>
                  {expandedCategory === 'breakfast' && (
                    <div className="px-4 md:px-10 pb-6 md:pb-10 pt-4 bg-gradient-to-b from-yellow-950/20 to-transparent border-t border-yellow-500/20 space-y-4 md:space-y-6 animate-fadeIn">
                      <div className="glass rounded-2xl overflow-hidden border border-orange-500/20">
                        <div onClick={() => toggleBreakfastSub('sweet')} className="p-4 md:p-7 cursor-pointer hover:bg-white/5 transition-all duration-300">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 md:space-x-5">
                              <span className="text-3xl md:text-6xl bg-gradient-to-br from-orange-500/20 to-yellow-500/20 p-3 md:p-4 rounded-xl md:rounded-2xl border border-orange-500/30">🍯</span>
                              <h3 className="text-2xl md:text-4xl font-bold text-orange-400 font-display">Sweet</h3>
                            </div>
                            <div className="text-2xl md:text-4xl text-gray-500 transition-transform duration-300" style={{ transform: breakfastSubCategory === 'sweet' ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</div>
                          </div>
                        </div>
                        {breakfastSubCategory === 'sweet' && (
                          <div className="px-4 md:px-7 pb-4 md:pb-7 pt-2 bg-gradient-to-b from-orange-950/20 to-transparent space-y-4 md:space-y-6 animate-fadeIn">
                            {menuData.breakfast.sweet.map(item => <FoodItem key={item.id} item={item} />)}
                          </div>
                        )}
                      </div>
                      <div className="glass rounded-2xl overflow-hidden border border-red-500/20">
                        <div onClick={() => toggleBreakfastSub('savory')} className="p-4 md:p-7 cursor-pointer hover:bg-white/5 transition-all duration-300">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 md:space-x-5">
                              <span className="text-3xl md:text-6xl bg-gradient-to-br from-red-500/20 to-orange-500/20 p-3 md:p-4 rounded-xl md:rounded-2xl border border-red-500/30">🥓</span>
                              <h3 className="text-2xl md:text-4xl font-bold text-red-400 font-display">Savory</h3>
                            </div>
                            <div className="text-2xl md:text-4xl text-gray-500 transition-transform duration-300" style={{ transform: breakfastSubCategory === 'savory' ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</div>
                          </div>
                        </div>
                        {breakfastSubCategory === 'savory' && (
                          <div className="px-4 md:px-7 pb-4 md:pb-7 pt-2 bg-gradient-to-b from-red-950/20 to-transparent space-y-4 md:space-y-6 animate-fadeIn">
                            {menuData.breakfast.savory.map(item => <FoodItem key={item.id} item={item} />)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="glass rounded-3xl overflow-hidden border border-gray-700/50 opacity-60">
                  <div className="p-6 md:p-10 flex items-center justify-between">
                    <div className="flex items-center space-x-4 md:space-x-6">
                      <div className="text-4xl md:text-7xl grayscale opacity-50 bg-gray-800/30 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-gray-700/30">🍳</div>
                      <div>
                        <h2 className="text-3xl md:text-5xl font-black text-gray-600 mb-1 md:mb-2 font-display">Breakfast</h2>
                        <p className="text-gray-500 text-sm md:text-lg font-light">Available 9 AM - 12 PM</p>
                      </div>
                    </div>
                    <div className="hidden sm:block bg-red-900/30 text-red-400 px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold text-sm md:text-lg border border-red-800/50">⏰ Unavailable</div>
                  </div>
                </div>
              )}

              {/* LUNCH BOX */}
              {isLunchAvailable ? (
                <div className="card-3d glass rounded-3xl overflow-hidden border border-green-500/20 neon-glow">
                  <div onClick={() => toggleCategory('lunch')} className="p-6 md:p-10 cursor-pointer hover:bg-white/5 transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 md:space-x-6">
                        <div className="text-4xl md:text-7xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-green-500/30 backdrop-blur-sm">🍔</div>
                        <div>
                          <h2 className="text-3xl md:text-5xl font-black text-green-400 mb-1 md:mb-2 font-display">Lunch</h2>
                          <p className="text-gray-400 text-sm md:text-lg font-light">Satisfying midday favorites</p>
                        </div>
                      </div>
                      <div className="text-3xl md:text-5xl text-gray-500 transition-transform duration-300" style={{ transform: expandedCategory === 'lunch' ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</div>
                    </div>
                  </div>
                  {expandedCategory === 'lunch' && (
                    <div className="px-4 md:px-10 pb-6 md:pb-10 pt-4 bg-gradient-to-b from-green-950/20 to-transparent border-t border-green-500/20 space-y-4 md:space-y-6 animate-fadeIn">
                      {menuData.lunch.map(item => <FoodItem key={item.id} item={item} />)}
                    </div>
                  )}
                </div>
              ) : (
                 <div className="glass rounded-3xl overflow-hidden border border-gray-700/50 opacity-60">
                  <div className="p-6 md:p-10 flex items-center justify-between">
                    <div className="flex items-center space-x-4 md:space-x-6">
                      <div className="text-4xl md:text-7xl grayscale opacity-50 bg-gray-800/30 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-gray-700/30">🍔</div>
                      <div>
                        <h2 className="text-3xl md:text-5xl font-black text-gray-600 mb-1 md:mb-2 font-display">Lunch</h2>
                        <p className="text-gray-500 text-sm md:text-lg font-light">Available 12 PM - 6 PM</p>
                      </div>
                    </div>
                    <div className="hidden sm:block bg-red-900/30 text-red-400 px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold text-sm md:text-lg border border-red-800/50">⏰ Unavailable</div>
                  </div>
                </div>
              )}

              {/* DINNER BOX */}
              {isDinnerAvailable ? (
                <div className="card-3d glass rounded-3xl overflow-hidden border border-purple-500/20 neon-glow">
                  <div onClick={() => toggleCategory('dinner')} className="p-6 md:p-10 cursor-pointer hover:bg-white/5 transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 md:space-x-6">
                        <div className="text-4xl md:text-7xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-purple-500/30 backdrop-blur-sm">🍝</div>
                        <div>
                          <h2 className="text-3xl md:text-5xl font-black text-purple-400 mb-1 md:mb-2 font-display">Dinner</h2>
                          <p className="text-gray-400 text-sm md:text-lg font-light">Exquisite evening delicacies</p>
                        </div>
                      </div>
                      <div className="text-3xl md:text-5xl text-gray-500 transition-transform duration-300" style={{ transform: expandedCategory === 'dinner' ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</div>
                    </div>
                  </div>
                  {expandedCategory === 'dinner' && (
                    <div className="px-4 md:px-10 pb-6 md:pb-10 pt-4 bg-gradient-to-b from-purple-950/20 to-transparent border-t border-purple-500/20 space-y-4 md:space-y-6 animate-fadeIn">
                      {menuData.dinner.map(item => <FoodItem key={item.id} item={item} />)}
                    </div>
                  )}
                </div>
              ) : (
                 <div className="glass rounded-3xl overflow-hidden border border-gray-700/50 opacity-60">
                  <div className="p-6 md:p-10 flex items-center justify-between">
                    <div className="flex items-center space-x-4 md:space-x-6">
                      <div className="text-4xl md:text-7xl grayscale opacity-50 bg-gray-800/30 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-gray-700/30">🍝</div>
                      <div>
                        <h2 className="text-3xl md:text-5xl font-black text-gray-600 mb-1 md:mb-2 font-display">Dinner</h2>
                        <p className="text-gray-500 text-sm md:text-lg font-light">Available 7 PM - 2 AM</p>
                      </div>
                    </div>
                    <div className="hidden sm:block bg-red-900/30 text-red-400 px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold text-sm md:text-lg border border-red-800/50">⏰ Unavailable</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <button onClick={() => setShowCart(!showCart)} className="fixed bottom-6 right-6 md:bottom-8 md:right-8 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white p-5 md:p-7 rounded-full transition-all duration-300 transform hover:scale-110 z-50 border-2 border-orange-500/50 animate-glow shadow-[0_0_20px_rgba(251,146,60,0.5)]">
        <div className="relative">
          <span className="text-3xl md:text-5xl">🛒</span>
          {getCartCount() > 0 && (
            <span className="absolute -top-3 -right-3 md:-top-4 md:-right-4 bg-green-500 text-white text-xs md:text-sm font-bold rounded-full w-7 h-7 md:w-9 md:h-9 flex items-center justify-center shadow-lg animate-pulse border-2 border-white">{getCartCount()}</span>
          )}
        </div>
      </button>

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={() => setShowCart(false)}>
          <div className="fixed right-0 top-0 h-full w-full sm:w-[400px] md:max-w-md bg-gradient-to-b from-gray-900 to-black overflow-y-auto animate-slideInRight border-l border-white/10 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white p-6 md:p-8 sticky top-0 z-10 border-b border-white/10 shrink-0">
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <h2 className="text-3xl md:text-4xl font-black font-display">Your Cart</h2>
                <button onClick={() => setShowCart(false)} className="text-3xl md:text-5xl hover:rotate-90 transition-transform duration-300 glass w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center border border-white/20">✕</button>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-2xl md:text-4xl">🛒</span>
                <p className="text-orange-100 text-lg md:text-xl font-semibold">{getCartCount()} {getCartCount() === 1 ? 'item' : 'items'}</p>
              </div>
            </div>

            <div className="p-4 md:p-6 flex-grow overflow-y-auto">
              {cart.length === 0 ? (
                <div className="text-center py-16 md:py-24">
                  <div className="text-7xl md:text-9xl mb-6 md:mb-8 animate-float">🛒</div>
                  <p className="text-gray-300 text-2xl md:text-3xl font-bold mb-2 md:mb-3 font-display">Your cart is empty</p>
                  <p className="text-gray-500 text-base md:text-lg font-light">Add some delicious items to get started!</p>
                </div>
              ) : (
                <div className="space-y-4 md:space-y-5">
                  {cart.map(item => (
                    <div key={item.id} className="glass rounded-2xl p-4 md:p-6 border border-white/10 neon-glow">
                      <div className="flex items-start space-x-3 md:space-x-4">
                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden shrink-0 border border-white/10">
                          {item.image && item.image.startsWith('http') ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center text-3xl">{item.image}</div>
                          )}
                        </div>
                        <div className="flex-grow">
                          
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-bold text-white text-lg md:text-xl font-display leading-tight">{item.name}</h3>
                              <p className="text-xs md:text-sm text-gray-400 mt-1 font-semibold">৳{item.price.toFixed(2)} each</p>
                            </div>
                            <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-300 font-bold text-xs md:text-sm glass px-2 md:px-3 py-1 rounded-lg border border-red-500/30 transition-all">✕</button>
                          </div>
                          
                          <div className="flex items-center justify-between mt-3 md:mt-4">
                            <div className="flex items-center space-x-2 md:space-x-3">
                              <button onClick={() => updateQuantity(item.id, -1)} className="bg-gray-700 hover:bg-gray-600 text-white w-8 h-8 md:w-10 md:h-10 rounded-full font-bold text-lg md:text-xl border border-gray-600 transition-all flex items-center justify-center">-</button>
                              <span className="font-bold text-lg md:text-xl w-6 md:w-10 text-center text-white">{item.quantity}</span>
                              <button onClick={() => updateQuantity(item.id, 1)} className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white w-8 h-8 md:w-10 md:h-10 rounded-full font-bold text-lg md:text-xl border border-orange-500/50 transition-all flex items-center justify-center">+</button>
                            </div>
                            <p className="font-bold gradient-text text-xl md:text-2xl">৳{(item.price * item.quantity).toFixed(2)}</p>
                          </div>

                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="bg-gradient-to-t from-black to-gray-900 border-t border-white/10 p-4 md:p-6 shrink-0 z-20 pb-8 md:pb-6">
                <div className="flex items-center justify-between mb-4 md:mb-6 glass p-4 md:p-6 rounded-2xl border border-green-500/30 neon-glow">
                  <span className="text-xl md:text-2xl font-bold text-white font-display">Total:</span>
                  <span className="text-3xl md:text-5xl font-black gradient-text font-display">৳{getCartTotal().toFixed(2)}</span>
                </div>
                <button onClick={() => { setShowCart(false); setShowCheckout(true); }} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white py-4 md:py-6 rounded-2xl font-bold text-lg md:text-xl transition-all duration-200 transform hover:scale-105 border border-green-500/50 neon-glow-strong mb-3 md:mb-4">
                  Proceed to Checkout 💳
                </button>
                <button onClick={() => setCart([])} className="w-full glass text-red-400 py-3 md:py-5 rounded-2xl font-bold transition-all duration-200 border border-red-500/30 hover:bg-red-500/10 text-sm md:text-base">
                  Clear Cart 🗑️
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-2 md:p-4" onClick={() => setShowCheckout(false)}>
          <div className="glass rounded-2xl md:rounded-3xl w-full max-w-2xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto border border-white/20 neon-glow" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-orange-600 to-red-600 p-6 md:p-8 sticky top-0 z-10 rounded-t-2xl md:rounded-t-3xl border-b border-white/10">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl md:text-4xl font-black text-white font-display">Checkout</h2>
                <button onClick={() => setShowCheckout(false)} className="text-3xl md:text-4xl text-white hover:rotate-90 transition-transform duration-300 glass w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center border border-white/20">✕</button>
              </div>
            </div>

            <div className="p-5 md:p-8 border-b border-white/10">
              <h3 className="text-xl md:text-2xl font-bold text-white mb-3 md:mb-4 font-display">Order Summary</h3>
              <div className="space-y-2 md:space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-gray-300 text-sm md:text-base">
                    <span>{item.quantity}x {item.name}</span>
                    <span className="font-bold gradient-text">৳{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mt-4 md:mt-6 pt-4 md:pt-6 border-t border-white/10">
                <span className="text-xl md:text-2xl font-bold text-white font-display">Total:</span>
                <span className="text-2xl md:text-3xl font-black gradient-text font-display">৳{getCartTotal().toFixed(2)}</span>
              </div>
            </div>

            <form onSubmit={handleOrderSubmit} className="p-5 md:p-8">
              <h3 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6 font-display">Delivery Details</h3>
              <div className="space-y-4 md:space-y-5 mb-6 md:mb-8">
                <div>
                  <label className="block text-gray-300 text-sm md:text-base font-semibold mb-2">Full Name *</label>
                  <input type="text" name="name" value={orderDetails.name} onChange={handleInputChange} className="w-full glass border border-white/20 rounded-xl px-4 md:px-5 py-3 md:py-4 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-all text-sm md:text-base" placeholder="Enter your full name" />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm md:text-base font-semibold mb-2">Phone Number *</label>
                  <input type="tel" name="phone" value={orderDetails.phone} onChange={handleInputChange} className="w-full glass border border-white/20 rounded-xl px-4 md:px-5 py-3 md:py-4 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-all text-sm md:text-base" placeholder="e.g. 01711-222333" />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm md:text-base font-semibold mb-2">Delivery Address *</label>
                  <textarea name="address" value={orderDetails.address} onChange={handleInputChange} rows="3" className="w-full glass border border-white/20 rounded-xl px-4 md:px-5 py-3 md:py-4 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-all resize-none text-sm md:text-base" placeholder="Enter your complete delivery address" />
                </div>
              </div>

              <h3 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6 font-display">Payment Method</h3>
              <div className="space-y-3 md:space-y-4">
                
                <div 
                  onClick={() => setOrderDetails({ ...orderDetails, paymentMethod: 'cod' })}
                  className={`cursor-pointer rounded-xl p-4 md:p-5 border transition-all ${orderDetails.paymentMethod === 'cod' ? 'glass border-green-500/80 bg-green-500/10' : 'border-gray-700/50 opacity-60 hover:opacity-100'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 md:space-x-4">
                      <span className="text-2xl md:text-3xl">💵</span>
                      <div>
                        <p className="text-white font-bold text-base md:text-lg">Cash on Delivery</p>
                        <p className="text-gray-400 text-xs md:text-sm">Pay when you receive your order</p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full border-2 flex items-center justify-center ${orderDetails.paymentMethod === 'cod' ? 'border-green-500' : 'border-gray-500'}`}>
                      {orderDetails.paymentMethod === 'cod' && <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-green-500 rounded-full"></div>}
                    </div>
                  </div>
                </div>

                <div 
                  onClick={() => setOrderDetails({ ...orderDetails, paymentMethod: 'bkash' })}
                  className={`cursor-pointer rounded-xl p-4 md:p-5 border transition-all ${orderDetails.paymentMethod === 'bkash' ? 'glass border-pink-500/80 bg-pink-500/10' : 'border-gray-700/50 opacity-60 hover:opacity-100'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 md:space-x-4">
                      <span className="text-2xl md:text-3xl">🦅</span>
                      <div>
                        <p className="text-pink-400 font-bold text-base md:text-lg">bKash Payment</p>
                        <p className="text-gray-400 text-xs md:text-sm">Pay securely via bKash App</p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full border-2 flex items-center justify-center ${orderDetails.paymentMethod === 'bkash' ? 'border-pink-500' : 'border-gray-500'}`}>
                      {orderDetails.paymentMethod === 'bkash' && <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-pink-500 rounded-full"></div>}
                    </div>
                  </div>

                  {orderDetails.paymentMethod === 'bkash' && (
                    <div className="mt-4 md:mt-5 pt-4 md:pt-5 border-t border-pink-500/30 animate-fadeIn">
                      <div className="bg-black/40 rounded-lg p-3 md:p-4 mb-3 md:mb-4 text-center">
                        <p className="text-gray-300 text-xs md:text-sm mb-1">Send exactly <strong className="text-white">৳{getCartTotal().toFixed(2)}</strong> to:</p>
                        <p className="text-pink-400 text-xl md:text-2xl font-black font-display tracking-widest">017XX-XXXXXX</p>
                      </div>
                      
                      <label className="block text-gray-300 text-sm md:text-base font-semibold mb-2">bKash TrxID *</label>
                      <input 
                        type="text" 
                        name="trxId" 
                        value={orderDetails.trxId} 
                        onChange={handleInputChange} 
                        className="w-full bg-black/50 border border-pink-500/50 rounded-xl px-4 md:px-5 py-3 md:py-4 text-white placeholder-gray-500 focus:outline-none focus:border-pink-400 transition-all font-mono uppercase text-sm md:text-base" 
                        placeholder="e.g. 8N4B6F9A2" 
                      />
                    </div>
                  )}
                </div>
              </div>

              {checkoutError && (
                <div className="mt-4 md:mt-6 bg-red-500/20 border border-red-500/50 rounded-xl p-3 md:p-4 text-center animate-fadeIn">
                  <p className="text-red-400 font-bold text-sm md:text-base">⚠️ {checkoutError}</p>
                </div>
              )}

              <button 
                type="submit" 
                disabled={isSubmitting}
                className={`w-full mt-4 md:mt-6 py-4 md:py-6 rounded-2xl font-bold text-lg md:text-xl transition-all duration-200 transform border neon-glow-strong ${
                  isSubmitting 
                    ? 'bg-gray-600 border-gray-500 text-gray-300 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white hover:scale-105 border-green-500/50'
                }`}
              >
                {isSubmitting ? 'Processing...' : 'Place Order 🎉'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Live Tracking Order Confirmation */}
      {orderSubmitted && currentOrder && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[70] flex items-center justify-center p-2 md:p-4">
          <div className="glass rounded-2xl md:rounded-3xl w-full max-w-2xl border border-white/20 neon-glow-strong animate-fadeIn max-h-[95vh] md:max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 md:p-10 rounded-t-2xl md:rounded-t-3xl text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-white/10 animate-pulse"></div>
              <div className="text-5xl md:text-7xl mb-3 md:mb-4 animate-float relative z-10">
                {liveOrderStatus === 'completed' ? '🎉' : '👨‍🍳'}
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-white mb-2 md:mb-3 font-display relative z-10 leading-tight">
                {liveOrderStatus === 'completed' ? 'Enjoy your meal!' : 'Order Confirmed!'}
              </h2>
              <p className="text-green-100 text-base md:text-xl font-bold relative z-10">
                Order <span className="text-white">#{currentOrder.id.substring(0,8)}</span>
              </p>
            </div>
            
            <div className="p-4 md:p-8">
              
              <div className="glass border border-white/10 rounded-2xl p-4 md:p-8 mb-5 md:mb-8 relative overflow-hidden">
                <h3 className="text-sm md:text-xl font-bold text-white mb-4 md:mb-6 font-display text-center uppercase tracking-widest text-orange-400">Live Order Status</h3>
                
                <div className="relative mb-2">
                  <div className="flex justify-between text-[10px] sm:text-xs md:text-sm font-bold mb-2 md:mb-3 relative z-10">
                    <span className={`${['pending', 'preparing', 'delivering', 'completed'].includes(liveOrderStatus) ? 'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]' : 'text-gray-600'} transition-colors duration-500`}>RECEIVED</span>
                    <span className={`${['preparing', 'delivering', 'completed'].includes(liveOrderStatus) ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]' : 'text-gray-600'} transition-colors duration-500`}>PREP</span>
                    <span className={`${['delivering', 'completed'].includes(liveOrderStatus) ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]' : 'text-gray-600'} transition-colors duration-500`}>DELIVERY</span>
                    <span className={`${liveOrderStatus === 'completed' ? 'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]' : 'text-gray-600'} transition-colors duration-500`}>DONE</span>
                  </div>
                  
                  <div className="h-2 md:h-3 bg-gray-800 rounded-full overflow-hidden flex relative z-10 border border-black">
                    <div className={`h-full transition-all duration-1000 ease-out bg-green-500 w-1/4`}></div>
                    <div className={`h-full transition-all duration-1000 ease-out bg-yellow-500 ${['preparing', 'delivering', 'completed'].includes(liveOrderStatus) ? 'w-1/4' : 'w-0'}`}></div>
                    <div className={`h-full transition-all duration-1000 ease-out bg-blue-500 ${['delivering', 'completed'].includes(liveOrderStatus) ? 'w-1/4' : 'w-0'}`}></div>
                    <div className={`h-full transition-all duration-1000 ease-out bg-green-500 ${liveOrderStatus === 'completed' ? 'w-1/4' : 'w-0'}`}></div>
                  </div>
                </div>
              </div>

              <div className="glass border border-white/10 rounded-2xl p-5 md:p-6 mb-5 md:mb-6">
                <h3 className="text-lg md:text-xl font-bold text-white mb-3 md:mb-4 font-display">Items Ordered</h3>
                <div className="space-y-2 md:space-y-3">
                  {currentOrder.items.map(item => (
                    <div key={item.id} className="flex justify-between items-center text-gray-300 border-b border-white/5 pb-2 text-sm md:text-base">
                      <span><span className="text-orange-400 font-bold">{item.quantity}x</span> {item.name}</span>
                      <span className="font-bold text-white">৳{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-3 md:mt-4 pt-3 md:pt-4">
                  <span className="text-base md:text-lg font-bold text-gray-400 uppercase tracking-wider">Total</span>
                  <span className="text-2xl md:text-3xl font-black gradient-text font-display">৳{currentOrder.total.toFixed(2)}</span>
                </div>
              </div>
              
              <button onClick={() => setOrderSubmitted(false)} className="w-full glass hover:bg-white/10 text-white py-4 md:py-5 rounded-2xl font-bold text-base md:text-lg transition-all duration-200 border border-white/20">
                Return to Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN DASHBOARD RENDER */}
      {currentPage === 'admin' && (
        <div className="fixed inset-0 z-[100] bg-black overflow-y-auto">
          <AdminDashboard />
          <button 
            onClick={() => setCurrentPage('home')} 
            className="absolute top-4 right-4 md:top-6 md:right-6 text-white font-bold bg-red-600/50 hover:bg-red-600 px-4 py-2 md:px-6 md:py-3 rounded-xl transition-all z-[110] text-sm md:text-base"
          >
            Close ✕
          </button>
        </div>
      )}

    </div>
  );
}

export default App;